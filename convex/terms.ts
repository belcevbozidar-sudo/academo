import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import { buildUserName } from "./users";

const DEFAULT_TERM_CONFIG = {
  termCount: 2,
  terms: [
    { termNumber: 1, startDate: "2024-09-16", endDate: "2025-02-04" },
    { termNumber: 2, startDate: "2025-02-06", endDate: "2025-06-30" },
  ],
  academicYear: "2024/2025",
};

/**
 * List all classes with their term configurations
 */
export const listClassesWithTerms = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "Не сте влезли в системата",
        code: "UNAUTHENTICATED",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "Потребителят не е намерен",
        code: "NOT_FOUND",
      });
    }

    if (!user.schoolId) {
      return [];
    }

    // Get all classes for the school
    const classes = await ctx.db
      .query("classes")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .collect();

    // Get all term configurations
    const termConfigs = await ctx.db
      .query("classTermConfigurations")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .collect();

    // Create a map for quick lookup
    const configMap = new Map(termConfigs.map(tc => [tc.classId, tc]));

    // Build the result with class teacher names
    const result = await Promise.all(classes.map(async (cls) => {
      // Get class teacher
      let classTeacherName = "";
      if (cls.classTeacherId) {
        const teacher = await ctx.db.get(cls.classTeacherId);
        if (teacher) {
          classTeacherName = buildUserName(teacher);
        }
      }

      const config = configMap.get(cls._id);
      
      return {
        _id: cls._id,
        name: cls.name,
        grade: cls.grade,
        letter: cls.letter,
        classTeacherName,
        academicYear: config?.academicYear ?? cls.academicYear ?? "",
        termCount: config?.termCount ?? 0,
        terms: config?.terms ?? [],
        // Get first term start and last term end for display
        startDate: config?.terms[0]?.startDate ?? "",
        endDate: config?.terms[config.terms.length - 1]?.endDate ?? "",
      };
    }));

    // Sort by grade then letter
    return result.sort((a, b) => {
      if (a.grade !== b.grade) return a.grade - b.grade;
      return a.letter.localeCompare(b.letter);
    });
  },
});

/**
 * Get term configuration for editing (all classes grouped by grade)
 */
export const getClassesForTermEdit = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "Не сте влезли в системата",
        code: "UNAUTHENTICATED",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "Потребителят не е намерен",
        code: "NOT_FOUND",
      });
    }

    if (!user.schoolId) {
      return {};
    }

    // Get all classes
    const classes = await ctx.db
      .query("classes")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .collect();

    // Get existing configurations
    const termConfigs = await ctx.db
      .query("classTermConfigurations")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .collect();

    const configMap = new Map(termConfigs.map(tc => [tc.classId, tc]));

    // Group classes by grade
    const byGrade: Record<number, Array<{
      _id: string;
      letter: string;
      name: string;
      hasConfig: boolean;
    }>> = {};

    for (const cls of classes) {
      if (!byGrade[cls.grade]) {
        byGrade[cls.grade] = [];
      }
      byGrade[cls.grade].push({
        _id: cls._id,
        letter: cls.letter,
        name: cls.name,
        hasConfig: configMap.has(cls._id),
      });
    }

    // Sort letters within each grade
    for (const grade of Object.keys(byGrade)) {
      byGrade[Number(grade)].sort((a, b) => a.letter.localeCompare(b.letter));
    }

    return byGrade;
  },
});

/**
 * Save term configurations for multiple classes
 */
export const saveTermConfigurations = mutation({
  args: {
    termCount: v.number(),
    terms: v.array(v.object({
      termNumber: v.number(),
      startDate: v.string(),
      endDate: v.string(),
    })),
    classIds: v.array(v.id("classes")),
    academicYear: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "Не сте влезли в системата",
        code: "UNAUTHENTICATED",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user || !user.schoolId) {
      throw new ConvexError({
        message: "Потребителят не е намерен или няма училище",
        code: "NOT_FOUND",
      });
    }

    // Check permissions
    const isAdmin = user.role === "system_admin" || 
                   user.role === "director" || 
                   user.role === "vice_director";

    if (!isAdmin) {
      throw new ConvexError({
        message: "Нямате права за тази операция",
        code: "FORBIDDEN",
      });
    }

    // Validate
    if (args.termCount < 1 || args.termCount > 4) {
      throw new ConvexError({
        message: "Броят срокове трябва да е между 1 и 4",
        code: "BAD_REQUEST",
      });
    }

    if (args.terms.length !== args.termCount) {
      throw new ConvexError({
        message: "Броят на сроковете не съответства",
        code: "BAD_REQUEST",
      });
    }

    if (args.classIds.length === 0) {
      throw new ConvexError({
        message: "Моля, изберете поне една паралелка",
        code: "BAD_REQUEST",
      });
    }

    // Get existing configurations for these classes
    const existingConfigs = await ctx.db
      .query("classTermConfigurations")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .collect();

    const existingMap = new Map(existingConfigs.map(c => [c.classId, c._id]));

    // Update or create configurations for each class
    for (const classId of args.classIds) {
      const existingId = existingMap.get(classId);

      if (existingId) {
        // Update existing
        await ctx.db.patch(existingId, {
          termCount: args.termCount,
          terms: args.terms,
          academicYear: args.academicYear,
        });
      } else {
        // Create new
        await ctx.db.insert("classTermConfigurations", {
          classId,
          termCount: args.termCount,
          terms: args.terms,
          academicYear: args.academicYear,
          schoolId: user.schoolId!,
        });
      }
    }

    return { updated: args.classIds.length };
  },
});

/**
 * Get current term configuration (for pre-filling the edit form)
 */
export const getCurrentTermConfig = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "Не сте влезли в системата",
        code: "UNAUTHENTICATED",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "Потребителят не е намерен",
        code: "NOT_FOUND",
      });
    }

    if (!user.schoolId) {
      return DEFAULT_TERM_CONFIG;
    }

    // Get any existing configuration to use as default
    const existingConfig = await ctx.db
      .query("classTermConfigurations")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .first();

    if (existingConfig) {
      return {
        termCount: existingConfig.termCount,
        terms: existingConfig.terms,
        academicYear: existingConfig.academicYear,
      };
    }

    // Return default
    return DEFAULT_TERM_CONFIG;
  },
});

// Keep legacy queries for backwards compatibility
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "Не сте влезли в системата",
        code: "UNAUTHENTICATED",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user || !user.schoolId) {
      return [];
    }

    const terms = await ctx.db
      .query("terms")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .collect();

    return terms.sort((a, b) => a.startDate - b.startDate);
  },
});

export const getById = query({
  args: { id: v.id("terms") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get term configuration for a specific class
 */
export const getTermConfigByClass = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "Не сте влезли в системата",
        code: "UNAUTHENTICATED",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user || !user.schoolId) {
      return null;
    }

    // Get term configuration for the class
    const termConfig = await ctx.db
      .query("classTermConfigurations")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .first();

    return termConfig;
  },
});
