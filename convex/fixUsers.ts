"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api.js";

// One-time fix to set isDeleted: false for all users who don't have it set
export const fixIsDeletedField = internalAction({
  args: {},
  handler: async (ctx): Promise<{ fixed: number }> => {
    const users = await ctx.runQuery(internal.users.getAllUsersForFix);
    let fixedCount = 0;

    for (const user of users) {
      if (user.isDeleted === undefined || user.isDeleted === true) {
        await ctx.runMutation(internal.users.setIsDeletedFalse, {
          userId: user._id,
        });
        fixedCount++;
      }
    }

    return { fixed: fixedCount };
  },
});
