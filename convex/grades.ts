import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";
import { isAdmin as checkIsAdmin, hasRole } from "./users.js";
import { internal } from "./_generated/api.js";

// Get grades by student's user ID (for parents viewing child data)
export const getGradesByStudentUserId = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Find the student record for this user
    const student = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!student) {
      return {
        grades: [],
        stats: {
          averageGrade: 0,
          totalGrades: 0,
        },
      };
    }

    // Get grades for this student
    const grades = await ctx.db
      .query("grades")
      .withIndex("by_student", (q) => q.eq("studentId", student._id))
      .collect();

    // Calculate statistics
    const numericGrades = grades
      .filter((g) => typeof g.value === "number")
      .map((g) => g.value as number);

    const averageGrade = numericGrades.length > 0
      ? numericGrades.reduce((sum, g) => sum + g, 0) / numericGrades.length
      : 0;

    // Enrich grades with subject names
    const enrichedGrades = await Promise.all(
      grades.map(async (grade) => {
        const subject = await ctx.db.get(grade.subjectId);
        const teacher = await ctx.db.get(grade.teacherId);
        const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;

        return {
          ...grade,
          subjectName: subject?.name || "Непознат предмет",
          teacherName: teacherUser?.firstName && teacherUser?.lastName
            ? `${teacherUser.firstName} ${teacherUser.lastName}`
            : "Непознат учител",
        };
      })
    );

    return {
      grades: enrichedGrades.sort((a, b) => b.date - a.date),
      stats: {
        averageGrade: Number(averageGrade.toFixed(2)),
        totalGrades: numericGrades.length,
      },
    };
  },
});

