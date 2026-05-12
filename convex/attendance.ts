import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";
import { isAdmin as checkIsAdmin, hasRole, buildUserName } from "./users.js";
import { internal } from "./_generated/api.js";

// List attendance records
export const listAttendance = query({
  args: {
    studentId: v.optional(v.id("students")),
    classId: v.optional(v.id("classes")),
    date: v.optional(v.number()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    let attendance;
    if (args.studentId) {
      attendance = await ctx.db
        .query("attendance")
        .withIndex("by_student", (q) => q.eq("studentId", args.studentId!))
        .collect();
    } else if (args.classId) {
      attendance = await ctx.db
        .query("attendance")
        .withIndex("by_class", (q) => q.eq("classId", args.classId!))
        .collect();
    } else if (args.date) {
      attendance = await ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.eq("date", args.date!))
        .collect();
    } else {
      // OPTIMIZED: Default to last 3 months instead of full table scan
      const threeMonthsAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
      attendance = await ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.gte("date", threeMonthsAgo))
        .collect();
    }

    // Filter by date range if provided
    if (args.startDate && args.endDate) {
      attendance = attendance.filter(
        (a) => a.date >= args.startDate! && a.date <= args.endDate!
      );
    }

    // Enrich with student, subject, teacher names
    const enrichedAttendance = await Promise.all(
      attendance.map(async (record) => {
        const student = await ctx.db.get(record.studentId);
        const studentUser = student ? await ctx.db.get(student.userId) : null;
        const subject = await ctx.db.get(record.subjectId);
        const teacher = await ctx.db.get(record.teacherId);
        const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;

        return {
          ...record,
          studentName: studentUser?.name,
          subjectName: subject?.name,
          teacherName: teacherUser?.name,
        };
      })
    );

    return enrichedAttendance;
  },
});

// Get attendance records for a class on a specific date (for add form pre-population)
export const getAttendanceForClassDate = query({
  args: {
    classId: v.id("classes"),
    date: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Get all attendance records for this class
    const classAttendance = await ctx.db
      .query("attendance")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Filter to only the specific date (normalize to same day)
    const targetDateStart = new Date(args.date);
    targetDateStart.setHours(0, 0, 0, 0);
    const targetDateEnd = new Date(args.date);
    targetDateEnd.setHours(23, 59, 59, 999);

    const dateAttendance = classAttendance.filter(
      (a) => a.date >= targetDateStart.getTime() && a.date <= targetDateEnd.getTime()
    );

    // Enrich with subject name and student info
    const enriched = await Promise.all(
      dateAttendance.map(async (record) => {
        const subject = await ctx.db.get(record.subjectId);
        return {
          _id: record._id,
          studentId: record.studentId,
          subjectId: record.subjectId,
          teacherId: record.teacherId,
          period: record.period,
          status: record.status,
          notes: record.notes,
          subjectName: subject?.name || "Неизвестен",
        };
      })
    );

    return enriched;
  },
});

