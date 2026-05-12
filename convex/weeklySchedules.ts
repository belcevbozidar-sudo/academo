import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { buildUserName } from "./users.js";
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
  // If we're past September schoolYearStartDay, we're in the new academic year
  let currentAcademicYearStart: number;
  if (currentMonth > 8 || (currentMonth === 8 && currentDay >= schoolYearStartDay)) {
    // We're in the new academic year (September onwards)
    currentAcademicYearStart = currentYear;
  } else {
    // We're still in the previous academic year (before September)
    currentAcademicYearStart = currentYear - 1;
  }
  
  const [startYear] = academicYear.split("/").map(Number);
  return startYear < currentAcademicYearStart;
}

// Simple helper for read-only contexts (uses current year approximation)
function isPastYear(academicYear: string): boolean {
  const currentYear = new Date().getFullYear();
  const [startYear] = academicYear.split("/").map(Number);
  return startYear < currentYear;
}

// GET /weekly-schedules - List all weekly schedules with stats
export const list = query({
  args: {
    classId: v.optional(v.id("classes")),
    termId: v.optional(v.id("terms")),
    schoolId: v.optional(v.id("schools")),
    academicYear: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    Array<{
      _id: Id<"weeklySchedules">;
      className: string;
      classType: string;
      termNumber: number;
      scheduleCount: number;
      weekCount: number;
      dayRegimeName: string | null;
    }>
  > => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Build query based on filters
    let schedules: Doc<"weeklySchedules">[];

    if (args.classId) {
      schedules = await ctx.db
        .query("weeklySchedules")
        .withIndex("by_class", (q) => q.eq("classId", args.classId!))
        .collect();
    } else if (args.schoolId) {
      schedules = await ctx.db
        .query("weeklySchedules")
        .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
        .collect();
    } else {
      schedules = await ctx.db.query("weeklySchedules").collect();
    }
    
    // Filter by termId if provided
    if (args.termId) {
      schedules = schedules.filter((s) => s.termId === args.termId);
    }

    // Filter by academic year if provided
    if (args.academicYear) {
      schedules = schedules.filter((s) => s.academicYear === args.academicYear);
    }

    // Enrich with related data
    const enriched = await Promise.all(
      schedules.map(async (schedule) => {
        const classDoc = await ctx.db.get(schedule.classId);
        const term = schedule.termId ? await ctx.db.get(schedule.termId) : null;
        let dayRegimeName: string | null = null;

        if (schedule.dayRegimeId) {
          const dayRegime = await ctx.db.get(schedule.dayRegimeId);
          dayRegimeName = dayRegime?.name ?? null;
        }

        return {
          _id: schedule._id,
          className: classDoc?.name ?? "-",
          classType: classDoc?.diaryType ?? "Основен клас",
          termNumber: term?.name.includes("Първи") ? 1 : 2,
          scheduleCount: 1, // One schedule per class/term combination
          weekCount: schedule.weekCount,
          dayRegimeName,
        };
      })
    );

    return enriched;
  },
});

// Get subjects from weekly schedule for a specific class
export const getSubjectsFromSchedule = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args): Promise<Array<{
    _id: Id<"subjects">;
    name: string;
    shortName: string;
    group?: string;
    isPrimary: boolean;
    schoolId: Id<"schools">;
    _creationTime: number;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get all weekly schedules for this class
    const schedules = await ctx.db
      .query("weeklySchedules")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Collect all unique subject IDs from schedule entries with their first occurrence
    const subjectFirstOccurrence = new Map<Id<"subjects">, { dayOfWeek: number; periodIndex: number }>();
    
    for (const schedule of schedules) {
      for (const entry of schedule.entries) {
        const existing = subjectFirstOccurrence.get(entry.subjectId);
        // If this subject hasn't been seen yet, or this occurrence is earlier
        if (!existing || 
            entry.dayOfWeek < existing.dayOfWeek || 
            (entry.dayOfWeek === existing.dayOfWeek && entry.periodIndex < existing.periodIndex)) {
          subjectFirstOccurrence.set(entry.subjectId, { 
            dayOfWeek: entry.dayOfWeek, 
            periodIndex: entry.periodIndex 
          });
        }
      }
    }

    // Fetch subject details
    const subjectsWithOccurrence = await Promise.all(
      Array.from(subjectFirstOccurrence.entries()).map(async ([subjectId, occurrence]) => {
        const subject = await ctx.db.get(subjectId);
        return subject ? { ...subject, firstOccurrence: occurrence } : null;
      })
    );

    // Sort by first occurrence (day of week, then period index)
    const sortedSubjects = subjectsWithOccurrence
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => {
        if (a.firstOccurrence.dayOfWeek !== b.firstOccurrence.dayOfWeek) {
          return a.firstOccurrence.dayOfWeek - b.firstOccurrence.dayOfWeek;
        }
        return a.firstOccurrence.periodIndex - b.firstOccurrence.periodIndex;
      });

    // Return without the firstOccurrence field
    return sortedSubjects.map(({ firstOccurrence, ...subject }) => subject);
  },
});

// Get all subjects for a class from classSubjects table only
// Each unique subject+preparationType combination has a unique key
// Also includes teacher information for each subject
export const getSubjectsForClass = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args): Promise<Array<{
    _id: Id<"subjects">;
    uniqueKey: string; // Unique key combining subject ID and preparation type
    name: string;
    displayName: string;
    shortName: string;
    group?: string;
    isPrimary: boolean;
    schoolId: Id<"schools">;
    preparationType?: string;
    _creationTime: number;
    // Teacher information
    teacherId?: Id<"teachers">;
    teacherUserId?: Id<"users">;
    teacherName?: string;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Helper to normalize preparation type
    // ЗП, ООП, undefined, empty string are all treated as "default" (no suffix shown)
    const normalizePrep = (prep: string | undefined): string => {
      if (!prep || prep === "ЗП" || prep === "ООП") return "DEFAULT";
      return prep;
    };

    // Track unique subject+preparationType+teacher combinations
    // Each combination gets a unique key for selection
    const subjectPrepMap = new Map<string, { 
      subjectId: Id<"subjects">; 
      preparationType: string; 
      originalPrepType: string;
      teacherId?: Id<"teachers">;
    }>();

    // First, get subjects from classSubjects table (immediate updates when class is edited)
    const classSubjects = await ctx.db
      .query("classSubjects")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    for (const cs of classSubjects) {
      const originalPrepType = cs.preparationType || "ЗП";
      const normalizedPrepType = normalizePrep(originalPrepType);
      // Use subjectId + normalized prep type + teacherId as key to preserve different teachers
      const key = `${cs.subjectId}__${normalizedPrepType}__${cs.teacherId || "none"}`;
      
      if (!subjectPrepMap.has(key)) {
        subjectPrepMap.set(key, { 
          subjectId: cs.subjectId, 
          preparationType: normalizedPrepType,
          originalPrepType,
          teacherId: cs.teacherId,
        });
      }
    }

    // Detect which subject+prepType combos have multiple teachers
    const subjectPrepTeacherCount = new Map<string, number>();
    for (const [, { subjectId, preparationType }] of subjectPrepMap.entries()) {
      const countKey = `${subjectId}__${preparationType}`;
      subjectPrepTeacherCount.set(countKey, (subjectPrepTeacherCount.get(countKey) || 0) + 1);
    }

    // Fetch all subject details and teacher names
    const subjects = await Promise.all(
      Array.from(subjectPrepMap.entries()).map(async ([uniqueKey, { subjectId, preparationType, teacherId }]) => {
        const subject = await ctx.db.get(subjectId);
        if (!subject) return null;
        
        // Get teacher info
        let teacherName: string | undefined;
        let teacherUserId: Id<"users"> | undefined;
        if (teacherId) {
          const teacher = await ctx.db.get(teacherId);
          if (teacher) {
            teacherUserId = teacher.userId;
            const teacherUser = await ctx.db.get(teacher.userId);
            if (teacherUser) {
              teacherName = `${teacherUser.firstName || ""} ${teacherUser.lastName || ""}`.trim();
            }
          }
        }
        
        // Create display name - show suffix only for non-default types
        const isDefaultType = preparationType === "DEFAULT";
        let displayName = isDefaultType 
          ? subject.name
          : `${subject.name} (${preparationType})`;
        
        // Append teacher name if this subject has multiple teachers
        const countKey = `${subjectId}__${preparationType}`;
        const hasMultipleTeachers = (subjectPrepTeacherCount.get(countKey) || 0) > 1;
        if (hasMultipleTeachers && teacherName) {
          // Use short teacher name: first initial + last name
          const parts = teacherName.split(" ");
          const shortTeacher = parts.length >= 2 
            ? `${parts[0].charAt(0)}. ${parts.slice(1).join(" ")}` 
            : teacherName;
          displayName = `${displayName} - ${shortTeacher}`;
        }
        
        return {
          ...subject,
          uniqueKey, // Include the unique key
          displayName,
          preparationType: isDefaultType ? undefined : preparationType,
          teacherId,
          teacherUserId,
          teacherName,
        };
      })
    );

    // Filter out nulls and sort alphabetically by displayName
    return subjects
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "bg"));
  },
});

