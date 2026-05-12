import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { buildUserName, hasProperName, isAdmin } from "./users.js";

// GET /inspections/months - Get month statistics for the year
export const getMonthStatistics = query({
  args: {
    year: v.number(),
    schoolId: v.id("schools"),
    teacherId: v.optional(v.id("teachers")),
    subjectId: v.optional(v.id("subjects")),
  },
  handler: async (ctx, args): Promise<Array<{
    month: number;
    year: number;
    totalLessons: number;
    takenLessons: number;
    percentageTaken: number;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const monthStats = [];

    // Process each month (1-12)
    for (let month = 1; month <= 12; month++) {
      // Get start and end of month in UTC
      const startDate = Date.UTC(args.year, month - 1, 1, 0, 0, 0, 0);
      const endDate = Date.UTC(args.year, month, 0, 23, 59, 59, 999);

      // Query lessons in this month
      const allLessons = await ctx.db
        .query("lessons")
        .withIndex("by_date", (q) => q.gte("date", startDate).lte("date", endDate))
        .collect();

      // Filter out weekend lessons (Saturday=6, Sunday=0)
      const weekdayLessons = allLessons.filter(l => {
        const d = new Date(l.date);
        const dow = d.getUTCDay();
        return dow !== 0 && dow !== 6;
      });

      // Filter by teacher and subject if provided
      let filteredLessons = weekdayLessons;
      
      if (args.teacherId) {
        filteredLessons = filteredLessons.filter(l => l.teacherId === args.teacherId);
      }
      
      if (args.subjectId) {
        filteredLessons = filteredLessons.filter(l => l.subjectId === args.subjectId);
      }

      // Filter by school
      const lessonsInSchool = [];
      for (const lesson of filteredLessons) {
        const classDoc = await ctx.db.get(lesson.classId);
        if (classDoc && classDoc.schoolId === args.schoolId) {
          lessonsInSchool.push(lesson);
        }
      }

      const totalLessons = lessonsInSchool.length;
      const takenLessons = lessonsInSchool.filter(l => l.isTaken).length;
      const percentageTaken = totalLessons > 0 ? Math.round((takenLessons / totalLessons) * 100) : 0;

      monthStats.push({
        month,
        year: args.year,
        totalLessons,
        takenLessons,
        percentageTaken,
      });
    }

    return monthStats;
  },
});

