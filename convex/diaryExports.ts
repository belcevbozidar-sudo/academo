import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { isAdmin as checkIsAdmin } from "./users.js";

// GET /diary-exports - List all diary exports
export const list = query({
  args: {
    schoolId: v.optional(v.id("schools")),
    academicYear: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    Array<
      Doc<"classDiaryExports"> & {
        className: string;
        classTeacherName: string;
      }
    >
  > => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const exports = args.schoolId
      ? await ctx.db
          .query("classDiaryExports")
          .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
          .collect()
      : await ctx.db.query("classDiaryExports").collect();

    const filtered = args.academicYear
      ? exports.filter((e) => e.academicYear === args.academicYear)
      : exports;

    // Enrich with class and teacher info
    const enriched = await Promise.all(
      filtered.map(async (exp) => {
        const classDoc = await ctx.db.get(exp.classId);
        let classTeacherName = "—";

        if (classDoc?.classTeacherId) {
          const teacherUser = await ctx.db.get(classDoc.classTeacherId);
          classTeacherName = teacherUser?.name ?? "—";
        }

        return {
          ...exp,
          className: classDoc?.name ?? "Неизвестен клас",
          classTeacherName,
        };
      })
    );

    return enriched.sort((a, b) => b.generatedAt - a.generatedAt);
  },
});

// POST /diary-exports/:id/generate - Generate diary export for a class
export const generate = mutation({
  args: {
    classId: v.id("classes"),
    academicYear: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"classDiaryExports">> => {
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

    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc) {
      throw new ConvexError({
        message: "Class not found",
        code: "NOT_FOUND",
      });
    }

    const exportId = await ctx.db.insert("classDiaryExports", {
      classId: args.classId,
      generatedAt: Date.now(),
      uploadedToNEISPUO: false,
      locked: false,
      schoolId: classDoc.schoolId,
      academicYear: args.academicYear,
      generatedBy: user._id,
    });

    return exportId;
  },
});

// POST /diary-exports/:id/upload-neispuo - Mark as uploaded to НЕИСПУО and lock
export const uploadToNEISPUO = mutation({
  args: { id: v.id("classDiaryExports") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const exportDoc = await ctx.db.get(args.id);
    if (!exportDoc) {
      throw new ConvexError({
        message: "Diary export not found",
        code: "NOT_FOUND",
      });
    }

    if (exportDoc.locked) {
      throw new ConvexError({
        message: "Diary export is already locked",
        code: "CONFLICT",
      });
    }

    await ctx.db.patch(args.id, {
      uploadedToNEISPUO: true,
      locked: true,
    });
  },
});

// POST /diary-exports/:id/unlock - Unlock diary export
export const unlock = mutation({
  args: { id: v.id("classDiaryExports") },
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

    // Only admin can unlock
    const isAdminUser = checkIsAdmin(user);

    if (!isAdminUser) {
      throw new ConvexError({
        message: "Only administrators can unlock diary exports",
        code: "FORBIDDEN",
      });
    }

    await ctx.db.patch(args.id, {
      locked: false,
    });
  },
});

// DELETE /diary-exports/:id - Delete diary export
export const remove = mutation({
  args: { id: v.id("classDiaryExports") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const exportDoc = await ctx.db.get(args.id);
    if (!exportDoc) {
      throw new ConvexError({
        message: "Diary export not found",
        code: "NOT_FOUND",
      });
    }

    if (exportDoc.locked) {
      throw new ConvexError({
        message: "Cannot delete locked diary export",
        code: "CONFLICT",
      });
    }

    await ctx.db.delete(args.id);
  },
});