// Get subjects for a class filtered by the current teacher
// Only returns subjects that the current teacher teaches in this class
export const getSubjectsForClassByTeacher = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args): Promise<Array<{
    _id: Id<"subjects">;
    uniqueKey: string;
    name: string;
    displayName: string;
    shortName: string;
    group?: string;
    isPrimary: boolean;
    schoolId: Id<"schools">;
    preparationType?: string;
    _creationTime: number;
    teacherId?: Id<"teachers">;
    teacherUserId?: Id<"users">;
    teacherName?: string;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get current user
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      return [];
    }

    // Check if user is admin/director - they see all subjects
    const isAdmin = user.role === "system_admin" || 
      user.role === "director" || 
      user.role === "vice_director" ||
      user.roles?.includes("system_admin") ||
      user.roles?.includes("director") ||
      user.roles?.includes("vice_director");

    // Get teacher record for current user
    const teacher = await ctx.db
      .query("teachers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const teacherId = teacher?._id;

    // Helper to normalize preparation type
    const normalizePrep = (prep: string | undefined): string => {
      if (!prep || prep === "ЗП" || prep === "ООП") return "DEFAULT";
      return prep;
    };

    // Track unique subject+preparationType combinations
    const subjectPrepMap = new Map<string, { 
      subjectId: Id<"subjects">; 
      preparationType: string; 
      originalPrepType: string;
      teacherId?: Id<"teachers">;
    }>();

    // Get subjects from classSubjects table
    const classSubjects = await ctx.db
      .query("classSubjects")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    for (const cs of classSubjects) {
      // If not admin, filter by teacher
      if (!isAdmin && teacherId && cs.teacherId !== teacherId) {
        continue;
      }
      
      const originalPrepType = cs.preparationType || "ЗП";
      const normalizedPrepType = normalizePrep(originalPrepType);
      const key = `${cs.subjectId}__${normalizedPrepType}`;
      
      if (!subjectPrepMap.has(key)) {
        subjectPrepMap.set(key, { 
          subjectId: cs.subjectId, 
          preparationType: normalizedPrepType,
          originalPrepType,
          teacherId: cs.teacherId,
        });
      }
    }

    // Fetch all subject details and teacher names

    // Fetch all subject details
    const subjects = await Promise.all(
      Array.from(subjectPrepMap.entries()).map(async ([uniqueKey, { subjectId, preparationType, teacherId: subjectTeacherId }]) => {
        const subject = await ctx.db.get(subjectId);
        if (!subject) return null;
        
        const isDefaultType = preparationType === "DEFAULT";
        const displayName = isDefaultType 
          ? subject.name
          : `${subject.name} (${preparationType})`;
        
        // Get teacher info
        let teacherName: string | undefined;
        let teacherUserId: Id<"users"> | undefined;
        if (subjectTeacherId) {
          const teacherDoc = await ctx.db.get(subjectTeacherId);
          if (teacherDoc) {
            teacherUserId = teacherDoc.userId;
            const teacherUser = await ctx.db.get(teacherDoc.userId);
            if (teacherUser) {
              teacherName = `${teacherUser.firstName || ""} ${teacherUser.lastName || ""}`.trim();
            }
          }
        }
        
        return {
          ...subject,
          uniqueKey,
          displayName,
          preparationType: isDefaultType ? undefined : preparationType,
          teacherId: subjectTeacherId,
          teacherUserId,
          teacherName,
        };
      })
    );

    return subjects
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "bg"));
  },
});

// GET /weekly-schedules/:id - Get single weekly schedule
export const getById = query({
  args: { id: v.id("weeklySchedules") },
  handler: async (
    ctx,
    args
  ): Promise<
    | (Doc<"weeklySchedules"> & {
        className: string;
        termName: string;
        dayRegimeName: string | null;
      })
    | null
  > => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const schedule = await ctx.db.get(args.id);
    if (!schedule) return null;

    const classDoc = await ctx.db.get(schedule.classId);
    const term = schedule.termId ? await ctx.db.get(schedule.termId) : null;
    let dayRegimeName: string | null = null;

    if (schedule.dayRegimeId) {
      const dayRegime = await ctx.db.get(schedule.dayRegimeId);
      dayRegimeName = dayRegime?.name ?? null;
    }

    return {
      ...schedule,
      className: classDoc?.name ?? "-",
      termName: term?.name ?? "-",
      dayRegimeName,
    };
  },
});

// Validation helper - check for conflicts
async function validateScheduleEntry(
  ctx: MutationCtx,
  entry: {
    dayOfWeek: number;
    periodIndex: number;
    subjectId: Id<"subjects">;
    teacherId: Id<"teachers">;
    roomId?: Id<"rooms">;
  },
  classId: Id<"classes">,
  termId: Id<"terms"> | undefined,
  excludeScheduleId?: Id<"weeklySchedules">
): Promise<string[]> {
  const errors: string[] = [];

  // If no termId, skip validation (can't check conflicts across terms)
  if (!termId) {
    return errors;
  }

  // Get all schedules for the same term
  const allSchedules = await ctx.db.query("weeklySchedules").collect();
  const termSchedules = allSchedules.filter((s) => s.termId === termId);

  for (const schedule of termSchedules) {
    // Skip the schedule we're updating
    if (excludeScheduleId && schedule._id === excludeScheduleId) continue;

    // Check each entry in this schedule
    for (const existingEntry of schedule.entries) {
      // Same day and period
      if (
        existingEntry.dayOfWeek === entry.dayOfWeek &&
        existingEntry.periodIndex === entry.periodIndex
      ) {
        // Teacher conflict
        if (existingEntry.teacherId === entry.teacherId) {
          // Try to get teacher record first
          const teacher = await ctx.db.get(entry.teacherId);
          let teacherName = "-";
          
          if (teacher) {
            const teacherUser = await ctx.db.get(teacher.userId);
            teacherName = buildUserName(teacherUser);
          } else {
            // If no teacher record, this might be an admin user ID
            // Try to get user directly (admin without teacher record)
            const user = await ctx.db.get(entry.teacherId as unknown as Id<"users">);
            teacherName = buildUserName(user);
          }
          
          errors.push(
            `Учителят ${teacherName} вече има час по същото време.`
          );
        }

        // Room conflict
        if (entry.roomId && existingEntry.roomId === entry.roomId) {
          const room = await ctx.db.get(entry.roomId);
          errors.push(
            `Кабинет ${room?.name ?? "-"} вече е зает по същото време.`
          );
        }

        // Class conflict (same class can't have two subjects at the same time)
        if (schedule.classId === classId) {
          errors.push(
            `Паралелката вече има друг час по същото време (${existingEntry.dayOfWeek}, час ${existingEntry.periodIndex}).`
          );
        }
      }
    }
  }

  return errors;
}

