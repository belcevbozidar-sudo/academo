import { query } from "./_generated/server";
import { ConvexError } from "convex/values";

// Get current user's extra hours schedules
export const getMyExtraHours = query({
  args: {},
  handler: async (ctx): Promise<Array<{
    _id: string;
    title: string;
    period: string;
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
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    const teacher = await ctx.db
      .query("teachers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (!teacher) {
      return [];
    }

    const extraHours = await ctx.db
      .query("extraHours")
      .withIndex("by_teacher", (q) => q.eq("teacherId", teacher._id))
      .order("desc")
      .collect();

    return extraHours.map((eh) => {
      const startDate = new Date(eh.startDate);
      const endDate = new Date(eh.endDate);
      const period = `${startDate.toLocaleDateString('bg-BG')} - ${endDate.toLocaleDateString('bg-BG')} (${eh.workingDays} работни дни)`;

      return {
        _id: eh._id,
        title: eh.title,
        period,
      };
    });
  },
});

// Get all extra hours schedules (for admins/directors)
export const getAllExtraHours = query({
  args: {},
  handler: async (ctx): Promise<Array<{
    _id: string;
    title: string;
    teacher: string;
    period: string;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const extraHours = await ctx.db
      .query("extraHours")
      .order("desc")
      .collect();

    const result = await Promise.all(
      extraHours.map(async (eh) => {
        const teacher = await ctx.db.get(eh.teacherId);
        const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;
        const teacherName = teacherUser 
          ? `${teacherUser.firstName} ${teacherUser.lastName}`
          : "-";

        const startDate = new Date(eh.startDate);
        const endDate = new Date(eh.endDate);
        const period = `${startDate.toLocaleDateString('bg-BG')} - ${endDate.toLocaleDateString('bg-BG')} (${eh.workingDays} работни дни)`;

        return {
          _id: eh._id,
          title: eh.title,
          teacher: teacherName,
          period,
        };
      })
    );

    return result;
  },
});
