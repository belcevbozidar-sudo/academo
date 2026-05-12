import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";

// List all curriculum plans with filters
export const listCurriculumPlans = query({
  args: {
    onlyMine: v.optional(v.boolean()),
    onlyMySchool: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Array<{
    _id: string;
    title: string;
    grade: number;
    subjectName: string;
    publisher: string;
    topicsCount: number;
    addedByName: string;
    addedDate: number;
    isOwner: boolean;
  }>> => {
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

    let plans = await ctx.db
      .query("curriculumPlans")
      .order("desc")
      .collect();

    // Filter by owner
    if (args.onlyMine) {
      plans = plans.filter(p => p.addedBy === user._id);
    }

    // Filter by school
    if (args.onlyMySchool && user.schoolId) {
      plans = plans.filter(p => p.schoolId === user.schoolId);
    }

    // Filter by visibility
    plans = plans.filter(p => {
      // Always show own plans
      if (p.addedBy === user._id) return true;
      // Show public plans
      if (p.visibility === "public") return true;
      // Show school plans if same school
      if (p.visibility === "school" && p.schoolId === user.schoolId) return true;
      // Private plans only visible to owner
      return false;
    });

    return Promise.all(
      plans.map(async (plan) => {
        const addedByUser = await ctx.db.get(plan.addedBy);
        const subject = plan.subjectId ? await ctx.db.get(plan.subjectId) : null;
        
        // Format the name as "Име П. Фамилия"
        let addedByName = "—";
        if (addedByUser) {
          const firstName = addedByUser.firstName || "";
          const middleName = addedByUser.middleName || "";
          const lastName = addedByUser.lastName || "";
          
          if (firstName || lastName) {
            const middleInitial = middleName ? `${middleName.charAt(0)}.` : "";
            addedByName = `${firstName} ${middleInitial} ${lastName}`.replace(/\s+/g, " ").trim();
          } else {
            addedByName = addedByUser.name || "—";
          }
        }
        
        return {
          _id: plan._id,
          title: plan.title,
          grade: plan.grade,
          subjectName: subject?.name || "—",
          publisher: plan.publisher || "—",
          topicsCount: plan.topics?.length || 0,
          addedByName,
          addedDate: plan.addedDate,
          isOwner: plan.addedBy === user._id,
        };
      })
    );
  },
});

// Get a single curriculum plan
export const getCurriculumPlan = query({
  args: { id: v.id("curriculumPlans") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const plan = await ctx.db.get(args.id);
    if (!plan) {
      throw new ConvexError({
        message: "План не е намерен",
        code: "NOT_FOUND",
      });
    }

    return plan;
  },
});

// Create a curriculum plan
export const createCurriculumPlan = mutation({
  args: {
    title: v.string(),
    grade: v.number(),
    subjectId: v.optional(v.id("subjects")),
    publisher: v.optional(v.string()),
    visibility: v.optional(v.union(
      v.literal("public"),
      v.literal("school"),
      v.literal("private")
    )),
    topics: v.optional(v.array(v.object({
      number: v.number(),
      week: v.number(),
      title: v.string(),
      type: v.string(),
      notes: v.optional(v.string()),
    }))),
  },
  handler: async (ctx, args): Promise<Id<"curriculumPlans">> => {
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

    if (!user || !user.schoolId) {
      throw new ConvexError({
        message: "User not found or has no school",
        code: "NOT_FOUND",
      });
    }

    const planId = await ctx.db.insert("curriculumPlans", {
      title: args.title,
      grade: args.grade,
      schoolId: user.schoolId,
      addedBy: user._id,
      addedDate: Date.now(),
      subjectId: args.subjectId,
      publisher: args.publisher,
      visibility: args.visibility || "public",
      topics: args.topics,
    });

    return planId;
  },
});

// Update a curriculum plan
export const updateCurriculumPlan = mutation({
  args: {
    id: v.id("curriculumPlans"),
    title: v.optional(v.string()),
    grade: v.optional(v.number()),
    subjectId: v.optional(v.id("subjects")),
    publisher: v.optional(v.string()),
    visibility: v.optional(v.union(
      v.literal("public"),
      v.literal("school"),
      v.literal("private")
    )),
    topics: v.optional(v.array(v.object({
      number: v.number(),
      week: v.number(),
      title: v.string(),
      type: v.string(),
      notes: v.optional(v.string()),
    }))),
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

    const plan = await ctx.db.get(args.id);
    if (!plan) {
      throw new ConvexError({
        message: "План не е намерен",
        code: "NOT_FOUND",
      });
    }

    // Only owner can edit
    if (plan.addedBy !== user._id) {
      throw new ConvexError({
        message: "Нямате права да редактирате този план",
        code: "FORBIDDEN",
      });
    }

    const updates: Record<string, unknown> = {};
    if (args.title !== undefined) updates.title = args.title;
    if (args.grade !== undefined) updates.grade = args.grade;
    if (args.subjectId !== undefined) updates.subjectId = args.subjectId;
    if (args.publisher !== undefined) updates.publisher = args.publisher;
    if (args.visibility !== undefined) updates.visibility = args.visibility;
    if (args.topics !== undefined) updates.topics = args.topics;

    await ctx.db.patch(args.id, updates);
  },
});

// Delete a curriculum plan
export const deleteCurriculumPlan = mutation({
  args: { id: v.id("curriculumPlans") },
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

    const plan = await ctx.db.get(args.id);
    if (!plan) {
      throw new ConvexError({
        message: "План не е намерен",
        code: "NOT_FOUND",
      });
    }

    // Only owner can delete
    if (plan.addedBy !== user._id) {
      throw new ConvexError({
        message: "Нямате права да изтриете този план",
        code: "FORBIDDEN",
      });
    }

    await ctx.db.delete(args.id);
  },
});

