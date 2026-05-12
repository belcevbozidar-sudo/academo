import { ConvexError } from "convex/values";
import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";
import { buildUserName, hasProperName } from "./users.js";

// Helper: calculate period start timestamp
function getPeriodStart(period: "1m" | "3m" | "6m" | "1y"): number {
  const periodMap = {
    "1m": 30 * 24 * 60 * 60 * 1000,
    "3m": 90 * 24 * 60 * 60 * 1000,
    "6m": 180 * 24 * 60 * 60 * 1000,
    "1y": 365 * 24 * 60 * 60 * 1000,
  };
  return Date.now() - periodMap[period];
}

// Get dashboard statistics for the home page
// OPTIMIZED: Uses by_date index for admin path instead of full table scans
export const getDashboardStats = query({
  args: {
    schoolId: v.optional(v.id("schools")),
    classId: v.optional(v.id("classes")),
    period: v.optional(v.union(
      v.literal("1m"),
      v.literal("3m"),
      v.literal("6m"),
      v.literal("1y")
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

    // If user is a student, filter data for that student only
    let studentId: Id<"students"> | undefined = undefined;
    if (currentUser.role === "student") {
      const student = await ctx.db
        .query("students")
        .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
        .first();
      if (student) {
        studentId = student._id;
      }
    }

    const startDate = getPeriodStart(args.period || "1m");

    // OPTIMIZED: Get grades using indexed queries
    let grades;
    if (studentId) {
      grades = await ctx.db
        .query("grades")
        .withIndex("by_student", (q) => q.eq("studentId", studentId!))
        .collect();
    } else if (args.classId) {
      grades = await ctx.db
        .query("grades")
        .withIndex("by_class", (q) => q.eq("classId", args.classId!))
        .collect();
    } else {
      // OPTIMIZED: Use by_date index to only read grades in the period
      grades = await ctx.db
        .query("grades")
        .withIndex("by_date", (q) => q.gte("date", startDate))
        .collect();
    }

    // For students, calculate average from all grades (including term grades)
    // For admins/teachers, filter by period
    const gradesToAverage = studentId ? grades : grades.filter((g) => g.date >= startDate);
    const numericGrades = gradesToAverage
      .filter((g) => typeof g.value === "number")
      .map((g) => g.value as number);

    const averageGrade = numericGrades.length > 0
      ? numericGrades.reduce((sum, g) => sum + g, 0) / numericGrades.length
      : 0;

    // OPTIMIZED: Get attendance using indexed queries
    let attendance;
    if (studentId) {
      attendance = await ctx.db
        .query("attendance")
        .withIndex("by_student", (q) => q.eq("studentId", studentId!))
        .collect();
    } else if (args.classId) {
      attendance = await ctx.db
        .query("attendance")
        .withIndex("by_class", (q) => q.eq("classId", args.classId!))
        .collect();
    } else {
      // OPTIMIZED: Use by_date index to only read attendance in the period
      attendance = await ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.gte("date", startDate))
        .collect();
    }
    const periodAttendance = attendance.filter((a) => a.date >= startDate);
    const totalAttendance = periodAttendance.length;
    const absentCount = periodAttendance.filter((a) => a.status === "absent").length;
    const attendanceRate = totalAttendance > 0
      ? ((totalAttendance - absentCount) / totalAttendance) * 100
      : 100;

    // Get events count
    const events = args.schoolId
      ? await ctx.db
          .query("events")
          .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
          .collect()
      : await ctx.db.query("events").collect();
    const upcomingEvents = events.filter((e) => e.startDate > Date.now()).length;

    // OPTIMIZED: Get remarks using indexed queries
    let remarks;
    if (studentId) {
      remarks = await ctx.db
        .query("remarks")
        .withIndex("by_student", (q) => q.eq("studentId", studentId!))
        .collect();
    } else {
      // OPTIMIZED: Use by_date index to only read remarks in the period
      remarks = await ctx.db
        .query("remarks")
        .withIndex("by_date", (q) => q.gte("date", startDate))
        .collect();
    }
    const periodRemarks = remarks.filter((r) => r.date >= startDate);
    const praiseCount = periodRemarks.filter((r) => r.type === "praise").length;
    const warningCount = periodRemarks.filter((r) => r.type === "warning").length;

    return {
      averageGrade: Number(averageGrade.toFixed(2)),
      totalGrades: numericGrades.length,
      attendanceRate: Number(attendanceRate.toFixed(2)),
      totalAbsences: absentCount,
      upcomingEvents,
      praiseCount,
      warningCount,
      totalRemarks: periodRemarks.length,
    };
  },
});

// Get grades by week for charts
// OPTIMIZED: Uses by_date index for admin path
export const getGradesByWeek = query({
  args: {
    schoolId: v.optional(v.id("schools")),
    classId: v.optional(v.id("classes")),
    weeks: v.number(),
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

    // If user is a student, filter data for that student only
    let studentId: Id<"students"> | undefined = undefined;
    if (currentUser.role === "student") {
      const student = await ctx.db
        .query("students")
        .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
        .first();
      if (student) {
        studentId = student._id;
      }
    }

    const startDate = Date.now() - args.weeks * 7 * 24 * 60 * 60 * 1000;

    // OPTIMIZED: Get grades using indexed queries
    let grades;
    if (studentId) {
      grades = await ctx.db
        .query("grades")
        .withIndex("by_student", (q) => q.eq("studentId", studentId!))
        .collect();
    } else if (args.classId) {
      grades = await ctx.db
        .query("grades")
        .withIndex("by_class", (q) => q.eq("classId", args.classId!))
        .collect();
    } else {
      // OPTIMIZED: Use by_date index instead of full table scan
      grades = await ctx.db
        .query("grades")
        .withIndex("by_date", (q) => q.gte("date", startDate))
        .collect();
    }
    const periodGrades = grades.filter((g) => g.date >= startDate);

    // Group by week
    const weeklyData: Record<string, { count: number; sum: number }> = {};

    periodGrades.forEach((grade) => {
      if (typeof grade.value !== "number") return;

      const weekStart = new Date(grade.date);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
      const weekKey = weekStart.toISOString().split("T")[0];

      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { count: 0, sum: 0 };
      }
      weeklyData[weekKey].count++;
      weeklyData[weekKey].sum += grade.value;
    });

    // Convert to array and calculate averages
    const chartData = Object.entries(weeklyData)
      .map(([week, data]) => ({
        week,
        count: data.count,
        average: Number((data.sum / data.count).toFixed(2)),
      }))
      .sort((a, b) => a.week.localeCompare(b.week));

    return chartData;
  },
});

