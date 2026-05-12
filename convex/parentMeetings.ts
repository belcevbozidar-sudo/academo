import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";
import { buildUserName, hasRole, isAdmin } from "./users.js";
import { internal } from "./_generated/api.js";

// List parent meetings for a class
export const listByClass = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const meetings = await ctx.db
      .query("parentMeetings")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Sort by startDate descending (newest first)
    meetings.sort((a, b) => b.startDate - a.startDate);

    // Enrich with creator name
    const enrichedMeetings = await Promise.all(
      meetings.map(async (meeting) => {
        const creator = await ctx.db.get(meeting.createdById);
        return {
          ...meeting,
          createdByName: buildUserName(creator),
        };
      })
    );

    return enrichedMeetings;
  },
});

// Create a parent meeting
export const create = mutation({
  args: {
    classId: v.id("classes"),
    title: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    location: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"parentMeetings">> => {
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
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Check if user can create parent meetings (admin, director, vice_director, or class teacher)
    const classData = await ctx.db.get(args.classId);
    const canCreate =
      isAdmin(user) ||
      hasRole(user, "class_teacher") ||
      (classData && classData.classTeacherId === user._id);

    if (!canCreate) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have permission to create parent meetings",
      });
    }

    const meetingId = await ctx.db.insert("parentMeetings", {
      classId: args.classId,
      title: args.title,
      startDate: args.startDate,
      endDate: args.endDate,
      location: args.location,
      description: args.description,
      createdById: user._id,
      createdAt: Date.now(),
    });

    // ✅ PARENT NOTIFICATION: Notify all parents in this class about the new meeting
    // First, get all students in this class
    const students = await ctx.db
      .query("students")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Get all parents
    const allParents = await ctx.db.query("parents").collect();
    
    // Find parents who have students in this class
    const studentIdSet = new Set(students.map(s => s._id.toString()));
    const notifiedParentIds = new Set<string>();

    // Format meeting date/time for notification
    const meetingDate = new Date(args.startDate);
    const formattedDate = meetingDate.toLocaleDateString("bg-BG", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const formattedTime = meetingDate.toLocaleTimeString("bg-BG", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Sofia",
    });

    for (const parent of allParents) {
      // Skip if we've already notified this parent
      if (notifiedParentIds.has(parent._id.toString())) continue;
      
      // Check if any of the parent's students are in this class
      const hasStudentInClass = parent.studentIds?.some(
        sid => studentIdSet.has(sid.toString())
      );
      
      if (hasStudentInClass && parent.userId) {
        notifiedParentIds.add(parent._id.toString());
        await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
          userId: parent.userId,
          type: "new_parent_meeting",
          title: "Нова родителска среща",
          message: `${args.title} - ${formattedDate} в ${formattedTime}${args.location ? ` (${args.location})` : ""}`,
          relatedEntityType: "parentMeeting",
          relatedEntityId: meetingId,
          actionUrl: `/bg/diary/class/${args.classId}/parent-meetings`,
          schoolId: classData?.schoolId,
        });
      }
    }

    return meetingId;
  },
});

// Update a parent meeting
export const update = mutation({
  args: {
    id: v.id("parentMeetings"),
    title: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    location: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
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
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    const meeting = await ctx.db.get(args.id);
    if (!meeting) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Parent meeting not found",
      });
    }

    // Check if user can edit (admin or creator or class teacher)
    const classData = await ctx.db.get(meeting.classId);
    const canEdit =
      isAdmin(user) ||
      meeting.createdById === user._id ||
      (classData && classData.classTeacherId === user._id);

    if (!canEdit) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have permission to edit this parent meeting",
      });
    }

    const { id, ...updates } = args;
    // Filter out undefined values
    const filteredUpdates: Record<string, string | number> = {};
    if (updates.title !== undefined) filteredUpdates.title = updates.title;
    if (updates.startDate !== undefined) filteredUpdates.startDate = updates.startDate;
    if (updates.endDate !== undefined) filteredUpdates.endDate = updates.endDate;
    if (updates.location !== undefined) filteredUpdates.location = updates.location;
    if (updates.description !== undefined) filteredUpdates.description = updates.description;

    await ctx.db.patch(id, filteredUpdates);
  },
});

// Delete a parent meeting
export const remove = mutation({
  args: { id: v.id("parentMeetings") },
  handler: async (ctx, args): Promise<void> => {
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
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    const meeting = await ctx.db.get(args.id);
    if (!meeting) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Parent meeting not found",
      });
    }

    // Check if user can delete (admin or creator or class teacher)
    const classData = await ctx.db.get(meeting.classId);
    const canDelete =
      isAdmin(user) ||
      meeting.createdById === user._id ||
      (classData && classData.classTeacherId === user._id);

    if (!canDelete) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have permission to delete this parent meeting",
      });
    }

    await ctx.db.delete(args.id);
  },
});

// List parent meetings for student/parent (for "My Invitations" page)
export const listForUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Get user to check role
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return [];
    }

    // Collect all relevant classIds for this user
    const relevantClassIds: Id<"classes">[] = [];

    // Check if user is a student and get their class
    const studentRecord = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (studentRecord?.classId) {
      relevantClassIds.push(studentRecord.classId);
    }

    // Check if user is a parent and get their children's classes
    if (user.role === "parent" || user.roles?.includes("parent")) {
      const parentRecord = await ctx.db
        .query("parents")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .first();

      if (parentRecord?.studentIds) {
        for (const studentId of parentRecord.studentIds) {
          const student = await ctx.db.get(studentId);
          if (student?.classId) {
            relevantClassIds.push(student.classId);
          }
        }
      }
    }

    if (relevantClassIds.length === 0) {
      return [];
    }

    // Get all parent meetings for relevant classes
    const allMeetings = await ctx.db.query("parentMeetings").collect();
    const relevantMeetings = allMeetings.filter((m) =>
      relevantClassIds.includes(m.classId)
    );

    // Enrich with class name and creator
    const enrichedMeetings = await Promise.all(
      relevantMeetings.map(async (meeting) => {
        const classData = await ctx.db.get(meeting.classId);
        const creator = await ctx.db.get(meeting.createdById);
        return {
          ...meeting,
          className: classData?.name || "Unknown",
          createdByName: buildUserName(creator),
        };
      })
    );

    // Sort by startDate descending
    enrichedMeetings.sort((a, b) => b.startDate - a.startDate);

    return enrichedMeetings;
  },
});