// List grades with filters
export const listGrades = query({
  args: {
    studentId: v.optional(v.id("students")),
    classId: v.optional(v.id("classes")),
    subjectId: v.optional(v.id("subjects")),
    teacherId: v.optional(v.id("teachers")),
    termId: v.optional(v.id("terms")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    let grades;
    if (args.studentId) {
      grades = await ctx.db
        .query("grades")
        .withIndex("by_student", (q) => q.eq("studentId", args.studentId!))
        .collect();
    } else if (args.classId) {
      grades = await ctx.db
        .query("grades")
        .withIndex("by_class", (q) => q.eq("classId", args.classId!))
        .collect();
    } else if (args.subjectId) {
      grades = await ctx.db
        .query("grades")
        .withIndex("by_subject", (q) => q.eq("subjectId", args.subjectId!))
        .collect();
    } else if (args.teacherId) {
      grades = await ctx.db
        .query("grades")
        .withIndex("by_teacher", (q) => q.eq("teacherId", args.teacherId!))
        .collect();
    } else {
      // OPTIMIZED: Default to last 6 months instead of full table scan
      const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
      grades = await ctx.db
        .query("grades")
        .withIndex("by_date", (q) => q.gte("date", sixMonthsAgo))
        .collect();
    }

    // Apply additional filters
    if (args.termId) {
      grades = grades.filter((g) => g.termId === args.termId);
    }

    // Enrich with student, subject, teacher names
    const enrichedGrades = await Promise.all(
      grades.map(async (grade) => {
        const student = await ctx.db.get(grade.studentId);
        const studentUser = student ? await ctx.db.get(student.userId) : null;
        const subject = await ctx.db.get(grade.subjectId);
        const teacher = await ctx.db.get(grade.teacherId);
        const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;

        return {
          ...grade,
          studentName: studentUser?.name,
          subjectName: subject?.name,
          teacherName: teacherUser?.name,
        };
      })
    );

    return enrichedGrades;
  },
});

// Create a new grade
export const createGrade = mutation({
  args: {
    studentId: v.id("students"),
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    teacherId: v.id("teachers"),
    value: v.union(v.number(), v.literal("absent")),
    type: v.union(
      v.literal("current"),
      v.literal("term"),
      v.literal("final")
    ),
    date: v.number(),
    notes: v.optional(v.string()),
    termId: v.optional(v.id("terms")),
  },
  handler: async (ctx, args): Promise<Id<"grades">> => {
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

    // Only teachers and admins can create grades
    const isAdminUser = checkIsAdmin(currentUser);

    // Admins can create grades for any class/subject
    if (!isAdminUser) {
      if (hasRole(currentUser, "teacher") || hasRole(currentUser, "class_teacher")) {
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
        // First check classSubjects table
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

        // If not found in classSubjects, also check weekly schedules as fallback
        if (!classSubject) {
          const schedules = await ctx.db
            .query("weeklySchedules")
            .withIndex("by_class", (q) => q.eq("classId", args.classId))
            .collect();

          const foundInSchedule = schedules.some(schedule =>
            schedule.entries.some(entry =>
              entry.subjectId === args.subjectId && entry.teacherId === teacher._id
            )
          );

          if (!foundInSchedule) {
            throw new ConvexError({
              code: "FORBIDDEN",
              message: "Нямате право да поставяте оценки на този клас/предмет",
            });
          }
        }
      } else {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Само учители и администратори могат да поставят оценки",
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

    const gradeId = await ctx.db.insert("grades", args);

    // ✅ FIX 3: Audit log
    // student is already fetched above for lock check
    const studentForAudit = student ?? await ctx.db.get(args.studentId);
    const subject = await ctx.db.get(args.subjectId);
    await ctx.db.insert("auditLog", {
      userId: currentUser._id,
      action: "create_grade",
      targetType: "grade",
      targetId: gradeId,
      details: JSON.stringify({
        studentId: args.studentId,
        subjectName: subject?.name,
        value: args.value,
        type: args.type,
      }),
      schoolId: studentForAudit?.schoolId,
    });

    // Create notification for student
    if (studentForAudit) {
      const studentUser = await ctx.db.get(studentForAudit.userId);
      const teacher = await ctx.db.get(args.teacherId);
      const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;
      
      const gradeValue = args.value === "absent" ? "Отсъстващ" : args.value.toString();
      
      await ctx.db.insert("notifications", {
        userId: studentForAudit.userId,
        type: "new_grade",
        title: `Нова оценка по ${subject?.name || "предмет"}`,
        message: `${teacherUser?.firstName || "Учител"} ${teacherUser?.lastName || ""} ви постави оценка ${gradeValue}`,
        isRead: false,
        relatedEntityType: "grade",
        relatedEntityId: gradeId,
        actionUrl: studentUser ? `/bg/diary/class/${args.classId}/grades` : undefined,
        schoolId: studentForAudit.schoolId,
      });

      // PARENT NOTIFICATION: Notify parent(s) about new grade
      // OPTIMIZED: Query parents by school instead of full table scan
      const parentRecords = student?.schoolId
        ? await ctx.db
            .query("parents")
            .withIndex("by_school", (q) => q.eq("schoolId", student.schoolId!))
            .collect()
        : await ctx.db.query("parents").collect();
      
      const studentParents = parentRecords.filter(
        p => p.studentIds && p.studentIds.includes(studentForAudit._id)
      );

      const studentName = studentUser 
        ? [studentUser.firstName, studentUser.lastName].filter(Boolean).join(" ")
        : "Вашето дете";

      for (const parent of studentParents) {
        await ctx.db.insert("notifications", {
          userId: parent.userId,
          type: "new_grade",
          title: `Нова оценка за ${studentName}`,
          message: `${studentName} получи оценка ${gradeValue} по ${subject?.name || "предмет"}`,
          isRead: false,
          relatedEntityType: "grade",
          relatedEntityId: gradeId,
          actionUrl: `/bg/profile/${studentForAudit.userId}`,
          schoolId: studentForAudit.schoolId,
        });
      }
    }

    return gradeId;
  },
});

// Update a grade
export const updateGrade = mutation({
  args: {
    id: v.id("grades"),
    value: v.optional(v.union(v.number(), v.literal("absent"))),
    type: v.optional(v.union(
      v.literal("current"),
      v.literal("term"),
      v.literal("final")
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

    const grade = await ctx.db.get(args.id);
    if (!grade) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Grade not found",
      });
    }

    const isAdminUser = checkIsAdmin(currentUser);

    // Admins can update any grade without restrictions
    if (!isAdminUser) {
      if (hasRole(currentUser, "teacher") || hasRole(currentUser, "class_teacher")) {
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

        // Check if this teacher created the grade
        if (grade.teacherId !== teacher._id) {
          throw new ConvexError({
            code: "FORBIDDEN",
            message: "Можете да редактирате само свои оценки",
          });
        }

        // Check if grade is older than 7 days
        const daysSinceGrade = (Date.now() - grade.date) / (1000 * 60 * 60 * 24);
        if (daysSinceGrade > 7) {
          throw new ConvexError({
            code: "FORBIDDEN",
            message: "Не можете да променяте оценки по-стари от 7 дни",
          });
        }
      } else {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Само учители и администратори могат да редактират оценки",
        });
      }
    }

    // ✅ PLATFORM SETTINGS: Check if diary is locked for this date
    const student = await ctx.db.get(grade.studentId);
    if (student?.schoolId && !isAdminUser) {
      const lockCheck = await ctx.runQuery(internal.platformSettings.checkDiaryLock, {
        schoolId: student.schoolId,
        userId: currentUser._id,
        targetDate: grade.date,
      });
      if (lockCheck.isLocked) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: lockCheck.message || "Дневникът е заключен за тази дата",
        });
      }
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);

    // ✅ FIX 3: Audit log
    const studentForAudit = student ?? await ctx.db.get(grade.studentId);
    const subject = await ctx.db.get(grade.subjectId);
    await ctx.db.insert("auditLog", {
      userId: currentUser._id,
      action: "update_grade",
      targetType: "grade",
      targetId: id,
      details: JSON.stringify({
        studentId: grade.studentId,
        subjectName: subject?.name,
        oldValue: grade.value,
        newValue: updates.value || grade.value,
      }),
      schoolId: studentForAudit?.schoolId,
    });
  },
});