// Get average grades by subject
// OPTIMIZED: Uses by_date index + batch subject lookups (instead of N lookups per grade)
export const getAverageGradesBySubject = query({
  args: {
    classId: v.optional(v.id("classes")),
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

    let grades;
    if (args.classId) {
      grades = await ctx.db
        .query("grades")
        .withIndex("by_class", (q) => q.eq("classId", args.classId!))
        .collect();
    } else {
      // OPTIMIZED: Read recent grades instead of full scan (last 6 months)
      const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
      grades = await ctx.db
        .query("grades")
        .withIndex("by_date", (q) => q.gte("date", sixMonthsAgo))
        .collect();
    }

    // OPTIMIZED: Aggregate by subjectId first, then batch lookup subject names
    const subjectStats = new Map<string, { count: number; sum: number }>();

    for (const grade of grades) {
      if (typeof grade.value !== "number") continue;
      const subId = grade.subjectId as string;
      const stats = subjectStats.get(subId) || { count: 0, sum: 0 };
      stats.count++;
      stats.sum += grade.value;
      subjectStats.set(subId, stats);
    }

    // Batch lookup: only ~29 subjects instead of thousands of per-grade lookups
    const chartData = await Promise.all(
      Array.from(subjectStats.entries()).map(async ([subjectId, data]) => {
        const subject = await ctx.db.get(subjectId as Id<"subjects">);
        return {
          subject: subject?.name || "Unknown",
          count: data.count,
          average: Number((data.sum / data.count).toFixed(2)),
        };
      })
    );

    return chartData.sort((a, b) => b.average - a.average);
  },
});