// GET /inspections/days - Get day statistics for a specific month
export const getDayStatistics = query({
  args: {
    year: v.number(),
    month: v.number(),
    schoolId: v.id("schools"),
    teacherId: v.optional(v.id("teachers")),
    subjectId: v.optional(v.id("subjects")),
  },
  handler: async (ctx, args): Promise<Array<{
    date: number;
    day: number;
    totalLessons: number;
    takenLessons: number;
    percentageTaken: number;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // ── Pre-compute schedule data once ──
    // Always load terms and schedules so we can filter lessons to the active term
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allSchedulesRaw: Array<{ classId: Id<"classes">; termId?: Id<"terms">; entries: Array<{ dayOfWeek: number; periodIndex: number; subjectId: Id<"subjects">; teacherId: Id<"teachers"> }> }> = [];
    let allTerms: Array<{ _id: Id<"terms">; startDate: number; endDate: number }> = [];

    allTerms = await ctx.db
      .query("terms")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .collect();
    const schedulesRaw = await ctx.db.query("weeklySchedules").collect();
    allSchedulesRaw = schedulesRaw.map(s => ({
      classId: s.classId,
      termId: s.termId,
      entries: s.entries,
    }));

    const dayStats = [];
    const daysInMonth = new Date(Date.UTC(args.year, args.month, 0)).getUTCDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStart = Date.UTC(args.year, args.month - 1, day, 0, 0, 0, 0);

      // Skip weekends
      const dayDate = new Date(dayStart);
      const utcDow = dayDate.getUTCDay();
      if (utcDow === 0 || utcDow === 6) {
        dayStats.push({ date: dayStart, day, totalLessons: 0, takenLessons: 0, percentageTaken: 0 });
        continue;
      }

      const dow = utcDow === 0 ? 7 : utcDow; // 1=Mon..7=Sun

      // Query lessons for this day
      const allLessons = await ctx.db
        .query("lessons")
        .withIndex("by_date", (q) => q.eq("date", dayStart))
        .collect();

      let filteredLessons = allLessons;

      // ── Filter lessons to only include those in the active term's schedule ──
      const activeTerm = allTerms.find(t => dayStart >= t.startDate && dayStart <= t.endDate);
      const activeSchedules = allSchedulesRaw.filter(s => {
        if (!activeTerm) return true;
        if (s.termId && s.termId !== activeTerm._id) return false;
        return true;
      });

      const validScheduleSlots = new Set<string>();
      for (const sched of activeSchedules) {
        for (const entry of sched.entries) {
          if (entry.dayOfWeek === dow) {
            validScheduleSlots.add(`${sched.classId}_${entry.periodIndex}_${entry.subjectId}`);
          }
        }
      }

      filteredLessons = filteredLessons.filter(l => {
        const slotKey = `${l.classId}_${l.periodIndex}_${l.subjectId}`;
        return validScheduleSlots.has(slotKey);
      });

      // Subject filter
      if (args.subjectId) {
        filteredLessons = filteredLessons.filter(l => l.subjectId === args.subjectId);
      }

      // ── Schedule-aware teacher filter ──
      if (args.teacherId) {
        // Build schedule map for this day of week
        const scheduleSlotTeachers = new Map<string, Set<string>>();
        for (const sched of activeSchedules) {
          for (const entry of sched.entries) {
            if (entry.dayOfWeek === dow) {
              const key = `${sched.classId}_${entry.periodIndex}_${entry.subjectId}`;
              if (!scheduleSlotTeachers.has(key)) scheduleSlotTeachers.set(key, new Set());
              scheduleSlotTeachers.get(key)!.add(entry.teacherId);
            }
          }
        }

        filteredLessons = filteredLessons.filter(l => {
          const slotKey = `${l.classId}_${l.periodIndex}_${l.subjectId}`;
          const scheduledTeachers = scheduleSlotTeachers.get(slotKey);
          if (scheduledTeachers?.has(args.teacherId!)) return true;
          // Fallback for lessons without schedule entry
          if (!scheduledTeachers && l.teacherId === args.teacherId) return true;
          return false;
        });
      }

      // Filter by school
      const lessonsInSchool = [];
      for (const lesson of filteredLessons) {
        const classDoc = await ctx.db.get(lesson.classId);
        if (classDoc && classDoc.schoolId === args.schoolId) {
          lessonsInSchool.push(lesson);
        }
      }

      const totalLessons = lessonsInSchool.length;
      const takenLessons = lessonsInSchool.filter(l => l.isTaken).length;
      const percentageTaken = totalLessons > 0 ? Math.round((takenLessons / totalLessons) * 100) : 0;

      dayStats.push({ date: dayStart, day, totalLessons, takenLessons, percentageTaken });
    }

    return dayStats;
  },
});

