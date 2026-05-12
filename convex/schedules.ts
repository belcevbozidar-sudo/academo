import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

// List schedules
export const listSchedules = query({
  args: {
    classId: v.optional(v.id("classes")),
    teacherId: v.optional(v.id("teachers")),
    dayOfWeek: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    let schedules;
    if (args.classId) {
      schedules = await ctx.db
        .query("schedules")
        .withIndex("by_class", (q) => q.eq("classId", args.classId!))
        .collect();
    } else if (args.teacherId) {
      schedules = await ctx.db
        .query("schedules")
        .withIndex("by_teacher", (q) => q.eq("teacherId", args.teacherId!))
        .collect();
    } else if (args.dayOfWeek) {
      schedules = await ctx.db
        .query("schedules")
        .withIndex("by_day", (q) => q.eq("dayOfWeek", args.dayOfWeek!))
        .collect();
    } else {
      schedules = await ctx.db.query("schedules").collect();
    }

    // Enrich with subject, teacher, class names
    const enrichedSchedules = await Promise.all(
      schedules.map(async (schedule) => {
        const subject = await ctx.db.get(schedule.subjectId);
        const teacher = await ctx.db.get(schedule.teacherId);
        const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;
        const classData = await ctx.db.get(schedule.classId);

        return {
          ...schedule,
          subjectName: subject?.name,
          teacherName: teacherUser?.name,
          className: classData?.name,
        };
      })
    );

    return enrichedSchedules;
  },
});

// Create schedule entry
export const createSchedule = mutation({
  args: {
    classId: v.id("classes"),
    dayOfWeek: v.number(),
    period: v.number(),
    subjectId: v.id("subjects"),
    teacherId: v.id("teachers"),
    room: v.optional(v.string()),
    weekType: v.optional(v.union(v.literal("odd"), v.literal("even"))),
    termId: v.optional(v.id("terms")),
  },
  handler: async (ctx, args): Promise<Id<"schedules">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    return await ctx.db.insert("schedules", args);
  },
});

