import { action } from "./_generated/server";
import { internal } from "./_generated/api";

// Публична функция за стартиране на миграцията
export const runMigration = action({
  args: {},
  handler: async (ctx): Promise<{ deleted: number; message: string }> => {
    return await ctx.runAction(internal.migrateBadgesV2.runBadgeMigration, {});
  },
});
