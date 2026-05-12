import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import { api, internal } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.d.ts";

// Get all reviews (remarks + badges) for students in a class
export const getReviewsByClass = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args): Promise<{
    studentId: string;
    studentName: string;
    remarks: number;
    praises: number;
  }[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get all students in the class
    const students = await ctx.db
      .query("students")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Get all lessons for this class to filter badges
    const classLessons = await ctx.db
      .query("lessons")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();
    const classLessonIds = new Set(classLessons.map(l => l._id));

    const results = await Promise.all(
      students.map(async (student) => {
        const user = await ctx.db.get(student.userId);
        
        // Count remarks (warnings) - filter by classId
        const remarksData = await ctx.db
          .query("remarks")
          .withIndex("by_student", (q) => q.eq("studentId", student._id))
          .filter((q) => 
            q.and(
              q.eq(q.field("type"), "warning"),
              q.eq(q.field("classId"), args.classId)
            )
          )
          .collect();

        // Count praises from remarks - filter by classId
        const praisesFromRemarks = await ctx.db
          .query("remarks")
          .withIndex("by_student", (q) => q.eq("studentId", student._id))
          .filter((q) => 
            q.and(
              q.eq(q.field("type"), "praise"),
              q.eq(q.field("classId"), args.classId)
            )
          )
          .collect();

        // Count badges - filter by lessons in this class
        const allBadges = await ctx.db
          .query("badges")
          .withIndex("by_student", (q) => q.eq("studentId", student._id))
          .collect();

        // Only count badges that belong to lessons in this class
        const classBadges = allBadges.filter(b => 
          b.lessonId && classLessonIds.has(b.lessonId)
        );

        // Define praise badge types
        const praiseBadgeTypes = [
          "general_praise",
          "active_participation",
          "excellent_presentation",
          "completed_task",
          "curiosity",
          "diligence",
          "progress",
          "communication",
          "sharp_mind",
          "concentration",
          "creativity",
          "teamwork",
          "leadership",
          "patriotism",
          "tolerance",
          "emotional_intelligence",
          "presentation_skills",
          "digital_skills",
          "musical_culture",
          "physical_culture",
        ];

        // Count praises and remarks from badges separately
        const praiseBadges = classBadges.filter(b => praiseBadgeTypes.includes(b.type));
        const remarkBadges = classBadges.filter(b => !praiseBadgeTypes.includes(b.type));

        return {
          studentId: student._id,
          studentName: user
            ? [user.firstName, user.middleName, user.lastName]
                .filter(Boolean)
                .join(" ")
            : "Unknown",
          remarks: remarksData.length + remarkBadges.length,
          praises: praisesFromRemarks.length + praiseBadges.length,
        };
      })
    );

    // Sort results alphabetically by student name for consistent numbering
    return results.sort((a, b) => a.studentName.localeCompare(b.studentName, "bg"));
  },
});