// Delete a grade
export const deleteGrade = mutation({
  args: { 
    id: v.id("grades"),
    reason: v.optional(v.string()), // Required for teachers, optional for admins
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

    const grade = await ctx.db.get(args.id);
    if (!grade) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Grade not found",
      });
    }

    const isAdminUser = checkIsAdmin(currentUser);
    const isTeacher = hasRole(currentUser, "teacher") || hasRole(currentUser, "class_teacher");

    // ✅ PLATFORM SETTINGS: Check strict mode for deletion
    const student = await ctx.db.get(grade.studentId);
    if (student?.schoolId) {
      const strictModeCheck = await ctx.runQuery(internal.platformSettings.checkStrictModeDelete, {
        schoolId: student.schoolId,
        userId: currentUser._id,
        entityType: "grade",
      });
      if (strictModeCheck.isBlocked) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: strictModeCheck.message || "Стриктен режим: Само администратори могат да изтриват оценки.",
        });
      }
    }

    // For teachers (non-admins): create a deletion request instead of deleting
    if (!isAdminUser && isTeacher) {
      if (!args.reason?.trim()) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Причината за изтриване е задължителна",
        });
      }

      // Check if there's already a pending request for this grade
      const existingRequest = await ctx.db
        .query("gradeDeleteRequests")
        .withIndex("by_grade", (q) => q.eq("gradeId", args.id))
        .filter((q) => q.eq(q.field("status"), "pending"))
        .first();

      if (existingRequest) {
        throw new ConvexError({
          code: "CONFLICT",
          message: "Вече има чакаща заявка за изтриване на тази оценка",
        });
      }

      // Get related data for snapshot
      const studentUser = student ? await ctx.db.get(student.userId) : null;
      const classDoc = await ctx.db.get(grade.classId);
      const subject = await ctx.db.get(grade.subjectId);
      const teacher = await ctx.db.get(grade.teacherId);
      const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;

      const studentName = studentUser 
        ? [studentUser.firstName, studentUser.lastName].filter(Boolean).join(" ") || "Неизвестен ученик"
        : "Неизвестен ученик";
      
      const teacherName = teacherUser
        ? [teacherUser.firstName, teacherUser.lastName].filter(Boolean).join(" ") || "Неизвестен учител"
        : "Неизвестен учител";

      const requestId = await ctx.db.insert("gradeDeleteRequests", {
        gradeId: args.id,
        requestedBy: currentUser._id,
        requestedAt: Date.now(),
        reason: args.reason.trim(),
        status: "pending",
        gradeSnapshot: {
          studentId: grade.studentId,
          studentName,
          classId: grade.classId,
          className: classDoc?.name || "Неизвестен клас",
          subjectId: grade.subjectId,
          subjectName: subject?.name || "Неизвестен предмет",
          teacherId: grade.teacherId,
          teacherName,
          value: grade.value,
          gradeType: grade.gradeType,
          date: grade.date,
        },
        schoolId: student?.schoolId || currentUser.schoolId as Id<"schools">,
      });

      // Create notification for admins
      // Get all users and filter those with admin roles
      // OPTIMIZED: Use by_role index for director/admin roles instead of scanning all users
      const directors = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "director")).collect();
      const viceDirectors = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "vice_director")).collect();
      const sysAdmins = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "system_admin")).collect();
      const admins = [...directors, ...viceDirectors, ...sysAdmins];

      const requesterName = [currentUser.firstName, currentUser.lastName].filter(Boolean).join(" ") || "Учител";

      for (const admin of admins) {
        await ctx.db.insert("notifications", {
          userId: admin._id,
          type: "grade_delete_request",
          title: "Заявка за изтриване на оценка",
          message: `${requesterName} поиска изтриване на оценка ${grade.value} по ${subject?.name || "предмет"} за ${studentName}. Причина: ${args.reason}`,
          isRead: false,
          relatedEntityType: "gradeDeleteRequest",
          relatedEntityId: requestId,
          actionUrl: "/bg/admin/requests",
          schoolId: student?.schoolId,
        });
      }

      // Return without deleting - the request was created
      return;
    }

    if (!isAdminUser) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Само администратори могат да изтриват оценки",
      });
    }

    const subject = await ctx.db.get(grade.subjectId);
    
    // Get student user for name
    const studentUser = student ? await ctx.db.get(student.userId) : null;
    const studentName = studentUser 
      ? [studentUser.firstName, studentUser.lastName].filter(Boolean).join(" ")
      : "Ученик";

    await ctx.db.delete(args.id);

    // ✅ FIX 3: Audit log
    await ctx.db.insert("auditLog", {
      userId: currentUser._id,
      action: "delete_grade",
      targetType: "grade",
      targetId: args.id,
      details: JSON.stringify({
        studentId: grade.studentId,
        subjectName: subject?.name,
        value: grade.value,
        type: grade.type,
      }),
      schoolId: student?.schoolId,
    });

    // ✅ PLATFORM SETTINGS: Notify admins about deletion
    if (student?.schoolId) {
      const gradeValue = grade.value === "absent" ? "Отсъстващ" : grade.value.toString();
      await ctx.scheduler.runAfter(0, internal.platformSettings.notifyAdminsOnDelete, {
        schoolId: student.schoolId,
        deletedByUserId: currentUser._id,
        entityType: "grade",
        entityDetails: `${studentName} - ${subject?.name || "предмет"}: ${gradeValue}`,
        studentId: grade.studentId,
      });
    }
  },
});