// ============================================
// CURRICULUM TOPICS (Тематично разпределение)
// ============================================

// List curriculum topics for a class and subject
// When preparationType is provided, only return topics for that specific preparation type
// This ensures "Български ЗП" and "Български ИУЧ" have separate topic lists
export const listCurriculumTopics = query({
  args: {
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    preparationType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const topics = await ctx.db
      .query("curriculumTopics")
      .withIndex("by_class_and_subject", (q) => 
        q.eq("classId", args.classId).eq("subjectId", args.subjectId)
      )
      .collect();

    // Normalize preparation type for comparison
    // "ЗП", "ООП", undefined, null all map to "DEFAULT"
    const normalizePrep = (prep: string | undefined): string => {
      if (!prep || prep === "ЗП" || prep === "ООП") return "DEFAULT";
      return prep;
    };

    const requestedPrep = normalizePrep(args.preparationType);

    // Filter by preparation type to separate topics between variants (e.g. Български ЗП vs Български ИУЧ)
    const filtered = topics.filter(t => normalizePrep(t.preparationType) === requestedPrep);

    // Sort: covered topics first by coveredDate ascending (oldest date at top),
    // then uncovered topics by topicNumber ascending
    return filtered.sort((a, b) => {
      // Both covered - sort by coveredDate ascending (oldest first)
      if (a.isCovered && b.isCovered) {
        const dateA = a.coveredDate ? new Date(a.coveredDate).getTime() : 0;
        const dateB = b.coveredDate ? new Date(b.coveredDate).getTime() : 0;
        if (dateA !== dateB) return dateA - dateB;
        return a.topicNumber - b.topicNumber;
      }
      // Covered topics come before uncovered
      if (a.isCovered && !b.isCovered) return -1;
      if (!a.isCovered && b.isCovered) return 1;
      // Both uncovered - sort by topicNumber ascending
      return a.topicNumber - b.topicNumber;
    });
  },
});

// Create a curriculum topic
export const createCurriculumTopic = mutation({
  args: {
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    title: v.string(),
    topicNumber: v.number(),
    weekNumber: v.number(),
    topicType: v.string(),
    description: v.optional(v.string()),
    academicYear: v.string(),
    preparationType: v.optional(v.string()), // ЗП, ИУЧ, ФУЧ, etc.
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

    // Only teachers, admins, directors can create topics
    const allowedRoles = ["system_admin", "director", "vice_director", "teacher", "class_teacher"];
    const hasPermission = allowedRoles.includes(user.role) || 
      user.roles?.some((r) => allowedRoles.includes(r));

    if (!hasPermission) {
      throw new ConvexError({
        message: "Нямате права да добавяте теми",
        code: "FORBIDDEN",
      });
    }

    const topicId = await ctx.db.insert("curriculumTopics", {
      classId: args.classId,
      subjectId: args.subjectId,
      title: args.title,
      topicNumber: args.topicNumber,
      weekNumber: args.weekNumber,
      topicType: args.topicType,
      description: args.description,
      academicYear: args.academicYear,
      isCovered: false,
      preparationType: args.preparationType,
    });

    return topicId;
  },
});