// GET /inspections/day-details - Get detailed information for a specific day
export const getDayDetails = query({
  args: {
    date: v.number(),
    schoolId: v.id("schools"),
    teacherId: v.optional(v.id("teachers")),
    subjectId: v.optional(v.id("subjects")),
  },
  handler: async (ctx, args): Promise<{
    summary: {
      totalLessons: number;
      takenLessons: number;
      totalAbsences: number;
      totalGrades: number;
      totalRemarks: number;
    };
    lessons: Array<{
      lessonId: Id<"lessons">;
      periodIndex: number;
      startTime: string;
      endTime: string;
      className: string;
      subjectName: string;
      teacherName: string;
      teacherNames: string[];
      percentageTaken: number;
      absencesCount: number;
      gradesCount: number;
      remarksCount: number;
      isTaken: boolean;
    }>;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Determine day of week from the date (1=Mon..7=Sun) for schedule lookup
    const dateObj = new Date(args.date);
    const utcDow = dateObj.getUTCDay(); // 0=Sun, 1=Mon..6=Sat
    const dayOfWeek = utcDow === 0 ? 7 : utcDow;

    // ── Step 1: Find the active term for this date ──
    const terms = await ctx.db
      .query("terms")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .collect();
    const activeTerm = terms.find(t => args.date >= t.startDate && args.date <= t.endDate);

    // ── Step 2: Get weekly schedules, filtered to the active term ──
    const allSchedulesRaw = await ctx.db.query("weeklySchedules").collect();
    // Exclude schedules that belong to a DIFFERENT term
    const activeSchedules = allSchedulesRaw.filter(s => {
      if (!activeTerm) return true; // No term found for this date - use all
      if (s.termId && s.termId !== activeTerm._id) return false; // Different term - skip
      return true; // Same term or no termId (general schedule)
    });

    // ── Step 3: Build schedule map ──
    // Key: "classId_periodIndex_subjectId" → Set of teacher IDs
    const scheduleSlotTeachers = new Map<string, Set<string>>();
    for (const sched of activeSchedules) {
      for (const entry of sched.entries) {
        if (entry.dayOfWeek === dayOfWeek) {
          const key = `${sched.classId}_${entry.periodIndex}_${entry.subjectId}`;
          if (!scheduleSlotTeachers.has(key)) {
            scheduleSlotTeachers.set(key, new Set());
          }
          scheduleSlotTeachers.get(key)!.add(entry.teacherId);
        }
      }
    }

    // ── Step 4: Get absences for substitution verification ──
    const allAbsences = await ctx.db
      .query("absences")
      .filter((q) =>
        q.and(
          q.lte(q.field("startDate"), args.date),
          q.gte(q.field("endDate"), args.date)
        )
      )
      .collect();

    // Build verified substitution map: "classId_periodIndex" → substituteTeacherId
    const verifiedSubstitutes = new Map<string, string>();
    for (const absence of allAbsences) {
      if (!absence.substitutions || absence.substitutions.length === 0) continue;

      if (absence.substitutionType === "single" && absence.substitutions.length > 0) {
        const sub = absence.substitutions[0];
        if (sub.teacherId && !sub.isFree) {
          // Substitute replaces ALL of the absent teacher's slots for the day
          for (const sched of activeSchedules) {
            for (const entry of sched.entries) {
              if (entry.teacherId === absence.teacherId && entry.dayOfWeek === dayOfWeek) {
                const key = `${sched.classId}_${entry.periodIndex}`;
                verifiedSubstitutes.set(key, sub.teacherId);
              }
            }
          }
        }
      } else if (absence.substitutionType === "multiple") {
        for (const sub of absence.substitutions) {
          if (sub.teacherId && !sub.isFree && sub.dayOfWeek === dayOfWeek) {
            const subDateMatches = sub.date === undefined || sub.date === args.date;
            if (subDateMatches && sub.periodIndex !== undefined) {
              const targetPeriod = sub.periodIndex + 1; // 0-based → 1-based
              for (const sched of activeSchedules) {
                for (const entry of sched.entries) {
                  if (
                    entry.teacherId === absence.teacherId &&
                    entry.dayOfWeek === dayOfWeek &&
                    entry.periodIndex === targetPeriod
                  ) {
                    const key = `${sched.classId}_${entry.periodIndex}`;
                    verifiedSubstitutes.set(key, sub.teacherId);
                  }
                }
              }
            }
          }
        }
      }
    }

    // ── Step 5: Query lessons for this day ──
    const allLessons = await ctx.db
      .query("lessons")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();

    // ── Step 5b: Filter lessons to only include those in the active term's schedule ──
    // Uses classId + periodIndex + subjectId to precisely match schedule entries,
    // preventing lessons from a different term or wrong subject from appearing
    const validScheduleSlots = new Set<string>();
    for (const sched of activeSchedules) {
      for (const entry of sched.entries) {
        if (entry.dayOfWeek === dayOfWeek) {
          validScheduleSlots.add(`${sched.classId}_${entry.periodIndex}_${entry.subjectId}`);
        }
      }
    }

    let filteredLessons = allLessons.filter(l => {
      const slotKey = `${l.classId}_${l.periodIndex}_${l.subjectId}`;
      return validScheduleSlots.has(slotKey);
    });

    // Filter by subject if provided
    if (args.subjectId) {
      filteredLessons = filteredLessons.filter(l => l.subjectId === args.subjectId);
    }

    // ── Step 6: Teacher filter using schedule + substitutions ──
    if (args.teacherId) {
      filteredLessons = filteredLessons.filter(l => {
        const slotKey = `${l.classId}_${l.periodIndex}_${l.subjectId}`;
        const scheduledTeachers = scheduleSlotTeachers.get(slotKey);

        // Teacher is scheduled for this slot in the active term
        if (scheduledTeachers?.has(args.teacherId!)) return true;

        // Teacher is a verified substitute for this slot
        const subKey = `${l.classId}_${l.periodIndex}`;
        if (verifiedSubstitutes.get(subKey) === args.teacherId) return true;

        // Fallback: if no schedule entry exists for this slot, use lesson.teacherId
        if (!scheduledTeachers && l.teacherId === args.teacherId) return true;

        return false;
      });
    }

    // ── Step 7: Enrich lessons with correct teacher display ──
    const enrichedLessons = [];

    // Pre-fetch attendance, grades, badges for this date (once)
    const allAttendance = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
    const allGrades = await ctx.db
      .query("grades")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
    const allBadges = await ctx.db
      .query("badges")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();

    // Cache resolved teacher names to avoid redundant DB lookups
    const teacherNameCache = new Map<string, string>();
    async function resolveTeacherName(teacherId: string): Promise<string> {
      if (teacherNameCache.has(teacherId)) return teacherNameCache.get(teacherId)!;
      const teacher = await ctx.db.get(teacherId as Id<"teachers">);
      const user = teacher ? await ctx.db.get(teacher.userId) : null;
      const name = buildUserName(user);
      teacherNameCache.set(teacherId, name);
      return name;
    }

    for (const lesson of filteredLessons) {
      const classDoc = await ctx.db.get(lesson.classId);
      if (!classDoc || classDoc.schoolId !== args.schoolId) continue;

      const subject = await ctx.db.get(lesson.subjectId);

      // ── Determine the correct teacher(s) to display ──
      const slotKey = `${lesson.classId}_${lesson.periodIndex}_${lesson.subjectId}`;
      const scheduledTeacherIdSet = scheduleSlotTeachers.get(slotKey);

      const subKey = `${lesson.classId}_${lesson.periodIndex}`;
      const substituteTeacherId = verifiedSubstitutes.get(subKey);

      let displayTeacherNames: string[] = [];
      let primaryTeacherName: string;

      if (substituteTeacherId) {
        // Verified substitute for this slot → show the substitute
        primaryTeacherName = await resolveTeacherName(substituteTeacherId);
        displayTeacherNames = [primaryTeacherName];
      } else if (scheduledTeacherIdSet && scheduledTeacherIdSet.size > 0) {
        // Use the schedule teachers from the active term (co-teaching supported)
        for (const tid of scheduledTeacherIdSet) {
          displayTeacherNames.push(await resolveTeacherName(tid));
        }
        primaryTeacherName = displayTeacherNames[0] ?? "Unknown";
      } else {
        // No schedule entry found – fall back to lesson.teacherId
        primaryTeacherName = await resolveTeacherName(lesson.teacherId);
        displayTeacherNames = [primaryTeacherName];
      }

      // ── Attendance, grades, badges ──
      const lessonAttendance = allAttendance.filter(
        a => a.classId === lesson.classId &&
             a.period === lesson.periodIndex &&
             (a.status === "absent" || a.status === "late")
      );
      const lessonGrades = allGrades.filter(
        g => g.classId === lesson.classId && g.subjectId === lesson.subjectId
      );
      const lessonBadges = allBadges.filter(b => b.lessonId === lesson._id);

      // Calculate time
      const startHour = 7 + lesson.periodIndex;
      const endHour = startHour + 1;
      const startTime = `${startHour.toString().padStart(2, '0')}:30`;
      const endTime = `${endHour.toString().padStart(2, '0')}:${(startHour + 1) % 2 === 0 ? '30' : '00'}`;

      enrichedLessons.push({
        lessonId: lesson._id,
        periodIndex: lesson.periodIndex,
        startTime,
        endTime,
        className: classDoc.name,
        subjectName: subject?.name ?? "-",
        teacherName: primaryTeacherName,
        teacherNames: displayTeacherNames,
        percentageTaken: lesson.isTaken ? 100 : 0,
        absencesCount: lessonAttendance.length,
        gradesCount: lessonGrades.length,
        remarksCount: lessonBadges.length,
        isTaken: lesson.isTaken,
      });
    }

    // Sort by period
    enrichedLessons.sort((a, b) => a.periodIndex - b.periodIndex);

    // Calculate summary
    const summary = {
      totalLessons: enrichedLessons.length,
      takenLessons: enrichedLessons.filter(l => l.isTaken).length,
      totalAbsences: enrichedLessons.reduce((sum, l) => sum + l.absencesCount, 0),
      totalGrades: enrichedLessons.reduce((sum, l) => sum + l.gradesCount, 0),
      totalRemarks: enrichedLessons.reduce((sum, l) => sum + l.remarksCount, 0),
    };

    return {
      summary,
      lessons: enrichedLessons,
    };
  },
});