// GET /weekly-schedules/count-by-teacher - Count active schedules for a teacher
export const countByTeacher = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<number> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get teacher record for this user
    const teacher = await ctx.db
      .query("teachers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!teacher) {
      return 0;
    }

    // Get all schedules
    const allSchedules = await ctx.db.query("weeklySchedules").collect();

    // Count schedules that include this teacher
    let count = 0;
    for (const schedule of allSchedules) {
      const hasTeacher = schedule.entries.some(
        (entry) => entry.teacherId === teacher._id
      );
      if (hasTeacher) {
        count++;
      }
    }

    return count;
  },
});

// POST /weekly-schedules - Create weekly schedule (blocked for past years)
export const create = mutation({
  args: {
    classId: v.id("classes"),
    termId: v.optional(v.id("terms")),
    dayRegimeId: v.optional(v.id("dayRegimes")),
    weekCount: v.number(),
    academicYear: v.string(),
    schoolId: v.id("schools"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    term1StartDate: v.optional(v.string()),
    term1EndDate: v.optional(v.string()),
    term2StartDate: v.optional(v.string()),
    term2EndDate: v.optional(v.string()),
    selectedWeeks: v.optional(v.array(v.number())),
    totalWeekNumbers: v.optional(v.array(v.number())),
    entries: v.array(
      v.object({
        dayOfWeek: v.number(),
        periodIndex: v.number(),
        subjectId: v.id("subjects"),
        teacherId: v.id("teachers"),
        roomId: v.optional(v.id("rooms")),
        preparationType: v.optional(v.string()),
        weekNumbers: v.optional(v.array(v.number())),
        groupId: v.optional(v.id("classGroups")),
      })
    ),
  },
  handler: async (ctx, args): Promise<Id<"weeklySchedules">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get current user and check role
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        message: "User not found",
        code: "UNAUTHENTICATED",
      });
    }

    // ✅ PLATFORM SETTINGS: Check if class teacher can edit schedules
    const canEdit = await ctx.runQuery(internal.platformSettings.checkClassTeacherCanEditSchedules, {
      schoolId: args.schoolId,
      userId: currentUser._id,
    });
    if (!canEdit) {
      throw new ConvexError({
        message: "Нямате права да създавате седмични разписания. Само администратори могат да правят промени.",
        code: "FORBIDDEN",
      });
    }

    // Block creation for past years (uses schoolYearStartDay setting)
    if (await isPastYearWithSettings(ctx, args.academicYear, args.schoolId)) {
      throw new ConvexError({
        message: "Не може да добавяте седмични разписания от предходни години.",
        code: "BAD_REQUEST",
      });
    }

    // Validate entries - ensure all teacher IDs exist
    for (const entry of args.entries) {
      const teacherRecord = await ctx.db.get(entry.teacherId);
      if (!teacherRecord) {
        throw new ConvexError({
          message: "Невалиден учител. Моля, презаредете страницата и опитайте отново.",
          code: "BAD_REQUEST",
        });
      }
    }

    // Validate entries for conflicts (only if termId provided)
    if (args.termId) {
      const allErrors: string[] = [];
      for (const entry of args.entries) {
        const errors = await validateScheduleEntry(
          ctx,
          entry,
          args.classId,
          args.termId
        );
        allErrors.push(...errors);
      }

      if (allErrors.length > 0) {
        throw new ConvexError({
          message: `Конфликти в разписанието: ${allErrors.join("; ")}`,
          code: "CONFLICT",
        });
      }
    }

    // Check if schedule already exists for this class/term
    const existing = await ctx.db
      .query("weeklySchedules")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    const alreadyExists = existing.find(
      (s) => s.termId === args.termId && s.academicYear === args.academicYear
    );

    if (alreadyExists) {
      throw new ConvexError({
        message:
          "Седмично разписание за тази паралелка и срок вече съществува.",
        code: "CONFLICT",
      });
    }

    // Tag entries with weekNumbers if selectedWeeks provided
    const taggedEntries = args.selectedWeeks && args.selectedWeeks.length > 0
      ? args.entries.map(entry => ({
          ...entry,
          weekNumbers: args.selectedWeeks!,
        }))
      : args.totalWeekNumbers && args.totalWeekNumbers.length > 0
        ? args.entries.map(entry => ({
            ...entry,
            weekNumbers: args.totalWeekNumbers!,
          }))
        : args.entries;

    return await ctx.db.insert("weeklySchedules", {
      classId: args.classId,
      termId: args.termId,
      dayRegimeId: args.dayRegimeId,
      weekCount: args.weekCount,
      academicYear: args.academicYear,
      schoolId: args.schoolId,
      startDate: args.startDate,
      endDate: args.endDate,
      term1StartDate: args.term1StartDate,
      term1EndDate: args.term1EndDate,
      term2StartDate: args.term2StartDate,
      term2EndDate: args.term2EndDate,
      entries: taggedEntries,
    });
  },
});

