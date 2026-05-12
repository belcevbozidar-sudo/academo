import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

// Get remedial exams for a class
export const getRemedialExamsByClass = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const remedialExams = await ctx.db
      .query("remedialExams")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Enrich with student and subject names
    const enrichedExams = await Promise.all(
      remedialExams.map(async (exam) => {
        const student = await ctx.db.get(exam.studentId);
        const studentUser = student ? await ctx.db.get(student.userId) : null;
        const subject = await ctx.db.get(exam.subjectId);

        return {
          ...exam,
          studentName: studentUser
            ? `${studentUser.firstName || ""} ${studentUser.middleName ? studentUser.middleName.charAt(0) + "." : ""} ${studentUser.lastName || ""}`.trim()
            : "Неизвестен ученик",
          studentNumber: student?.studentNumber,
          subjectName: subject?.name || "Неизвестен предмет",
          subjectShortName: subject?.shortName || "—",
        };
      })
    );

    return enrichedExams;
  },
});

// Get students with "takes_exam" annual result for a class
export const getStudentsForRemedialExams = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Get all students in the class
    const students = await ctx.db
      .query("students")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Get annual results with "takes_exam" status for these students
    const currentYear = new Date().getFullYear();
    const academicYear = new Date().getMonth() < 8
      ? `${currentYear - 1}/${currentYear}`
      : `${currentYear}/${currentYear + 1}`;

    const studentsWithExams = await Promise.all(
      students.map(async (student) => {
        const annualResult = await ctx.db
          .query("annualResults")
          .withIndex("by_student", (q) => q.eq("studentId", student._id))
          .filter((q) => q.eq(q.field("result"), "takes_exam"))
          .first();

        if (!annualResult) {
          return null;
        }

        const user = await ctx.db.get(student.userId);
        return {
          _id: student._id,
          userId: student.userId,
          studentNumber: student.studentNumber,
          name: user
            ? `${user.firstName || ""} ${user.middleName ? user.middleName.charAt(0) + "." : ""} ${user.lastName || ""}`.trim()
            : "Неизвестен ученик",
        };
      })
    );

    return studentsWithExams.filter((s) => s !== null);
  },
});

// Create or update remedial exam
export const upsertRemedialExam = mutation({
  args: {
    studentId: v.id("students"),
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    session1Required: v.optional(v.boolean()),
    session2Required: v.optional(v.boolean()),
    additionalRequired: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Id<"remedialExams">> => {
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
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Check if admin or teacher
    const isAdmin =
      currentUser.roles?.includes("director") ||
      currentUser.roles?.includes("vice_director") ||
      currentUser.roles?.includes("system_admin");

    const isTeacher = currentUser.roles?.includes("teacher");

    if (!isAdmin && !isTeacher) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Само администратори и учители могат да управляват поправителни изпити",
      });
    }

    // Get school ID from class
    const classData = await ctx.db.get(args.classId);
    if (!classData) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Class not found",
      });
    }

    // Calculate academic year
    const currentYear = new Date().getFullYear();
    const academicYear =
      new Date().getMonth() < 8
        ? `${currentYear - 1}/${currentYear}`
        : `${currentYear}/${currentYear + 1}`;

    // Check if exam already exists
    const existingExam = await ctx.db
      .query("remedialExams")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .filter((q) =>
        q.and(
          q.eq(q.field("classId"), args.classId),
          q.eq(q.field("subjectId"), args.subjectId)
        )
      )
      .first();

    if (existingExam) {
      // Update existing exam
      await ctx.db.patch(existingExam._id, {
        session1Required: args.session1Required,
        session2Required: args.session2Required,
        additionalRequired: args.additionalRequired,
        updatedBy: currentUser._id,
        updatedAt: Date.now(),
      });
      return existingExam._id;
    } else {
      // Create new exam
      const examId = await ctx.db.insert("remedialExams", {
        studentId: args.studentId,
        classId: args.classId,
        schoolId: classData.schoolId,
        subjectId: args.subjectId,
        academicYear,
        session1Required: args.session1Required,
        session2Required: args.session2Required,
        additionalRequired: args.additionalRequired,
        createdBy: currentUser._id,
        createdAt: Date.now(),
      });
      return examId;
    }
  },
});