// GET /inspections/lesson-details - Get detailed student information for a specific lesson
export const getLessonDetails = query({
  args: {
    lessonId: v.id("lessons"),
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args): Promise<{
    lesson: {
      periodIndex: number;
      startTime: string;
      endTime: string;
      className: string;
      classId: Id<"classes">;
      subjectName: string;
      teacherName: string;
      topic: string;
      isTaken: boolean;
    };
    summary: {
      totalStudents: number;
      absences: number;
      lateArrivals: number;
      grades: number;
      reviews: number;
    };
    students: Array<{
      studentId: Id<"students">;
      userId: Id<"users">;
      studentNumber: number;
      name: string;
      attendance: "present" | "absent" | "late" | "excused" | null;
      grade: string | null;
      review: string | null;
      reviewType: "remark" | null;
    }>;
  } | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) return null;

    const classDoc = await ctx.db.get(lesson.classId);
    if (!classDoc || classDoc.schoolId !== args.schoolId) return null;

    const subject = await ctx.db.get(lesson.subjectId);
    const teacher = await ctx.db.get(lesson.teacherId);
    const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;

    // Get all students in this class
    const classStudents = await ctx.db
      .query("students")
      .withIndex("by_class", (q) => q.eq("classId", lesson.classId))
      .collect();

    // Get attendance for this lesson
    const allAttendance = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => q.eq("date", lesson.date))
      .collect();

    const lessonAttendance = allAttendance.filter(
      a => a.classId === lesson.classId && a.period === lesson.periodIndex
    );

    // Get grades for this lesson
    const allGrades = await ctx.db
      .query("grades")
      .withIndex("by_date", (q) => q.eq("date", lesson.date))
      .collect();

    const lessonGrades = allGrades.filter(
      g => g.classId === lesson.classId && g.subjectId === lesson.subjectId
    );

    // Get badges/reviews for this lesson
    const allBadges = await ctx.db
      .query("badges")
      .withIndex("by_date", (q) => q.eq("date", lesson.date))
      .collect();

    const lessonBadges = allBadges.filter(b => b.lessonId === lesson._id);

    // Build student data
    const students: Array<{
      studentId: Id<"students">;
      userId: Id<"users">;
      studentNumber: number;
      name: string;
      attendance: "present" | "absent" | "late" | "excused" | null;
      grade: string | null;
      review: string | null;
      reviewType: "remark" | null;
    }> = [];

    for (const student of classStudents) {
      const user = await ctx.db.get(student.userId);
      
      // Skip users without proper names (firstName AND lastName required)
      if (!hasProperName(user)) {
        continue;
      }

      // Find attendance for this student
      const studentAttendance = lessonAttendance.find(a => a.studentId === student._id);
      
      // Find grade for this student
      const studentGrade = lessonGrades.find(g => g.studentId === student._id);
      
      // Find review for this student
      const studentBadge = lessonBadges.find(b => b.studentId === student._id);

      // Convert grade value to string
      let gradeStr: string | null = null;
      if (studentGrade) {
        gradeStr = studentGrade.value === "absent" ? "Н" : String(studentGrade.value);
      }

      students.push({
        studentId: student._id,
        userId: student.userId,
        studentNumber: student.studentNumber ?? 0,
        name: buildUserName(user),
        attendance: studentAttendance?.status ?? null,
        grade: gradeStr,
        review: studentBadge?.notes ?? null,
        reviewType: studentBadge ? "remark" : null,
      });
    }

    // Sort by student number
    students.sort((a, b) => a.studentNumber - b.studentNumber);

    // Calculate time
    const startHour = 7 + lesson.periodIndex;
    const endHour = startHour + 1;
    const startTime = `${startHour.toString().padStart(2, '0')}:30`;
    const endTime = `${endHour.toString().padStart(2, '0')}:${(startHour + 1) % 2 === 0 ? '30' : '00'}`;

    // Summary
    const summary = {
      totalStudents: students.length,
      absences: students.filter(s => s.attendance === "absent").length,
      lateArrivals: students.filter(s => s.attendance === "late").length,
      grades: students.filter(s => s.grade !== null).length,
      reviews: students.filter(s => s.review !== null).length,
    };

    return {
      lesson: {
        periodIndex: lesson.periodIndex,
        startTime,
        endTime,
        className: classDoc.name,
        classId: lesson.classId,
        subjectName: subject?.name ?? "-",
        teacherName: buildUserName(teacherUser),
        topic: lesson.topic ?? "",
        isTaken: lesson.isTaken,
      },
      summary,
      students,
    };
  },
});