// PATCH /weekly-schedules/:id - Update weekly schedule (blocked for past years)
export const update = mutation({
  args: {
    id: v.id("weeklySchedules"),
    dayRegimeId: v.optional(v.id("dayRegimes")),
    weekCount: v.optional(v.number()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    term1StartDate: v.optional(v.string()),
    term1EndDate: v.optional(v.string()),
    term2StartDate: v.optional(v.string()),
    term2EndDate: v.optional(v.string()),
    // Selected weeks for week-specific editing
    selectedWeeks: v.optional(v.array(v.number())),
    totalWeekNumbers: v.optional(v.array(v.number())),
    entries: v.optional(
      v.array(
        v.object({
          dayOfWeek: v.number(),
          periodIndex: v.number(),
          subjectId: v.id("subjects"),
          teacherId: v.id("teachers"),
          roomId: v.optional(v.id("rooms")),
          preparationType: v.optional(v.string()),
          weekNumbers: v.optional(v.array(v.number())),
          groupId: v.optional(v.id("classGroups")),
        })
      )
    ),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get current user and check role
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        message: "User not found",
        code: "UNAUTHENTICATED",
      });
    }

    const schedule = await ctx.db.get(args.id);
    if (!schedule) {
      throw new ConvexError({
        message: "Седмичното разписание не е намерено.",
        code: "NOT_FOUND",
      });
    }

    // ✅ PLATFORM SETTINGS: Check if class teacher can edit schedules
    const canEdit = await ctx.runQuery(internal.platformSettings.checkClassTeacherCanEditSchedules, {
      schoolId: schedule.schoolId,
      userId: currentUser._id,
    });
    if (!canEdit) {
      throw new ConvexError({
        message: "Нямате права да редактирате седмични разписания. Само администратори могат да правят промени.",
        code: "FORBIDDEN",
      });
    }

    // Block updates for past years (uses schoolYearStartDay setting)
    if (await isPastYearWithSettings(ctx, schedule.academicYear, schedule.schoolId)) {
      throw new ConvexError({
        message: "Не може да редактирате седмични разписания от предходни години.",
        code: "BAD_REQUEST",
      });
    }

    // Validate entries - ensure all teacher IDs exist
    if (args.entries) {
      for (const entry of args.entries) {
        const teacherRecord = await ctx.db.get(entry.teacherId);
        if (!teacherRecord) {
          throw new ConvexError({
            message: "Невалиден учител. Моля, презаредете страницата и опитайте отново.",
            code: "BAD_REQUEST",
          });
        }
      }
    }

    // Validate entries if provided
    if (args.entries) {
      const allErrors: string[] = [];
      for (const entry of args.entries) {
        const errors = await validateScheduleEntry(
          ctx,
          entry,
          schedule.classId,
          schedule.termId,
          args.id
        );
        allErrors.push(...errors);
      }

      if (allErrors.length > 0) {
        throw new ConvexError({
          message: `Конфликти в разписанието: ${allErrors.join("; ")}`,
          code: "CONFLICT",
        });
      }
    }

    const updates: Partial<Doc<"weeklySchedules">> = {};
    if (args.dayRegimeId !== undefined) updates.dayRegimeId = args.dayRegimeId;
    if (args.weekCount !== undefined) updates.weekCount = args.weekCount;
    if (args.startDate !== undefined) updates.startDate = args.startDate;
    if (args.endDate !== undefined) updates.endDate = args.endDate;
    if (args.term1StartDate !== undefined) updates.term1StartDate = args.term1StartDate;
    if (args.term1EndDate !== undefined) updates.term1EndDate = args.term1EndDate;
    if (args.term2StartDate !== undefined) updates.term2StartDate = args.term2StartDate;
    if (args.term2EndDate !== undefined) updates.term2EndDate = args.term2EndDate;

    if (args.entries !== undefined) {
      const selectedWeeks = args.selectedWeeks ?? [];
      const totalWeekNumbers = args.totalWeekNumbers ?? [];
      const isWeekSpecific = selectedWeeks.length > 0 && totalWeekNumbers.length > 0 
        && selectedWeeks.length < totalWeekNumbers.length;

      if (isWeekSpecific) {
        // Week-specific update: merge entries - keep entries for unselected weeks
        const existingEntries = schedule.entries;
        const selectedWeeksSet = new Set(selectedWeeks);

        // Remove selected weeks from existing entries' weekNumbers
        const keptEntries: typeof existingEntries = [];
        for (const entry of existingEntries) {
          // Legacy entries (no weekNumbers) are treated as applying to all weeks
          const entryWeeks = entry.weekNumbers ?? totalWeekNumbers;
          const remaining = entryWeeks.filter((w: number) => !selectedWeeksSet.has(w));
          if (remaining.length > 0) {
            keptEntries.push({ ...entry, weekNumbers: remaining });
          }
          // If remaining is empty, the entry is fully replaced by new entries
        }

        // Tag new entries with selected week numbers
        const newEntries = args.entries.map(entry => ({
          ...entry,
          weekNumbers: selectedWeeks,
        }));

        updates.entries = [...keptEntries, ...newEntries];
      } else {
        // All weeks selected or no week info: replace all entries (standard behavior)
        // Tag entries with all week numbers if available
        if (totalWeekNumbers.length > 0) {
          updates.entries = args.entries.map(entry => ({
            ...entry,
            weekNumbers: totalWeekNumbers,
          }));
        } else {
          updates.entries = args.entries;
        }
      }
    }

    await ctx.db.patch(args.id, updates);
  },
});

// DELETE /weekly-schedules/:id - Delete weekly schedule (blocked for past years)
export const remove = mutation({
  args: { id: v.id("weeklySchedules") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get current user and check role
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        message: "User not found",
        code: "UNAUTHENTICATED",
      });
    }

    const schedule = await ctx.db.get(args.id);
    if (!schedule) {
      throw new ConvexError({
        message: "Седмичното разписание не е намерено.",
        code: "NOT_FOUND",
      });
    }

    // ✅ PLATFORM SETTINGS: Check if class teacher can edit schedules
    const canEdit = await ctx.runQuery(internal.platformSettings.checkClassTeacherCanEditSchedules, {
      schoolId: schedule.schoolId,
      userId: currentUser._id,
    });
    if (!canEdit) {
      throw new ConvexError({
        message: "Нямате права да изтривате седмични разписания. Само администратори могат да правят промени.",
        code: "FORBIDDEN",
      });
    }

    // Block deletion for past years (uses schoolYearStartDay setting)
    if (await isPastYearWithSettings(ctx, schedule.academicYear, schedule.schoolId)) {
      throw new ConvexError({
        message: "Не може да изтривате седмични разписания от предходни години.",
        code: "BAD_REQUEST",
      });
    }

    await ctx.db.delete(args.id);
  },
});

// POST /weekly-schedules/:id/duplicate - Duplicate an existing schedule
export const duplicate = mutation({
  args: { id: v.id("weeklySchedules") },
  handler: async (ctx, args): Promise<Id<"weeklySchedules">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get current user and check role
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        message: "User not found",
        code: "UNAUTHENTICATED",
      });
    }

    const schedule = await ctx.db.get(args.id);
    if (!schedule) {
      throw new ConvexError({
        message: "Седмичното разписание не е намерено.",
        code: "NOT_FOUND",
      });
    }

    // ✅ PLATFORM SETTINGS: Check if class teacher can edit schedules
    const canEdit = await ctx.runQuery(internal.platformSettings.checkClassTeacherCanEditSchedules, {
      schoolId: schedule.schoolId,
      userId: currentUser._id,
    });
    if (!canEdit) {
      throw new ConvexError({
        message: "Нямате права да дублирате седмични разписания. Само администратори могат да правят промени.",
        code: "FORBIDDEN",
      });
    }

    // Create a copy of the schedule
    const newScheduleId = await ctx.db.insert("weeklySchedules", {
      classId: schedule.classId,
      termId: schedule.termId,
      dayRegimeId: schedule.dayRegimeId,
      weekCount: schedule.weekCount,
      academicYear: schedule.academicYear,
      schoolId: schedule.schoolId,
      entries: schedule.entries,
      createdBy: currentUser._id,
      lastEditedAt: Date.now(),
      lastEditedBy: currentUser._id,
    });

    return newScheduleId;
  },
});

