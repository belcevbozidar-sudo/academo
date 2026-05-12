import { ConvexError } from "convex/values";
import { internalMutation, query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";
import { internal } from "./_generated/api.js";

// Internal mutation to create assignment
export const createAssignmentInternal = internalMutation({
  args: {
    title: v.string(),
    type: v.string(),
    description: v.optional(v.string()),
    classId: v.optional(v.id("classes")),
    subjectId: v.optional(v.id("subjects")),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("not_completed")
    ),
    dueDate: v.optional(v.number()),
    targetType: v.optional(v.union(v.literal("class"), v.literal("activity"))),
    extracurricularActivityId: v.optional(v.id("extracurricularActivities")),
    isExtended: v.optional(v.boolean()),
    activeFrom: v.optional(v.number()),
    activeTo: v.optional(v.number()),
    isGroupTask: v.optional(v.boolean()),
    fileIds: v.optional(v.array(v.id("_storage"))),
    participantIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args): Promise<Id<"assignments">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Get user and teacher
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Get teacher record
    const teacher = await ctx.db
      .query("teachers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (!teacher) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only teachers can create assignments",
      });
    }

    const assignmentId = await ctx.db.insert("assignments", {
      title: args.title,
      type: args.type,
      description: args.description,
      classId: args.classId,
      subjectId: args.subjectId,
      teacherId: teacher._id,
      status: args.status,
      dueDate: args.dueDate,
      assignedDate: Date.now(),
      targetType: args.targetType,
      extracurricularActivityId: args.extracurricularActivityId,
      isExtended: args.isExtended,
      activeFrom: args.activeFrom,
      activeTo: args.activeTo,
      isGroupTask: args.isGroupTask,
      fileIds: args.fileIds,
      participantIds: args.participantIds,
    });

    // Create participant records if extended mode with participants
    if (args.isExtended && args.participantIds && args.participantIds.length > 0) {
      for (const participantId of args.participantIds) {
        await ctx.db.insert("assignmentParticipants", {
          assignmentId,
          userId: participantId,
          status: "assigned",
        });
      }
    }

    return assignmentId;
  },
});

// Get assignment by ID with full details
export const getAssignmentById = query({
  args: { assignmentId: v.id("assignments") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) {
      return null;
    }

    // Get related data
    const classData = assignment.classId ? await ctx.db.get(assignment.classId) : null;
    const subject = assignment.subjectId ? await ctx.db.get(assignment.subjectId) : null;
    const teacher = await ctx.db.get(assignment.teacherId);
    const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;

    // Get participants if extended
    let participants: Array<{
      participantId: string;
      userId: string;
      name: string;
      role: string;
      classId: string | null;
      className: string;
      status: string;
      seenAt?: number;
    }> = [];

    if (assignment.isExtended) {
      const participantRecords = await ctx.db
        .query("assignmentParticipants")
        .withIndex("by_assignment", (q) => q.eq("assignmentId", args.assignmentId))
        .collect();

      participants = await Promise.all(
        participantRecords.map(async (p) => {
          const user = await ctx.db.get(p.userId);
          const userClass = user?.classId ? await ctx.db.get(user.classId) : null;
          
          const roleMap: Record<string, string> = {
            student: "Ученик",
            parent: "Родител",
            teacher: "Учител",
            class_teacher: "Класен ръководител",
          };

          return {
            participantId: p._id,
            userId: user?._id || "",
            name: user ? [user.firstName, user.middleName?.charAt(0) ? user.middleName.charAt(0) + "." : "", user.lastName].filter(Boolean).join(" ") : "Неизвестен",
            role: user ? (user.role === "parent" ? "Родител на ..." : (roleMap[user.role] || user.role)) : "",
            classId: user?.classId || null,
            className: userClass?.name || "-",
            status: p.status,
            seenAt: p.seenAt,
          };
        })
      );
    } else {
      // For non-extended, get students from class
      if (assignment.classId) {
        const students = await ctx.db
          .query("students")
          .withIndex("by_class", (q) => q.eq("classId", assignment.classId!))
          .collect();

        // Check if there are participant records for these students
        const participantRecords = await ctx.db
          .query("assignmentParticipants")
          .withIndex("by_assignment", (q) => q.eq("assignmentId", args.assignmentId))
          .collect();

        const participantMap = new Map(participantRecords.map(p => [p.userId.toString(), p]));

        participants = await Promise.all(
          students.map(async (student) => {
            const user = await ctx.db.get(student.userId);
            const existingParticipant = participantMap.get(student.userId.toString());
            
            return {
              participantId: existingParticipant?._id || student._id,
              userId: user?._id || "",
              name: user ? [user.firstName, user.middleName?.charAt(0) ? user.middleName.charAt(0) + "." : "", user.lastName].filter(Boolean).join(" ") : "Неизвестен",
              role: "Ученик",
              classId: assignment.classId || null,
              className: classData?.name || "-",
              status: existingParticipant?.status || "assigned",
              seenAt: existingParticipant?.seenAt,
            };
          })
        );
      }
    }

    return {
      ...assignment,
      className: classData?.name || null,
      subjectName: subject?.name || null,
      teacherName: teacherUser ? [teacherUser.firstName, teacherUser.lastName].filter(Boolean).join(" ") : "Неизвестен",
      teacherUserId: teacherUser?._id || null,
      participants,
    };
  },
});

// Update assignment status
export const updateAssignmentStatus = mutation({
  args: {
    assignmentId: v.id("assignments"),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("not_completed")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    await ctx.db.patch(args.assignmentId, { status: args.status });
  },
});

