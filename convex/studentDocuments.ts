import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

// List student documents with enriched data
export const list = query({
  args: {
    schoolId: v.optional(v.id("schools")),
    studentId: v.optional(v.id("students")),
    classId: v.optional(v.id("classes")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    let documents;
    if (args.studentId) {
      documents = await ctx.db
        .query("studentDocuments")
        .withIndex("by_student", (q) => q.eq("studentId", args.studentId!))
        .collect();
    } else if (args.classId) {
      documents = await ctx.db
        .query("studentDocuments")
        .withIndex("by_class", (q) => q.eq("classId", args.classId!))
        .collect();
    } else if (args.schoolId) {
      documents = await ctx.db
        .query("studentDocuments")
        .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
        .collect();
    } else {
      documents = await ctx.db.query("studentDocuments").collect();
    }

    // Enrich with related data
    const enrichedDocuments = await Promise.all(
      documents.map(async (doc) => {
        const student = await ctx.db.get(doc.studentId);
        const classData = await ctx.db.get(doc.classId);
        const issuedBy = await ctx.db.get(doc.issuedBy);
        const createdBy = await ctx.db.get(doc.createdBy);
        const lastEditedBy = doc.lastEditedBy
          ? await ctx.db.get(doc.lastEditedBy)
          : null;

        let studentName = "Неизвестен";
        if (student) {
          const studentUser = await ctx.db.get(student.userId);
          studentName = studentUser?.name || "Неизвестен";
        }

        return {
          ...doc,
          studentName,
          className: classData?.name || "-",
          issuedByName: issuedBy?.name || "Неизвестен",
          createdByName: createdBy?.name || "Неизвестен",
          lastEditedByName: lastEditedBy?.name || null,
        };
      })
    );

    // Sort by creation date (newest first)
    enrichedDocuments.sort((a, b) => b.createdDate - a.createdDate);

    return enrichedDocuments;
  },
});

// Get a single student document by ID
export const getById = query({
  args: { id: v.id("studentDocuments") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const doc = await ctx.db.get(args.id);
    if (!doc) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Document not found",
      });
    }

    return doc;
  },
});

// Create a new student document
export const create = mutation({
  args: {
    type: v.string(),
    studentId: v.id("students"),
    classId: v.id("classes"),
    issuedBy: v.id("users"),
    issuedDate: v.number(),
    createdBy: v.id("users"),
    schoolId: v.id("schools"),
    academicYear: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"studentDocuments">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // ✅ SECURITY FIX: Only admins and authorized staff can create student documents
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not found",
      });
    }

    const allowedRoles = ["director", "vice_director", "system_admin", "secretary"];
    if (!allowedRoles.includes(currentUser.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Само администратори и секретари могат да създават ученически документи",
      });
    }

    const documentId = await ctx.db.insert("studentDocuments", {
      ...args,
      createdDate: Date.now(),
    });

    return documentId;
  },
});

// Update an existing student document
export const update = mutation({
  args: {
    id: v.id("studentDocuments"),
    type: v.optional(v.string()),
    issuedBy: v.optional(v.id("users")),
    issuedDate: v.optional(v.number()),
    lastEditedBy: v.id("users"),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // ✅ SECURITY FIX: Only admins and authorized staff can update student documents
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not found",
      });
    }

    const allowedRoles = ["director", "vice_director", "system_admin", "secretary"];
    if (!allowedRoles.includes(currentUser.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Само администратори и секретари могат да редактират ученически документи",
      });
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      lastEditedDate: Date.now(),
    });
  },
});

// Delete a student document
export const remove = mutation({
  args: { id: v.id("studentDocuments") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // ✅ SECURITY FIX: Only admins can delete student documents
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not found",
      });
    }

    const allowedRoles = ["director", "vice_director", "system_admin"];
    if (!allowedRoles.includes(currentUser.role)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Само администратори могат да изтриват ученически документи",
      });
    }

    await ctx.db.delete(args.id);
  },
});

// Export student documents for NEISPUO
export const exportForNEISPUO = mutation({
  args: {
    documentIds: v.array(v.id("studentDocuments")),
    exportedBy: v.id("users"),
  },
  handler: async (ctx, args): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // TODO: Implement NEISPUO export logic
    // For now, return a placeholder message
    return `Експортирани ${args.documentIds.length} документа`;
  },
});