// Get grade statistics
export const getGradeStatistics = query({
  args: {
    classId: v.optional(v.id("classes")),
    studentId: v.optional(v.id("students")),
    subjectId: v.optional(v.id("subjects")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    let grades;
    if (args.classId) {
      grades = await ctx.db
        .query("grades")
        .withIndex("by_class", (q) => q.eq("classId", args.classId!))
        .collect();
    } else if (args.studentId) {
      grades = await ctx.db
        .query("grades")
        .withIndex("by_student", (q) => q.eq("studentId", args.studentId!))
        .collect();
    } else if (args.subjectId) {
      grades = await ctx.db
        .query("grades")
        .withIndex("by_subject", (q) => q.eq("subjectId", args.subjectId!))
        .collect();
    } else {
      // OPTIMIZED: Default to last 6 months instead of full table scan
      const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
      grades = await ctx.db
        .query("grades")
        .withIndex("by_date", (q) => q.gte("date", sixMonthsAgo))
        .collect();
    }
    const numericGrades = grades
      .filter((g) => typeof g.value === "number")
      .map((g) => g.value as number);

    if (numericGrades.length === 0) {
      return {
        average: 0,
        count: 0,
        excellentCount: 0,
        goodCount: 0,
        satisfactoryCount: 0,
        poorCount: 0,
      };
    }

    const average =
      numericGrades.reduce((sum, grade) => sum + grade, 0) /
      numericGrades.length;

    return {
      average,
      count: numericGrades.length,
      excellentCount: numericGrades.filter((g) => g === 6).length,
      goodCount: numericGrades.filter((g) => g >= 4.5 && g < 6).length,
      satisfactoryCount: numericGrades.filter((g) => g >= 3 && g < 4.5).length,
      poorCount: numericGrades.filter((g) => g < 3).length,
    };
  },
});

// Get grades for a class and subject
export const getGradesByClassAndSubject = query({
  args: {
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const grades = await ctx.db
      .query("grades")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .filter((q) => q.eq(q.field("subjectId"), args.subjectId))
      .collect();

    return grades;
  },
});

// Get all grades for a class
export const getGradesByClass = query({
  args: {
    classId: v.id("classes"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const grades = await ctx.db
      .query("grades")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    return grades;
  },
});

// Bulk create grades for multiple students
export const bulkCreateGrades = mutation({
  args: {
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    teacherId: v.id("teachers"),
    gradeType: v.string(),
    date: v.number(),
    comment: v.optional(v.string()),
    studentGrades: v.array(
      v.object({
        studentId: v.id("students"),
        value: v.number(),
      })
    ),
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

    // Only teachers and admins can create grades
    const isAdminUser = checkIsAdmin(currentUser);

    // Admins can create grades for any class/subject
    if (!isAdminUser) {
      if (hasRole(currentUser, "teacher") || hasRole(currentUser, "class_teacher")) {
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
        // First check classSubjects table
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

        // If not found in classSubjects, also check weekly schedules as fallback
        if (!classSubject) {
          const schedules = await ctx.db
            .query("weeklySchedules")
            .withIndex("by_class", (q) => q.eq("classId", args.classId))
            .collect();

          const foundInSchedule = schedules.some(schedule =>
            schedule.entries.some(entry =>
              entry.subjectId === args.subjectId && entry.teacherId === teacher._id
            )
          );

          if (!foundInSchedule) {
            throw new ConvexError({
              code: "FORBIDDEN",
              message: "Нямате право да поставяте оценки на този клас/предмет",
            });
          }
        }
      } else {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Само учители и администратори могат да поставят оценки",
        });
      }
    }

    // Get subject and teacher info once for notifications
    const subject = await ctx.db.get(args.subjectId);
    const teacher = await ctx.db.get(args.teacherId);
    const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;

    // Query parent records ONCE before the loop
    // OPTIMIZED: Use school index instead of full table scan
    const classDoc = await ctx.db.get(args.classId);
    const allParentRecords = classDoc?.schoolId
      ? await ctx.db
          .query("parents")
          .withIndex("by_school", (q) => q.eq("schoolId", classDoc.schoolId))
          .collect()
      : await ctx.db.query("parents").collect();

    // Create grades for all students
    for (const studentGrade of args.studentGrades) {
      const gradeId = await ctx.db.insert("grades", {
        studentId: studentGrade.studentId,
        classId: args.classId,
        subjectId: args.subjectId,
        teacherId: args.teacherId,
        value: studentGrade.value,
        type: "current",
        date: args.date,
        gradeType: args.gradeType,
        notes: args.comment,
      });

      // Create notification for each student
      const student = await ctx.db.get(studentGrade.studentId);
      if (student) {
        const studentUser = await ctx.db.get(student.userId);
        
        await ctx.db.insert("notifications", {
          userId: student.userId,
          type: "new_grade",
          title: `Нова оценка по ${subject?.name || "предмет"}`,
          message: `${teacherUser?.firstName || "Учител"} ${teacherUser?.lastName || ""} ви постави оценка ${studentGrade.value}`,
          isRead: false,
          relatedEntityType: "grade",
          relatedEntityId: gradeId,
          actionUrl: `/bg/diary/class/${args.classId}/grades`,
          schoolId: student.schoolId,
        });

        // Find parents that have this student (using cached parent records)
        const studentParents = allParentRecords.filter(
          p => p.studentIds && p.studentIds.includes(student._id)
        );

        const studentName = studentUser 
          ? [studentUser.firstName, studentUser.lastName].filter(Boolean).join(" ")
          : "Вашето дете";

        for (const parent of studentParents) {
          await ctx.db.insert("notifications", {
            userId: parent.userId,
            type: "new_grade",
            title: `Нова оценка за ${studentName}`,
            message: `${studentName} получи оценка ${studentGrade.value} по ${subject?.name || "предмет"}`,
            isRead: false,
            relatedEntityType: "grade",
            relatedEntityId: gradeId,
            actionUrl: `/bg/profile/${student.userId}`,
            schoolId: student.schoolId,
          });
        }
      }
    }

    // Audit log
    const classDocForAudit = classDoc ?? await ctx.db.get(args.classId);
    await ctx.db.insert("auditLog", {
      userId: currentUser._id,
      action: "bulk_create_grades",
      targetType: "grade",
      targetId: args.classId,
      details: JSON.stringify({
        className: classDocForAudit?.name,
        subjectName: subject?.name,
        studentCount: args.studentGrades.length,
        gradeType: args.gradeType,
      }),
      schoolId: classDocForAudit?.schoolId,
    });
  },
});