// Get top performing classes
// OPTIMIZED: Bulk read recent grades, aggregate by class in memory
export const getTopClasses = query({
  args: {
    schoolId: v.optional(v.id("schools")),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // OPTIMIZED: One bulk read instead of 23 per-class queries
    const threeMonthsAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const allGrades = await ctx.db
      .query("grades")
      .withIndex("by_date", (q) => q.gte("date", threeMonthsAgo))
      .collect();

    // Aggregate by classId in memory
    const classStats = new Map<string, { sum: number; count: number }>();
    for (const grade of allGrades) {
      if (typeof grade.value !== "number") continue;
      const cid = grade.classId as string;
      const stats = classStats.get(cid) || { sum: 0, count: 0 };
      stats.sum += grade.value;
      stats.count++;
      classStats.set(cid, stats);
    }

    // Sort and take top candidates
    const sorted = Array.from(classStats.entries())
      .map(([classId, stats]) => ({
        classId: classId as Id<"classes">,
        average: stats.sum / stats.count,
        gradeCount: stats.count,
      }))
      .filter((c) => c.average >= 5.5)
      .sort((a, b) => b.average - a.average)
      .slice(0, args.limit);

    // Lookup class names only for top results
    const results = await Promise.all(
      sorted.map(async (item) => {
        const cls = await ctx.db.get(item.classId);
        return {
          className: cls?.name || "Unknown",
          average: Number(item.average.toFixed(2)),
          gradeCount: item.gradeCount,
        };
      })
    );

    return results;
  },
});

// Get top performing students
// OPTIMIZED: Read grades in bulk, aggregate by student, lookup names only for top N
export const getTopStudents = query({
  args: {
    schoolId: v.optional(v.id("schools")),
    classId: v.optional(v.id("classes")),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // OPTIMIZED: Read grades in bulk instead of per-student
    let allGrades;
    if (args.classId) {
      allGrades = await ctx.db
        .query("grades")
        .withIndex("by_class", (q) => q.eq("classId", args.classId!))
        .collect();
    } else {
      // Read recent grades using date index
      const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
      allGrades = await ctx.db
        .query("grades")
        .withIndex("by_date", (q) => q.gte("date", sixMonthsAgo))
        .collect();
    }

    // Aggregate by studentId in memory
    const studentStats = new Map<string, { sum: number; count: number }>();
    for (const grade of allGrades) {
      if (typeof grade.value !== "number") continue;
      const sid = grade.studentId as string;
      const stats = studentStats.get(sid) || { sum: 0, count: 0 };
      stats.sum += grade.value;
      stats.count++;
      studentStats.set(sid, stats);
    }

    // Sort by average and take top N + buffer for filtering invalid names
    const sorted = Array.from(studentStats.entries())
      .map(([studentId, stats]) => ({
        studentId: studentId as Id<"students">,
        average: stats.sum / stats.count,
        gradeCount: stats.count,
      }))
      .sort((a, b) => b.average - a.average)
      .slice(0, args.limit * 2); // Take extra in case some are filtered out

    // OPTIMIZED: Only lookup names for top candidates (not all 669 students)
    const results = [];
    for (const item of sorted) {
      if (results.length >= args.limit) break;
      const student = await ctx.db.get(item.studentId);
      if (!student) continue;
      const user = await ctx.db.get(student.userId);
      if (!hasProperName(user)) continue;
      const classData = await ctx.db.get(student.classId);
      results.push({
        studentName: buildUserName(user),
        className: classData?.name || "-",
        average: Number(item.average.toFixed(2)),
        gradeCount: item.gradeCount,
      });
    }

    return results;
  },
});

