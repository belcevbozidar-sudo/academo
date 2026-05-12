import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const getBadgeBatch = internalQuery({
  args: {},
  handler: async (ctx) => {
    const badges = await ctx.db
      .query("badges")
      .take(100); // Delete in batches of 100
    
    return badges.map(b => b._id);
  },
});

export const deleteBadgeBatch = internalMutation({
  args: { badgeIds: v.array(v.id("badges")) },
  handler: async (ctx, args) => {
    for (const badgeId of args.badgeIds) {
      await ctx.db.delete(badgeId);
    }
  },
});