// Get grades for a student grouped by subject
export const getStudentGradesBySubject = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Find the student record
    const student = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!student) {
      return [];
    }

    // Get all grades for this student
    const grades = await ctx.db
      .query("grades")
      .withIndex("by_student", (q) => q.eq("studentId", student._id))
      .collect();

    // Group grades by subject
    const gradesBySubject: Record<string, typeof grades> = {};
    
    for (const grade of grades) {
      const subjectId = grade.subjectId;
      if (!gradesBySubject[subjectId]) {
        gradesBySubject[subjectId] = [];
      }
      gradesBySubject[subjectId].push(grade);
    }

    // Enrich with subject and teacher details
    const result = await Promise.all(
      Object.entries(gradesBySubject).map(async ([subjectId, subjectGrades]) => {
        const subject = await ctx.db.get(subjectId as Id<"subjects">);
        
        const enrichedGrades = await Promise.all(
          subjectGrades.map(async (grade) => {
            const teacher = await ctx.db.get(grade.teacherId);
            const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;
            
            return {
              ...grade,
              teacherName: teacherUser ? `${teacherUser.firstName} ${teacherUser.lastName}` : "Неизвестен учител",
            };
          })
        );

        return {
          subjectId,
          subjectName: subject?.name || "Неизвестен предмет",
          grades: enrichedGrades,
        };
      })
    );

    return result;
  },
});

