"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";

export const runSync = action({
  args: {},
  handler: async (ctx): Promise<{ created: number; existing: number; errors: number }> => {
    const result = await ctx.runMutation(api.admin.syncTeachers);
    return result;
  },
});
