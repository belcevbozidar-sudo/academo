import { v } from "convex/values";
import { query } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";

// Default settings for when platformSettings is not found
const DEFAULT_INCLUDE_GRADES_1_TO_3 = false;

// Helper to get date range based on period
function getDateRange(period: "1m" | "3m" | "6m" | "1y"): {
  start: number;
  end: number;
} {
  const end = Date.now();
  const start = new Date();

  switch (period) {
    case "1m":
      start.setMonth(start.getMonth() - 1);
      break;
    case "3m":
      start.setMonth(start.getMonth() - 3);
      break;
    case "6m":
      start.setMonth(start.getMonth() - 6);
      break;
    case "1y":
      start.setFullYear(start.getFullYear() - 1);
      break;
  }

  return { start: start.getTime(), end };
}

// GET /stats/school - School-wide statistics
export const getSchoolStats = query({
  args: {
    schoolId: v.optional(v.id("schools")),
    subjectId: v.optional(v.id("subjects")),
    classId: v.optional(v.id("classes")),
    gradeType: v.optional(
      v.union(v.literal("current"), v.literal("term"), v.literal("final"))
    ),
    period: v.union(
      v.literal("1m"),
      v.literal("3m"),
      v.literal("6m"),
      v.literal("1y")
    ),
  },
  handler: async (ctx, args): Promise<{
    excellentClassesCount: number;
    highestAverage: number;
    totalGradesCount: number;
    averageGrade: number;
    topClasses: Array<{
      className: string;
      average: number;
    }>;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get current user to get schoolId
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    // Check includeGrades1to3InRankings setting
    let includeGrades1to3 = DEFAULT_INCLUDE_GRADES_1_TO_3;
    if (currentUser?.schoolId) {
      const settings = await ctx.db
        .query("platformSettings")
        .withIndex("by_school", (q) => q.eq("schoolId", currentUser.schoolId!))
        .unique();
      includeGrades1to3 = settings?.includeGrades1to3InRankings ?? DEFAULT_INCLUDE_GRADES_1_TO_3;
    }

    const { start, end } = getDateRange(args.period);

    // OPTIMIZED: Use by_date index instead of full table scan
    let grades = await ctx.db
      .query("grades")
      .withIndex("by_date", (q) => q.gte("date", start))
      .collect();

    // Filter upper bound (already filtered lower bound via index)
    grades = grades.filter((g) => g.date <= end);

    // Filter by subject if provided
    if (args.subjectId) {
      grades = grades.filter((g) => g.subjectId === args.subjectId);
    }

    // Filter by class if provided
    if (args.classId) {
      grades = grades.filter((g) => g.classId === args.classId);
    }

    // Filter by grade type if provided
    if (args.gradeType) {
      grades = grades.filter((g) => g.type === args.gradeType);
    }

    // Filter out grades from classes 1-3 if setting is disabled
    if (!includeGrades1to3) {
      const classCache = new Map<Id<"classes">, number | null>();
      const filteredGrades = [];
      
      for (const grade of grades) {
        let classGrade = classCache.get(grade.classId);
        if (classGrade === undefined) {
          const classDoc = await ctx.db.get(grade.classId);
          classGrade = classDoc?.grade ?? null;
          classCache.set(grade.classId, classGrade);
        }
        
        // Include only if class grade is 4 or higher (or unknown)
        if (classGrade === null || classGrade >= 4) {
          filteredGrades.push(grade);
        }
      }
      grades = filteredGrades;
    }

    // Calculate average grade (excluding "absent")
    const numericGrades = grades.filter(
      (g) => typeof g.value === "number"
    ) as Array<{ value: number; classId: Id<"classes"> }>;

    const totalGrades = numericGrades.length;
    const sumGrades = numericGrades.reduce((sum, g) => sum + g.value, 0);
    const averageGrade = totalGrades > 0 ? sumGrades / totalGrades : 0;

    // Calculate averages by class
    const classAverages = new Map<Id<"classes">, { sum: number; count: number }>();

    for (const grade of numericGrades) {
      const existing = classAverages.get(grade.classId) ?? { sum: 0, count: 0 };
      classAverages.set(grade.classId, {
        sum: existing.sum + grade.value,
        count: existing.count + 1,
      });
    }

    // Get top classes
    const classStats = await Promise.all(
      Array.from(classAverages.entries()).map(async ([classId, stats]) => {
        const classDoc = await ctx.db.get(classId);
        return {
          className: classDoc?.name ?? "Unknown",
          average: stats.count > 0 ? stats.sum / stats.count : 0,
        };
      })
    );

    classStats.sort((a, b) => b.average - a.average);
    const topClasses = classStats.slice(0, 5);

    // Count excellent classes (>5.50)
    const excellentClassesCount = classStats.filter(
      (c) => c.average > 5.5
    ).length;

    const highestAverage = classStats.length > 0 ? classStats[0].average : 0;

    return {
      excellentClassesCount,
      highestAverage,
      totalGradesCount: totalGrades,
      averageGrade,
      topClasses,
    };
  },
});

