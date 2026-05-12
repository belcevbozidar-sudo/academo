import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api.js";

// Helper to check if year is in the past (uses schoolYearStartDay setting)
async function isPastYearWithSettings(ctx: MutationCtx, academicYear: string, schoolId?: Id<"schools">): Promise<boolean> {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-11, September = 8
  const currentDay = now.getDate();
  const currentYear = now.getFullYear();
  
  // Get schoolYearStartDay from settings (default: 15)
  let schoolYearStartDay = 15;
  if (schoolId) {
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .unique();
    schoolYearStartDay = settings?.schoolYearStartDay ?? 15;
  }
  
  // Calculate the current academic year based on schoolYearStartDay
  let currentAcademicYearStart: number;
  if (currentMonth > 8 || (currentMonth === 8 && currentDay >= schoolYearStartDay)) {
    currentAcademicYearStart = currentYear;
  } else {
    currentAcademicYearStart = currentYear - 1;
  }
  
  const [startYear] = academicYear.split("/").map(Number);
  return startYear < currentAcademicYearStart;
}

// Simple helper for read-only contexts
function isPastYear(academicYear: string): boolean {
  const currentYear = new Date().getFullYear();
  const [startYear] = academicYear.split("/").map(Number);
  return startYear < currentYear;
}

// GET /day-regimes - List all day regimes with stats
export const list = query({
  args: {
    schoolId: v.optional(v.id("schools")),
    academicYear: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<
    Array<{
      _id: Id<"dayRegimes">;
      name: string;
      shift: 1 | 2 | "none";
      startTime: string;
      endTime: string;
      periodCount: number;
      academicYear: string;
      assignedClassesCount: number;
      exampleClassName: string | null;
    }>
  > => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Fetch day regimes
    const regimes = args.schoolId
      ? await ctx.db
          .query("dayRegimes")
          .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
          .collect()
      : await ctx.db.query("dayRegimes").collect();

    // Filter by academic year if provided
    const filteredRegimes = args.academicYear
      ? regimes.filter((r) => r.academicYear === args.academicYear)
      : regimes;

    // Enrich with assignment stats
    const enriched = await Promise.all(
      filteredRegimes.map(async (regime) => {
        const assignments = await ctx.db
          .query("dayRegimeAssignments")
          .withIndex("by_day_regime", (q) => q.eq("dayRegimeId", regime._id))
          .collect();

        let exampleClassName: string | null = null;
        if (assignments.length > 0) {
          const firstClass = await ctx.db.get(assignments[0].classId);
          if (firstClass) {
            exampleClassName = firstClass.name;
          }
        }

        return {
          _id: regime._id,
          name: regime.name,
          shift: regime.shift,
          startTime: regime.startTime,
          endTime: regime.endTime,
          periodCount: regime.periodCount,
          academicYear: regime.academicYear,
          assignedClassesCount: assignments.length,
          exampleClassName,
        };
      })
    );

    return enriched;
  },
});

