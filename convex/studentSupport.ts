import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";
import { internal } from "./_generated/api.js";

// Основания (Reasons)
export const SUPPORT_REASONS = [
  "Затруднения в обучението",
  "Рискови фактори в средата",
  "Проблемно поведение",
  "Хронично заболяване",
  "Напредва по-бързо от останалите",
  "Друго",
];

// Дейности (Activities) - organized by category
export const SUPPORT_ACTIVITIES = {
  "Обща подкрепа": [
    "Допълнително обучение",
    "Допълнителен БЕЛ",
    "Консултация (по предмет)",
    "Екипна работа между учители",
    "Кариерно ориентиране",
    "Занимания по интереси",
    "Грижа за здравето",
    "Превенция на проблемно поведение",
    "Превенция на обучителни затруднения",
    "Логопед",
    "Консултация",
    "Психологическо консултиране",
    "Здравословен начин на живот",
    "Културно - образователни дейности",
    "Училищни проекти",
    "Културно - опознавателен туризъм",
    "Работа по конкретен случай",
  ],
  "Допълнителна подкрепа": [
    "Работа по конкретен случай",
    "Психо-социална рехабилитация",
    "Осигуряване на достъпна среда",
    "Обучение за ученици със сензорни увреждания",
    "Ресурсно подпомагане (по предмет)",
    "Рехабилитация на комуникативни нарушения",
    "Психологическо консултиране",
    "Рехабилитация на слуха и говора",
    "Зрителна рехабилитация",
    "Рехабилитация на комуникативните",
    "Социални умения",
    "Арттерапия",
    "Музикотерапия",
    "Трудотерапия",
    "Логопед",
  ],
  "Административна дейност": [
    "Друга",
  ],
};

// Get all student support records for a class
export const getStudentSupportByClass = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const supportRecords = await ctx.db
      .query("studentSupport")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Get student, teacher, subject and creator details
    const enrichedRecords = await Promise.all(
      supportRecords.map(async (record) => {
        const student = await ctx.db.get(record.studentId);
        const studentUser = student ? await ctx.db.get(student.userId) : null;
        const createdByUser = await ctx.db.get(record.createdBy);
        const lastEditedByUser = record.lastEditedBy 
          ? await ctx.db.get(record.lastEditedBy) 
          : null;
        
        // Get teacher info
        let teacherName = "Неизвестен";
        if (record.teacherId) {
          const teacher = await ctx.db.get(record.teacherId);
          if (teacher) {
            const teacherUser = await ctx.db.get(teacher.userId);
            if (teacherUser) {
              teacherName = [teacherUser.firstName, teacherUser.middleName?.charAt(0), teacherUser.lastName]
                .filter(Boolean)
                .join(" ");
            }
          }
        }
        
        // Get subject info
        let subjectName = null;
        if (record.subjectId) {
          const subject = await ctx.db.get(record.subjectId);
          if (subject) {
            subjectName = subject.shortName || subject.name;
          }
        }

        return {
          ...record,
          studentName: studentUser
            ? [studentUser.firstName, studentUser.middleName, studentUser.lastName]
                .filter(Boolean)
                .join(" ")
            : "Неизвестен",
          studentNumber: student?.studentNumber || 0,
          teacherName,
          subjectName,
          createdByName: createdByUser
            ? [createdByUser.firstName, createdByUser.lastName]
                .filter(Boolean)
                .join(" ")
            : "Неизвестен",
          lastEditedByName: lastEditedByUser
            ? [lastEditedByUser.firstName, lastEditedByUser.lastName]
                .filter(Boolean)
                .join(" ")
            : null,
        };
      })
    );

    // Sort by date (newest first), then by student number
    return enrichedRecords.sort((a, b) => {
      const dateA = a.date || a.startDate || a.createdAt;
      const dateB = b.date || b.startDate || b.createdAt;
      if (dateA !== dateB) {
        return dateB - dateA;
      }
      return a.studentNumber - b.studentNumber;
    });
  },
});

// Create a new student support record
export const createStudentSupport = mutation({
  args: {
    studentId: v.id("students"),
    classId: v.id("classes"),
    reason: v.string(),
    activity: v.string(),
    date: v.number(),
    subjectId: v.optional(v.id("subjects")),
    teacherId: v.id("teachers"),
    notes: v.optional(v.string()),
    // Legacy fields for backwards compatibility
    supportType: v.optional(v.string()),
    description: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"studentSupport">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get current user
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        message: "Current user not found",
        code: "NOT_FOUND",
      });
    }

    // Get the student's class to get schoolId
    const classData = await ctx.db.get(args.classId);
    if (!classData) {
      throw new ConvexError({
        message: "Class not found",
        code: "NOT_FOUND",
      });
    }

    const recordId = await ctx.db.insert("studentSupport", {
      studentId: args.studentId,
      classId: args.classId,
      schoolId: classData.schoolId,
      reason: args.reason,
      activity: args.activity,
      date: args.date,
      subjectId: args.subjectId,
      teacherId: args.teacherId,
      supportType: args.supportType || args.activity,
      description: args.description,
      startDate: args.startDate || args.date,
      endDate: args.endDate,
      status: "active",
      createdBy: currentUser._id,
      createdAt: Date.now(),
      notes: args.notes,
    });

    // ✅ PARENT NOTIFICATION: Notify parents about new student support
    const student = await ctx.db.get(args.studentId);
    if (student) {
      const studentUser = await ctx.db.get(student.userId);
      const studentName = studentUser 
        ? [studentUser.firstName, studentUser.lastName].filter(Boolean).join(" ")
        : "Вашето дете";

      // Get subject name if provided
      let subjectText = "";
      if (args.subjectId) {
        const subject = await ctx.db.get(args.subjectId);
        if (subject) {
          subjectText = ` по ${subject.shortName || subject.name}`;
        }
      }

      // Find parents of this student
      const parentRecords = await ctx.db.query("parents").collect();
      const studentParents = parentRecords.filter(
        p => p.studentIds && p.studentIds.includes(student._id)
      );

      for (const parent of studentParents) {
        await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
          userId: parent.userId,
          type: "new_student_support",
          title: `Подкрепа за ${studentName}`,
          message: `${studentName} има нов запис за подкрепа: ${args.activity}${subjectText}`,
          relatedEntityType: "studentSupport",
          relatedEntityId: recordId,
          actionUrl: `/bg/profile/${student.userId}`,
          schoolId: classData.schoolId,
        });
      }
    }

    return recordId;
  },
});

