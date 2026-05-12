import { ConvexError } from "convex/values";
import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

// Get my assignments (for current teacher)
export const getMyAssignments = query({
  args: {},
  handler: async (ctx): Promise<
    Array<{
      _id: Id<"assignments">;
      title: string;
      type: string;
      description?: string;
      status: "pending" | "in_progress" | "completed" | "not_completed";
      className: string;
      subjectName: string;
      dueDate?: number;
      assignedDate: number;
      isExtended?: boolean;
      targetType?: "class" | "activity";
    }>
  > => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Get user
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
      return [];
    }

    // Get assignments
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_teacher", (q) => q.eq("teacherId", teacher._id))
      .collect();

    // Enrich with class and subject names
    const enrichedAssignments = await Promise.all(
      assignments.map(async (assignment) => {
        const classData = assignment.classId ? await ctx.db.get(assignment.classId) : null;
        const subject = assignment.subjectId ? await ctx.db.get(assignment.subjectId) : null;
        const activity = assignment.extracurricularActivityId 
          ? await ctx.db.get(assignment.extracurricularActivityId) 
          : null;

        // Count participants
        const participants = await ctx.db
          .query("assignmentParticipants")
          .withIndex("by_assignment", (q) => q.eq("assignmentId", assignment._id))
          .collect();

        return {
          _id: assignment._id,
          title: assignment.title,
          type: assignment.type,
          description: assignment.description,
          status: assignment.status,
          className: classData?.name || (activity?.name || "Неизвестен клас"),
          subjectName: subject?.name || (activity ? "Извънкласна дейност" : "Неизвестен предмет"),
          dueDate: assignment.dueDate,
          assignedDate: assignment.assignedDate,
          targetType: assignment.targetType,
          isExtended: assignment.isExtended,
          participantCount: participants.length,
        };
      })
    );

    return enrichedAssignments.sort((a, b) => b.assignedDate - a.assignedDate);
  },
});
