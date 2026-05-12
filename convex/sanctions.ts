import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

// Типове санкции по чл. 199 и чл. 139
export const SANCTION_TYPES = [
  "чл. 199 ал. 1 т. 1 Забележка",
  "чл. 199 ал. 1 т. 2 Преместване в друга паралелка в същото училище",
  "чл. 199 ал. 1 т. 3 Предупреждение за преместване в друго училище",
  "чл. 199 ал. 1 т. 4 Преместване в друго училище",
  "чл. 199 ал. 1 т. 5 Преместване от дневна в самостоятелна форма на обучение",
  "чл. 139 ал. 1 т. 2 Извършване на дейности в полза на училището",
];

// Get all sanctions for a class
export const getSanctionsByClass = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const sanctions = await ctx.db
      .query("sanctions")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Enrich with student and creator details
    const enrichedSanctions = await Promise.all(
      sanctions.map(async (sanction) => {
        const student = await ctx.db.get(sanction.studentId);
        const studentUser = student ? await ctx.db.get(student.userId) : null;
        const createdByUser = await ctx.db.get(sanction.createdBy);
        const lastEditedByUser = sanction.lastEditedBy
          ? await ctx.db.get(sanction.lastEditedBy)
          : null;

        // Get file URLs
        const fileUrls: string[] = [];
        if (sanction.fileIds) {
          for (const fileId of sanction.fileIds) {
            const url = await ctx.storage.getUrl(fileId);
            if (url) fileUrls.push(url);
          }
        }

        return {
          ...sanction,
          studentName: studentUser
            ? [studentUser.firstName, studentUser.middleName, studentUser.lastName]
                .filter(Boolean)
                .join(" ")
            : "Неизвестен",
          studentNumber: student?.studentNumber || 0,
          createdByName: createdByUser
            ? [createdByUser.firstName, createdByUser.lastName]
                .filter(Boolean)
                .join(" ")
            : "Неизвестен",
          lastEditedByName: lastEditedByUser
            ? [lastEditedByUser.firstName, lastEditedByUser.lastName]
                .filter(Boolean)
                .join(" ")
            : null,
          fileUrls,
        };
      })
    );

    // Sort by start date (newest first), then by student number
    return enrichedSanctions.sort((a, b) => {
      if (a.startDate !== b.startDate) {
        return b.startDate - a.startDate;
      }
      return a.studentNumber - b.studentNumber;
    });
  },
});

// Get a single sanction by ID
export const getSanctionById = query({
  args: { id: v.id("sanctions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const sanction = await ctx.db.get(args.id);
    if (!sanction) {
      return null;
    }

    const student = await ctx.db.get(sanction.studentId);
    const studentUser = student ? await ctx.db.get(student.userId) : null;

    // Get file URLs
    const fileUrls: string[] = [];
    if (sanction.fileIds) {
      for (const fileId of sanction.fileIds) {
        const url = await ctx.storage.getUrl(fileId);
        if (url) fileUrls.push(url);
      }
    }

    return {
      ...sanction,
      studentName: studentUser
        ? [studentUser.firstName, studentUser.middleName, studentUser.lastName]
            .filter(Boolean)
            .join(" ")
        : "Неизвестен",
      studentNumber: student?.studentNumber || 0,
      fileUrls,
    };
  },
});

// Create a new sanction
export const createSanction = mutation({
  args: {
    studentId: v.id("students"),
    classId: v.id("classes"),
    sanctionType: v.string(),
    orderNumber: v.string(),
    orderDate: v.number(),
    reason: v.string(),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    fileIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args): Promise<Id<"sanctions">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get current user
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        message: "Current user not found",
        code: "NOT_FOUND",
      });
    }

    // Get the class to get schoolId
    const classData = await ctx.db.get(args.classId);
    if (!classData) {
      throw new ConvexError({
        message: "Class not found",
        code: "NOT_FOUND",
      });
    }

    const sanctionId = await ctx.db.insert("sanctions", {
      studentId: args.studentId,
      classId: args.classId,
      schoolId: classData.schoolId,
      sanctionType: args.sanctionType,
      orderNumber: args.orderNumber,
      orderDate: args.orderDate,
      reason: args.reason,
      startDate: args.startDate,
      endDate: args.endDate,
      fileIds: args.fileIds,
      createdBy: currentUser._id,
      createdAt: Date.now(),
    });

    return sanctionId;
  },
});

// Update a sanction
export const updateSanction = mutation({
  args: {
    id: v.id("sanctions"),
    studentId: v.optional(v.id("students")),
    sanctionType: v.optional(v.string()),
    orderNumber: v.optional(v.string()),
    orderDate: v.optional(v.number()),
    reason: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    fileIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get current user
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        message: "Current user not found",
        code: "NOT_FOUND",
      });
    }

    const sanction = await ctx.db.get(args.id);
    if (!sanction) {
      throw new ConvexError({
        message: "Sanction not found",
        code: "NOT_FOUND",
      });
    }

    // If fileIds are being updated, delete removed files from storage
    if (args.fileIds !== undefined && sanction.fileIds) {
      const newFileIds = new Set(args.fileIds.map(id => id.toString()));
      for (const oldFileId of sanction.fileIds) {
        if (!newFileIds.has(oldFileId.toString())) {
          // This file was removed, delete from storage
          try {
            await ctx.storage.delete(oldFileId);
          } catch (e) {
            // File may already be deleted, continue
            console.log("Could not delete file from storage:", oldFileId);
          }
        }
      }
    }

    const updates: Partial<{
      studentId: Id<"students">;
      sanctionType: string;
      orderNumber: string;
      orderDate: number;
      reason: string;
      startDate: number;
      endDate: number;
      fileIds: Id<"_storage">[];
      lastEditedBy: Id<"users">;
      lastEditedAt: number;
    }> = {
      lastEditedBy: currentUser._id,
      lastEditedAt: Date.now(),
    };

    if (args.studentId !== undefined) updates.studentId = args.studentId;
    if (args.sanctionType !== undefined) updates.sanctionType = args.sanctionType;
    if (args.orderNumber !== undefined) updates.orderNumber = args.orderNumber;
    if (args.orderDate !== undefined) updates.orderDate = args.orderDate;
    if (args.reason !== undefined) updates.reason = args.reason;
    if (args.startDate !== undefined) updates.startDate = args.startDate;
    if (args.endDate !== undefined) updates.endDate = args.endDate;
    if (args.fileIds !== undefined) updates.fileIds = args.fileIds;

    await ctx.db.patch(args.id, updates);
  },
});

// Delete a sanction
export const deleteSanction = mutation({
  args: {
    id: v.id("sanctions"),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const sanction = await ctx.db.get(args.id);
    if (!sanction) {
      throw new ConvexError({
        message: "Sanction not found",
        code: "NOT_FOUND",
      });
    }

    // Delete associated files from storage
    if (sanction.fileIds) {
      for (const fileId of sanction.fileIds) {
        await ctx.storage.delete(fileId);
      }
    }

    await ctx.db.delete(args.id);
  },
});

// Generate upload URL for files
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }
    return await ctx.storage.generateUploadUrl();
  },
});