// Get detailed reviews for a specific student
export const getStudentReviews = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args): Promise<{
    praises: Array<{
      _id: string;
      type: "praise";
      source: "remark" | "badge";
      content: string;
      date: number;
      teacherName: string;
      subjectName?: string | null;
      badgeType?: string;
      badgeLabel?: string;
      notes?: string | null;
    }>;
    warnings: Array<{
      _id: string;
      type: "warning";
      source: "remark" | "badge";
      content: string;
      date: number;
      teacherName: string;
      subjectName?: string | null;
      badgeType?: string;
      badgeLabel?: string;
      notes?: string | null;
    }>;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get remarks
    const remarks = await ctx.db
      .query("remarks")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    // Get badges
    const badges = await ctx.db
      .query("badges")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    // Process remarks
    const processedRemarks = await Promise.all(
      remarks.map(async (remark) => {
        const teacher = await ctx.db.get(remark.teacherId);
        const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;
        const subject = remark.subjectId
          ? await ctx.db.get(remark.subjectId)
          : null;

        return {
          _id: remark._id as string,
          type: remark.type,
          source: "remark" as const,
          content: remark.content,
          date: remark.date,
          teacherName: teacherUser
            ? [teacherUser.firstName, teacherUser.lastName]
                .filter(Boolean)
                .join(" ")
            : "Unknown",
          subjectName: subject?.name || null,
          badgeType: remark.badgeType || undefined,
          badgeLabel: remark.badgeType ? getBadgeLabel(remark.badgeType) : undefined,
          notes: remark.badgeType ? remark.content : null, // Ако има badgeType, content е коментарът
        };
      })
    );

    // Process badges
    const processedBadges = await Promise.all(
      badges.map(async (badge) => {
        const teacher = await ctx.db.get(badge.teacherId);
        const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;

        // Determine if it's a praise or warning
        const isPraise = [
          "general_praise",
          "active_participation",
          "excellent_presentation",
          "completed_task",
          "curiosity",
          "diligence",
          "progress",
          "communication",
          "sharp_mind",
          "concentration",
          "creativity",
          "teamwork",
          "leadership",
          "patriotism",
          "tolerance",
          "emotional_intelligence",
          "presentation_skills",
          "digital_skills",
          "musical_culture",
          "physical_culture",
        ].includes(badge.type);

        return {
          _id: badge._id as string,
          type: isPraise ? ("praise" as const) : ("warning" as const),
          source: "badge" as const,
          badgeType: badge.type,
          badgeLabel: getBadgeLabel(badge.type),
          notes: badge.notes || null,
          content: badge.notes || getBadgeLabel(badge.type),
          date: badge.date,
          teacherName: teacherUser
            ? [teacherUser.firstName, teacherUser.lastName]
                .filter(Boolean)
                .join(" ")
            : "Unknown",
          subjectName: null as string | null,
        };
      })
    );

    // Combine and sort by date
    const allReviews = [...processedRemarks, ...processedBadges].sort(
      (a, b) => b.date - a.date
    );

    const praises = allReviews.filter((r) => r.type === "praise") as Array<{
      _id: string;
      type: "praise";
      source: "remark" | "badge";
      content: string;
      date: number;
      teacherName: string;
      subjectName?: string | null;
      badgeType?: string;
      badgeLabel?: string;
      notes?: string | null;
    }>;
    const warnings = allReviews.filter((r) => r.type === "warning") as Array<{
      _id: string;
      type: "warning";
      source: "remark" | "badge";
      content: string;
      date: number;
      teacherName: string;
      subjectName?: string | null;
      badgeType?: string;
      badgeLabel?: string;
      notes?: string | null;
    }>;

    return { praises, warnings };
  },
});

// Helper function to get badge label
function getBadgeLabel(type: string): string {
  const labels: Record<string, string> = {
    // Похвали (Praises) - 20 типа
    general_praise: "Обща похвала",
    active_participation: "Активно участие",
    excellent_presentation: "Отлично представяне",
    completed_task: "Изпълнена задача",
    curiosity: "Любознателност",
    diligence: "Прилежност",
    progress: "Напредък",
    communication: "Добра комуникация",
    sharp_mind: "Остър ум",
    concentration: "Концентрация",
    creativity: "Креативност",
    teamwork: "Работа в екип",
    leadership: "Лидерство",
    patriotism: "Патриотизъм",
    tolerance: "Толерантност",
    emotional_intelligence: "Емоционална интелигентност",
    presentation_skills: "Умения за презентиране",
    digital_skills: "Дигитални умения",
    musical_culture: "Музикална култура",
    physical_culture: "Физическа култура",
    // Забележки (Remarks) - 20 типа
    general_remark: "Обща забележка",
    bad_discipline: "Лоша дисциплина",
    lack_of_attention: "Липса на внимание",
    official_remark: "Официална забележка",
    disrespect: "Неуважение",
    aggression: "Агресия",
    removed_from_class: "Отстранен от час",
    late: "Закъснение",
    absence: "Отсъствие",
    poor_performance: "Слабо представяне",
    unprepared: "Без подготовка",
    no_homework: "Без домашна работа",
    no_textbook: "Без учебно помагало",
    no_materials: "Без учебни пособия",
    no_equipment: "Без екип",
    no_uniform: "Без униформа",
    breakfast: "Закуска",
    lunch: "Обяд",
    afternoon_sleep: "Следобеден сън",
    afternoon_snack: "Следобедна закуска",
  };
  return labels[type] || type;
}

