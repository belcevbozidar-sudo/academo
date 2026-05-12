import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";
import { isAdmin as checkIsAdmin, hasRole } from "./users.js";

// Create a grade deletion request (for teachers)
export const createDeleteRequest = mutation({
  args: {
    gradeId: v.id("grades"),
    reason: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"gradeDeleteRequests">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

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

    // Validate reason is not empty
    if (!args.reason.trim()) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Причината за изтриване е задължителна",
      });
    }

    // Get the grade
    const grade = await ctx.db.get(args.gradeId);
    if (!grade) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Оценката не е намерена",
      });
    }

    // Check if there's already a pending request for this grade
    const existingRequest = await ctx.db
      .query("gradeDeleteRequests")
      .withIndex("by_grade", (q) => q.eq("gradeId", args.gradeId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingRequest) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Вече има чакаща заявка за изтриване на тази оценка",
      });
    }

    // Get related data for snapshot
    const student = await ctx.db.get(grade.studentId);
    const studentUser = student ? await ctx.db.get(student.userId) : null;
    const classDoc = await ctx.db.get(grade.classId);
    const subject = await ctx.db.get(grade.subjectId);
    const teacher = await ctx.db.get(grade.teacherId);
    const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;

    const studentName = studentUser 
      ? [studentUser.firstName, studentUser.lastName].filter(Boolean).join(" ") || "Неизвестен ученик"
      : "Неизвестен ученик";
    
    const teacherName = teacherUser
      ? [teacherUser.firstName, teacherUser.lastName].filter(Boolean).join(" ") || "Неизвестен учител"
      : "Неизвестен учител";

    const requestId = await ctx.db.insert("gradeDeleteRequests", {
      gradeId: args.gradeId,
      requestedBy: currentUser._id,
      requestedAt: Date.now(),
      reason: args.reason.trim(),
      status: "pending",
      gradeSnapshot: {
        studentId: grade.studentId,
        studentName,
        classId: grade.classId,
        className: classDoc?.name || "Неизвестен клас",
        subjectId: grade.subjectId,
        subjectName: subject?.name || "Неизвестен предмет",
        teacherId: grade.teacherId,
        teacherName,
        value: grade.value,
        gradeType: grade.gradeType,
        date: grade.date,
      },
      schoolId: student?.schoolId || currentUser.schoolId as Id<"schools">,
    });

    // Create notification for admins
    // Get all users and filter those with admin roles (from either role or roles array)
    const allUsers = await ctx.db.query("users").collect();
    const admins = allUsers.filter((user) => {
      const hasAdminRole = user.role === "director" || user.role === "vice_director" || user.role === "system_admin";
      const hasAdminRoleInArray = user.roles?.some(r => r === "director" || r === "vice_director" || r === "system_admin");
      return hasAdminRole || hasAdminRoleInArray;
    });

    const requesterName = [currentUser.firstName, currentUser.lastName].filter(Boolean).join(" ") || "Учител";

    for (const admin of admins) {
      await ctx.db.insert("notifications", {
        userId: admin._id,
        type: "grade_delete_request",
        title: "Заявка за изтриване на оценка",
        message: `${requesterName} поиска изтриване на оценка ${grade.value} по ${subject?.name || "предмет"} за ${studentName}. Причина: ${args.reason}`,
        isRead: false,
        relatedEntityType: "gradeDeleteRequest",
        relatedEntityId: requestId,
        actionUrl: "/bg/admin/requests",
        schoolId: student?.schoolId,
      });
    }

    return requestId;
  },
});

// Get all pending requests (for admins)
export const getPendingRequests = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

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

    // Only admins can view requests
    const isAdminUser = checkIsAdmin(currentUser);
    if (!isAdminUser) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Само администратори могат да преглеждат заявки",
      });
    }

    const requests = await ctx.db
      .query("gradeDeleteRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .collect();

    // Enrich with requester info
    const enrichedRequests = await Promise.all(
      requests.map(async (request) => {
        const requester = await ctx.db.get(request.requestedBy);
        return {
          ...request,
          requesterName: requester 
            ? [requester.firstName, requester.lastName].filter(Boolean).join(" ") || "Неизвестен"
            : "Неизвестен",
        };
      })
    );

    return enrichedRequests;
  },
});