// Get absences by week for chart
// OPTIMIZED: Uses by_date index for admin path
export const getAbsencesByWeek = query({
  args: {
    weeks: v.number(),
  },
  handler: async (ctx, args): Promise<Array<{ week: string; count: number }>> => {
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

    // If user is a student, filter data for that student only
    let studentId: Id<"students"> | undefined = undefined;
    if (currentUser.role === "student") {
      const student = await ctx.db
        .query("students")
        .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
        .first();
      if (student) {
        studentId = student._id;
      }
    }

    const startDate = Date.now() - args.weeks * 7 * 24 * 60 * 60 * 1000;

    let attendance;
    if (studentId) {
      attendance = await ctx.db
        .query("attendance")
        .withIndex("by_student", (q) => q.eq("studentId", studentId!))
        .collect();
    } else {
      // OPTIMIZED: Use by_date index instead of full table scan
      attendance = await ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.gte("date", startDate))
        .collect();
    }

    const periodAttendance = attendance.filter((a) => a.date >= startDate);

    // Group by week
    const weeklyData: Record<string, number> = {};
    periodAttendance.forEach((record) => {
      const weekStart = new Date(record.date);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
      const weekKey = weekStart.toISOString().split("T")[0];

      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = 0;
      }
      weeklyData[weekKey]++;
    });

    return Object.entries(weeklyData)
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => a.week.localeCompare(b.week));
  },
});

// Get top and bottom classes by average grade
// OPTIMIZED: Only read recent grades (3 months) instead of all-time
export const getClassesByAverage = query({
  args: {},
  handler: async (ctx): Promise<{ top: Array<{ classId: Id<"classes">; className: string; average: number }>; bottom: Array<{ classId: Id<"classes">; className: string; average: number }> }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // OPTIMIZED: Read all recent grades in one bulk query, then aggregate by class in memory
    // Before: 23 separate queries (one per class), each reading all grades for that class
    // After: 1 query with date filter
    const threeMonthsAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const recentGrades = await ctx.db
      .query("grades")
      .withIndex("by_date", (q) => q.gte("date", threeMonthsAgo))
      .collect();

    // Aggregate by classId in memory
    const classStats = new Map<string, { sum: number; count: number }>();
    for (const grade of recentGrades) {
      if (typeof grade.value !== "number") continue;
      const cid = grade.classId as string;
      const stats = classStats.get(cid) || { sum: 0, count: 0 };
      stats.sum += grade.value;
      stats.count++;
      classStats.set(cid, stats);
    }

    // Lookup class names only for classes that have grades
    const classAverages = await Promise.all(
      Array.from(classStats.entries()).map(async ([classId, stats]) => {
        const cls = await ctx.db.get(classId as Id<"classes">);
        return {
          classId: classId as Id<"classes">,
          className: cls?.name || "Unknown",
          average: Number((stats.sum / stats.count).toFixed(2)),
        };
      })
    );

    const sorted = classAverages.filter((c) => c.average > 0).sort((a, b) => b.average - a.average);
    return {
      top: sorted.slice(0, 3),
      bottom: sorted.slice(-3).reverse(),
    };
  },
});

// Get top and bottom classes by absences
// OPTIMIZED: Bulk read recent attendance, aggregate in memory
export const getClassesByAbsences = query({
  args: {},
  handler: async (ctx): Promise<{ top: Array<{ classId: Id<"classes">; className: string; absences: number }>; bottom: Array<{ classId: Id<"classes">; className: string; absences: number }> }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // OPTIMIZED: Read recent attendance in one bulk query instead of 23 per-class queries
    const threeMonthsAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const recentAttendance = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => q.gte("date", threeMonthsAgo))
      .collect();

    // Aggregate by classId in memory
    const classAbsenceMap = new Map<string, number>();
    for (const record of recentAttendance) {
      const cid = record.classId as string;
      classAbsenceMap.set(cid, (classAbsenceMap.get(cid) || 0) + 1);
    }

    // Lookup class names only for classes that have attendance
    const classAbsences = await Promise.all(
      Array.from(classAbsenceMap.entries()).map(async ([classId, absences]) => {
        const cls = await ctx.db.get(classId as Id<"classes">);
        return {
          classId: classId as Id<"classes">,
          className: cls?.name || "Unknown",
          absences,
        };
      })
    );

    const sorted = classAbsences.filter((c) => c.absences > 0).sort((a, b) => a.absences - b.absences);
    return {
      top: sorted.slice(0, 3),
      bottom: sorted.slice(-3).reverse(),
    };
  },
});