// MUTATION: Mark lesson as taken and verified (Взет и проверен)
export const markLessonAsTaken = mutation({
  args: {
    lessonId: v.id("lessons"),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Check if user is admin/director/vice_director
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    if (!isAdmin(user)) {
      throw new ConvexError({
        message: "Само администратори, директори и зам. директори могат да променят този статус",
        code: "FORBIDDEN",
      });
    }

    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
      throw new ConvexError({
        message: "Lesson not found",
        code: "NOT_FOUND",
      });
    }

    await ctx.db.patch(args.lessonId, {
      isTaken: true,
      isVerified: true,
    });
  },
});

// MUTATION: Mark lesson as not conducted (Непроведен)
export const markLessonAsNotConducted = mutation({
  args: {
    lessonId: v.id("lessons"),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Check if user is admin/director/vice_director
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    if (!isAdmin(user)) {
      throw new ConvexError({
        message: "Само администратори, директори и зам. директори могат да променят този статус",
        code: "FORBIDDEN",
      });
    }

    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
      throw new ConvexError({
        message: "Lesson not found",
        code: "NOT_FOUND",
      });
    }

    await ctx.db.patch(args.lessonId, {
      isTaken: false,
      isNotConducted: true,
    });
  },
});

// MUTATION: Clear all lesson data (Изчисти) - Clears attendance, grades, badges for the lesson
export const clearLessonData = mutation({
  args: {
    lessonId: v.id("lessons"),
  },
  handler: async (ctx, args): Promise<{ deletedAttendance: number; deletedGrades: number; deletedBadges: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Check if user is admin/director/vice_director
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    if (!isAdmin(user)) {
      throw new ConvexError({
        message: "Само администратори, директори и зам. директори могат да изчистват данни",
        code: "FORBIDDEN",
      });
    }

    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
      throw new ConvexError({
        message: "Lesson not found",
        code: "NOT_FOUND",
      });
    }

    // Delete attendance records for this lesson
    const allAttendance = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => q.eq("date", lesson.date))
      .collect();
    
    const lessonAttendance = allAttendance.filter(
      a => a.classId === lesson.classId && a.period === lesson.periodIndex
    );
    
    for (const attendance of lessonAttendance) {
      await ctx.db.delete(attendance._id);
    }

    // Delete grades for this lesson
    const allGrades = await ctx.db
      .query("grades")
      .withIndex("by_date", (q) => q.eq("date", lesson.date))
      .collect();
    
    const lessonGrades = allGrades.filter(
      g => g.classId === lesson.classId && g.subjectId === lesson.subjectId
    );
    
    for (const grade of lessonGrades) {
      await ctx.db.delete(grade._id);
    }

    // Delete badges/remarks for this lesson
    const allBadges = await ctx.db
      .query("badges")
      .withIndex("by_date", (q) => q.eq("date", lesson.date))
      .collect();
    
    const lessonBadges = allBadges.filter(b => b.lessonId === lesson._id);
    
    for (const badge of lessonBadges) {
      await ctx.db.delete(badge._id);
    }

    // Reset lesson status
    await ctx.db.patch(args.lessonId, {
      isTaken: false,
      isVerified: false,
      isNotConducted: false,
      topic: "",
    });

    return {
      deletedAttendance: lessonAttendance.length,
      deletedGrades: lessonGrades.length,
      deletedBadges: lessonBadges.length,
    };
  },
});