// Create attendance record
export const createAttendance = mutation({
  args: {
    studentId: v.id("students"),
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    teacherId: v.id("teachers"),
    date: v.number(),
    period: v.number(),
    status: v.union(
      v.literal("present"),
      v.literal("absent"),
      v.literal("late"),
      v.literal("excused")
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"attendance">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // ✅ SECURITY FIX: Authorization check
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not found",
      });
    }

    const isAdminUser = checkIsAdmin(currentUser);

    // Admins can do anything - skip all checks
    if (!isAdminUser) {
      if (hasRole(currentUser, "teacher")) {
        // Verify teacher teaches this subject in this class
        const teacher = await ctx.db
          .query("teachers")
          .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
          .first();

        if (!teacher) {
          throw new ConvexError({
            code: "FORBIDDEN",
            message: "Not authorized as a teacher",
          });
        }

        // Check if teacher is assigned to teach this subject in this class
        const classSubject = await ctx.db
          .query("classSubjects")
          .withIndex("by_class", (q) => q.eq("classId", args.classId))
          .filter((q) => 
            q.and(
              q.eq(q.field("subjectId"), args.subjectId),
              q.eq(q.field("teacherId"), teacher._id)
            )
          )
          .first();

        if (!classSubject) {
          throw new ConvexError({
            code: "FORBIDDEN",
            message: "Нямате право да отбелязвате присъствие на този клас/предмет",
          });
        }
      } else {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Само учители и администратори могат да отбелязват присъствие",
        });
      }
    }

    // ✅ PLATFORM SETTINGS: Check if diary is locked for this date
    const student = await ctx.db.get(args.studentId);
    if (student?.schoolId && !isAdminUser) {
      const lockCheck = await ctx.runQuery(internal.platformSettings.checkDiaryLock, {
        schoolId: student.schoolId,
        userId: currentUser._id,
        targetDate: args.date,
      });
      if (lockCheck.isLocked) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: lockCheck.message || "Дневникът е заключен за тази дата",
        });
      }
    }

    const attendanceId = await ctx.db.insert("attendance", args);

    // Create notification for student
    const studentForNotification = student ?? await ctx.db.get(args.studentId);
    if (studentForNotification) {
      const subject = await ctx.db.get(args.subjectId);
      const teacher = await ctx.db.get(args.teacherId);
      const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;
      const studentUser = await ctx.db.get(studentForNotification.userId);
      
      let notificationType: "new_absence" | "new_late" | "new_excused";
      let statusText: string;
      
      if (args.status === "absent") {
        notificationType = "new_absence";
        statusText = "неизвинено отсъствие";
      } else if (args.status === "late") {
        notificationType = "new_late";
        statusText = "закъснение";
      } else if (args.status === "excused") {
        notificationType = "new_excused";
        statusText = "извинено отсъствие";
      } else {
        // Don't notify for "present"
        return attendanceId;
      }

      const teacherName = teacherUser
        ? [teacherUser.firstName, teacherUser.lastName].filter(Boolean).join(" ")
        : "Учител";

      await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
        userId: studentForNotification.userId,
        type: notificationType,
        title: `Ново отсъствие`,
        message: `${teacherName} отбеляза ${statusText} по ${subject?.name || "предмет"} на ${new Date(args.date).toLocaleDateString("bg-BG")}`,
        relatedEntityType: "attendance",
        relatedEntityId: attendanceId,
        actionUrl: `/bg/diary/class/${args.classId}/absences`,
      });

      // ✅ PARENT NOTIFICATION: Notify parent(s) about new absence/late
      // OPTIMIZED: Query parents by school instead of full table scan
      const parentRecords = studentForNotification.schoolId
        ? await ctx.db
            .query("parents")
            .withIndex("by_school", (q) => q.eq("schoolId", studentForNotification.schoolId!))
            .collect()
        : await ctx.db.query("parents").collect();
      
      // Find parents that have this student in their studentIds array
      const studentParents = parentRecords.filter(
        p => p.studentIds && p.studentIds.includes(studentForNotification._id)
      );

      const studentName = studentUser 
        ? [studentUser.firstName, studentUser.lastName].filter(Boolean).join(" ")
        : "Вашето дете";

      for (const parent of studentParents) {
        await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
          userId: parent.userId,
          type: notificationType,
          title: `Ново отсъствие за ${studentName}`,
          message: `${studentName} има ${statusText} по ${subject?.name || "предмет"} на ${new Date(args.date).toLocaleDateString("bg-BG")}`,
          relatedEntityType: "attendance",
          relatedEntityId: attendanceId,
          actionUrl: `/bg/profile/${studentForNotification.userId}`,
          schoolId: studentForNotification.schoolId,
        });
      }
    }

    return attendanceId;
  },
});