// GET /day-regimes/:id - Get single day regime
export const getById = query({
  args: { id: v.id("dayRegimes") },
  handler: async (ctx, args): Promise<Doc<"dayRegimes"> | null> => {
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

// GET /day-regimes/:id/assignments - Get assignments for a regime
export const getAssignments = query({
  args: { dayRegimeId: v.id("dayRegimes") },
  handler: async (
    ctx,
    args
  ): Promise<
    Array<{
      _id: Id<"dayRegimeAssignments">;
      className: string;
      classGrade: number;
      academicYear: string;
    }>
  > => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const assignments = await ctx.db
      .query("dayRegimeAssignments")
      .withIndex("by_day_regime", (q) => q.eq("dayRegimeId", args.dayRegimeId))
      .collect();

    const enriched = await Promise.all(
      assignments.map(async (assignment) => {
        const classDoc = await ctx.db.get(assignment.classId);
        return {
          _id: assignment._id,
          className: classDoc?.name ?? "-",
          classGrade: classDoc?.grade ?? 0,
          academicYear: assignment.academicYear,
        };
      })
    );

    return enriched;
  },
});

// POST /day-regimes - Create day regime (blocked for past years)
export const create = mutation({
  args: {
    name: v.string(),
    shift: v.union(v.literal(1), v.literal(2), v.literal("none")),
    startTime: v.string(),
    endTime: v.string(),
    periodCount: v.number(),
    schoolId: v.id("schools"),
    academicYear: v.string(),
    periods: v.optional(v.array(v.object({
      periodNumber: v.number(),
      startTime: v.string(),
      duration: v.number(),
      endTime: v.string(),
    }))),
    hasDifferentRegimes: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"dayRegimes">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // ✅ PLATFORM SETTINGS: Check if class teacher can edit day regimes
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (currentUser) {
      const canEdit = await ctx.runQuery(internal.platformSettings.checkClassTeacherCanEditDayRegime, {
        schoolId: args.schoolId,
        userId: currentUser._id,
      });
      if (!canEdit) {
        throw new ConvexError({
          message: "Нямате права да редактирате дневни режими. Само администратори могат да правят промени.",
          code: "FORBIDDEN",
        });
      }
    }

    // Block creation for past years (uses schoolYearStartDay setting)
    if (await isPastYearWithSettings(ctx, args.academicYear, args.schoolId)) {
      throw new ConvexError({
        message: "Не може да добавяте дневни режими от предходни години.",
        code: "BAD_REQUEST",
      });
    }

    // Validate times
    if (args.startTime >= args.endTime) {
      throw new ConvexError({
        message: "Началният час трябва да е преди крайния час.",
        code: "BAD_REQUEST",
      });
    }

    return await ctx.db.insert("dayRegimes", {
      name: args.name,
      shift: args.shift,
      startTime: args.startTime,
      endTime: args.endTime,
      periodCount: args.periodCount,
      schoolId: args.schoolId,
      academicYear: args.academicYear,
      periods: args.periods,
      hasDifferentRegimes: args.hasDifferentRegimes,
    });
  },
});

// PATCH /day-regimes/:id - Update day regime (blocked for past years)
export const update = mutation({
  args: {
    id: v.id("dayRegimes"),
    name: v.optional(v.string()),
    shift: v.optional(v.union(v.literal(1), v.literal(2), v.literal("none"))),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    periodCount: v.optional(v.number()),
    periods: v.optional(v.array(v.object({
      periodNumber: v.number(),
      startTime: v.string(),
      duration: v.number(),
      endTime: v.string(),
    }))),
    hasDifferentRegimes: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const regime = await ctx.db.get(args.id);
    if (!regime) {
      throw new ConvexError({
        message: "Дневният режим не е намерен.",
        code: "NOT_FOUND",
      });
    }

    // ✅ PLATFORM SETTINGS: Check if class teacher can edit day regimes
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (currentUser) {
      const canEdit = await ctx.runQuery(internal.platformSettings.checkClassTeacherCanEditDayRegime, {
        schoolId: regime.schoolId,
        userId: currentUser._id,
      });
      if (!canEdit) {
        throw new ConvexError({
          message: "Нямате права да редактирате дневни режими. Само администратори могат да правят промени.",
          code: "FORBIDDEN",
        });
      }
    }

    // Block updates for past years (uses schoolYearStartDay setting)
    if (await isPastYearWithSettings(ctx, regime.academicYear, regime.schoolId)) {
      throw new ConvexError({
        message: "Не може да редактирате дневни режими от предходни години.",
        code: "BAD_REQUEST",
      });
    }

    const updates: Partial<Doc<"dayRegimes">> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.shift !== undefined) updates.shift = args.shift;
    if (args.startTime !== undefined) updates.startTime = args.startTime;
    if (args.endTime !== undefined) updates.endTime = args.endTime;
    if (args.periodCount !== undefined) updates.periodCount = args.periodCount;
    if (args.periods !== undefined) updates.periods = args.periods;
    if (args.hasDifferentRegimes !== undefined) updates.hasDifferentRegimes = args.hasDifferentRegimes;

    // Validate times if both present
    const finalStartTime = args.startTime ?? regime.startTime;
    const finalEndTime = args.endTime ?? regime.endTime;
    if (finalStartTime >= finalEndTime) {
      throw new ConvexError({
        message: "Началният час трябва да е преди крайния час.",
        code: "BAD_REQUEST",
      });
    }

    await ctx.db.patch(args.id, updates);
  },
});

// DELETE /day-regimes/:id - Delete day regime (blocked for past years)
export const remove = mutation({
  args: { id: v.id("dayRegimes") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const regime = await ctx.db.get(args.id);
    if (!regime) {
      throw new ConvexError({
        message: "Дневният режим не е намерен.",
        code: "NOT_FOUND",
      });
    }

    // ✅ PLATFORM SETTINGS: Check if class teacher can edit day regimes
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (currentUser) {
      const canEdit = await ctx.runQuery(internal.platformSettings.checkClassTeacherCanEditDayRegime, {
        schoolId: regime.schoolId,
        userId: currentUser._id,
      });
      if (!canEdit) {
        throw new ConvexError({
          message: "Нямате права да изтривате дневни режими. Само администратори могат да правят промени.",
          code: "FORBIDDEN",
        });
      }
    }

    // Block deletion for past years (uses schoolYearStartDay setting)
    if (await isPastYearWithSettings(ctx, regime.academicYear, regime.schoolId)) {
      throw new ConvexError({
        message: "Не може да изтривате дневни режими от предходни години.",
        code: "BAD_REQUEST",
      });
    }

    // Delete all assignments first
    const assignments = await ctx.db
      .query("dayRegimeAssignments")
      .withIndex("by_day_regime", (q) => q.eq("dayRegimeId", args.id))
      .collect();

    for (const assignment of assignments) {
      await ctx.db.delete(assignment._id);
    }

    await ctx.db.delete(args.id);
  },
});

// POST /day-regime-assignments - Assign day regime to class
export const assignToClass = mutation({
  args: {
    dayRegimeId: v.id("dayRegimes"),
    classId: v.id("classes"),
    termId: v.optional(v.id("terms")),
  },
  handler: async (ctx, args): Promise<Id<"dayRegimeAssignments">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const regime = await ctx.db.get(args.dayRegimeId);
    if (!regime) {
      throw new ConvexError({
        message: "Дневният режим не е намерен.",
        code: "NOT_FOUND",
      });
    }

    // Block assignment for past years (uses schoolYearStartDay setting)
    if (await isPastYearWithSettings(ctx, regime.academicYear, regime.schoolId)) {
      throw new ConvexError({
        message:
          "Не може да обвързвате дневни режими от предходни години към паралелки.",
        code: "BAD_REQUEST",
      });
    }

    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc) {
      throw new ConvexError({
        message: "Паралелката не е намерена.",
        code: "NOT_FOUND",
      });
    }

    // Check if assignment already exists
    const existing = await ctx.db
      .query("dayRegimeAssignments")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    const alreadyAssigned = existing.find(
      (a) =>
        a.dayRegimeId === args.dayRegimeId &&
        a.academicYear === regime.academicYear
    );

    if (alreadyAssigned) {
      throw new ConvexError({
        message: "Тази паралелка вече е обвързана към този дневен режим.",
        code: "CONFLICT",
      });
    }

    return await ctx.db.insert("dayRegimeAssignments", {
      dayRegimeId: args.dayRegimeId,
      classId: args.classId,
      termId: args.termId,
      academicYear: regime.academicYear,
    });
  },
});

// DELETE /day-regime-assignments/:id - Remove assignment
export const removeAssignment = mutation({
  args: { id: v.id("dayRegimeAssignments") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const assignment = await ctx.db.get(args.id);
    if (!assignment) {
      throw new ConvexError({
        message: "Обвързването не е намерено.",
        code: "NOT_FOUND",
      });
    }

    // Get schoolId from class for settings check
    const classDoc = await ctx.db.get(assignment.classId);
    const schoolId = classDoc?.schoolId;

    // Block removal for past years (uses schoolYearStartDay setting)
    if (await isPastYearWithSettings(ctx, assignment.academicYear, schoolId)) {
      throw new ConvexError({
        message: "Не може да премахвате обвързвания от предходни години.",
        code: "BAD_REQUEST",
      });
    }

    await ctx.db.delete(args.id);
  },
});