// POST /weekly-schedules/:id/duplicate-to-class - Duplicate schedule to another class
export const duplicateToClass = mutation({
  args: { 
    id: v.id("weeklySchedules"),
    targetClassId: v.id("classes"),
  },
  handler: async (ctx, args): Promise<Id<"weeklySchedules">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get current user and check role
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        message: "User not found",
        code: "UNAUTHENTICATED",
      });
    }

    const schedule = await ctx.db.get(args.id);
    if (!schedule) {
      throw new ConvexError({
        message: "Седмичното разписание не е намерено.",
        code: "NOT_FOUND",
      });
    }

    // Get target class to verify it exists
    const targetClass = await ctx.db.get(args.targetClassId);
    if (!targetClass) {
      throw new ConvexError({
        message: "Целевата паралелка не е намерена.",
        code: "NOT_FOUND",
      });
    }

    // ✅ PLATFORM SETTINGS: Check if class teacher can edit schedules
    const canEdit = await ctx.runQuery(internal.platformSettings.checkClassTeacherCanEditSchedules, {
      schoolId: schedule.schoolId,
      userId: currentUser._id,
    });
    if (!canEdit) {
      throw new ConvexError({
        message: "Нямате права да дублирате седмични разписания. Само администратори могат да правят промени.",
        code: "FORBIDDEN",
      });
    }

    // Check if target class already has a schedule for this term/year
    const existingSchedules = await ctx.db
      .query("weeklySchedules")
      .withIndex("by_class", (q) => q.eq("classId", args.targetClassId))
      .collect();

    const existingSchedule = existingSchedules.find(
      (s) => s.termId === schedule.termId && s.academicYear === schedule.academicYear
    );

    // If existing schedule found, delete it first
    if (existingSchedule) {
      await ctx.db.delete(existingSchedule._id);
    }

    // Create a copy of the schedule for the target class
    const newScheduleId = await ctx.db.insert("weeklySchedules", {
      classId: args.targetClassId,
      termId: schedule.termId,
      dayRegimeId: schedule.dayRegimeId,
      weekCount: schedule.weekCount,
      academicYear: schedule.academicYear,
      schoolId: targetClass.schoolId,
      entries: schedule.entries,
      createdBy: currentUser._id,
      lastEditedAt: Date.now(),
      lastEditedBy: currentUser._id,
    });

    return newScheduleId;
  },
});

// GET /weekly-schedules/subjects-for-date - Get subjects scheduled for a specific date for a class
// Returns ALL lessons (periods) for the date, sorted by periodIndex (chronological order)
export const getSubjectsForDate = query({
  args: {
    classId: v.id("classes"),
    date: v.number(), // timestamp
  },
  handler: async (ctx, args): Promise<{
    subjects: Array<{
      periodIndex: number;
      classSubjectId: Id<"classSubjects">;
      subjectId: Id<"subjects">;
      subjectName: string;
      preparationType?: string;
      teacherId?: Id<"teachers">;
      teacherName?: string;
    }>;
    isNonSchoolDay: boolean;
    nonSchoolDayName?: string;
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
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    // Get day of week - need to handle timezone properly
    // The frontend sends a timestamp that represents midnight local time
    // To get the correct day, we need to extract the date in a timezone-safe way
    // Add 12 hours to ensure we're firmly in the correct day regardless of timezone
    const adjustedTimestamp = args.date + (12 * 60 * 60 * 1000);
    const adjustedDate = new Date(adjustedTimestamp);
    const jsDay = adjustedDate.getUTCDay();
    
    // Convert: Sunday=0 -> 7, Monday=1 -> 1, ..., Friday=5 -> 5, Saturday=6 -> 6
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;

    // Check if it's a weekend
    if (dayOfWeek > 5) {
      return { subjects: [], isNonSchoolDay: true, nonSchoolDayName: "Почивен ден" };
    }

    // Check if it's a non-school day
    if (user.schoolId) {
      const nonSchoolDays = await ctx.db
        .query("nonSchoolDays")
        .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
        .collect();

      for (const day of nonSchoolDays) {
        const dayStart = new Date(day.startDate);
        dayStart.setUTCHours(0, 0, 0, 0);
        const dayEnd = new Date(day.endDate);
        dayEnd.setUTCHours(23, 59, 59, 999);

        if (args.date >= dayStart.getTime() && args.date <= dayEnd.getTime()) {
          // Check if applies to this class
          if (day.appliesToAllClasses || (day.classIds && day.classIds.includes(args.classId))) {
            return { subjects: [], isNonSchoolDay: true, nonSchoolDayName: day.name };
          }
        }
      }
    }

    // Get weekly schedule for this class
    const schedules = await ctx.db
      .query("weeklySchedules")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Collect ALL lessons (periods) scheduled for this day of week
    // Each period is a separate entry, even if the same subject appears multiple times
    const lessons: Array<{
      periodIndex: number;
      classSubjectId: Id<"classSubjects">;
      subjectId: Id<"subjects">;
      preparationType?: string;
      teacherId?: Id<"teachers">;
    }> = [];

    for (const schedule of schedules) {
      for (const entry of schedule.entries) {
        if (entry.dayOfWeek === dayOfWeek) {
          // Find corresponding classSubject
          const classSubjects = await ctx.db
            .query("classSubjects")
            .withIndex("by_class", (q) => q.eq("classId", args.classId))
            .filter((q) => q.eq(q.field("subjectId"), entry.subjectId))
            .collect();

          // Find matching classSubject by preparationType and teacherId
          let matchingCS = classSubjects.find(cs => 
            (cs.preparationType === entry.preparationType || 
             (!cs.preparationType && !entry.preparationType) ||
             (cs.preparationType === "ЗП" && !entry.preparationType) ||
             (!cs.preparationType && entry.preparationType === "ЗП")) &&
            cs.teacherId === entry.teacherId
          );

          // Fallback: match by preparationType only
          if (!matchingCS) {
            matchingCS = classSubjects.find(cs => 
              cs.preparationType === entry.preparationType || 
              (!cs.preparationType && !entry.preparationType) ||
              (cs.preparationType === "ЗП" && !entry.preparationType) ||
              (!cs.preparationType && entry.preparationType === "ЗП")
            );
          }

          if (!matchingCS && classSubjects.length > 0) {
            matchingCS = classSubjects[0];
          }

          if (matchingCS) {
            lessons.push({
              periodIndex: entry.periodIndex,
              classSubjectId: matchingCS._id,
              subjectId: entry.subjectId,
              preparationType: entry.preparationType,
              teacherId: entry.teacherId as Id<"teachers"> | undefined,
            });
          }
        }
      }
    }

    // Sort by periodIndex (chronological order)
    lessons.sort((a, b) => a.periodIndex - b.periodIndex);

    // Enrich with subject and teacher names
    const subjects = await Promise.all(
      lessons.map(async (item) => {
        const subject = await ctx.db.get(item.subjectId);
        let teacherName: string | undefined;
        
        if (item.teacherId) {
          const teacher = await ctx.db.get(item.teacherId);
          if (teacher) {
            const teacherUser = await ctx.db.get(teacher.userId);
            if (teacherUser) {
              teacherName = buildUserName(teacherUser);
            }
          }
        }

        return {
          periodIndex: item.periodIndex,
          classSubjectId: item.classSubjectId,
          subjectId: item.subjectId,
          subjectName: subject?.name || "Неизвестен предмет",
          preparationType: item.preparationType,
          teacherId: item.teacherId,
          teacherName,
        };
      })
    );

    return { 
      subjects,
      isNonSchoolDay: false 
    };
  },
});

