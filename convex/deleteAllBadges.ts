"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";

export const deleteAllBadges = action({
  args: {},
  handler: async (ctx): Promise<{ deletedCount: number }> => {
    console.log("Starting to delete all badges...");
    
    let deletedCount = 0;
    let hasMore = true;
    
    while (hasMore) {
      // Get a batch of badges (paginated to avoid hitting limits)
      const batch = await ctx.runQuery(internal.deleteAllBadgesHelpers.getBadgeBatch, {});
      
      if (batch.length === 0) {
        hasMore = false;
        break;
      }
      
      // Delete this batch
      await ctx.runMutation(internal.deleteAllBadgesHelpers.deleteBadgeBatch, { 
        badgeIds: batch 
      });
      
      deletedCount += batch.length;
      console.log(`Deleted ${batch.length} badges. Total: ${deletedCount}`);
    }
    
    console.log(`Finished! Total badges deleted: ${deletedCount}`);
    return { deletedCount };
  },
});
