"use node";

import { ConvexError } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

// Create assignment action
export const createAssignmentAction = action({
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

    const assignmentId = await ctx.runMutation(
      internal.assignments.createAssignmentInternal,
      args
    );

    return assignmentId;
  },
});
