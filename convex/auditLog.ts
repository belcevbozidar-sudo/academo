import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

// ✅ FIX 3: AUDIT LOG СИСТЕМА
// Записва всички критични операции в системата

// Internal mutation for logging - called from other backend functions
export const logInternal = internalMutation({
  args: {
    userId: v.id("users"),
    action: v.string(),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    details: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    schoolId: v.optional(v.id("schools")),
  },
  handler: async (ctx, args): Promise<Id<"auditLog">> => {
    return await ctx.db.insert("auditLog", args);
  },
});

// Public mutation - requires authentication
export const log = mutation({
  args: {
    userId: v.id("users"),
    action: v.string(),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    details: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    schoolId: v.optional(v.id("schools")),
  },
  handler: async (ctx, args): Promise<Id<"auditLog">> => {
    // ✅ SECURITY FIX: Require authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Verify the userId matches the current user or the user is an admin
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Only allow logging for self or if admin
    const isAdmin = currentUser.role === "system_admin" || 
      currentUser.role === "director" || 
      currentUser.role === "vice_director" ||
      currentUser.roles?.includes("system_admin") ||
      currentUser.roles?.includes("director") ||
      currentUser.roles?.includes("vice_director");

    if (args.userId !== currentUser._id && !isAdmin) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot log actions for other users",
      });
    }

    return await ctx.db.insert("auditLog", args);
  },
});

export const getRecentLogs = query({
  args: {
    userId: v.optional(v.id("users")),
    action: v.optional(v.string()),
    schoolId: v.optional(v.id("schools")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // ✅ SECURITY FIX: Require authentication and admin role
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
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // ✅ SECURITY: Only admins can view audit logs
    const isAdminUser = 
      currentUser.role === "system_admin" || 
      currentUser.role === "director" || 
      currentUser.role === "vice_director" ||
      currentUser.roles?.includes("system_admin") ||
      currentUser.roles?.includes("director") ||
      currentUser.roles?.includes("vice_director");

    if (!isAdminUser) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Само администратори могат да преглеждат одит логовете",
      });
    }

    let logs;

    if (args.userId) {
      logs = await ctx.db
        .query("auditLog")
        .withIndex("by_user", (q) => q.eq("userId", args.userId!))
        .order("desc")
        .take(args.limit || 100);
    } else if (args.action) {
      logs = await ctx.db
        .query("auditLog")
        .withIndex("by_action", (q) => q.eq("action", args.action!))
        .order("desc")
        .take(args.limit || 100);
    } else if (args.schoolId) {
      logs = await ctx.db
        .query("auditLog")
        .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
        .order("desc")
        .take(args.limit || 100);
    } else {
      logs = await ctx.db
        .query("auditLog")
        .order("desc")
        .take(args.limit || 100);
    }

    // Enrich with user names
    const enrichedLogs = await Promise.all(
      logs.map(async (log) => {
        const user = await ctx.db.get(log.userId);
        return {
          ...log,
          userName: user?.name || "Неизвестен",
        };
      })
    );

    return enrichedLogs;
  },
});
