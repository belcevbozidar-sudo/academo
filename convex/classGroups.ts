import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel.d.ts";

// List all groups for a class
export const listByClass = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args): Promise<Array<
    Doc<"classGroups"> & {
      subjectName: string;
      teacherName: string;
      studentCount: number;
    }
  >> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }

    const groups = await ctx.db
      .query("classGroups")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    return Promise.all(groups.map(async (g) => {
      const subject = await ctx.db.get(g.subjectId);
      
      // Get teacher name
      let teacherName = "—";
      if (g.teacherId) {
        const teacher = await ctx.db.get(g.teacherId);
        if (teacher) {
          const user = await ctx.db.get(teacher.userId);
          if (user) {
            const fName = user.firstName || "";
            const lName = user.lastName || "";
            teacherName = `${fName} ${lName}`.trim() || user.name || "—";
          }
        }
      }

      return {
        ...g,
        subjectName: subject?.name || "—",
        teacherName,
        studentCount: g.studentIds.length,
      };
    }));
  },
});

// Get group for a specific class + subject
export const getByClassAndSubject = query({
  args: {
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }

    return await ctx.db
      .query("classGroups")
      .withIndex("by_class_and_subject", (q) =>
        q.eq("classId", args.classId).eq("subjectId", args.subjectId)
      )
      .collect();
  },
});

// Create a new group
export const create = mutation({
  args: {
    classId: v.id("classes"),
    name: v.string(),
    groupType: v.union(v.literal("full_class"), v.literal("partial"), v.literal("ifo")),
    subjectId: v.id("subjects"),
    teacherId: v.optional(v.id("teachers")),
    preparationType: v.optional(v.string()),
    studentIds: v.array(v.id("students")),
    normativ: v.number(),
    educationAddress: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"classGroups">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    const classData = await ctx.db.get(args.classId);
    if (!classData) {
      throw new ConvexError({ message: "Class not found", code: "NOT_FOUND" });
    }

    return await ctx.db.insert("classGroups", {
      classId: args.classId,
      name: args.name,
      groupType: args.groupType,
      subjectId: args.subjectId,
      teacherId: args.teacherId,
      preparationType: args.preparationType,
      studentIds: args.studentIds,
      normativ: args.normativ,
      educationAddress: args.educationAddress,
      schoolId: classData.schoolId,
      createdBy: user._id,
      createdAt: Date.now(),
    });
  },
});

// Update an existing group
export const update = mutation({
  args: {
    id: v.id("classGroups"),
    name: v.optional(v.string()),
    groupType: v.optional(v.union(v.literal("full_class"), v.literal("partial"), v.literal("ifo"))),
    subjectId: v.optional(v.id("subjects")),
    teacherId: v.optional(v.id("teachers")),
    preparationType: v.optional(v.string()),
    studentIds: v.optional(v.array(v.id("students"))),
    normativ: v.optional(v.number()),
    educationAddress: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError({ message: "Group not found", code: "NOT_FOUND" });
    }

    const updates: Record<string, unknown> = {
      lastEditedBy: user._id,
      lastEditedAt: Date.now(),
    };
    if (args.name !== undefined) updates.name = args.name;
    if (args.groupType !== undefined) updates.groupType = args.groupType;
    if (args.subjectId !== undefined) updates.subjectId = args.subjectId;
    if (args.teacherId !== undefined) updates.teacherId = args.teacherId;
    if (args.preparationType !== undefined) updates.preparationType = args.preparationType;
    if (args.studentIds !== undefined) updates.studentIds = args.studentIds;
    if (args.normativ !== undefined) updates.normativ = args.normativ;
    if (args.educationAddress !== undefined) updates.educationAddress = args.educationAddress;

    await ctx.db.patch(args.id, updates);
  },
});

// Save all groups for a class (bulk upsert - delete removed, create new, update existing)
export const saveAllForClass = mutation({
  args: {
    classId: v.id("classes"),
    groups: v.array(v.object({
      id: v.optional(v.id("classGroups")),
      name: v.string(),
      groupType: v.union(v.literal("full_class"), v.literal("partial"), v.literal("ifo")),
      subjectId: v.id("subjects"),
      teacherId: v.optional(v.id("teachers")),
      preparationType: v.optional(v.string()),
      studentIds: v.array(v.id("students")),
      normativ: v.number(),
      educationAddress: v.string(),
    })),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    const classData = await ctx.db.get(args.classId);
    if (!classData) {
      throw new ConvexError({ message: "Class not found", code: "NOT_FOUND" });
    }

    // Get existing groups
    const existing = await ctx.db
      .query("classGroups")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    const existingIds = new Set(existing.map(g => g._id));
    const newIds = new Set(args.groups.filter(g => g.id).map(g => g.id as string));

    // Delete removed groups
    for (const eg of existing) {
      if (!newIds.has(eg._id)) {
        await ctx.db.delete(eg._id);
      }
    }

    // Create or update groups
    for (const g of args.groups) {
      if (g.id && existingIds.has(g.id)) {
        // Update existing
        await ctx.db.patch(g.id, {
          name: g.name,
          groupType: g.groupType,
          subjectId: g.subjectId,
          teacherId: g.teacherId,
          preparationType: g.preparationType,
          studentIds: g.studentIds,
          normativ: g.normativ,
          educationAddress: g.educationAddress,
          lastEditedBy: user._id,
          lastEditedAt: Date.now(),
        });
      } else {
        // Create new
        await ctx.db.insert("classGroups", {
          classId: args.classId,
          name: g.name,
          groupType: g.groupType,
          subjectId: g.subjectId,
          teacherId: g.teacherId,
          preparationType: g.preparationType,
          studentIds: g.studentIds,
          normativ: g.normativ,
          educationAddress: g.educationAddress,
          schoolId: classData.schoolId,
          createdBy: user._id,
          createdAt: Date.now(),
        });
      }
    }
  },
});

// Delete class group
export const remove = mutation({
  args: { id: v.id("classGroups") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError({ message: "Group not found", code: "NOT_FOUND" });
    }

    await ctx.db.delete(args.id);
  },
});
