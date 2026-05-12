import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

// Result types
export const RESULT_TYPES = {
  completes: "Завършва",
  stays: "Остава",
  takes_exam: "Полага изпит",
} as const;

export const RESULT_AFTER_EXAM_TYPES = {
  completes: "Завършва",
  stays: "Остава",
} as const;

// Get all annual results for a class
export const getAnnualResultsByClass = query({
  args: { 
    classId: v.id("classes"),
    academicYear: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get all students in this class
    const students = await ctx.db
      .query("students")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Get the class to determine academic year
    const classData = await ctx.db.get(args.classId);
    const academicYear = args.academicYear || classData?.academicYear || "2024/2025";

    // Get annual results for this class
    const annualResults = await ctx.db
      .query("annualResults")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Filter by academic year
    const filteredResults = annualResults.filter(
      (r) => r.academicYear === academicYear
    );

    // Create a map for quick lookup
    const resultsMap = new Map(
      filteredResults.map((r) => [r.studentId, r])
    );

    // Enrich students with their results
    const enrichedStudents = await Promise.all(
      students.map(async (student) => {
        const studentUser = await ctx.db.get(student.userId);
        const result = resultsMap.get(student._id);
        
        let updatedByName = null;
        if (result?.updatedBy) {
          const updatedByUser = await ctx.db.get(result.updatedBy);
          if (updatedByUser) {
            updatedByName = [updatedByUser.firstName, updatedByUser.lastName]
              .filter(Boolean)
              .join(" ");
          }
        }

        return {
          _id: student._id,
          userId: student.userId,
          studentNumber: student.studentNumber || 0,
          studentName: studentUser
            ? [studentUser.firstName, studentUser.middleName, studentUser.lastName]
                .filter(Boolean)
                .join(" ")
            : "Неизвестен",
          result: result?.result || null,
          resultAfterExam: result?.resultAfterExam || null,
          resultId: result?._id || null,
          updatedAt: result?.updatedAt || null,
          updatedByName,
        };
      })
    );

    // Sort by student number
    return enrichedStudents
      .filter((s) => s.studentName !== "Неизвестен")
      .sort((a, b) => a.studentNumber - b.studentNumber);
  },
});

// Get a single annual result by student ID
export const getAnnualResultByStudent = query({
  args: { 
    studentId: v.id("students"),
    academicYear: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const student = await ctx.db.get(args.studentId);
    if (!student) {
      return null;
    }

    const classData = await ctx.db.get(student.classId);
    const academicYear = args.academicYear || classData?.academicYear || "2024/2025";

    const annualResults = await ctx.db
      .query("annualResults")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    const result = annualResults.find((r) => r.academicYear === academicYear);
    
    if (!result) {
      return null;
    }

    let updatedByName = null;
    if (result.updatedBy) {
      const updatedByUser = await ctx.db.get(result.updatedBy);
      if (updatedByUser) {
        updatedByName = [updatedByUser.firstName, updatedByUser.lastName]
          .filter(Boolean)
          .join(" ");
      }
    }

    return {
      ...result,
      updatedByName,
    };
  },
});

// Update or create an annual result
export const upsertAnnualResult = mutation({
  args: {
    studentId: v.id("students"),
    classId: v.id("classes"),
    academicYear: v.optional(v.string()),
    result: v.optional(v.union(
      v.literal("completes"),
      v.literal("stays"),
      v.literal("takes_exam")
    )),
    resultAfterExam: v.optional(v.union(
      v.literal("completes"),
      v.literal("stays")
    )),
  },
  handler: async (ctx, args): Promise<Id<"annualResults">> => {
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

    // Get the class to get schoolId and academicYear
    const classData = await ctx.db.get(args.classId);
    if (!classData) {
      throw new ConvexError({
        message: "Class not found",
        code: "NOT_FOUND",
      });
    }

    const academicYear = args.academicYear || classData.academicYear;

    // Check if there's an existing result
    const existingResults = await ctx.db
      .query("annualResults")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    const existingResult = existingResults.find(
      (r) => r.academicYear === academicYear
    );

    if (existingResult) {
      // Update existing result
      await ctx.db.patch(existingResult._id, {
        result: args.result,
        resultAfterExam: args.resultAfterExam,
        updatedBy: currentUser._id,
        updatedAt: Date.now(),
      });
      return existingResult._id;
    } else {
      // Create new result
      const resultId = await ctx.db.insert("annualResults", {
        studentId: args.studentId,
        classId: args.classId,
        schoolId: classData.schoolId,
        academicYear,
        result: args.result,
        resultAfterExam: args.resultAfterExam,
        updatedBy: currentUser._id,
        updatedAt: Date.now(),
      });
      return resultId;
    }
  },
});

// Delete an annual result
export const deleteAnnualResult = mutation({
  args: {
    id: v.id("annualResults"),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const result = await ctx.db.get(args.id);
    if (!result) {
      throw new ConvexError({
        message: "Result not found",
        code: "NOT_FOUND",
      });
    }

    await ctx.db.delete(args.id);
  },
});