// Update attendance
export const updateAttendance = mutation({
  args: {
    id: v.id("attendance"),
    status: v.optional(v.union(
      v.literal("present"),
      v.literal("absent"),
      v.literal("late"),
      v.literal("excused")
    )),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // ✅ SECURITY FIX: Authorization check
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not found",
      });
    }

    const attendance = await ctx.db.get(args.id);
    if (!attendance) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Attendance record not found",
      });
    }

    const isAdminUser = checkIsAdmin(currentUser);

    // Admins can do anything - skip all checks
    if (!isAdminUser) {
      if (hasRole(currentUser, "teacher")) {
        const teacher = await ctx.db
          .query("teachers")
          .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
          .first();

        if (!teacher) {
          throw new ConvexError({
            code: "FORBIDDEN",
            message: "Not authorized as a teacher",
          });
        }

        // Check if this teacher created the attendance record
        if (attendance.teacherId !== teacher._id) {
          throw new ConvexError({
            code: "FORBIDDEN",
            message: "Можете да редактирате само свои записи за присъствие",
          });
        }
      } else {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Само учители и администратори могат да редактират присъствие",
        });
      }
    }

    // ✅ PLATFORM SETTINGS: Check if diary is locked for this date
    const student = await ctx.db.get(attendance.studentId);
    if (student?.schoolId && !isAdminUser) {
      const lockCheck = await ctx.runQuery(internal.platformSettings.checkDiaryLock, {
        schoolId: student.schoolId,
        userId: currentUser._id,
        targetDate: attendance.date,
      });
      if (lockCheck.isLocked) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: lockCheck.message || "Дневникът е заключен за тази дата",
        });
      }
    }

    // ✅ PARENT NOTIFICATION: Notify parent when absence is excused
    const previousStatus = attendance.status;
    const newStatus = args.status;
    
    if (newStatus === "excused" && previousStatus !== "excused" && student) {
      const studentUser = await ctx.db.get(student.userId);
      const subject = await ctx.db.get(attendance.subjectId);
      
      const studentName = studentUser 
        ? [studentUser.firstName, studentUser.lastName].filter(Boolean).join(" ")
        : "Вашето дете";

      // Find parents of this student
      // OPTIMIZED: Query parents by school instead of full table scan
      const parentRecords2 = student.schoolId
        ? await ctx.db
            .query("parents")
            .withIndex("by_school", (q) => q.eq("schoolId", student.schoolId!))
            .collect()
        : await ctx.db.query("parents").collect();
      const studentParents = parentRecords2.filter(
        p => p.studentIds && p.studentIds.includes(student._id)
      );

      for (const parent of studentParents) {
        await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
          userId: parent.userId,
          type: "new_excused",
          title: `Извинено отсъствие за ${studentName}`,
          message: `Отсъствието на ${studentName} по ${subject?.name || "предмет"} от ${new Date(attendance.date).toLocaleDateString("bg-BG")} е извинено.`,
          relatedEntityType: "attendance",
          relatedEntityId: args.id,
          actionUrl: `/bg/profile/${student.userId}`,
          schoolId: student.schoolId,
        });
      }
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

// Bulk create attendance (for entire class)
export const bulkCreateAttendance = mutation({
  args: {
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    teacherId: v.id("teachers"),
    date: v.number(),
    period: v.number(),
    studentStatuses: v.array(
      v.object({
        studentId: v.id("students"),
        status: v.union(
          v.literal("present"),
          v.literal("absent"),
          v.literal("late"),
          v.literal("excused")
        ),
        notes: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args): Promise<Array<Id<"attendance">>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // ✅ SECURITY FIX: Authorization check
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not found",
      });
    }

    const isAdminUser = checkIsAdmin(currentUser);

    // Admins can do anything - skip all checks
    if (!isAdminUser) {
      if (hasRole(currentUser, "teacher")) {
        const teacher = await ctx.db
          .query("teachers")
          .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
          .first();

        if (!teacher) {
          throw new ConvexError({
            code: "FORBIDDEN",
            message: "Not authorized as a teacher",
          });
        }

        // Check if teacher is assigned to teach this subject in this class
        const classSubject = await ctx.db
          .query("classSubjects")
          .withIndex("by_class", (q) => q.eq("classId", args.classId))
          .filter((q) => 
            q.and(
              q.eq(q.field("subjectId"), args.subjectId),
              q.eq(q.field("teacherId"), teacher._id)
            )
          )
          .first();

        if (!classSubject) {
          throw new ConvexError({
            code: "FORBIDDEN",
            message: "Нямате право да отбелязвате присъствие на този клас/предмет",
          });
        }
      } else {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Само учители и администратори могат да отбелязват присъствие",
        });
      }
    }

    const { studentStatuses, ...commonData } = args;

    const attendanceIds = await Promise.all(
      studentStatuses.map((studentStatus) =>
        ctx.db.insert("attendance", {
          ...commonData,
          studentId: studentStatus.studentId,
          status: studentStatus.status,
          notes: studentStatus.notes,
        })
      )
    );

    return attendanceIds;
  },
});