// GET /weekly-schedules/by-class - Get schedule details for a class
export const getByClass = query({
  args: {
    classId: v.id("classes"),
    termId: v.optional(v.id("terms")),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    schedule:
      | (Doc<"weeklySchedules"> & {
          className: string;
          termName: string;
          dayRegimeName: string | null;
          isPastYear: boolean;
        })
      | null;
    enrichedEntries: Array<{
      dayOfWeek: number;
      periodIndex: number;
      subjectId: Id<"subjects">;
      subjectName: string;
      teacherName: string;
      teacherUserId?: string;
      teacherFirstName?: string;
      teacherMiddleName?: string;
      teacherLastName?: string;
      roomName: string | null;
      preparationType?: string;
      weekNumbers?: number[];
      groupId?: Id<"classGroups">;
      groupName?: string;
    }>;
    dayRegime: {
      name: string;
      startTime: string;
      endTime: string;
      periodCount: number;
      periods?: Array<{
        periodNumber: number;
        startTime: string;
        duration: number;
        endTime: string;
      }>;
    } | null;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Find schedule for this class
    const schedules = await ctx.db
      .query("weeklySchedules")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    let schedule = schedules[0];

    // Filter by term if provided
    if (args.termId) {
      schedule =
        schedules.find((s) => s.termId === args.termId) ?? schedules[0];
    }

    if (!schedule) {
      return {
        schedule: null,
        enrichedEntries: [],
        dayRegime: null,
      };
    }

    // Get class and term details
    const classDoc = await ctx.db.get(schedule.classId);
    const term = schedule.termId ? await ctx.db.get(schedule.termId) : null;

    // Get day regime if assigned
    let dayRegimeName: string | null = null;
    let dayRegime: {
      name: string;
      startTime: string;
      endTime: string;
      periodCount: number;
      periods?: Array<{
        periodNumber: number;
        startTime: string;
        duration: number;
        endTime: string;
      }>;
    } | null = null;

    if (schedule.dayRegimeId) {
      const regime = await ctx.db.get(schedule.dayRegimeId);
      if (regime) {
        dayRegimeName = regime.name;
        dayRegime = {
          name: regime.name,
          startTime: regime.startTime,
          endTime: regime.endTime,
          periodCount: regime.periodCount,
          periods: regime.periods,
        };
      }
    }

    // Enrich entries with subject/teacher/room names
    // Show ONLY the teacher that was actually saved in the schedule entry
    const enrichedEntries: Array<{
      dayOfWeek: number;
      periodIndex: number;
      subjectId: Id<"subjects">;
      subjectName: string;
      teacherName: string;
      teacherUserId?: string;
      teacherFirstName?: string;
      teacherMiddleName?: string;
      teacherLastName?: string;
      roomName: string | null;
      preparationType?: string;
      weekNumbers?: number[];
      groupId?: Id<"classGroups">;
      groupName?: string;
    }> = [];
    
    // Process each schedule entry - use ONLY the teacher from the entry
    for (const entry of schedule.entries) {
      const subject = await ctx.db.get(entry.subjectId);
      const room = entry.roomId ? await ctx.db.get(entry.roomId) : null;
      const subjectName = subject?.shortName || subject?.name || "-";
      const roomName = room?.name ?? null;
      
      // Get the teacher from the schedule entry (the one actually selected)
      const teacher = await ctx.db.get(entry.teacherId);
      let teacherName = "-";
      let teacherUserId: string | undefined = undefined;
      let teacherFirstName: string | undefined = undefined;
      let teacherMiddleName: string | undefined = undefined;
      let teacherLastName: string | undefined = undefined;
      
      if (teacher) {
        const teacherUser = await ctx.db.get(teacher.userId);
        teacherName = buildUserName(teacherUser);
        teacherUserId = teacherUser?._id;
        teacherFirstName = teacherUser?.firstName;
        teacherMiddleName = teacherUser?.middleName;
        teacherLastName = teacherUser?.lastName;
      } else {
        // If no teacher record, this might be an admin user ID
        const user = await ctx.db.get(entry.teacherId as unknown as Id<"users">);
        teacherName = buildUserName(user);
        teacherUserId = user?._id;
        teacherFirstName = user?.firstName;
        teacherMiddleName = user?.middleName;
        teacherLastName = user?.lastName;
      }
      
      // Get group info if present
      let groupId: Id<"classGroups"> | undefined = entry.groupId;
      let groupName: string | undefined = undefined;
      if (entry.groupId) {
        const group = await ctx.db.get(entry.groupId);
        if (group) {
          groupName = group.name;
        }
      }
      
      enrichedEntries.push({
        dayOfWeek: entry.dayOfWeek,
        periodIndex: entry.periodIndex,
        subjectId: entry.subjectId,
        subjectName,
        teacherName,
        teacherUserId,
        teacherFirstName,
        teacherMiddleName,
        teacherLastName,
        roomName,
        preparationType: entry.preparationType,
        weekNumbers: entry.weekNumbers,
        groupId,
        groupName,
      });
    }

    return {
      schedule: {
        ...schedule,
        className: classDoc?.name ?? "-",
        termName: term?.name ?? "-",
        dayRegimeName,
        isPastYear: isPastYear(schedule.academicYear),
      },
      enrichedEntries,
      dayRegime,
    };
  },
});