// Bulk create student support records (for multiple students)
export const bulkCreateStudentSupport = mutation({
  args: {
    classId: v.id("classes"),
    studentIds: v.array(v.id("students")),
    reason: v.string(),
    activity: v.string(),
    date: v.number(),
    subjectId: v.optional(v.id("subjects")),
    teacherId: v.id("teachers"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"studentSupport">[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get current user
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        message: "Current user not found",
        code: "NOT_FOUND",
      });
    }

    // Get the class to get schoolId
    const classData = await ctx.db.get(args.classId);
    if (!classData) {
      throw new ConvexError({
        message: "Class not found",
        code: "NOT_FOUND",
      });
    }

    const recordIds: Id<"studentSupport">[] = [];
    
    // Get subject name if provided (for notifications)
    let subjectText = "";
    if (args.subjectId) {
      const subject = await ctx.db.get(args.subjectId);
      if (subject) {
        subjectText = ` по ${subject.shortName || subject.name}`;
      }
    }

    // Get all parents once for efficiency
    const parentRecords = await ctx.db.query("parents").collect();
    
    for (const studentId of args.studentIds) {
      const recordId = await ctx.db.insert("studentSupport", {
        studentId,
        classId: args.classId,
        schoolId: classData.schoolId,
        reason: args.reason,
        activity: args.activity,
        date: args.date,
        subjectId: args.subjectId,
        teacherId: args.teacherId,
        supportType: args.activity,
        startDate: args.date,
        status: "active",
        createdBy: currentUser._id,
        createdAt: Date.now(),
        notes: args.notes,
      });
      recordIds.push(recordId);

      // ✅ PARENT NOTIFICATION: Notify parents about new student support
      const student = await ctx.db.get(studentId);
      if (student) {
        const studentUser = await ctx.db.get(student.userId);
        const studentName = studentUser 
          ? [studentUser.firstName, studentUser.lastName].filter(Boolean).join(" ")
          : "Вашето дете";

        // Find parents of this student
        const studentParents = parentRecords.filter(
          p => p.studentIds && p.studentIds.includes(student._id)
        );

        for (const parent of studentParents) {
          await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
            userId: parent.userId,
            type: "new_student_support",
            title: `Подкрепа за ${studentName}`,
            message: `${studentName} има нов запис за подкрепа: ${args.activity}${subjectText}`,
            relatedEntityType: "studentSupport",
            relatedEntityId: recordId,
            actionUrl: `/bg/profile/${student.userId}`,
            schoolId: classData.schoolId,
          });
        }
      }
    }

    return recordIds;
  },
});

// Update a student support record
export const updateStudentSupport = mutation({
  args: {
    id: v.id("studentSupport"),
    reason: v.optional(v.string()),
    activity: v.optional(v.string()),
    date: v.optional(v.number()),
    subjectId: v.optional(v.id("subjects")),
    teacherId: v.optional(v.id("teachers")),
    supportType: v.optional(v.string()),
    description: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    status: v.optional(v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("cancelled")
    )),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get current user
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        message: "Current user not found",
        code: "NOT_FOUND",
      });
    }

    const record = await ctx.db.get(args.id);
    if (!record) {
      throw new ConvexError({
        message: "Record not found",
        code: "NOT_FOUND",
      });
    }

    const updates: Partial<{
      reason: string;
      activity: string;
      date: number;
      subjectId: Id<"subjects">;
      teacherId: Id<"teachers">;
      supportType: string;
      description: string;
      startDate: number;
      endDate: number;
      status: "active" | "completed" | "cancelled";
      notes: string;
      lastEditedBy: Id<"users">;
      lastEditedAt: number;
    }> = {
      lastEditedBy: currentUser._id,
      lastEditedAt: Date.now(),
    };

    if (args.reason !== undefined) updates.reason = args.reason;
    if (args.activity !== undefined) {
      updates.activity = args.activity;
      updates.supportType = args.activity;
    }
    if (args.date !== undefined) {
      updates.date = args.date;
      updates.startDate = args.date;
    }
    if (args.subjectId !== undefined) updates.subjectId = args.subjectId;
    if (args.teacherId !== undefined) updates.teacherId = args.teacherId;
    if (args.supportType !== undefined) updates.supportType = args.supportType;
    if (args.description !== undefined) updates.description = args.description;
    if (args.startDate !== undefined) updates.startDate = args.startDate;
    if (args.endDate !== undefined) updates.endDate = args.endDate;
    if (args.status !== undefined) updates.status = args.status;
    if (args.notes !== undefined) updates.notes = args.notes;

    await ctx.db.patch(args.id, updates);
  },
});

// Delete a student support record
export const deleteStudentSupport = mutation({
  args: {
    id: v.id("studentSupport"),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const record = await ctx.db.get(args.id);
    if (!record) {
      throw new ConvexError({
        message: "Record not found",
        code: "NOT_FOUND",
      });
    }

    await ctx.db.delete(args.id);
  },
});