// Get class absences summary by student
export const getClassAbsencesSummary = query({
  args: {
    classId: v.id("classes"),
  },
  handler: async (ctx, args): Promise<Array<{
    studentId: Id<"students">;
    studentName: string;
    studentUserId: Id<"users">;
    lateCount: number;
    unexcusedCount: number;
    totalUnexcused: number;
    totalExcused: number;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Get all students in the class
    const students = await ctx.db
      .query("students")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Get all attendance records for this class
    const allAttendance = await ctx.db
      .query("attendance")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Calculate stats per student
    const results = await Promise.all(
      students.map(async (student) => {
        const studentUser = await ctx.db.get(student.userId);
        
        // Filter out Unknown or invalid users
        const userName = buildUserName(studentUser);
        if (!studentUser || userName === "Unknown" || !studentUser.firstName) {
          return null;
        }
        
        const studentAttendance = allAttendance.filter(
          (a) => a.studentId === student._id
        );

        const lateCount = studentAttendance.filter(
          (a) => a.status === "late"
        ).length;
        const unexcusedCount = studentAttendance.filter(
          (a) => a.status === "absent"
        ).length;
        const excusedCount = studentAttendance.filter(
          (a) => a.status === "excused"
        ).length;

        // Total unexcused = full absences + (late * 0.5)
        const totalUnexcused = unexcusedCount + (lateCount * 0.5);

        return {
          studentId: student._id,
          studentName: userName,
          studentUserId: student.userId,
          lateCount,
          unexcusedCount,
          totalUnexcused,
          totalExcused: excusedCount,
        };
      })
    );

    // Filter out null entries (Unknown users)
    const validResults = results.filter((r): r is NonNullable<typeof r> => r !== null);
    
    // Sort alphabetically by student name for consistent numbering
    return validResults.sort((a, b) => a.studentName.localeCompare(b.studentName, "bg"));
  },
});

// Delete attendance record (for late arrivals)
export const deleteAttendance = mutation({
  args: {
    id: v.id("attendance"),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not found",
      });
    }

    const attendance = await ctx.db.get(args.id);
    if (!attendance) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Attendance record not found",
      });
    }

    const isAdminUser = checkIsAdmin(currentUser);

    // ✅ PLATFORM SETTINGS: Check strict mode for deletion
    const studentForStrictCheck = await ctx.db.get(attendance.studentId);
    if (studentForStrictCheck?.schoolId) {
      const strictModeCheck = await ctx.runQuery(internal.platformSettings.checkStrictModeDelete, {
        schoolId: studentForStrictCheck.schoolId,
        userId: currentUser._id,
        entityType: "absence",
      });
      if (strictModeCheck.isBlocked) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: strictModeCheck.message || "Стриктен режим: Само администратори могат да изтриват отсъствия.",
        });
      }
    }

    // Admins can delete anything
    if (!isAdminUser) {
      if (hasRole(currentUser, "teacher")) {
        const teacher = await ctx.db
          .query("teachers")
          .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
          .first();

        if (!teacher) {
          throw new ConvexError({
            code: "FORBIDDEN",
            message: "Not authorized as a teacher",
          });
        }

        // Check if this teacher created the attendance record
        if (attendance.teacherId !== teacher._id) {
          throw new ConvexError({
            code: "FORBIDDEN",
            message: "Можете да изтривате само свои записи за присъствие",
          });
        }
      } else {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Само учители и администратори могат да изтриват присъствие",
        });
      }
    }

    // ✅ PLATFORM SETTINGS: Check if diary is locked for this date
    const student = await ctx.db.get(attendance.studentId);
    if (student?.schoolId && !isAdminUser) {
      const lockCheck = await ctx.runQuery(internal.platformSettings.checkDiaryLock, {
        schoolId: student.schoolId,
        userId: currentUser._id,
        targetDate: attendance.date,
      });
      if (lockCheck.isLocked) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: lockCheck.message || "Дневникът е заключен за тази дата",
        });
      }
    }

    // Get student and subject info for notification
    const studentUser = student ? await ctx.db.get(student.userId) : null;
    const studentName = studentUser 
      ? [studentUser.firstName, studentUser.lastName].filter(Boolean).join(" ")
      : "Ученик";
    const subject = await ctx.db.get(attendance.subjectId);

    await ctx.db.delete(args.id);

    // ✅ PLATFORM SETTINGS: Notify admins about deletion
    if (student?.schoolId) {
      const statusLabels: Record<string, string> = {
        absent: "неизвинено отсъствие",
        late: "закъснение",
        excused: "извинено отсъствие",
        present: "присъствие",
      };
      await ctx.scheduler.runAfter(0, internal.platformSettings.notifyAdminsOnDelete, {
        schoolId: student.schoolId,
        deletedByUserId: currentUser._id,
        entityType: "absence",
        entityDetails: `${studentName} - ${subject?.name || "предмет"}: ${statusLabels[attendance.status] || attendance.status}`,
        studentId: attendance.studentId,
      });
    }
  },
});