// Get all grades for a specific student
export const getGradesByStudent = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const grades = await ctx.db
      .query("grades")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    return grades;
  },
});

// Set or update term grade (finalize)
export const setTermGrade = mutation({
  args: {
    studentId: v.id("students"),
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    teacherId: v.id("teachers"),
    value: v.number(),
    termNumber: v.number(), // 1 or 2
    isFinalized: v.boolean(),
  },
  handler: async (ctx, args): Promise<Id<"grades">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Check if user has permission
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }

    const isAdminUser = currentUser.roles?.includes("director") ||
      currentUser.roles?.includes("vice_director") ||
      currentUser.roles?.includes("system_admin") ||
      currentUser.roles?.includes("teacher");

    if (!isAdminUser) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Not authorized" });
    }

    // Calculate date range for the term
    const now = new Date();
    const year = now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear();
    
    // Term 1: September - January, Term 2: February - June
    const termStartMonth = args.termNumber === 1 ? 8 : 1; // 0-indexed: 8 = September, 1 = February
    const termEndMonth = args.termNumber === 1 ? 0 : 5; // 0-indexed: 0 = January, 5 = June
    const termYear = args.termNumber === 1 ? year : year + 1;
    
    // Check if there's already a term grade for this student/subject/term
    const existingGrades = await ctx.db
      .query("grades")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    const existingTermGrade = existingGrades.find(g => 
      g.subjectId === args.subjectId && 
      g.type === "term" &&
      new Date(g.date).getMonth() < 6 === (args.termNumber === 1 ? new Date(g.date).getMonth() >= 8 || new Date(g.date).getMonth() <= 1 : new Date(g.date).getMonth() >= 1 && new Date(g.date).getMonth() <= 5)
    );

    if (existingTermGrade) {
      // Update existing term grade
      await ctx.db.patch(existingTermGrade._id, {
        value: args.value,
        isFinalized: args.isFinalized,
        teacherId: args.teacherId,
      });
      return existingTermGrade._id;
    } else {
      // Create new term grade
      const gradeId = await ctx.db.insert("grades", {
        studentId: args.studentId,
        classId: args.classId,
        subjectId: args.subjectId,
        teacherId: args.teacherId,
        value: args.value,
        type: "term",
        date: Date.now(),
        isFinalized: args.isFinalized,
        gradeType: args.termNumber === 1 ? "Срочна оценка I срок" : "Срочна оценка II срок",
      });
      return gradeId;
    }
  },
});

