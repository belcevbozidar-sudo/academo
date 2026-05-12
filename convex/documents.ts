import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

// DOCUMENTS
export const listDocuments = query({
  args: {
    schoolId: v.optional(v.id("schools")),
    studentId: v.optional(v.id("students")),
    type: v.optional(
      v.union(
        v.literal("student_document"),
        v.literal("protocol"),
        v.literal("order"),
        v.literal("correspondence")
      )
    ),
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
        .query("documents")
        .withIndex("by_student", (q) => q.eq("studentId", args.studentId!))
        .collect();
    } else if (args.schoolId) {
      documents = await ctx.db
        .query("documents")
        .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
        .collect();
    } else if (args.type) {
      documents = await ctx.db
        .query("documents")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .collect();
    } else {
      documents = await ctx.db.query("documents").collect();
    }

    // Filter by type if needed (for additional filtering)
    const filteredDocs = args.type
      ? documents.filter((d) => d.type === args.type)
      : documents;

    // Enrich with user names
    const enrichedDocuments = await Promise.all(
      filteredDocs.map(async (doc) => {
        const issuedBy = await ctx.db.get(doc.issuedBy);
        const lastEditedBy = doc.lastEditedBy
          ? await ctx.db.get(doc.lastEditedBy)
          : null;
        
        let studentName = null;
        let className = null;
        if (doc.studentId) {
          const student = await ctx.db.get(doc.studentId);
          if (student) {
            const studentUser = await ctx.db.get(student.userId);
            studentName = studentUser?.name;
            const classData = await ctx.db.get(student.classId);
            className = classData?.name;
          }
        }

        return {
          ...doc,
          issuedByName: issuedBy?.name,
          lastEditedByName: lastEditedBy?.name,
          studentName,
          className,
        };
      })
    );

    return enrichedDocuments;
  },
});

export const createDocument = mutation({
  args: {
    title: v.string(),
    type: v.union(
      v.literal("student_document"),
      v.literal("protocol"),
      v.literal("order"),
      v.literal("correspondence")
    ),
    studentId: v.optional(v.id("students")),
    schoolId: v.id("schools"),
    issuedBy: v.id("users"),
    issuedDate: v.number(),
    content: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"documents">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // ✅ SECURITY FIX: Only admins and authorized staff can create documents
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
        message: "Само администратори и секретари могат да създават документи",
      });
    }

    // ✅ FIX 1: Rate limiting
    const { checkRateLimit } = await import("./rateLimiting.js");
    await checkRateLimit(ctx, currentUser._id, "create_document");

    const documentId = await ctx.db.insert("documents", args);

    // ✅ FIX 3: Audit log
    await ctx.db.insert("auditLog", {
      userId: currentUser._id,
      action: "create_document",
      targetType: "document",
      targetId: documentId,
      details: JSON.stringify({
        title: args.title,
        type: args.type,
      }),
      schoolId: args.schoolId,
    });

    return documentId;
  },
});

export const updateDocument = mutation({
  args: {
    id: v.id("documents"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    lastEditedBy: v.id("users"),
    lastEditedDate: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // ✅ SECURITY FIX: Only admins and authorized staff can update documents
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
        message: "Само администратори и секретари могат да редактират документи",
      });
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);

    // ✅ FIX 3: Audit log
    const document = await ctx.db.get(id);
    await ctx.db.insert("auditLog", {
      userId: currentUser._id,
      action: "update_document",
      targetType: "document",
      targetId: id,
      details: JSON.stringify({
        title: document?.title,
        type: document?.type,
      }),
      schoolId: document?.schoolId,
    });
  },
});

export const deleteDocument = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // ✅ SECURITY FIX: Only admins can delete documents
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
        message: "Само администратори могат да изтриват документи",
      });
    }

    // Get document before deleting for audit log
    const document = await ctx.db.get(args.id);
    
    await ctx.db.delete(args.id);

    // ✅ FIX 3: Audit log
    if (document) {
      await ctx.db.insert("auditLog", {
        userId: currentUser._id,
        action: "delete_document",
        targetType: "document",
        targetId: args.id,
        details: JSON.stringify({
          title: document.title,
          type: document.type,
        }),
        schoolId: document.schoolId,
      });
    }
  },
});

// MESSAGES
export const listMessages = query({
  args: {
    userId: v.optional(v.id("users")),
    schoolId: v.optional(v.id("schools")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const messages = args.schoolId
      ? await ctx.db
          .query("messages")
          .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
          .collect()
      : await ctx.db.query("messages").collect();

    // Filter messages for specific user (received)
    const filteredMessages = args.userId
      ? messages.filter((m) => m.toUserIds.includes(args.userId!))
      : messages;

    // Sort by sent date
    filteredMessages.sort((a, b) => b.sentDate - a.sentDate);

    // Enrich with sender names
    const enrichedMessages = await Promise.all(
      filteredMessages.map(async (message) => {
        const from = await ctx.db.get(message.fromUserId);
        return {
          ...message,
          fromName: from?.name,
          isRead: args.userId ? message.readBy.includes(args.userId) : false,
        };
      })
    );

    return enrichedMessages;
  },
});

export const createMessage = mutation({
  args: {
    fromUserId: v.id("users"),
    toUserIds: v.array(v.id("users")),
    subject: v.string(),
    content: v.string(),
    sentDate: v.number(),
    readBy: v.array(v.id("users")),
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args): Promise<Id<"messages">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    return await ctx.db.insert("messages", args);
  },
});

export const markMessageAsRead = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Message not found",
      });
    }

    if (!message.readBy.includes(args.userId)) {
      await ctx.db.patch(args.messageId, {
        readBy: [...message.readBy, args.userId],
      });
    }
  },
});