// Get attendance statistics
export const getAttendanceStatistics = query({
  args: {
    classId: v.optional(v.id("classes")),
    studentId: v.optional(v.id("students")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    let attendance;
    if (args.classId) {
      attendance = await ctx.db
        .query("attendance")
        .withIndex("by_class", (q) => q.eq("classId", args.classId!))
        .collect();
    } else if (args.studentId) {
      attendance = await ctx.db
        .query("attendance")
        .withIndex("by_student", (q) => q.eq("studentId", args.studentId!))
        .collect();
    } else {
      // OPTIMIZED: Default to last 3 months instead of full table scan
      const threeMonthsAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
      attendance = await ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.gte("date", threeMonthsAgo))
        .collect();
    }

    // Filter by date range
    if (args.startDate && args.endDate) {
      attendance = attendance.filter(
        (a) => a.date >= args.startDate! && a.date <= args.endDate!
      );
    }

    const total = attendance.length;
    const present = attendance.filter((a) => a.status === "present").length;
    const absent = attendance.filter((a) => a.status === "absent").length;
    const late = attendance.filter((a) => a.status === "late").length;
    const excused = attendance.filter((a) => a.status === "excused").length;

    return {
      total,
      present,
      absent,
      late,
      excused,
      attendanceRate: total > 0 ? (present / total) * 100 : 0,
    };
  },
});

// Excuse absence with note type (supports auto-excuse settings)
export const excuseAbsenceWithNote = mutation({
  args: {
    attendanceId: v.id("attendance"),
    noteType: v.union(v.literal("medical"), v.literal("parent"), v.literal("other")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ excused: boolean; autoExcused: boolean; message: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not found",
      });
    }

    const attendance = await ctx.db.get(args.attendanceId);
    if (!attendance) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Записът за присъствие не е намерен",
      });
    }

    // Get student's school to check settings
    const student = await ctx.db.get(attendance.studentId);
    if (!student?.schoolId) {
      // No school, just update manually
      await ctx.db.patch(args.attendanceId, {
        status: "excused",
        notes: args.notes,
      });
      return { excused: true, autoExcused: false, message: "Отсъствието е уважено" };
    }

    // ✅ PLATFORM SETTINGS: Check if auto-excuse is enabled for this note type
    const autoExcuseEnabled = await ctx.runQuery(internal.platformSettings.checkAutoExcuse, {
      schoolId: student.schoolId,
      noteType: args.noteType,
    });

    // Note type labels for Bulgarian messages
    const noteTypeLabels = {
      medical: "медицинска бележка",
      parent: "родителска бележка",
      other: "друга причина",
    };

    // Helper function to send parent notifications
    const sendParentNotification = async () => {
      if (attendance.status === "excused") return; // Already excused, no need to notify
      
      const studentUser = await ctx.db.get(student.userId);
      const subject = await ctx.db.get(attendance.subjectId);
      
      const studentName = studentUser 
        ? [studentUser.firstName, studentUser.lastName].filter(Boolean).join(" ")
        : "Вашето дете";

      // Find parents of this student
      // OPTIMIZED: Query parents by school instead of full table scan
      const parentRecords = student.schoolId
        ? await ctx.db
            .query("parents")
            .withIndex("by_school", (q) => q.eq("schoolId", student.schoolId!))
            .collect()
        : await ctx.db.query("parents").collect();
      const studentParents = parentRecords.filter(
        p => p.studentIds && p.studentIds.includes(student._id)
      );

      for (const parent of studentParents) {
        await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
          userId: parent.userId,
          type: "new_excused",
          title: `Извинено отсъствие за ${studentName}`,
          message: `Отсъствието на ${studentName} по ${subject?.name || "предмет"} от ${new Date(attendance.date).toLocaleDateString("bg-BG")} е извинено с ${noteTypeLabels[args.noteType]}.`,
          relatedEntityType: "attendance",
          relatedEntityId: args.attendanceId,
          actionUrl: `/bg/profile/${student.userId}`,
          schoolId: student.schoolId,
        });
      }
    };

    if (autoExcuseEnabled) {
      // Auto-excuse is enabled - automatically change status to excused
      await sendParentNotification();
      await ctx.db.patch(args.attendanceId, {
        status: "excused",
        notes: args.notes || `Уважено автоматично с ${noteTypeLabels[args.noteType]}`,
      });
      return {
        excused: true,
        autoExcused: true,
        message: `Отсъствието е уважено автоматично (${noteTypeLabels[args.noteType]})`,
      };
    } else {
      // Auto-excuse is disabled - just add the note without changing status
      await ctx.db.patch(args.attendanceId, {
        notes: args.notes || `${noteTypeLabels[args.noteType]}`,
      });
      return {
        excused: false,
        autoExcused: false,
        message: `Бележката е добавена. Автоматичното уважаване за ${noteTypeLabels[args.noteType]} е изключено.`,
      };
    }
  },
});