// Get all requests (with filters)
export const getAllRequests = query({
  args: {
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("all")
    )),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

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

    // Only admins can view requests
    const isAdminUser = checkIsAdmin(currentUser);
    if (!isAdminUser) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Само администратори могат да преглеждат заявки",
      });
    }

    let requests;
    if (args.status && args.status !== "all") {
      requests = await ctx.db
        .query("gradeDeleteRequests")
        .withIndex("by_status", (q) => q.eq("status", args.status as "pending" | "approved" | "rejected"))
        .order("desc")
        .collect();
    } else {
      requests = await ctx.db
        .query("gradeDeleteRequests")
        .order("desc")
        .collect();
    }

    // Enrich with requester and resolver info
    const enrichedRequests = await Promise.all(
      requests.map(async (request) => {
        const requester = await ctx.db.get(request.requestedBy);
        const resolver = request.resolvedBy ? await ctx.db.get(request.resolvedBy) : null;
        
        return {
          ...request,
          requesterName: requester 
            ? [requester.firstName, requester.lastName].filter(Boolean).join(" ") || "Неизвестен"
            : "Неизвестен",
          resolverName: resolver
            ? [resolver.firstName, resolver.lastName].filter(Boolean).join(" ") || "Неизвестен"
            : null,
        };
      })
    );

    return enrichedRequests;
  },
});

// Approve a deletion request (deletes the grade)
export const approveRequest = mutation({
  args: {
    requestId: v.id("gradeDeleteRequests"),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

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

    // Only admins can approve requests
    const isAdminUser = checkIsAdmin(currentUser);
    if (!isAdminUser) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Само администратори могат да одобряват заявки",
      });
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Заявката не е намерена",
      });
    }

    if (request.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Тази заявка вече е обработена",
      });
    }

    // Delete the grade
    const grade = await ctx.db.get(request.gradeId);
    if (grade) {
      await ctx.db.delete(request.gradeId);
      
      // Audit log
      await ctx.db.insert("auditLog", {
        userId: currentUser._id,
        action: "approve_grade_delete_request",
        targetType: "grade",
        targetId: request.gradeId,
        details: JSON.stringify({
          requestId: args.requestId,
          gradeSnapshot: request.gradeSnapshot,
          reason: request.reason,
        }),
        schoolId: request.schoolId,
      });
    }

    // Update request status
    await ctx.db.patch(args.requestId, {
      status: "approved",
      resolvedBy: currentUser._id,
      resolvedAt: Date.now(),
    });

    // Notify the requester
    await ctx.db.insert("notifications", {
      userId: request.requestedBy,
      type: "grade_delete_approved",
      title: "Заявката е одобрена",
      message: `Заявката ви за изтриване на оценка ${request.gradeSnapshot.value} по ${request.gradeSnapshot.subjectName} беше одобрена.`,
      isRead: false,
      schoolId: request.schoolId,
    });
  },
});

// Reject a deletion request
export const rejectRequest = mutation({
  args: {
    requestId: v.id("gradeDeleteRequests"),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

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

    // Only admins can reject requests
    const isAdminUser = checkIsAdmin(currentUser);
    if (!isAdminUser) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Само администратори могат да отхвърлят заявки",
      });
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Заявката не е намерена",
      });
    }

    if (request.status !== "pending") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Тази заявка вече е обработена",
      });
    }

    // Update request status
    await ctx.db.patch(args.requestId, {
      status: "rejected",
      resolvedBy: currentUser._id,
      resolvedAt: Date.now(),
      rejectionReason: args.rejectionReason,
    });

    // Audit log
    await ctx.db.insert("auditLog", {
      userId: currentUser._id,
      action: "reject_grade_delete_request",
      targetType: "gradeDeleteRequest",
      targetId: args.requestId,
      details: JSON.stringify({
        gradeSnapshot: request.gradeSnapshot,
        reason: request.reason,
        rejectionReason: args.rejectionReason,
      }),
      schoolId: request.schoolId,
    });

    // Notify the requester
    await ctx.db.insert("notifications", {
      userId: request.requestedBy,
      type: "grade_delete_rejected",
      title: "Заявката е отхвърлена",
      message: `Заявката ви за изтриване на оценка ${request.gradeSnapshot.value} по ${request.gradeSnapshot.subjectName} беше отхвърлена.${args.rejectionReason ? ` Причина: ${args.rejectionReason}` : ""}`,
      isRead: false,
      schoolId: request.schoolId,
    });
  },
});

// Get count of pending requests (for badge display)
export const getPendingRequestsCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return 0;
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      return 0;
    }

    // Only admins can see the count
    const isAdminUser = checkIsAdmin(currentUser);
    if (!isAdminUser) {
      return 0;
    }

    const requests = await ctx.db
      .query("gradeDeleteRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    return requests.length;
  },
});