// Get active schedule for a specific user (student or teacher)
export const getActiveScheduleForUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get the user
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }

    // If student, get schedule by class
    if (user.role === "student" || user.roles?.includes("student")) {
      // Get student record to find their class
      const studentRecord = await ctx.db
        .query("students")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .first();
      
      if (!studentRecord?.classId) {
        return null;
      }

      // Get the most recent schedule for this class
      const schedules = await ctx.db
        .query("weeklySchedules")
        .withIndex("by_class", (q) => q.eq("classId", studentRecord.classId))
        .order("desc")
        .take(1);

      if (schedules.length === 0) {
        return null;
      }

      const schedule = schedules[0];
      
      // Group entries by day of week and period
      const scheduleByDay: Array<Array<{
        subjectName?: string;
        subjectId?: Id<"subjects">;
        teacherName?: string;
        teacherUserId?: string;
        teacherFirstName?: string;
        teacherMiddleName?: string;
        teacherLastName?: string;
        className?: string;
        classId?: Id<"classes">;
        roomName?: string;
        isGroupSplit: boolean;
        groupName?: string;
        periodIndex?: number;
        dayOfWeek?: number;
      }>> = [[], [], [], [], [], [], []]; // 7 days

      for (const entry of schedule.entries) {
        const subject = await ctx.db.get(entry.subjectId);
        
        // Try to get teacher
        const teacher = await ctx.db.get(entry.teacherId);
        let teacherName = "-";
        let teacherUserId: string | undefined = undefined;
        let teacherFirstName: string | undefined = undefined;
        let teacherMiddleName: string | undefined = undefined;
        let teacherLastName: string | undefined = undefined;
        
        if (teacher) {
          const teacherUser = await ctx.db.get(teacher.userId);
          teacherName = buildUserName(teacherUser);
          teacherUserId = teacherUser?._id;
          teacherFirstName = teacherUser?.firstName;
          teacherMiddleName = teacherUser?.middleName;
          teacherLastName = teacherUser?.lastName;
        } else {
          const maybeUser = await ctx.db.get(entry.teacherId as unknown as Id<"users">);
          teacherName = buildUserName(maybeUser);
          teacherUserId = maybeUser?._id;
          teacherFirstName = maybeUser?.firstName;
          teacherMiddleName = maybeUser?.middleName;
          teacherLastName = maybeUser?.lastName;
        }
        
        const room = entry.roomId ? await ctx.db.get(entry.roomId) : null;
        
        // Get group info if present
        let entryGroupName: string | undefined = undefined;
        if (entry.groupId) {
          const group = await ctx.db.get(entry.groupId);
          if (group) {
            entryGroupName = group.name;
          }
        }

        // Add to appropriate day
        if (!scheduleByDay[entry.dayOfWeek]) {
          scheduleByDay[entry.dayOfWeek] = [];
        }
        
        // Ensure array is large enough for this period
        while (scheduleByDay[entry.dayOfWeek].length <= entry.periodIndex) {
          scheduleByDay[entry.dayOfWeek].push({
            subjectName: undefined,
            subjectId: undefined,
            teacherName: undefined,
            teacherUserId: undefined,
            teacherFirstName: undefined,
            teacherMiddleName: undefined,
            teacherLastName: undefined,
            className: undefined,
            classId: undefined,
            roomName: undefined,
            isGroupSplit: false,
            periodIndex: undefined,
            dayOfWeek: undefined,
          });
        }
        
        scheduleByDay[entry.dayOfWeek][entry.periodIndex] = {
          subjectName: (() => {
            let name = subject?.shortName || subject?.name || "-";
            if (entry.preparationType && entry.preparationType !== "ЗП" && entry.preparationType !== "ООП") {
              name = `${name} (${entry.preparationType})`;
            }
            return name;
          })(),
          subjectId: entry.subjectId,
          teacherName,
          teacherUserId,
          teacherFirstName,
          teacherMiddleName,
          teacherLastName,
          className: undefined, // Students don't need className
          classId: schedule.classId,
          roomName: room?.name ?? undefined,
          isGroupSplit: !!entryGroupName,
          groupName: entryGroupName,
          periodIndex: entry.periodIndex,
          dayOfWeek: entry.dayOfWeek,
        };
      }

      // Get day regime periods if available
      let dayRegimePeriods: Array<{
        periodNumber: number;
        startTime: string;
        duration: number;
        endTime: string;
      }> | null = null;
      
      if (schedule.dayRegimeId) {
        const regime = await ctx.db.get(schedule.dayRegimeId);
        if (regime?.periods) {
          dayRegimePeriods = regime.periods;
        }
      }

      return {
        _id: schedule._id,
        schedule: scheduleByDay,
        dayRegimePeriods,
      };
    }

    // If teacher, get their schedule across all classes
    if (
      user.role === "teacher" || 
      user.roles?.includes("teacher") || 
      user.role === "class_teacher" || 
      user.roles?.includes("class_teacher") ||
      user.role === "director" ||
      user.roles?.includes("director") ||
      user.role === "vice_director" ||
      user.roles?.includes("vice_director")
    ) {
      // Get teacher record for this user
      const teacher = await ctx.db
        .query("teachers")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .first();

      if (!teacher) {
        return null;
      }

      // Get all schedules
      const allSchedules = await ctx.db.query("weeklySchedules").collect();

      // Helper to sort class names (smaller class first: 8а before 8б)
      const sortClassNames = (a: string, b: string): number => {
        const matchA = a.match(/^(\d+)([а-яА-Яa-zA-Z]?)$/);
        const matchB = b.match(/^(\d+)([а-яА-Яa-zA-Z]?)$/);
        
        if (matchA && matchB) {
          const numA = parseInt(matchA[1]);
          const numB = parseInt(matchB[1]);
          if (numA !== numB) return numA - numB;
          return (matchA[2] || "").localeCompare(matchB[2] || "", "bg");
        }
        return a.localeCompare(b, "bg");
      };

      // Group entries by day of week and period
      const scheduleByDay: Array<Array<{
        subjectName?: string;
        subjectId?: Id<"subjects">;
        teacherName?: string;
        teacherUserId?: string;
        teacherFirstName?: string;
        teacherMiddleName?: string;
        teacherLastName?: string;
        className?: string;
        classId?: Id<"classes">;
        roomName?: string;
        isGroupSplit: boolean;
        groupName?: string;
        periodIndex?: number;
        dayOfWeek?: number;
        classNames?: string[]; // Track multiple class names
        subjectNames?: string[]; // Track multiple subject names
        classSubjectPairs?: Array<{ className: string; subjectName: string }>; // Track class-subject pairs
      }>> = [[], [], [], [], [], [], []]; // 7 days

      // Find all entries where this teacher is assigned
      for (const schedule of allSchedules) {
        const classDoc = await ctx.db.get(schedule.classId);
        // Skip schedules without a valid class (ghost lessons)
        if (!classDoc) continue;
        
        for (const entry of schedule.entries) {
          if (entry.teacherId === teacher._id) {
            const subject = await ctx.db.get(entry.subjectId);
            const room = entry.roomId ? await ctx.db.get(entry.roomId) : null;
            
            // Get group info if present
            let teacherEntryGroupName: string | undefined = undefined;
            if (entry.groupId) {
              const group = await ctx.db.get(entry.groupId);
              if (group) {
                teacherEntryGroupName = group.name;
              }
            }
            
            // Build subject display name with preparation type if not ЗП or ООП
            let subjectDisplayName = subject?.shortName || subject?.name || "-";
            if (entry.preparationType && entry.preparationType !== "ЗП" && entry.preparationType !== "ООП") {
              subjectDisplayName = `${subjectDisplayName} (${entry.preparationType})`;
            }

            // Add to appropriate day
            if (!scheduleByDay[entry.dayOfWeek]) {
              scheduleByDay[entry.dayOfWeek] = [];
            }
            
            // Ensure array is large enough for this period
            while (scheduleByDay[entry.dayOfWeek].length <= entry.periodIndex) {
              scheduleByDay[entry.dayOfWeek].push({
                subjectName: undefined,
                subjectId: undefined,
                teacherName: undefined,
                teacherUserId: undefined,
                teacherFirstName: undefined,
                teacherMiddleName: undefined,
                teacherLastName: undefined,
                className: undefined,
                classId: undefined,
                roomName: undefined,
                isGroupSplit: false,
                periodIndex: undefined,
                dayOfWeek: undefined,
                classNames: undefined,
                subjectNames: undefined,
                classSubjectPairs: undefined,
              });
            }
            
            // Check if there's already an entry for this period
            const existingEntry = scheduleByDay[entry.dayOfWeek][entry.periodIndex];
            if (existingEntry?.subjectName) {
              // Track class-subject pairs
              const existingPairs = existingEntry.classSubjectPairs || [
                { className: existingEntry.classNames?.[0] || existingEntry.className || "", subjectName: existingEntry.subjectName }
              ];
              
              // Add new pair
              existingPairs.push({ className: classDoc.name, subjectName: subjectDisplayName });
              
              // Sort pairs by class name (smaller class first)
              existingPairs.sort((a, b) => sortClassNames(a.className, b.className));
              
              // Extract sorted data
              const sortedClassNames = existingPairs.map(p => p.className);
              const sortedSubjectNames = existingPairs.map(p => p.subjectName);
              
              // Display classes in reverse order (larger first)
              const displayClassNames = [...sortedClassNames].reverse();
              
              existingEntry.className = displayClassNames.join(", ");
              existingEntry.classNames = sortedClassNames;
              existingEntry.subjectNames = sortedSubjectNames;
              existingEntry.classSubjectPairs = existingPairs;
              
              // Set subjectName: if all same, show one; if different, show all in order (smaller class first)
              const uniqueSubjects = [...new Set(sortedSubjectNames)];
              existingEntry.subjectName = uniqueSubjects.length === 1 
                ? uniqueSubjects[0] 
                : sortedSubjectNames.join(" / ");
            } else {
              // Create new entry
              scheduleByDay[entry.dayOfWeek][entry.periodIndex] = {
                subjectName: subjectDisplayName,
                subjectId: entry.subjectId,
                teacherName: undefined, // Teachers don't need teacherName
                teacherUserId: undefined,
                teacherFirstName: undefined,
                teacherMiddleName: undefined,
                teacherLastName: undefined,
                className: classDoc.name,
                classId: schedule.classId,
                roomName: room?.name ?? undefined,
                isGroupSplit: !!teacherEntryGroupName,
                groupName: teacherEntryGroupName,
                periodIndex: entry.periodIndex,
                dayOfWeek: entry.dayOfWeek,
                classNames: [classDoc.name],
                subjectNames: [subjectDisplayName],
                classSubjectPairs: [{ className: classDoc.name, subjectName: subjectDisplayName }],
              };
            }
          }
        }
      }

      // Return the schedule if there are any entries
      const hasEntries = scheduleByDay.some(day => day.some(period => period.subjectName));
      if (!hasEntries) {
        return null;
      }

      // Get day regime periods from first schedule that has them
      let dayRegimePeriods: Array<{
        periodNumber: number;
        startTime: string;
        duration: number;
        endTime: string;
      }> | null = null;
      
      for (const schedule of allSchedules) {
        if (schedule.dayRegimeId) {
          const regime = await ctx.db.get(schedule.dayRegimeId);
          if (regime?.periods) {
            dayRegimePeriods = regime.periods;
            break;
          }
        }
      }

      return {
        _id: allSchedules[0]?._id, // Just use first schedule ID
        schedule: scheduleByDay,
        dayRegimePeriods,
      };
    }

    return null;
  },
});