// Get top and bottom students by average grade
// OPTIMIZED: Read grades in bulk, aggregate, lookup names only for top/bottom results
export const getStudentsByAverage = query({
  args: {},
  handler: async (ctx): Promise<{ top: Array<{ studentId: Id<"students">; studentName: string; className: string; average: number }>; bottom: Array<{ studentId: Id<"students">; studentName: string; className: string; average: number }> }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // OPTIMIZED: Read grades in bulk, aggregate by student
    const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
    const allGrades = await ctx.db
      .query("grades")
      .withIndex("by_date", (q) => q.gte("date", sixMonthsAgo))
      .collect();

    // Aggregate by studentId
    const studentStats = new Map<string, { sum: number; count: number }>();
    for (const grade of allGrades) {
      if (typeof grade.value !== "number") continue;
      const sid = grade.studentId as string;
      const stats = studentStats.get(sid) || { sum: 0, count: 0 };
      stats.sum += grade.value;
      stats.count++;
      studentStats.set(sid, stats);
    }

    // Sort by average
    const sorted = Array.from(studentStats.entries())
      .map(([studentId, stats]) => ({
        studentId: studentId as Id<"students">,
        average: stats.sum / stats.count,
      }))
      .filter((s) => s.average > 0)
      .sort((a, b) => b.average - a.average);

    // Take top 6 and bottom 6 candidates (extra buffer for invalid names)
    const topCandidates = sorted.slice(0, 6);
    const bottomCandidates = sorted.slice(-6).reverse();
    const candidates = [...topCandidates, ...bottomCandidates];

    // OPTIMIZED: Lookup names only for candidates (not all 669 students)
    const enrichedMap = new Map<string, { studentId: Id<"students">; studentName: string; className: string; average: number }>();
    for (const item of candidates) {
      if (enrichedMap.has(item.studentId)) continue;
      const student = await ctx.db.get(item.studentId);
      if (!student) continue;
      const user = await ctx.db.get(student.userId);
      if (!hasProperName(user)) continue;
      const classData = await ctx.db.get(student.classId);
      enrichedMap.set(item.studentId, {
        studentId: item.studentId,
        studentName: buildUserName(user),
        className: classData?.name || "-",
        average: Number(item.average.toFixed(2)),
      });
    }

    // Build top/bottom arrays from enriched data
    const topResults: Array<{ studentId: Id<"students">; studentName: string; className: string; average: number }> = [];
    const bottomResults: Array<{ studentId: Id<"students">; studentName: string; className: string; average: number }> = [];

    for (const c of topCandidates) {
      if (topResults.length >= 3) break;
      const enriched = enrichedMap.get(c.studentId);
      if (enriched) topResults.push(enriched);
    }
    for (const c of bottomCandidates) {
      if (bottomResults.length >= 3) break;
      const enriched = enrichedMap.get(c.studentId);
      if (enriched) bottomResults.push(enriched);
    }

    return { top: topResults, bottom: bottomResults };
  },
});

// Get top and bottom students by absences
// OPTIMIZED: Read attendance in bulk, aggregate, lookup names only for top/bottom results
export const getStudentsByAbsences = query({
  args: {},
  handler: async (ctx): Promise<{ top: Array<{ studentId: Id<"students">; studentName: string; className: string; absences: number }>; bottom: Array<{ studentId: Id<"students">; studentName: string; className: string; absences: number }> }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // OPTIMIZED: Read attendance in bulk instead of per-student
    const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
    const allAttendance = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => q.gte("date", sixMonthsAgo))
      .collect();

    // Aggregate by studentId
    const studentAbsences = new Map<string, number>();
    for (const record of allAttendance) {
      const sid = record.studentId as string;
      studentAbsences.set(sid, (studentAbsences.get(sid) || 0) + 1);
    }

    // Sort by absences
    const sorted = Array.from(studentAbsences.entries())
      .map(([studentId, absences]) => ({
        studentId: studentId as Id<"students">,
        absences,
      }))
      .filter((s) => s.absences > 0)
      .sort((a, b) => a.absences - b.absences);

    // Take top 6 and bottom 6 candidates (extra buffer for invalid names)
    const topCandidates = sorted.slice(0, 6);
    const bottomCandidates = sorted.slice(-6).reverse();
    const candidates = [...topCandidates, ...bottomCandidates];

    // OPTIMIZED: Lookup names only for candidates
    const enrichedMap = new Map<string, { studentId: Id<"students">; studentName: string; className: string; absences: number }>();
    for (const item of candidates) {
      if (enrichedMap.has(item.studentId)) continue;
      const student = await ctx.db.get(item.studentId);
      if (!student) continue;
      const user = await ctx.db.get(student.userId);
      if (!hasProperName(user)) continue;
      const classData = await ctx.db.get(student.classId);
      enrichedMap.set(item.studentId, {
        studentId: item.studentId,
        studentName: buildUserName(user),
        className: classData?.name || "-",
        absences: item.absences,
      });
    }

    const topResults: Array<{ studentId: Id<"students">; studentName: string; className: string; absences: number }> = [];
    const bottomResults: Array<{ studentId: Id<"students">; studentName: string; className: string; absences: number }> = [];

    for (const c of topCandidates) {
      if (topResults.length >= 3) break;
      const enriched = enrichedMap.get(c.studentId);
      if (enriched) topResults.push(enriched);
    }
    for (const c of bottomCandidates) {
      if (bottomResults.length >= 3) break;
      const enriched = enrichedMap.get(c.studentId);
      if (enriched) bottomResults.push(enriched);
    }

    return { top: topResults, bottom: bottomResults };
  },
});