// Get reviews for a student by userId
export const getStudentReviewsByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<{
    praises: Array<{
      _id: string;
      type: "praise";
      content: string;
      date: number;
      teacherName: string;
      subjectName?: string | null;
      badgeType?: string;
    }>;
    warnings: Array<{
      _id: string;
      type: "warning";
      content: string;
      date: number;
      teacherName: string;
      subjectName?: string | null;
      badgeType?: string;
    }>;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Find student record
    const student = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!student) {
      return { praises: [], warnings: [] };
    }

    const result = await ctx.runQuery(api.reviews.getStudentReviews, {
      studentId: student._id,
    });
    
    return result;
  },
});

// Create a remark (praise or warning)
export const createRemark = mutation({
  args: {
    studentId: v.id("students"),
    classId: v.id("classes"),
    type: v.union(v.literal("praise"), v.literal("warning")),
    content: v.string(),
    subjectId: v.optional(v.id("subjects")),
    date: v.optional(v.number()),
    badgeType: v.optional(v.string()), // Тип на значката
  },
  handler: async (ctx, args): Promise<Id<"remarks">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get current user and their teacher record
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

    const teacher = await ctx.db
      .query("teachers")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .unique();

    if (!teacher) {
      throw new ConvexError({
        message: "Teacher record not found",
        code: "NOT_FOUND",
      });
    }

    // ✅ PLATFORM SETTINGS: Check if diary is locked for this date
    const student = await ctx.db.get(args.studentId);
    const remarkDate = args.date || Date.now();
    if (student?.schoolId) {
      const lockCheck = await ctx.runQuery(internal.platformSettings.checkDiaryLock, {
        schoolId: student.schoolId,
        userId: currentUser._id,
        targetDate: remarkDate,
      });
      if (lockCheck.isLocked) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: lockCheck.message || "Дневникът е заключен за тази дата",
        });
      }
    }

    const remarkId = await ctx.db.insert("remarks", {
      studentId: args.studentId,
      teacherId: teacher._id,
      classId: args.classId,
      type: args.type,
      content: args.content,
      date: remarkDate,
      subjectId: args.subjectId,
      badgeType: args.badgeType,
    });

    // Create notification for student
    {
      const studentForNotification = student ?? await ctx.db.get(args.studentId);
      if (studentForNotification) {
        const subject = args.subjectId ? await ctx.db.get(args.subjectId) : null;
        const teacherUser = await ctx.db.get(teacher.userId);
        
        const teacherName = teacherUser
          ? [teacherUser.firstName, teacherUser.lastName].filter(Boolean).join(" ")
          : "Учител";

        const notificationType = args.type === "praise" ? "new_praise" : "new_warning";
        const titleText = args.type === "praise" ? "Нова похвала" : "Нова забележка";

        const subjectText = subject ? ` по ${subject.name}` : "";

        await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
          userId: studentForNotification.userId,
          type: notificationType,
          title: titleText,
          message: `${teacherName}${subjectText}: ${args.content}`,
          relatedEntityType: "remark",
          relatedEntityId: remarkId,
          actionUrl: `/bg/diary/class/${args.classId}/reviews`,
        });
      }
    }

    return remarkId;
  },
});