// Update participant status
export const updateParticipantStatus = mutation({
  args: {
    assignmentId: v.id("assignments"),
    participantId: v.string(),
    status: v.union(
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("not_completed")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Try to find existing participant record
    try {
      const existingParticipant = await ctx.db.get(args.participantId as Id<"assignmentParticipants">);
      
      if (existingParticipant && existingParticipant.assignmentId) {
        await ctx.db.patch(args.participantId as Id<"assignmentParticipants">, { status: args.status });
        return;
      }
    } catch {
      // If getting fails, it might be a student ID - create a new participant record
    }

    // For non-extended assignments, create a participant record if it doesn't exist
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Assignment not found",
      });
    }

    // Try to find the student and get their userId
    try {
      const student = await ctx.db.get(args.participantId as Id<"students">);
      if (student) {
        // Check if participant record already exists for this user
        const existingRecord = await ctx.db
          .query("assignmentParticipants")
          .withIndex("by_assignment", (q) => q.eq("assignmentId", args.assignmentId))
          .filter((q) => q.eq(q.field("userId"), student.userId))
          .first();

        if (existingRecord) {
          await ctx.db.patch(existingRecord._id, { status: args.status });
        } else {
          // Create new participant record
          await ctx.db.insert("assignmentParticipants", {
            assignmentId: args.assignmentId,
            userId: student.userId,
            status: args.status,
          });
        }
      }
    } catch {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Invalid participant ID",
      });
    }
  },
});

// Update all participants status
export const updateAllParticipantsStatus = mutation({
  args: {
    assignmentId: v.id("assignments"),
    status: v.union(
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("not_completed")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const participants = await ctx.db
      .query("assignmentParticipants")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", args.assignmentId))
      .collect();

    for (const participant of participants) {
      await ctx.db.patch(participant._id, { status: args.status });
    }
  },
});

// Delete assignment
export const deleteAssignment = mutation({
  args: { assignmentId: v.id("assignments") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Delete participant records
    const participants = await ctx.db
      .query("assignmentParticipants")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", args.assignmentId))
      .collect();

    for (const participant of participants) {
      await ctx.db.delete(participant._id);
    }

    // Delete assignment
    await ctx.db.delete(args.assignmentId);
  },
});

// Update assignment
export const updateAssignment = mutation({
  args: {
    assignmentId: v.id("assignments"),
    title: v.optional(v.string()),
    type: v.optional(v.string()),
    description: v.optional(v.string()),
    classId: v.optional(v.id("classes")),
    subjectId: v.optional(v.id("subjects")),
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("not_completed")
    )),
    dueDate: v.optional(v.number()),
    targetType: v.optional(v.union(v.literal("class"), v.literal("activity"))),
    extracurricularActivityId: v.optional(v.id("extracurricularActivities")),
    isExtended: v.optional(v.boolean()),
    activeFrom: v.optional(v.number()),
    activeTo: v.optional(v.number()),
    isGroupTask: v.optional(v.boolean()),
    fileIds: v.optional(v.array(v.id("_storage"))),
    participantIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const { assignmentId, participantIds, ...updateFields } = args;

    // Update assignment fields
    await ctx.db.patch(assignmentId, updateFields);

    // If participantIds are provided, update participants
    if (participantIds !== undefined) {
      // Delete existing participant records
      const existingParticipants = await ctx.db
        .query("assignmentParticipants")
        .withIndex("by_assignment", (q) => q.eq("assignmentId", assignmentId))
        .collect();

      for (const participant of existingParticipants) {
        await ctx.db.delete(participant._id);
      }

      // Create new participant records
      for (const userId of participantIds) {
        await ctx.db.insert("assignmentParticipants", {
          assignmentId,
          userId,
          status: "assigned",
        });
      }
    }
  },
});

// Generate upload URL for files
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }
    return await ctx.storage.generateUploadUrl();
  },
});

// Get all assignments for a class
export const getAssignmentsByClass = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const allAssignments = await ctx.db
      .query("assignments")
      .order("desc")
      .collect();
    
    const assignments = allAssignments.filter(a => a.classId === args.classId);

    return assignments;
  },
});

// Create assignment (public mutation for teachers/admins)
export const createAssignment = mutation({
  args: {
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    teacherId: v.id("teachers"),
    title: v.string(),
    type: v.string(),
    description: v.optional(v.string()),
    dueDate: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"assignments">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Get current user
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Check if user is admin or teacher
    const isAdmin = ["director", "vice_director", "system_admin"].includes(user.role) ||
                   (user.roles && user.roles.some(r => ["director", "vice_director", "system_admin"].includes(r)));

    if (!isAdmin) {
      // Check if user is a teacher
      const teacher = await ctx.db
        .query("teachers")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .unique();

      if (!teacher) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Only teachers and admins can create assignments",
        });
      }
    }

    const assignmentId = await ctx.db.insert("assignments", {
      title: args.title,
      type: args.type,
      description: args.description,
      classId: args.classId,
      subjectId: args.subjectId,
      teacherId: args.teacherId,
      status: "pending",
      dueDate: args.dueDate,
      assignedDate: Date.now(),
    });

    // Send notifications to all students in the class
    const students = await ctx.db
      .query("students")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    const subject = await ctx.db.get(args.subjectId);
    const teacher = await ctx.db.get(args.teacherId);
    const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;
    const teacherName = teacherUser
      ? [teacherUser.firstName, teacherUser.lastName].filter(Boolean).join(" ")
      : "Учител";

    for (const student of students) {
      await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
        userId: student.userId,
        type: "new_assignment",
        title: `Нова контролна работа по ${subject?.name || "предмет"}`,
        message: `${teacherName}: ${args.title}`,
        relatedEntityType: "assignment",
        relatedEntityId: assignmentId,
        actionUrl: `/bg/diary/class/${args.classId}/tests`,
      });
    }

    return assignmentId;
  },
});
