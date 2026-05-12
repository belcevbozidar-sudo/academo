import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

// Get current user's notifications (latest first)
export const getMyNotifications = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<Array<{
    _id: Id<"notifications">;
    _creationTime: number;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    actionUrl?: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    const limit = args.limit || 50;

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    return notifications;
  },
});

// Get count of unread notifications
export const getUnreadCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return 0;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      return 0;
    }

    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_read", (q) =>
        q.eq("userId", user._id).eq("isRead", false)
      )
      .collect();

    return unreadNotifications.length;
  },
});

// Mark a single notification as read
export const markAsRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    const notification = await ctx.db.get(args.notificationId);

    if (!notification) {
      throw new ConvexError({
        message: "Notification not found",
        code: "NOT_FOUND",
      });
    }

    if (notification.userId !== user._id) {
      throw new ConvexError({
        message: "Not authorized to mark this notification as read",
        code: "FORBIDDEN",
      });
    }

    await ctx.db.patch(args.notificationId, { isRead: true });
  },
});

// Mark all notifications as read
export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_read", (q) =>
        q.eq("userId", user._id).eq("isRead", false)
      )
      .collect();

    for (const notification of unreadNotifications) {
      await ctx.db.patch(notification._id, { isRead: true });
    }
  },
});

// Internal mutation to create a notification (called by other backend functions)
export const createNotification = internalMutation({
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("new_grade"),
      v.literal("new_absence"),
      v.literal("new_late"),
      v.literal("new_excused"),
      v.literal("new_praise"),
      v.literal("new_warning"),
      v.literal("teacher_absence_approved"),
      v.literal("teacher_substitution"),
      v.literal("new_event"),
      v.literal("new_assignment"),
      v.literal("new_message"),
      v.literal("new_homework"),
      v.literal("admin_alert"),
      v.literal("grade_delete_request"),
      v.literal("grade_delete_approved"),
      v.literal("grade_delete_rejected"),
      v.literal("new_student_support"),
      v.literal("new_parent_meeting")
    ),
    title: v.string(),
    message: v.string(),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
    actionUrl: v.optional(v.string()),
    schoolId: v.optional(v.id("schools")),
  },
  handler: async (ctx, args): Promise<Id<"notifications">> => {
    const notificationId = await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      title: args.title,
      message: args.message,
      isRead: false,
      relatedEntityType: args.relatedEntityType,
      relatedEntityId: args.relatedEntityId,
      actionUrl: args.actionUrl,
      schoolId: args.schoolId,
    });

    return notificationId;
  },
});