// Update a remark
export const updateRemark = mutation({
  args: {
    remarkId: v.id("remarks"),
    type: v.optional(v.union(v.literal("praise"), v.literal("warning"))),
    content: v.optional(v.string()),
    subjectId: v.optional(v.union(v.id("subjects"), v.null())),
    date: v.optional(v.number()),
    badgeType: v.optional(v.union(v.string(), v.null())),
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

    // Check if user is admin, director, or vice_director
    const isAdmin = currentUser.roles?.includes("system_admin") ||
                    currentUser.roles?.includes("director") ||
                    currentUser.roles?.includes("vice_director");

    // Get the remark
    const remark = await ctx.db.get(args.remarkId);
    if (!remark) {
      throw new ConvexError({
        message: "Remark not found",
        code: "NOT_FOUND",
      });
    }

    // If not admin, check if user is the teacher who created the remark
    if (!isAdmin) {
      const teacher = await ctx.db
        .query("teachers")
        .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
        .unique();

      if (!teacher || teacher._id !== remark.teacherId) {
        throw new ConvexError({
          message: "Не сте оторизиран да редактирате този отзив",
          code: "FORBIDDEN",
        });
      }
    }

    // Build update object
    const updates: {
      type?: "praise" | "warning";
      content?: string;
      subjectId?: Id<"subjects"> | undefined;
      date?: number;
      badgeType?: string | undefined;
    } = {};
    
    if (args.type !== undefined) updates.type = args.type;
    if (args.content !== undefined) updates.content = args.content;
    if (args.subjectId !== undefined) updates.subjectId = args.subjectId === null ? undefined : args.subjectId;
    if (args.date !== undefined) updates.date = args.date;
    if (args.badgeType !== undefined) updates.badgeType = args.badgeType === null ? undefined : args.badgeType;

    await ctx.db.patch(args.remarkId, updates);
  },
});

// Delete a remark
export const deleteRemark = mutation({
  args: {
    remarkId: v.id("remarks"),
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

    // Check if user is admin, director, or vice_director
    const isAdmin = currentUser.roles?.includes("system_admin") ||
                    currentUser.roles?.includes("director") ||
                    currentUser.roles?.includes("vice_director");

    // Get the remark
    const remark = await ctx.db.get(args.remarkId);
    if (!remark) {
      throw new ConvexError({
        message: "Remark not found",
        code: "NOT_FOUND",
      });
    }

    // ✅ PLATFORM SETTINGS: Check strict mode for deletion
    const studentForStrictCheck = await ctx.db.get(remark.studentId);
    if (studentForStrictCheck?.schoolId) {
      const strictModeCheck = await ctx.runQuery(internal.platformSettings.checkStrictModeDelete, {
        schoolId: studentForStrictCheck.schoolId,
        userId: currentUser._id,
        entityType: "review",
      });
      if (strictModeCheck.isBlocked) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: strictModeCheck.message || "Стриктен режим: Само администратори могат да изтриват отзиви.",
        });
      }
    }

    // If not admin, check if user is the teacher who created the remark
    if (!isAdmin) {
      const teacher = await ctx.db
        .query("teachers")
        .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
        .unique();

      if (!teacher || teacher._id !== remark.teacherId) {
        throw new ConvexError({
          message: "Не сте оторизиран да изтриете този отзив",
          code: "FORBIDDEN",
        });
      }
    }

    // ✅ PLATFORM SETTINGS: Check if diary is locked for this date
    const student = await ctx.db.get(remark.studentId);
    if (student?.schoolId && !isAdmin) {
      const lockCheck = await ctx.runQuery(internal.platformSettings.checkDiaryLock, {
        schoolId: student.schoolId,
        userId: currentUser._id,
        targetDate: remark.date,
      });
      if (lockCheck.isLocked) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: lockCheck.message || "Дневникът е заключен за тази дата",
        });
      }
    }

    // Get student info for notification
    const studentUser = student ? await ctx.db.get(student.userId) : null;
    const studentName = studentUser 
      ? [studentUser.firstName, studentUser.lastName].filter(Boolean).join(" ")
      : "Ученик";

    // Delete the remark
    await ctx.db.delete(args.remarkId);

    // ✅ PLATFORM SETTINGS: Notify admins about deletion
    if (student?.schoolId) {
      const typeLabel = remark.type === "praise" ? "похвала" : "забележка";
      await ctx.scheduler.runAfter(0, internal.platformSettings.notifyAdminsOnDelete, {
        schoolId: student.schoolId,
        deletedByUserId: currentUser._id,
        entityType: "review",
        entityDetails: `${studentName} - ${typeLabel}: ${remark.content.substring(0, 50)}${remark.content.length > 50 ? "..." : ""}`,
        studentId: remark.studentId,
      });
    }
  },
});