// GET /stats/grades - Grade statistics with trends
export const getGradeStats = query({
  args: {
    schoolId: v.optional(v.id("schools")),
    subjectId: v.optional(v.id("subjects")),
    gradeType: v.optional(
      v.union(v.literal("current"), v.literal("term"), v.literal("final"))
    ),
    period: v.union(
      v.literal("1m"),
      v.literal("3m"),
      v.literal("6m"),
      v.literal("1y")
    ),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    weeklyNewGrades: Array<{ week: string; count: number }>;
    averageBySubject: Array<{
      subjectName: string;
      average: number;
      count: number;
    }>;
    averageTrend: Array<{ month: string; average: number }>;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get current user to get schoolId
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    // Check includeGrades1to3InRankings setting
    let includeGrades1to3 = DEFAULT_INCLUDE_GRADES_1_TO_3;
    if (currentUser?.schoolId) {
      const settings = await ctx.db
        .query("platformSettings")
        .withIndex("by_school", (q) => q.eq("schoolId", currentUser.schoolId!))
        .unique();
      includeGrades1to3 = settings?.includeGrades1to3InRankings ?? DEFAULT_INCLUDE_GRADES_1_TO_3;
    }

    const { start, end } = getDateRange(args.period);

    // OPTIMIZED: Use by_date index instead of full table scan
    let grades = await ctx.db
      .query("grades")
      .withIndex("by_date", (q) => q.gte("date", start))
      .collect();

    // Filter upper bound
    grades = grades.filter((g) => g.date <= end);

    // Filter by subject if provided
    if (args.subjectId) {
      grades = grades.filter((g) => g.subjectId === args.subjectId);
    }

    // Filter by grade type if provided
    if (args.gradeType) {
      grades = grades.filter((g) => g.type === args.gradeType);
    }

    // Filter out grades from classes 1-3 if setting is disabled
    if (!includeGrades1to3) {
      const classCache = new Map<Id<"classes">, number | null>();
      const filteredGrades = [];
      
      for (const grade of grades) {
        let classGrade = classCache.get(grade.classId);
        if (classGrade === undefined) {
          const classDoc = await ctx.db.get(grade.classId);
          classGrade = classDoc?.grade ?? null;
          classCache.set(grade.classId, classGrade);
        }
        
        // Include only if class grade is 4 or higher (or unknown)
        if (classGrade === null || classGrade >= 4) {
          filteredGrades.push(grade);
        }
      }
      grades = filteredGrades;
    }

    // Calculate weekly new grades
    const weeklyGrades = new Map<string, number>();
    for (const grade of grades) {
      const date = new Date(grade.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay() + 1);
      const weekKey = weekStart.toISOString().split("T")[0];

      weeklyGrades.set(weekKey, (weeklyGrades.get(weekKey) ?? 0) + 1);
    }

    const weeklyNewGrades = Array.from(weeklyGrades.entries())
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => a.week.localeCompare(b.week));

    // Calculate average by subject
    const numericGrades = grades.filter(
      (g) => typeof g.value === "number"
    ) as Array<{ value: number; subjectId: Id<"subjects">; date: number }>;

    const subjectStats = new Map<Id<"subjects">, { sum: number; count: number }>();

    for (const grade of numericGrades) {
      const existing = subjectStats.get(grade.subjectId) ?? { sum: 0, count: 0 };
      subjectStats.set(grade.subjectId, {
        sum: existing.sum + grade.value,
        count: existing.count + 1,
      });
    }

    const averageBySubject = await Promise.all(
      Array.from(subjectStats.entries()).map(async ([subjectId, stats]) => {
        const subject = await ctx.db.get(subjectId);
        return {
          subjectName: subject?.name ?? "Unknown",
          average: stats.count > 0 ? stats.sum / stats.count : 0,
          count: stats.count,
        };
      })
    );

    averageBySubject.sort((a, b) => b.average - a.average);

    // Calculate monthly average trend
    const monthlyAverages = new Map<string, { sum: number; count: number }>();
    for (const grade of numericGrades) {
      const date = new Date(grade.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      const existing = monthlyAverages.get(monthKey) ?? { sum: 0, count: 0 };
      monthlyAverages.set(monthKey, {
        sum: existing.sum + grade.value,
        count: existing.count + 1,
      });
    }

    const averageTrend = Array.from(monthlyAverages.entries())
      .map(([month, stats]) => ({
        month,
        average: stats.count > 0 ? stats.sum / stats.count : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      weeklyNewGrades,
      averageBySubject,
      averageTrend,
    };
  },
});

// GET /stats/student - Student-specific statistics with real data
export const getStudentStats = query({
  args: {
    studentId: v.id("students"),
    period: v.union(
      v.literal("1m"),
      v.literal("3m"),
      v.literal("6m"),
      v.literal("1y")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get date range
    const end = Date.now();
    const start = new Date();
    switch (args.period) {
      case "1m":
        start.setMonth(start.getMonth() - 1);
        break;
      case "3m":
        start.setMonth(start.getMonth() - 3);
        break;
      case "6m":
        start.setMonth(start.getMonth() - 6);
        break;
      case "1y":
        start.setFullYear(start.getFullYear() - 1);
        break;
    }
    const startTime = start.getTime();

    // Get student
    const student = await ctx.db.get(args.studentId);
    if (!student) {
      throw new ConvexError({
        message: "Student not found",
        code: "NOT_FOUND",
      });
    }

    // Get all grades for this student
    const allGrades = await ctx.db
      .query("grades")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    const gradesInPeriod = allGrades.filter(g => g.date >= startTime && g.date <= end);

    // Get attendance for this student
    const allAttendance = await ctx.db
      .query("attendance")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    const attendanceInPeriod = allAttendance.filter(a => a.date >= startTime && a.date <= end);

    // Get badges (remarks) for this student
    const allBadges = await ctx.db
      .query("badges")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    const badgesInPeriod = allBadges.filter(b => b.date >= startTime && b.date <= end);

    // Calculate grade statistics - exclude term grades to match Dashboard calculation
    const numericGrades = gradesInPeriod
      .filter(g => typeof g.value === "number" && g.type !== "term")
      .map(g => g.value as number);

    const totalGrades = numericGrades.length;
    const sumGrades = numericGrades.reduce((sum, val) => sum + val, 0);
    const averageGrade = totalGrades > 0 ? sumGrades / totalGrades : 0;
    const highestGrade = numericGrades.length > 0 ? Math.max(...numericGrades) : 0;

    // Grade distribution (from numeric grades, already excluding term grades)
    const gradeDistribution = {
      grade6: numericGrades.filter(g => g === 6).length,
      grade5: numericGrades.filter(g => g >= 5 && g < 6).length,
      grade4: numericGrades.filter(g => g >= 4 && g < 5).length,
      grade3: numericGrades.filter(g => g >= 3 && g < 4).length,
      grade2: numericGrades.filter(g => g < 3).length,
    };

    // Monthly grade averages (exclude term grades)
    const monthlyGrades = new Map<string, { sum: number; count: number }>();
    const bgMonths = ["Ян", "Февр", "Март", "Апр", "Май", "Юни", "Юли", "Авг", "Септ", "Окт", "Ное", "Дек"];
    
    for (const grade of gradesInPeriod) {
      if (typeof grade.value !== "number" || grade.type === "term") continue;
      const date = new Date(grade.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthlyGrades.get(monthKey) ?? { sum: 0, count: 0 };
      monthlyGrades.set(monthKey, {
        sum: existing.sum + (grade.value as number),
        count: existing.count + 1,
      });
    }

    const averageGradeData = Array.from(monthlyGrades.entries())
      .map(([monthKey, stats]) => {
        const month = monthKey.split("-")[1];
        const monthIdx = parseInt(month) - 1;
        return {
          name: bgMonths[monthIdx],
          value: stats.count > 0 ? stats.sum / stats.count : 0,
          sortKey: monthKey,
        };
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ name, value }) => ({ name, value }));

    // Attendance statistics
    const totalAbsences = attendanceInPeriod.filter(a => a.status === "absent").length;
    const excusedAbsences = attendanceInPeriod.filter(a => a.status === "excused").length;
    const lateCount = attendanceInPeriod.filter(a => a.status === "late").length;
    const unexcusedAbsences = totalAbsences; // All "absent" are unexcused
    const totalUnexcused = unexcusedAbsences + (lateCount * 0.5);

    // Monthly absences
    const monthlyAbsences = new Map<string, number>();
    for (const att of attendanceInPeriod) {
      if (att.status !== "absent") continue;
      const date = new Date(att.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthlyAbsences.set(monthKey, (monthlyAbsences.get(monthKey) ?? 0) + 1);
    }

    const absenceData = Array.from(monthlyAbsences.entries())
      .map(([monthKey, count]) => {
        const month = monthKey.split("-")[1];
        const monthIdx = parseInt(month) - 1;
        return {
          name: bgMonths[monthIdx],
          value: count,
          sortKey: monthKey,
        };
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ name, value }) => ({ name, value }));

    // Absences by subject
    const subjectAbsences = new Map<Id<"subjects">, number>();
    for (const att of attendanceInPeriod) {
      if (att.status !== "absent" || !att.subjectId) continue;
      subjectAbsences.set(att.subjectId, (subjectAbsences.get(att.subjectId) ?? 0) + 1);
    }

    const mostAbsencesData = await Promise.all(
      Array.from(subjectAbsences.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(async ([subjectId, count]) => {
          const subject = await ctx.db.get(subjectId);
          return {
            name: subject?.name ?? "Неизвестен",
            value: count,
          };
        })
    );

    // Group badges by type for remarks
    const badgeTypeCounts = new Map<string, number>();
    for (const badge of badgesInPeriod) {
      badgeTypeCounts.set(badge.type, (badgeTypeCounts.get(badge.type) ?? 0) + 1);
    }

    const remarksData = Array.from(badgeTypeCounts.entries()).map(([type, count]) => ({
      badge: getBadgeLabel(type),
      count,
    }));

    // Calculate class ranking - only count active (non-deleted) students
    const allClassStudents = await ctx.db
      .query("students")
      .withIndex("by_class", (q) => q.eq("classId", student.classId))
      .collect();
    
    // Filter out deleted students by checking their user records
    const classStudents: typeof allClassStudents = [];
    for (const cs of allClassStudents) {
      const studentUser = await ctx.db.get(cs.userId);
      if (studentUser && !studentUser.isDeleted) {
        classStudents.push(cs);
      }
    }

    // OPTIMIZED: Read all grades and attendance for the class in bulk (2 queries)
    // instead of per-student (was 2N queries for N students)
    const classGrades = await ctx.db
      .query("grades")
      .withIndex("by_class", (q) => q.eq("classId", student.classId))
      .collect();

    const classAttendance = await ctx.db
      .query("attendance")
      .withIndex("by_class", (q) => q.eq("classId", student.classId))
      .collect();

    // Aggregate in memory per student
    const gradesByStudent = new Map<string, number[]>();
    for (const g of classGrades) {
      if (typeof g.value !== "number" || g.type === "term" || g.date < startTime || g.date > end) continue;
      const sid = g.studentId as string;
      const arr = gradesByStudent.get(sid) || [];
      arr.push(g.value);
      gradesByStudent.set(sid, arr);
    }

    const absencesByStudent = new Map<string, number>();
    for (const a of classAttendance) {
      if (a.status !== "absent" || a.date < startTime || a.date > end) continue;
      const sid = a.studentId as string;
      absencesByStudent.set(sid, (absencesByStudent.get(sid) || 0) + 1);
    }

    const studentRankings: Array<{ studentId: Id<"students">; average: number; absenceCount: number }> = [];
    
    for (const cs of classStudents) {
      const numGrades = gradesByStudent.get(cs._id as string) || [];
      const absCount = absencesByStudent.get(cs._id as string) || 0;
      const avg = numGrades.length > 0 ? numGrades.reduce((s, val) => s + val, 0) / numGrades.length : 0;
      
      studentRankings.push({
        studentId: cs._id,
        average: avg,
        absenceCount: absCount,
      });
    }

    // Sort by average desc, then by absence count asc
    studentRankings.sort((a, b) => {
      if (b.average !== a.average) return b.average - a.average;
      return a.absenceCount - b.absenceCount;
    });

    const rankInClass = studentRankings.findIndex(s => s.studentId === args.studentId) + 1;

    return {
      // Grade stats
      averageGrade,
      highestGrade,
      totalGrades,
      gradeDistribution,
      averageGradeData,
      
      // Attendance stats
      totalAbsences,
      excusedAbsences,
      unexcusedAbsences,
      lateCount,
      totalUnexcused,
      absenceData,
      mostAbsencesData,
      
      // Review stats
      totalRemarks: badgesInPeriod.length,
      remarksData,
      
      // Rankings
      rankInClass: rankInClass || "-",
      totalInClass: classStudents.length,
    };
  },
});

// Helper to get badge label
function getBadgeLabel(type: string): string {
  const labels: Record<string, string> = {
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