// Update schedule
export const updateSchedule = mutation({
  args: {
    id: v.id("schedules"),
    subjectId: v.optional(v.id("subjects")),
    teacherId: v.optional(v.id("teachers")),
    room: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

// Delete schedule
export const deleteSchedule = mutation({
  args: { id: v.id("schedules") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    await ctx.db.delete(args.id);
  },
});

// Get teacher's schedule for a day
export const getTeacherDaySchedule = query({
  args: {
    teacherId: v.id("teachers"),
    dayOfWeek: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const schedules = await ctx.db
      .query("schedules")
      .withIndex("by_teacher", (q) => q.eq("teacherId", args.teacherId))
      .collect();

    const daySchedules = schedules.filter((s) => s.dayOfWeek === args.dayOfWeek);

    // Sort by period
    daySchedules.sort((a, b) => a.period - b.period);

    // Enrich with data
    const enrichedSchedules = await Promise.all(
      daySchedules.map(async (schedule) => {
        const subject = await ctx.db.get(schedule.subjectId);
        const classData = await ctx.db.get(schedule.classId);

        return {
          ...schedule,
          subjectName: subject?.name,
          className: classData?.name,
        };
      })
    );

    return enrichedSchedules;
  },
});

// TERMS
export const listTerms = query({
  args: {
    schoolId: v.optional(v.id("schools")),
    academicYear: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    let terms;
    if (args.schoolId) {
      terms = await ctx.db
        .query("terms")
        .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
        .collect();
    } else if (args.academicYear) {
      terms = await ctx.db
        .query("terms")
        .withIndex("by_academic_year", (q) => q.eq("academicYear", args.academicYear!))
        .collect();
    } else {
      terms = await ctx.db.query("terms").collect();
    }

    return terms;
  },
});

export const createTerm = mutation({
  args: {
    name: v.string(),
    schoolId: v.id("schools"),
    startDate: v.number(),
    endDate: v.number(),
    academicYear: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"terms">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    return await ctx.db.insert("terms", args);
  },
});

// NON-SCHOOL DAYS
export const listNonSchoolDays = query({
  args: {
    schoolId: v.optional(v.id("schools")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const nonSchoolDays = args.schoolId
      ? await ctx.db
          .query("nonSchoolDays")
          .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
          .collect()
      : await ctx.db.query("nonSchoolDays").collect();

    // Filter by date range
    if (args.startDate && args.endDate) {
      return nonSchoolDays.filter(
        (day) =>
          day.startDate >= args.startDate! && day.endDate <= args.endDate!
      );
    }

    return nonSchoolDays;
  },
});

// Get subjects from class schedule for a specific date (based on day of week)
export const getClassScheduleSubjects = query({
  args: {
    classId: v.id("classes"),
    date: v.number(), // timestamp
    dayOfWeek: v.optional(v.number()), // Optional: pass day of week directly from frontend (1 = Monday, 7 = Sunday)
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Use provided dayOfWeek or calculate from date
    // If dayOfWeek is provided from frontend, use it (calculated in client's timezone)
    let dayOfWeek = args.dayOfWeek;
    
    if (dayOfWeek === undefined) {
      // Fallback: calculate from date (may have timezone issues)
      const dateObj = new Date(args.date);
      dayOfWeek = dateObj.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
      if (dayOfWeek === 0) dayOfWeek = 7; // Convert Sunday from 0 to 7
    }

    // Get all schedules for this class and day
    const schedules = await ctx.db
      .query("schedules")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    const daySchedules = schedules.filter((s) => s.dayOfWeek === dayOfWeek);

    // Get unique subjects with their periods
    const subjectMap = new Map<string, { subjectId: Id<"subjects">; subjectName: string; periods: number[] }>();

    for (const schedule of daySchedules) {
      const subject = await ctx.db.get(schedule.subjectId);
      if (subject) {
        const existing = subjectMap.get(schedule.subjectId);
        if (existing) {
          existing.periods.push(schedule.period);
        } else {
          subjectMap.set(schedule.subjectId, {
            subjectId: schedule.subjectId,
            subjectName: subject.name,
            periods: [schedule.period],
          });
        }
      }
    }

    return Array.from(subjectMap.values()).sort((a, b) => a.subjectName.localeCompare(b.subjectName));
  },
});

// Validate if a subject exists in class schedule at a specific period on a specific date
export const validateScheduleEntry = query({
  args: {
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    date: v.number(), // timestamp
    period: v.number(),
    dayOfWeek: v.optional(v.number()), // Optional: pass day of week directly from frontend (1 = Monday, 7 = Sunday)
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Use provided dayOfWeek or calculate from date
    let dayOfWeek = args.dayOfWeek;
    
    if (dayOfWeek === undefined) {
      const dateObj = new Date(args.date);
      dayOfWeek = dateObj.getUTCDay();
      if (dayOfWeek === 0) dayOfWeek = 7;
    }

    // Get weekly schedule for this class (term-aware filtering)
    const allClassSchedules = await ctx.db
      .query("weeklySchedules")
      .filter((q) => q.eq(q.field("classId"), args.classId))
      .collect();
    const allTermsForValidation = await ctx.db.query("terms").collect();
    const activeTermForValidation = allTermsForValidation.find(t => args.date >= t.startDate && args.date <= t.endDate);
    const filteredClassSchedules = allClassSchedules.filter(s => {
      if (!activeTermForValidation) return true;
      if (s.termId && s.termId !== activeTermForValidation._id) return false;
      return true;
    });
    const weeklySchedule = filteredClassSchedules[0] ?? null;

    if (!weeklySchedule || !weeklySchedule.entries) {
      return {
        isValid: false,
        message: "Няма разписание за този клас",
      };
    }

    const entries = weeklySchedule.entries as Array<{
      dayOfWeek: number;
      periodIndex: number;
      subjectId: Id<"subjects">;
      teacherId: Id<"teachers">;
    }>;

    // Find matching schedule entry
    const matchingEntry = entries.find(
      (e) =>
        e.dayOfWeek === dayOfWeek &&
        e.periodIndex === args.period &&
        e.subjectId === args.subjectId
    );

    if (matchingEntry) {
      const subject = await ctx.db.get(args.subjectId);
      return {
        isValid: true,
        subjectName: subject?.name,
        period: args.period,
        dayOfWeek,
      };
    }

    // Check what subject is actually scheduled at this period
    const actualEntry = entries.find(
      (e) => e.dayOfWeek === dayOfWeek && e.periodIndex === args.period
    );

    if (actualEntry) {
      const actualSubject = await ctx.db.get(actualEntry.subjectId);
      return {
        isValid: false,
        message: `На този час (${args.period}) е планиран "${actualSubject?.name || "друг предмет"}", а не избрания предмет`,
        actualSubjectName: actualSubject?.name,
      };
    }

    return {
      isValid: false,
      message: `Ученикът няма час на ${args.period}-ти период на този ден`,
    };
  },
});

export const createNonSchoolDay = mutation({
  args: {
    name: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    category: v.string(),
    schoolId: v.id("schools"),
    appliesToAllClasses: v.boolean(),
    classIds: v.optional(v.array(v.id("classes"))),
  },
  handler: async (ctx, args): Promise<Id<"nonSchoolDays">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    return await ctx.db.insert("nonSchoolDays", args);
  },
});
