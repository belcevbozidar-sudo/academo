import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";

// List all non-school days
export const listNonSchoolDays = query({
  args: {},
  handler: async (ctx): Promise<Array<{
    _id: string;
    name: string;
    startDate: number;
    endDate: number;
    category: string;
    classNames: string;
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

    // If no school, return empty array
    if (!user.schoolId) {
      return [];
    }

    const nonSchoolDays = await ctx.db
      .query("nonSchoolDays")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .order("desc")
      .collect();

    return Promise.all(
      nonSchoolDays.map(async (day) => {
        let classNames = "Цялото училище";
        if (!day.appliesToAllClasses && day.classIds && day.classIds.length > 0) {
          const classes = await Promise.all(
            day.classIds.map((id) => ctx.db.get(id))
          );
          classNames = classes.filter(Boolean).map((c) => c!.name).join(", ");
        }
        return {
          _id: day._id,
          name: day.name,
          startDate: day.startDate,
          endDate: day.endDate,
          category: day.category,
          classNames,
        };
      })
    );
  },
});

// Create a non-school day
export const createNonSchoolDay = mutation({
  args: {
    name: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    category: v.string(),
    appliesToAllClasses: v.boolean(),
    classIds: v.optional(v.array(v.id("classes"))),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
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

    if (!user || !user.schoolId) {
      throw new ConvexError({
        message: "User not found or has no school",
        code: "NOT_FOUND",
      });
    }

    const dayId = await ctx.db.insert("nonSchoolDays", {
      name: args.name,
      startDate: args.startDate,
      endDate: args.endDate,
      category: args.category,
      schoolId: user.schoolId,
      appliesToAllClasses: args.appliesToAllClasses,
      classIds: args.classIds,
    });

    return dayId;
  },
});

// Get a single non-school day by ID
export const getById = query({
  args: { id: v.id("nonSchoolDays") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }
    return await ctx.db.get(args.id);
  },
});

// Update a non-school day
export const updateNonSchoolDay = mutation({
  args: {
    id: v.id("nonSchoolDays"),
    name: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    category: v.optional(v.string()),
    appliesToAllClasses: v.optional(v.boolean()),
    classIds: v.optional(v.array(v.id("classes"))),
  },
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

    // Check if user has admin privileges
    const isAdmin = ["system_admin", "director", "vice_director"].includes(user.role);
    if (!isAdmin) {
      throw new ConvexError({
        message: "Only admins can update non-school days",
        code: "FORBIDDEN",
      });
    }

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError({
        message: "Non-school day not found",
        code: "NOT_FOUND",
      });
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.startDate !== undefined) updates.startDate = args.startDate;
    if (args.endDate !== undefined) updates.endDate = args.endDate;
    if (args.category !== undefined) updates.category = args.category;
    if (args.appliesToAllClasses !== undefined) updates.appliesToAllClasses = args.appliesToAllClasses;
    if (args.classIds !== undefined) updates.classIds = args.classIds;

    await ctx.db.patch(args.id, updates);
  },
});

// Delete a non-school day
export const deleteNonSchoolDay = mutation({
  args: { id: v.id("nonSchoolDays") },
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

    // Check if user has admin privileges
    const isAdmin = ["system_admin", "director", "vice_director"].includes(user.role);
    if (!isAdmin) {
      throw new ConvexError({
        message: "Only admins can delete non-school days",
        code: "FORBIDDEN",
      });
    }

    await ctx.db.delete(args.id);
  },
});

// Get non-school days for a specific week and class
export const getNonSchoolDaysForWeek = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    classId: v.optional(v.id("classes")),
  },
  handler: async (ctx, args): Promise<Array<{
    _id: Id<"nonSchoolDays">;
    name: string;
    startDate: number;
    endDate: number;
    category: string;
    affectedDays: number[]; // Array of day numbers (1-5) that are non-school days
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

    if (!user || !user.schoolId) {
      return [];
    }

    // Get all non-school days for this school
    const allNonSchoolDays = await ctx.db
      .query("nonSchoolDays")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .collect();

    // Filter to those that overlap with the requested week
    const result: Array<{
      _id: Id<"nonSchoolDays">;
      name: string;
      startDate: number;
      endDate: number;
      category: string;
      affectedDays: number[];
    }> = [];

    for (const day of allNonSchoolDays) {
      // Check if this non-school day overlaps with the week
      if (day.endDate < args.startDate || day.startDate > args.endDate) {
        continue; // No overlap
      }

      // Check if it applies to this class
      if (!day.appliesToAllClasses && args.classId) {
        if (!day.classIds || !day.classIds.includes(args.classId)) {
          continue; // Doesn't apply to this class
        }
      }

      // Calculate which days of the week are affected (1 = Monday, 5 = Friday)
      const affectedDays: number[] = [];
      
      // Iterate through each day of the week
      const weekStart = new Date(args.startDate);
      for (let i = 0; i < 5; i++) { // Monday to Friday
        const currentDay = new Date(weekStart);
        currentDay.setDate(currentDay.getDate() + i);
        const currentDayTimestamp = currentDay.getTime();
        
        // Check if this day falls within the non-school day period
        // Normalize to start of day for comparison
        const dayStart = new Date(day.startDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day.endDate);
        dayEnd.setHours(23, 59, 59, 999);
        
        if (currentDayTimestamp >= dayStart.getTime() && currentDayTimestamp <= dayEnd.getTime()) {
          affectedDays.push(i + 1); // 1-indexed (1 = Monday)
        }
      }

      if (affectedDays.length > 0) {
        result.push({
          _id: day._id,
          name: day.name,
          startDate: day.startDate,
          endDate: day.endDate,
          category: day.category,
          affectedDays,
        });
      }
    }

    return result;
  },
});

// Check if a specific date is a non-school day
export const checkDateIsNonSchoolDay = query({
  args: { 
    date: v.number(), // UTC timestamp for the date to check
  },
  handler: async (ctx, args): Promise<{
    isNonSchoolDay: boolean;
    nonSchoolDay: {
      name: string;
      category: string;
    } | null;
  }> => {
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

    if (!user || !user.schoolId) {
      return { isNonSchoolDay: false, nonSchoolDay: null };
    }

    // Get all non-school days for the user's school
    const allNonSchoolDays = await ctx.db
      .query("nonSchoolDays")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .collect();

    // Check if the date falls within any non-school day
    const checkDate = new Date(args.date);
    checkDate.setUTCHours(12, 0, 0, 0); // Set to noon to avoid timezone issues

    for (const day of allNonSchoolDays) {
      const dayStart = new Date(day.startDate);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(day.endDate);
      dayEnd.setUTCHours(23, 59, 59, 999);

      if (checkDate.getTime() >= dayStart.getTime() && checkDate.getTime() <= dayEnd.getTime()) {
        // Check if it applies to all classes (for teachers, we check all classes)
        if (day.appliesToAllClasses) {
          return {
            isNonSchoolDay: true,
            nonSchoolDay: {
              name: day.name,
              category: day.category,
            },
          };
        }
      }
    }

    return { isNonSchoolDay: false, nonSchoolDay: null };
  },
});