// Update remedial exam grade
export const updateRemedialExamGrade = mutation({
  args: {
    examId: v.id("remedialExams"),
    session: v.union(v.literal("session1"), v.literal("session2"), v.literal("additional")),
    grade: v.optional(v.union(v.number(), v.literal("absent"))),
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
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Check if admin or teacher
    const isAdmin =
      currentUser.roles?.includes("director") ||
      currentUser.roles?.includes("vice_director") ||
      currentUser.roles?.includes("system_admin");

    const isTeacher = currentUser.roles?.includes("teacher");

    if (!isAdmin && !isTeacher) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Само администратори и учители могат да въвеждат оценки",
      });
    }

    const exam = await ctx.db.get(args.examId);
    if (!exam) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Remedial exam not found",
      });
    }

    // Update the appropriate grade field
    const updateData: Record<string, unknown> = {
      updatedBy: currentUser._id,
      updatedAt: Date.now(),
    };

    if (args.session === "session1") {
      updateData.session1Grade = args.grade;
    } else if (args.session === "session2") {
      updateData.session2Grade = args.grade;
    } else if (args.session === "additional") {
      updateData.additionalGrade = args.grade;
    }

    await ctx.db.patch(args.examId, updateData);
  },
});

// Delete remedial exam
export const deleteRemedialExam = mutation({
  args: { examId: v.id("remedialExams") },
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
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Check if admin
    const isAdmin =
      currentUser.roles?.includes("director") ||
      currentUser.roles?.includes("vice_director") ||
      currentUser.roles?.includes("system_admin");

    if (!isAdmin) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Само администратори могат да изтриват поправителни изпити",
      });
    }

    await ctx.db.delete(args.examId);
  },
});

// Bulk update session requirements for a subject
export const bulkUpdateSessionRequirements = mutation({
  args: {
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    updates: v.array(
      v.object({
        studentId: v.id("students"),
        session1Required: v.optional(v.boolean()),
        session2Required: v.optional(v.boolean()),
        additionalRequired: v.optional(v.boolean()),
      })
    ),
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
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Check if admin or teacher
    const isAdmin =
      currentUser.roles?.includes("director") ||
      currentUser.roles?.includes("vice_director") ||
      currentUser.roles?.includes("system_admin");

    const isTeacher = currentUser.roles?.includes("teacher");

    if (!isAdmin && !isTeacher) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Само администратори и учители могат да управляват поправителни изпити",
      });
    }

    // Get school ID from class
    const classData = await ctx.db.get(args.classId);
    if (!classData) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Class not found",
      });
    }

    // Calculate academic year
    const currentYear = new Date().getFullYear();
    const academicYear =
      new Date().getMonth() < 8
        ? `${currentYear - 1}/${currentYear}`
        : `${currentYear}/${currentYear + 1}`;

    for (const update of args.updates) {
      // Check if exam already exists
      const existingExam = await ctx.db
        .query("remedialExams")
        .withIndex("by_student", (q) => q.eq("studentId", update.studentId))
        .filter((q) =>
          q.and(
            q.eq(q.field("classId"), args.classId),
            q.eq(q.field("subjectId"), args.subjectId)
          )
        )
        .first();

      // Check if all sessions are false - if so, delete the exam
      const allFalse =
        !update.session1Required &&
        !update.session2Required &&
        !update.additionalRequired;

      if (existingExam) {
        if (allFalse) {
          // Delete the exam if no sessions are required
          await ctx.db.delete(existingExam._id);
        } else {
          // Update existing exam
          await ctx.db.patch(existingExam._id, {
            session1Required: update.session1Required,
            session2Required: update.session2Required,
            additionalRequired: update.additionalRequired,
            // Clear grades if session is being removed
            session1Grade: update.session1Required ? existingExam.session1Grade : undefined,
            session2Grade: update.session2Required ? existingExam.session2Grade : undefined,
            additionalGrade: update.additionalRequired ? existingExam.additionalGrade : undefined,
            updatedBy: currentUser._id,
            updatedAt: Date.now(),
          });
        }
      } else if (!allFalse) {
        // Create new exam only if at least one session is required
        await ctx.db.insert("remedialExams", {
          studentId: update.studentId,
          classId: args.classId,
          schoolId: classData.schoolId,
          subjectId: args.subjectId,
          academicYear,
          session1Required: update.session1Required,
          session2Required: update.session2Required,
          additionalRequired: update.additionalRequired,
          createdBy: currentUser._id,
          createdAt: Date.now(),
        });
      }
    }
  },
});