// Update term grade
export const updateTermGrade = mutation({
  args: {
    gradeId: v.id("grades"),
    value: v.number(),
    isFinalized: v.optional(v.boolean()),
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
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }

    const isAdminUser = currentUser.roles?.includes("director") ||
      currentUser.roles?.includes("vice_director") ||
      currentUser.roles?.includes("system_admin") ||
      currentUser.roles?.includes("teacher");

    if (!isAdminUser) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Not authorized" });
    }

    const grade = await ctx.db.get(args.gradeId);
    if (!grade) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Grade not found" });
    }

    await ctx.db.patch(args.gradeId, {
      value: args.value,
      ...(args.isFinalized !== undefined && { isFinalized: args.isFinalized }),
    });
  },
});

// Bulk delete grades
export const bulkDeleteGrades = mutation({
  args: {
    gradeIds: v.array(v.id("grades")),
  },
  handler: async (ctx, args): Promise<number> => {
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

    const isAdminUser = checkIsAdmin(currentUser);

    if (!isAdminUser) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Само администратори могат да изтриват оценки масово",
      });
    }

    let deletedCount = 0;

    for (const gradeId of args.gradeIds) {
      const grade = await ctx.db.get(gradeId);
      if (grade) {
        await ctx.db.delete(gradeId);
        deletedCount++;
      }
    }

    // Audit log
    await ctx.db.insert("auditLog", {
      userId: currentUser._id,
      action: "bulk_delete_grades",
      targetType: "grade",
      targetId: currentUser._id,
      details: JSON.stringify({
        count: deletedCount,
        gradeIds: args.gradeIds,
      }),
      schoolId: currentUser.schoolId,
    });

    return deletedCount;
  },
});

// Delete term grade
export const deleteTermGrade = mutation({
  args: {
    gradeId: v.id("grades"),
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
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }

    const isAdminUser = currentUser.roles?.includes("director") ||
      currentUser.roles?.includes("vice_director") ||
      currentUser.roles?.includes("system_admin") ||
      currentUser.roles?.includes("teacher");

    if (!isAdminUser) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Not authorized" });
    }

    const grade = await ctx.db.get(args.gradeId);
    if (!grade) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Grade not found" });
    }

    await ctx.db.delete(args.gradeId);
  },
});
