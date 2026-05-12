import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Helper query and mutation for migration (not in Node.js)
export const getAllBadges = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("badges").collect();
  },
});

export const deleteBadge = internalMutation({
  args: { badgeId: v.id("badges") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.badgeId);
  },
});