// GET /weekly-schedules/by-teacher - Get schedules for a teacher
export const getByTeacher = query({
  args: { teacherId: v.id("teachers") },
  handler: async (ctx, args): Promise<{
    schedules: Array<{
      _id: Id<"weeklySchedules">;
      classId: Id<"classes">;
      className: string;
      entries: Array<{
        dayOfWeek: number;
        periodIndex: number;
        subjectId: Id<"subjects">;
        subjectName: string;
        teacherId: Id<"teachers">;
        roomId?: Id<"rooms">;
        roomName?: string;
        preparationType?: string;
        groupName?: string;
      }>;
    }>;
    dayRegimePeriods: Array<{
      periodNumber: number;
      startTime: string;
      duration: number;
      endTime: string;
    }> | null;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get all schedules
    const allSchedules = await ctx.db.query("weeklySchedules").collect();
    
    // Filter schedules that have entries with this teacher
    const teacherSchedules = [];
    let dayRegimePeriods: Array<{
      periodNumber: number;
      startTime: string;
      duration: number;
      endTime: string;
    }> | null = null;
    
    for (const schedule of allSchedules) {
      const classDoc = await ctx.db.get(schedule.classId);
      // Skip schedules without a valid class (ghost lessons)
      if (!classDoc) continue;
      
      const teacherEntries = [];
      
      for (const entry of schedule.entries) {
        if (entry.teacherId === args.teacherId) {
          const subject = await ctx.db.get(entry.subjectId);
          const room = entry.roomId ? await ctx.db.get(entry.roomId) : null;
          
          // Build subject name with preparation type if not ЗП or ООП
          let subjectDisplayName = subject?.shortName || subject?.name || "-";
          if (entry.preparationType && entry.preparationType !== "ЗП" && entry.preparationType !== "ООП") {
            subjectDisplayName = `${subjectDisplayName} (${entry.preparationType})`;
          }
          
          // Get group name if present
          let teacherScheduleGroupName: string | undefined = undefined;
          if (entry.groupId) {
            const group = await ctx.db.get(entry.groupId);
            if (group) {
              teacherScheduleGroupName = group.name;
            }
          }
          
          teacherEntries.push({
            dayOfWeek: entry.dayOfWeek,
            periodIndex: entry.periodIndex,
            subjectId: entry.subjectId,
            subjectName: subjectDisplayName,
            teacherId: entry.teacherId,
            roomId: entry.roomId,
            roomName: room?.name,
            preparationType: entry.preparationType,
            groupName: teacherScheduleGroupName,
          });
        }
      }
      
      if (teacherEntries.length > 0) {
        teacherSchedules.push({
          _id: schedule._id,
          classId: schedule.classId,
          className: classDoc.name,
          entries: teacherEntries,
        });
        
        // Get day regime periods from first schedule that has them
        if (!dayRegimePeriods && schedule.dayRegimeId) {
          const regime = await ctx.db.get(schedule.dayRegimeId);
          if (regime?.periods) {
            dayRegimePeriods = regime.periods;
          }
        }
      }
    }
    
    return {
      schedules: teacherSchedules,
      dayRegimePeriods,
    };
  },
});

// Get subjects for a class filtered by the current teacher from SCHEDULE ONLY
// This excludes subjects from classSubjects table - only returns subjects
// that have actual schedule entries for this teacher
export const getTeacherSubjectsFromScheduleOnly = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args): Promise<Array<{
    subjectId: Id<"subjects">;
    subjectName: string;
    preparationType: string;
    uniqueKey: string;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get current user
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      return [];
    }

    // Check if user is admin/director - they see all subjects
    const isAdmin = user.role === "system_admin" || 
      user.role === "director" || 
      user.role === "vice_director" ||
      user.roles?.includes("system_admin") ||
      user.roles?.includes("director") ||
      user.roles?.includes("vice_director");

    // Get teacher record for current user
    const teacher = await ctx.db
      .query("teachers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const teacherId = teacher?._id;

    // Get all weekly schedules for this class
    const schedules = await ctx.db
      .query("weeklySchedules")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Track unique subject+preparationType combinations from schedule entries only
    const subjectPrepMap = new Map<string, { 
      subjectId: Id<"subjects">; 
      preparationType: string; 
    }>();

    for (const schedule of schedules) {
      for (const entry of schedule.entries) {
        // Skip if no subject or teacher
        if (!entry.subjectId || !entry.teacherId) continue;

        // If not admin, filter by teacher
        if (!isAdmin && teacherId && entry.teacherId !== teacherId) {
          continue;
        }

        const prepType = entry.preparationType || "ЗП";
        const key = `${entry.subjectId}__${prepType}`;
        
        if (!subjectPrepMap.has(key)) {
          subjectPrepMap.set(key, { 
            subjectId: entry.subjectId as Id<"subjects">, 
            preparationType: prepType,
          });
        }
      }
    }

    // Fetch all subject details
    const subjects = await Promise.all(
      Array.from(subjectPrepMap.entries()).map(async ([uniqueKey, { subjectId, preparationType }]) => {
        const subject = await ctx.db.get(subjectId);
        if (!subject) return null;
        
        const isDefaultType = preparationType === "ЗП" || preparationType === "ООП";
        const subjectName = isDefaultType 
          ? subject.name
          : `${subject.name} (${preparationType})`;
        
        return {
          subjectId,
          subjectName,
          preparationType,
          uniqueKey,
        };
      })
    );

    return subjects
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName, "bg"));
  },
});

// Update all schedules without a dayRegimeId to use a default one
export const setDefaultDayRegimeForAll = mutation({
  args: { dayRegimeId: v.id("dayRegimes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get all schedules without a dayRegimeId
    const schedules = await ctx.db.query("weeklySchedules").collect();
    const schedulesWithoutRegime = schedules.filter(s => !s.dayRegimeId);

    // Update each schedule
    for (const schedule of schedulesWithoutRegime) {
      await ctx.db.patch(schedule._id, { dayRegimeId: args.dayRegimeId });
    }

    return { updated: schedulesWithoutRegime.length };
  },
});