// Update a curriculum topic
export const updateCurriculumTopic = mutation({
  args: {
    topicId: v.id("curriculumTopics"),
    title: v.optional(v.string()),
    topicNumber: v.optional(v.number()),
    weekNumber: v.optional(v.number()),
    topicType: v.optional(v.string()),
    description: v.optional(v.string()),
    isCovered: v.optional(v.boolean()),
    coveredDate: v.optional(v.number()),
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

    // Only teachers, admins, directors can update topics
    const allowedRoles = ["system_admin", "director", "vice_director", "teacher", "class_teacher"];
    const hasPermission = allowedRoles.includes(user.role) || 
      user.roles?.some((r) => allowedRoles.includes(r));

    if (!hasPermission) {
      throw new ConvexError({
        message: "Нямате права да редактирате теми",
        code: "FORBIDDEN",
      });
    }

    const topic = await ctx.db.get(args.topicId);
    if (!topic) {
      throw new ConvexError({
        message: "Темата не е намерена",
        code: "NOT_FOUND",
      });
    }

    const updates: Record<string, unknown> = {};
    if (args.title !== undefined) updates.title = args.title;
    if (args.topicNumber !== undefined) updates.topicNumber = args.topicNumber;
    if (args.weekNumber !== undefined) updates.weekNumber = args.weekNumber;
    if (args.topicType !== undefined) updates.topicType = args.topicType;
    if (args.description !== undefined) updates.description = args.description;
    if (args.isCovered !== undefined) updates.isCovered = args.isCovered;
    if (args.coveredDate !== undefined) updates.coveredDate = args.coveredDate;

    await ctx.db.patch(args.topicId, updates);
  },
});

// Delete a curriculum topic
export const deleteCurriculumTopic = mutation({
  args: {
    topicId: v.id("curriculumTopics"),
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

    // Only teachers, admins, directors can delete topics
    const allowedRoles = ["system_admin", "director", "vice_director", "teacher", "class_teacher"];
    const hasPermission = allowedRoles.includes(user.role) || 
      user.roles?.some((r) => allowedRoles.includes(r));

    if (!hasPermission) {
      throw new ConvexError({
        message: "Нямате права да изтривате теми",
        code: "FORBIDDEN",
      });
    }

    // Before deleting, clean up the linked lesson if this topic was covered
    const topic = await ctx.db.get(args.topicId);
    if (topic && topic.isCovered && topic.coveredByLessonId) {
      const lesson = await ctx.db.get(topic.coveredByLessonId);
      if (lesson) {
        // Always clear the lesson's topic text since the linked curriculum topic is being deleted
        await ctx.db.patch(lesson._id, { topic: undefined });
      }
    }

    await ctx.db.delete(args.topicId);
  },
});

// Get lessons for a class and subject (for topic assignment)
export const getLessonsForTopic = query({
  args: {
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get lessons for this class and subject
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Filter by subject and sort by date (most recent first)
    const filteredLessons = lessons
      .filter((l) => l.subjectId === args.subjectId && l.isTaken)
      .sort((a, b) => b.date - a.date);

    return filteredLessons.map((lesson) => ({
      _id: lesson._id,
      date: lesson.date,
      periodIndex: lesson.periodIndex,
      topic: lesson.topic,
    }));
  },
});

// Mark topic as covered with lesson link
export const markTopicAsCovered = mutation({
  args: {
    topicId: v.id("curriculumTopics"),
    lessonId: v.id("lessons"),
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

    const topic = await ctx.db.get(args.topicId);
    if (!topic) {
      throw new ConvexError({
        message: "Темата не е намерена",
        code: "NOT_FOUND",
      });
    }

    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
      throw new ConvexError({
        message: "Часът не е намерен",
        code: "NOT_FOUND",
      });
    }

    // Update topic with lesson link
    await ctx.db.patch(args.topicId, {
      isCovered: true,
      coveredDate: lesson.date,
      coveredByLessonId: args.lessonId,
    });

    // Also update the lesson's topic if not already set
    if (!lesson.topic) {
      await ctx.db.patch(args.lessonId, {
        topic: topic.title,
      });
    }
  },
});

// Unmark topic as covered
export const unmarkTopicAsCovered = mutation({
  args: {
    topicId: v.id("curriculumTopics"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const topic = await ctx.db.get(args.topicId);
    if (!topic) {
      throw new ConvexError({
        message: "Темата не е намерена",
        code: "NOT_FOUND",
      });
    }

    await ctx.db.patch(args.topicId, {
      isCovered: false,
      coveredDate: undefined,
      coveredByLessonId: undefined,
    });
  },
});
