import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

// Get all project activities for a school
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "Трябва да сте влезли в профила си",
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

    const schoolId = user.schoolId;

    const activities = await ctx.db
      .query("projectActivities")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();

    // Get user info for each activity
    const activitiesWithUsers = await Promise.all(
      activities.map(async (activity) => {
        const creator = await ctx.db.get(activity.createdBy);
        return {
          ...activity,
          creatorName: creator
            ? [creator.firstName, creator.middleName?.[0] ? `${creator.middleName[0]}.` : null, creator.lastName]
                .filter(Boolean)
                .join(" ") || creator.name || "Неизвестен"
            : "Неизвестен",
        };
      })
    );

    return activitiesWithUsers;
  },
});

// Get a single project activity by ID
export const get = query({
  args: {
    id: v.id("projectActivities"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "Трябва да сте влезли в профила си",
        code: "UNAUTHENTICATED",
      });
    }

    const activity = await ctx.db.get(args.id);
    if (!activity) {
      throw new ConvexError({
        message: "Проектната дейност не е намерена",
        code: "NOT_FOUND",
      });
    }

    const creator = await ctx.db.get(activity.createdBy);
    
    return {
      ...activity,
      creatorName: creator
        ? [creator.firstName, creator.middleName?.[0] ? `${creator.middleName[0]}.` : null, creator.lastName]
            .filter(Boolean)
            .join(" ") || creator.name || "Неизвестен"
        : "Неизвестен",
    };
  },
});

// Create a new project activity
export const create = mutation({
  args: {
    name: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    projectType: v.optional(v.union(
      v.literal("national_partnership"),
      v.literal("international_partnership"),
      v.literal("no_partner")
    )),
    programType: v.optional(v.union(
      v.literal("mon_national"),
      v.literal("mon_esf"),
      v.literal("other_national"),
      v.literal("npo_cooperation"),
      v.literal("eu_lifelong_learning"),
      v.literal("eu_erasmus"),
      v.literal("eu_other"),
      v.literal("other_international")
    )),
    website: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    mainResults: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "Трябва да сте влезли в профила си",
        code: "UNAUTHENTICATED",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user || !user.schoolId) {
      throw new ConvexError({
        message: "Потребителят не е намерен",
        code: "NOT_FOUND",
      });
    }

    // Check permissions - only admin, director, vice_director can create
    const allowedRoles = ["director", "vice_director", "system_admin"];
    const userRoles = user.roles || [user.role];
    const hasPermission = userRoles.some((role) => allowedRoles.includes(role));

    if (!hasPermission) {
      throw new ConvexError({
        message: "Нямате права за създаване на проектни дейности",
        code: "FORBIDDEN",
      });
    }

    // Validate description length
    if (args.shortDescription && args.shortDescription.length > 500) {
      throw new ConvexError({
        message: "Краткото описание не може да бъде по-дълго от 500 символа",
        code: "BAD_REQUEST",
      });
    }

    const activityId = await ctx.db.insert("projectActivities", {
      name: args.name,
      startDate: args.startDate,
      endDate: args.endDate,
      projectType: args.projectType,
      programType: args.programType,
      website: args.website,
      shortDescription: args.shortDescription,
      mainResults: args.mainResults,
      schoolId: user.schoolId,
      createdBy: user._id,
      createdAt: Date.now(),
    });

    return activityId;
  },
});

// Update a project activity
export const update = mutation({
  args: {
    id: v.id("projectActivities"),
    name: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    projectType: v.optional(v.union(
      v.literal("national_partnership"),
      v.literal("international_partnership"),
      v.literal("no_partner")
    )),
    programType: v.optional(v.union(
      v.literal("mon_national"),
      v.literal("mon_esf"),
      v.literal("other_national"),
      v.literal("npo_cooperation"),
      v.literal("eu_lifelong_learning"),
      v.literal("eu_erasmus"),
      v.literal("eu_other"),
      v.literal("other_international")
    )),
    website: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    mainResults: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "Трябва да сте влезли в профила си",
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

    // Check permissions
    const allowedRoles = ["director", "vice_director", "system_admin"];
    const userRoles = user.roles || [user.role];
    const hasPermission = userRoles.some((role) => allowedRoles.includes(role));

    if (!hasPermission) {
      throw new ConvexError({
        message: "Нямате права за редактиране на проектни дейности",
        code: "FORBIDDEN",
      });
    }

    const activity = await ctx.db.get(args.id);
    if (!activity) {
      throw new ConvexError({
        message: "Проектната дейност не е намерена",
        code: "NOT_FOUND",
      });
    }

    // Validate description length
    if (args.shortDescription && args.shortDescription.length > 500) {
      throw new ConvexError({
        message: "Краткото описание не може да бъде по-дълго от 500 символа",
        code: "BAD_REQUEST",
      });
    }

    await ctx.db.patch(args.id, {
      name: args.name,
      startDate: args.startDate,
      endDate: args.endDate,
      projectType: args.projectType,
      programType: args.programType,
      website: args.website,
      shortDescription: args.shortDescription,
      mainResults: args.mainResults,
      lastEditedBy: user._id,
      lastEditedAt: Date.now(),
    });

    return args.id;
  },
});

// Delete a project activity
export const remove = mutation({
  args: {
    id: v.id("projectActivities"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "Трябва да сте влезли в профила си",
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

    // Check permissions
    const allowedRoles = ["director", "vice_director", "system_admin"];
    const userRoles = user.roles || [user.role];
    const hasPermission = userRoles.some((role) => allowedRoles.includes(role));

    if (!hasPermission) {
      throw new ConvexError({
        message: "Нямате права за изтриване на проектни дейности",
        code: "FORBIDDEN",
      });
    }

    const activity = await ctx.db.get(args.id);
    if (!activity) {
      throw new ConvexError({
        message: "Проектната дейност не е намерена",
        code: "NOT_FOUND",
      });
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
