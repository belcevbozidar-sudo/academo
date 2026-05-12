import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

// GET /homework/by-class - Get all homework for a class
export const getHomeworkByClass = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args): Promise<Array<{
    homework: Doc<"homework">;
    subject: Doc<"subjects"> | null;
    teacher: {
      _id: Id<"teachers">;
      firstName?: string;
      lastName?: string;
      name?: string;
    } | null;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const homeworkList = await ctx.db
      .query("homework")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Sort by assigned date descending
    homeworkList.sort((a, b) => b.assignedDate - a.assignedDate);

    const result = await Promise.all(
      homeworkList.map(async (hw) => {
        const subject = await ctx.db.get(hw.subjectId);
        const teacher = await ctx.db.get(hw.teacherId);
        let teacherInfo: {
          _id: Id<"teachers">;
          firstName?: string;
          lastName?: string;
          name?: string;
        } | null = null;

        if (teacher) {
          const teacherUser = await ctx.db.get(teacher.userId);
          teacherInfo = {
            _id: teacher._id,
            firstName: teacherUser?.firstName,
            lastName: teacherUser?.lastName,
            name: teacherUser?.name,
          };
        }

        return {
          homework: hw,
          subject,
          teacher: teacherInfo,
        };
      })
    );

    return result;
  },
});

// GET /homework/by-class-and-subject - Get homework for a specific class and subject
export const getHomeworkByClassAndSubject = query({
  args: { 
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
  },
  handler: async (ctx, args): Promise<Array<Doc<"homework">>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const homeworkList = await ctx.db
      .query("homework")
      .withIndex("by_class_and_subject", (q) => 
        q.eq("classId", args.classId).eq("subjectId", args.subjectId)
      )
      .collect();

    // Sort by assigned date descending
    return homeworkList.sort((a, b) => b.assignedDate - a.assignedDate);
  },
});

// GET /homework/subjects-with-count - Get subjects with homework count for a class
export const getSubjectsWithHomeworkCount = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args): Promise<Array<{
    subject: Doc<"subjects">;
    count: number;
    preparationType?: string;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get all subjects for this class from classSubjects
    const classSubjects = await ctx.db
      .query("classSubjects")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Get all homework for this class
    const homeworkList = await ctx.db
      .query("homework")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Count homework per subject
    const homeworkCountMap = new Map<string, number>();
    for (const hw of homeworkList) {
      const subjectId = hw.subjectId.toString();
      homeworkCountMap.set(subjectId, (homeworkCountMap.get(subjectId) || 0) + 1);
    }

    // Build result with subjects and counts
    const result: Array<{
      subject: Doc<"subjects">;
      count: number;
      preparationType?: string;
    }> = [];

    const seenSubjects = new Set<string>();

    for (const cs of classSubjects) {
      const subjectId = cs.subjectId.toString();
      if (seenSubjects.has(subjectId)) continue;
      seenSubjects.add(subjectId);

      const subject = await ctx.db.get(cs.subjectId);
      if (subject) {
        result.push({
          subject,
          count: homeworkCountMap.get(subjectId) || 0,
          preparationType: cs.preparationType,
        });
      }
    }

    // Sort alphabetically by subject name
    return result.sort((a, b) => a.subject.name.localeCompare(b.subject.name, "bg"));
  },
});

// POST /homework - Create new homework
export const createHomework = mutation({
  args: {
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    title: v.string(),
    assignedDate: v.number(),
    dueDate: v.number(),
    lessonId: v.optional(v.id("lessons")),
  },
  handler: async (ctx, args): Promise<Id<"homework">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    // Get teacher ID for this user
    const teacher = await ctx.db
      .query("teachers")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .first();

    if (!teacher) {
      throw new ConvexError({
        message: "Teacher not found",
        code: "NOT_FOUND",
      });
    }

    // Get class to get school ID
    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc) {
      throw new ConvexError({
        message: "Class not found",
        code: "NOT_FOUND",
      });
    }

    // Get subject name for notification
    const subject = await ctx.db.get(args.subjectId);
    const subjectName = subject?.name || "Предмет";

    const homeworkId = await ctx.db.insert("homework", {
      classId: args.classId,
      subjectId: args.subjectId,
      schoolId: classDoc.schoolId,
      teacherId: teacher._id,
      lessonId: args.lessonId,
      title: args.title,
      assignedDate: args.assignedDate,
      dueDate: args.dueDate,
      createdBy: currentUser._id,
      createdAt: Date.now(),
    });

    // Send notifications to all students in the class
    const students = await ctx.db
      .query("students")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Format due date for notification message
    const dueDateObj = new Date(args.dueDate);
    const formattedDueDate = `${dueDateObj.getUTCDate().toString().padStart(2, '0')}.${(dueDateObj.getUTCMonth() + 1).toString().padStart(2, '0')}.${dueDateObj.getUTCFullYear()}`;

    for (const student of students) {
      // Notify student user
      if (student.userId) {
        await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
          userId: student.userId,
          type: "new_homework",
          title: "Нова домашна работа",
          message: `${subjectName}: ${args.title}. Срок: ${formattedDueDate}`,
          relatedEntityType: "homework",
          relatedEntityId: homeworkId,
          actionUrl: `/bg/diary/class/${args.classId}/homework`,
          schoolId: classDoc.schoolId,
        });
      }
    }

    // Find parents who have students in this class and notify them
    const allParents = await ctx.db.query("parents").collect();
    const studentIdSet = new Set(students.map((s) => s._id.toString()));
    
    for (const parent of allParents) {
      // Check if any of the parent's studentIds are in this class
      const hasStudentInClass = parent.studentIds?.some((sid) => studentIdSet.has(sid.toString()));
      if (hasStudentInClass && parent.userId) {
        await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
          userId: parent.userId,
          type: "new_homework",
          title: "Нова домашна работа",
          message: `${subjectName}: ${args.title}. Срок: ${formattedDueDate}`,
          relatedEntityType: "homework",
          relatedEntityId: homeworkId,
          actionUrl: `/bg/diary/class/${args.classId}/homework`,
          schoolId: classDoc.schoolId,
        });
      }
    }

    return homeworkId;
  },
});

// PATCH /homework/:id - Update homework
export const updateHomework = mutation({
  args: {
    id: v.id("homework"),
    title: v.optional(v.string()),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    const homework = await ctx.db.get(args.id);
    if (!homework) {
      throw new ConvexError({
        message: "Homework not found",
        code: "NOT_FOUND",
      });
    }

    const updates: {
      title?: string;
      dueDate?: number;
      lastEditedBy: Id<"users">;
      lastEditedAt: number;
    } = {
      lastEditedBy: currentUser._id,
      lastEditedAt: Date.now(),
    };

    if (args.title !== undefined) {
      updates.title = args.title;
    }
    if (args.dueDate !== undefined) {
      updates.dueDate = args.dueDate;
    }

    await ctx.db.patch(args.id, updates);
  },
});

// DELETE /homework/:id - Delete homework
export const deleteHomework = mutation({
  args: { id: v.id("homework") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const homework = await ctx.db.get(args.id);
    if (!homework) {
      throw new ConvexError({
        message: "Homework not found",
        code: "NOT_FOUND",
      });
    }

    await ctx.db.delete(args.id);
  },
});
