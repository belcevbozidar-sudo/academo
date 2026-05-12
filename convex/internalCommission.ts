import { query, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// Types for ВЧК (Втори час на класа)
export const VCK_TYPES = [
  { value: "student_consultation", label: "Консултиране на ученици" },
  { value: "parent_consultation", label: "Консултиране на родители" },
  { value: "school_documentation", label: "Работа с училищна документация" },
] as const;

export type VckType = "student_consultation" | "parent_consultation" | "school_documentation";

// Get all VCK records for a class
export const getByClass = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args): Promise<Array<{
    _id: string;
    type: VckType;
    typeLabel: string;
    startDate: number;
    endDate: number;
    roomId: string | null;
    roomName: string | null;
    teacherId: string;
    teacherName: string;
    description: string | null;
    createdAt: number;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const records = await ctx.db
      .query("internalCommission")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .order("desc")
      .collect();

    const enrichedRecords = await Promise.all(
      records.map(async (record) => {
        const teacher = await ctx.db.get(record.teacherId);
        const teacherName = teacher
          ? `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim()
          : "Неизвестен учител";

        let roomName: string | null = null;
        if (record.roomId) {
          const room = await ctx.db.get(record.roomId);
          roomName = room?.name ?? null;
        }

        const typeInfo = VCK_TYPES.find(t => t.value === record.type);

        return {
          _id: record._id,
          type: record.type,
          typeLabel: typeInfo?.label ?? record.type,
          startDate: record.startDate,
          endDate: record.endDate,
          roomId: record.roomId ?? null,
          roomName,
          teacherId: record.teacherId,
          teacherName,
          description: record.description ?? null,
          createdAt: record.createdAt,
        };
      })
    );

    return enrichedRecords;
  },
});

// Get single VCK record by ID
export const getById = query({
  args: { id: v.id("internalCommission") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const record = await ctx.db.get(args.id);
    if (!record) {
      return null;
    }

    const teacher = await ctx.db.get(record.teacherId);
    let roomName: string | null = null;
    if (record.roomId) {
      const room = await ctx.db.get(record.roomId);
      roomName = room?.name ?? null;
    }

    const typeInfo = VCK_TYPES.find(t => t.value === record.type);

    return {
      ...record,
      typeLabel: typeInfo?.label ?? record.type,
      teacherName: teacher
        ? `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim()
        : "Неизвестен учител",
      roomName,
    };
  },
});

// Get rooms for a school
export const getRoomsBySchool = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const rooms = await ctx.db
      .query("rooms")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .collect();

    return rooms.map(room => ({
      _id: room._id,
      name: room.name,
      floor: room.floor,
    }));
  },
});

// Get teachers for a school
export const getTeachersBySchool = query({
  args: { schoolId: v.id("schools") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const users = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .collect();

    // Filter to get only teachers
    const teachers = users.filter(user => 
      user.roles?.includes("teacher") || 
      user.roles?.includes("class_teacher") ||
      user.role === "teacher" ||
      user.role === "class_teacher"
    );

    return teachers.map(teacher => ({
      _id: teacher._id,
      name: `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim() || "Без име",
    })).sort((a, b) => a.name.localeCompare(b.name, "bg"));
  },
});

// Create new VCK record
export const create = mutation({
  args: {
    classId: v.id("classes"),
    type: v.union(
      v.literal("student_consultation"),
      v.literal("parent_consultation"),
      v.literal("school_documentation")
    ),
    startDate: v.number(),
    endDate: v.number(),
    roomId: v.optional(v.id("rooms")),
    teacherId: v.id("users"),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"internalCommission">> => {
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

    // Get school ID from class
    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc) {
      throw new ConvexError({
        message: "Class not found",
        code: "NOT_FOUND",
      });
    }

    const recordId = await ctx.db.insert("internalCommission", {
      classId: args.classId,
      schoolId: classDoc.schoolId,
      type: args.type,
      startDate: args.startDate,
      endDate: args.endDate,
      roomId: args.roomId,
      teacherId: args.teacherId,
      description: args.description,
      createdBy: user._id,
      createdAt: Date.now(),
    });

    return recordId;
  },
});

// Bulk create VCK records
export const bulkCreate = mutation({
  args: {
    classId: v.id("classes"),
    records: v.array(v.object({
      type: v.union(
        v.literal("student_consultation"),
        v.literal("parent_consultation"),
        v.literal("school_documentation")
      ),
      startDate: v.number(),
      endDate: v.number(),
      roomId: v.optional(v.id("rooms")),
      teacherId: v.id("users"),
      description: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args): Promise<Id<"internalCommission">[]> => {
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

    // Get school ID from class
    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc) {
      throw new ConvexError({
        message: "Class not found",
        code: "NOT_FOUND",
      });
    }

    const recordIds: Id<"internalCommission">[] = [];
    const now = Date.now();

    for (const record of args.records) {
      const recordId = await ctx.db.insert("internalCommission", {
        classId: args.classId,
        schoolId: classDoc.schoolId,
        type: record.type,
        startDate: record.startDate,
        endDate: record.endDate,
        roomId: record.roomId,
        teacherId: record.teacherId,
        description: record.description,
        createdBy: user._id,
        createdAt: now,
      });
      recordIds.push(recordId);
    }

    return recordIds;
  },
});

// Update VCK record
export const update = mutation({
  args: {
    id: v.id("internalCommission"),
    type: v.optional(v.union(
      v.literal("student_consultation"),
      v.literal("parent_consultation"),
      v.literal("school_documentation")
    )),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    roomId: v.optional(v.id("rooms")),
    teacherId: v.optional(v.id("users")),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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

    const record = await ctx.db.get(args.id);
    if (!record) {
      throw new ConvexError({
        message: "Record not found",
        code: "NOT_FOUND",
      });
    }

    const updates: Partial<{
      type: VckType;
      startDate: number;
      endDate: number;
      roomId: Id<"rooms">;
      teacherId: Id<"users">;
      description: string;
      lastEditedBy: Id<"users">;
      lastEditedAt: number;
    }> = {
      lastEditedBy: user._id,
      lastEditedAt: Date.now(),
    };

    if (args.type !== undefined) updates.type = args.type;
    if (args.startDate !== undefined) updates.startDate = args.startDate;
    if (args.endDate !== undefined) updates.endDate = args.endDate;
    if (args.roomId !== undefined) updates.roomId = args.roomId;
    if (args.teacherId !== undefined) updates.teacherId = args.teacherId;
    if (args.description !== undefined) updates.description = args.description;

    await ctx.db.patch(args.id, updates);
  },
});

// Delete VCK record
export const remove = mutation({
  args: { id: v.id("internalCommission") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const record = await ctx.db.get(args.id);
    if (!record) {
      throw new ConvexError({
        message: "Record not found",
        code: "NOT_FOUND",
      });
    }

    await ctx.db.delete(args.id);
  },
});