// Get most active teachers
// OPTIMIZED: Uses audit log instead of reading ALL grades + ALL attendance + ALL remarks
export const getActiveTeachers = query({
  args: {},
  handler: async (ctx): Promise<Array<{ teacherId: Id<"teachers">; teacherName: string; activityCount: number }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // OPTIMIZED: Read recent audit log entries instead of full-scanning 3 large tables
    // Before: read ALL grades (~4,600) + ALL attendance (~8,000) + ALL remarks = ~13,000+ documents
    // After: read ~500 recent audit log entries
    const recentLogs = await ctx.db
      .query("auditLog")
      .order("desc")
      .take(500);

    // Count activities per userId from audit log
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const activityByUser = new Map<string, number>();
    for (const log of recentLogs) {
      if (log._creationTime < thirtyDaysAgo) continue;
      const uid = log.userId as string;
      activityByUser.set(uid, (activityByUser.get(uid) || 0) + 1);
    }

    // Map users to teachers (teachers table is small: ~87 records)
    const teachers = await ctx.db.query("teachers").collect();
    const teacherByUserId = new Map<string, typeof teachers[0]>();
    for (const t of teachers) {
      teacherByUserId.set(t.userId as string, t);
    }

    // Build results, looking up names only for matched teachers
    const teacherActivities: Array<{
      teacherId: Id<"teachers">;
      teacherName: string;
      activityCount: number;
    }> = [];

    for (const [userId, count] of activityByUser) {
      const teacher = teacherByUserId.get(userId);
      if (!teacher) continue;

      const user = await ctx.db.get(teacher.userId);
      if (!user || !hasProperName(user)) continue;

      teacherActivities.push({
        teacherId: teacher._id,
        teacherName: buildUserName(user),
        activityCount: count,
      });
    }

    return teacherActivities
      .sort((a, b) => b.activityCount - a.activityCount)
      .slice(0, 7);
  },
});

// Get lessons this week percentage
// OPTIMIZED: Uses by_date index for this week only
export const getLessonsThisWeekPercentage = query({
  args: {},
  handler: async (ctx): Promise<number> => {
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

    // Get start and end of current week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 4); // Friday
    endOfWeek.setHours(23, 59, 59, 999);

    const startTime = startOfWeek.getTime();
    const endTime = endOfWeek.getTime();

    // OPTIMIZED: Use by_date index instead of full table scan of all lessons
    const thisWeekLessons = await ctx.db
      .query("lessons")
      .withIndex("by_date", (q) => q.gte("date", startTime))
      .collect();

    // Filter to only this week (upper bound)
    const filteredLessons = thisWeekLessons.filter((l) => l.date <= endTime);

    if (filteredLessons.length === 0) return 0;

    // Count how many have been conducted (have attendance records)
    let conductedCount = 0;
    for (const lesson of filteredLessons) {
      const hasAttendance = await ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.eq("date", lesson.date))
        .first();

      if (hasAttendance) {
        conductedCount++;
      }
    }

    return Math.round((conductedCount / filteredLessons.length) * 100);
  },
});