// Bulk delete reviews (remarks and badges)
export const bulkDeleteReviews = mutation({
  args: {
    reviews: v.array(v.object({
      reviewId: v.string(),
      source: v.union(v.literal("remark"), v.literal("badge")),
    })),
  },
  handler: async (ctx, args): Promise<number> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

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

    // Check if user is admin, director, or vice_director
    const isAdmin = currentUser.roles?.includes("system_admin") ||
                    currentUser.roles?.includes("director") ||
                    currentUser.roles?.includes("vice_director");

    if (!isAdmin) {
      throw new ConvexError({
        message: "Само администратори могат да изтриват отзиви масово",
        code: "FORBIDDEN",
      });
    }

    let deletedCount = 0;

    for (const review of args.reviews) {
      if (review.source === "remark") {
        const remark = await ctx.db.get(review.reviewId as Id<"remarks">);
        if (remark) {
          await ctx.db.delete(review.reviewId as Id<"remarks">);
          deletedCount++;
        }
      } else {
        const badge = await ctx.db.get(review.reviewId as Id<"badges">);
        if (badge) {
          await ctx.db.delete(review.reviewId as Id<"badges">);
          deletedCount++;
        }
      }
    }

    return deletedCount;
  },
});

// Delete a review (remark or badge)
export const deleteReview = mutation({
  args: {
    reviewId: v.string(),
    source: v.union(v.literal("remark"), v.literal("badge")),
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

    // Check if user is admin, director, or vice_director
    const isAdmin = currentUser.roles?.includes("system_admin") ||
                    currentUser.roles?.includes("director") ||
                    currentUser.roles?.includes("vice_director");

    if (args.source === "remark") {
      // Handle remark deletion
      const remark = await ctx.db.get(args.reviewId as Id<"remarks">);
      if (!remark) {
        throw new ConvexError({
          message: "Отзивът не е намерен",
          code: "NOT_FOUND",
        });
      }

      // If not admin, check if user is the teacher who created the remark
      if (!isAdmin) {
        const teacher = await ctx.db
          .query("teachers")
          .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
          .unique();

        if (!teacher || teacher._id !== remark.teacherId) {
          throw new ConvexError({
            message: "Не сте оторизиран да изтриете този отзив",
            code: "FORBIDDEN",
          });
        }
      }

      await ctx.db.delete(args.reviewId as Id<"remarks">);
    } else {
      // Handle badge deletion
      const badge = await ctx.db.get(args.reviewId as Id<"badges">);
      if (!badge) {
        throw new ConvexError({
          message: "Отзивът не е намерен",
          code: "NOT_FOUND",
        });
      }

      // If not admin, check if user is the teacher who created the badge
      if (!isAdmin) {
        const teacher = await ctx.db
          .query("teachers")
          .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
          .unique();

        if (!teacher || teacher._id !== badge.teacherId) {
          throw new ConvexError({
            message: "Не сте оторизиран да изтриете този отзив",
            code: "FORBIDDEN",
          });
        }
      }

      await ctx.db.delete(args.reviewId as Id<"badges">);
    }
  },
});
