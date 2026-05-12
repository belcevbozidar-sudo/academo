import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api.js";

// GET /lessons/by-schedule - Get lessons from schedule for teacher on specific date
export const getLessonsBySchedule = query({
  args: {
    teacherId: v.id("teachers"),
    date: v.number(),
  },
  handler: async (ctx, args): Promise<Array<{
    scheduleEntry: {
      dayOfWeek: number;
      periodIndex: number;
      subjectId: Id<"subjects">;
      teacherId: Id<"teachers">;
      roomId?: Id<"rooms">;
      groupId?: Id<"classGroups">;
    };
    subject: Doc<"subjects">;
    class: Doc<"classes">;
    lesson: Doc<"lessons"> | null;
    dayRegime: {
      startTime: string;
      endTime: string;
      periodCount: number;
      periods?: Array<{ periodNumber: number; startTime: string; duration: number; endTime: string }>;
    } | null;
    isSubstitution?: boolean;
    originalTeacherName?: string;
    isCivicEducation?: boolean;
    groupName?: string;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get day of week from date (1 = Monday, 7 = Sunday)
    // args.date is a UTC timestamp in milliseconds representing midnight UTC of a calendar date
    const date = new Date(args.date);
    
    // Use UTC methods to extract day of week since we're storing UTC timestamps
    // getUTCDay() returns 0 for Sunday, 1 for Monday, etc.
    // We convert Sunday (0) to 7 to match our schedule system where Monday = 1
    const dayOfWeek = date.getUTCDay() === 0 ? 7 : date.getUTCDay();

    // Normalize to ensure we have midnight UTC (args.date should already be normalized)
    const normalizedDate = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0);

    // ── Term-aware schedule filtering ──
    // Get all weekly schedules AND terms so we only use the schedule for the active term
    const allSchedulesRaw = await ctx.db.query("weeklySchedules").collect();
    const allTerms = await ctx.db.query("terms").collect();
    const activeTerm = allTerms.find(t => normalizedDate >= t.startDate && normalizedDate <= t.endDate);

    // Filter schedules: exclude those belonging to a DIFFERENT term
    const allSchedules = allSchedulesRaw.filter(s => {
      if (!activeTerm) return true; // No term found for this date → use all
      if (s.termId && s.termId !== activeTerm._id) return false; // Different term → skip
      return true; // Same term or no termId (general schedule)
    });
    
    const scheduleEntries: Array<{
      scheduleEntry: {
        dayOfWeek: number;
        periodIndex: number;
        subjectId: Id<"subjects">;
        teacherId: Id<"teachers">;
        roomId?: Id<"rooms">;
        groupId?: Id<"classGroups">;
      };
      subject: Doc<"subjects">;
      class: Doc<"classes">;
      lesson: Doc<"lessons"> | null;
      dayRegime: {
        startTime: string;
        endTime: string;
        periodCount: number;
        periods?: Array<{ periodNumber: number; startTime: string; duration: number; endTime: string }>;
      } | null;
      isSubstitution?: boolean;
      originalTeacherName?: string;
      isCivicEducation?: boolean;
      groupName?: string;
    }> = [];

    // ПЪРВО: Взимаме всички отсъствия за тази дата за да филтрираме часовете
    const allAbsences = await ctx.db
      .query("absences")
      .filter((q) => 
        q.and(
          q.lte(q.field("startDate"), normalizedDate),
          q.gte(q.field("endDate"), normalizedDate)
        )
      )
      .collect();

    // Създаваме множество от часове, които не трябва да се показват на отсъстващия учител
    // (периоди, за които има назначен заместник ИЛИ са маркирани като свободни часове)
    const excludedSlotsForAbsentTeacher = new Set<string>();
    // Флаг за пълно изключване - ако има "single" заместване или свободен час, всички часове са изключени
    let excludeAllSlotsForAbsentTeacher = false;
    
    for (const absence of allAbsences) {
      // Ако този учител е отсъстващият учител, маркираме неговите часове
      if (absence.teacherId === args.teacherId) {
        // За "single" тип - един заместник за ВСИЧКИ часове ИЛИ всички са свободни
        if (absence.substitutionType === "single" && absence.substitutions && absence.substitutions.length > 0) {
          const singleSub = absence.substitutions[0];
          // Скриваме всички часове ако има заместник ИЛИ са маркирани като свободни
          if (singleSub.teacherId || singleSub.isFree) {
            excludeAllSlotsForAbsentTeacher = true;
          }
        }
        // За "multiple" тип - различни заместници/свободни часове за различни часове
        else if (absence.substitutionType === "multiple" && absence.substitutions && absence.substitutions.length > 0) {
          for (const sub of absence.substitutions) {
            // Проверяваме дали заместването е за тази конкретна дата
            const subDateMatches = sub.date === undefined || sub.date === normalizedDate;
            const dayMatches = sub.dayOfWeek === dayOfWeek;
            
            // Изключваме ако има заместник ИЛИ е свободен час
            if (dayMatches && subDateMatches && sub.periodIndex !== undefined && (sub.teacherId || sub.isFree)) {
              // Добавяме слота в изключените (periodIndex + 1 защото в разписанието е 1-based)
              excludedSlotsForAbsentTeacher.add(`${sub.periodIndex + 1}`);
            }
          }
        }
        // За "none" тип - учителят няма заместник, но все пак е в отсъствие
        // В този случай НЕ изключваме часовете - учителят може да ги взема сам
      }
    }

    for (const schedule of allSchedules) {
      const classDoc = await ctx.db.get(schedule.classId);
      if (!classDoc) continue;

      // Get day regime if assigned
      let dayRegimeInfo: {
        startTime: string;
        endTime: string;
        periodCount: number;
        periods?: Array<{ periodNumber: number; startTime: string; duration: number; endTime: string }>;
      } | null = null;

      if (schedule.dayRegimeId) {
        const regime = await ctx.db.get(schedule.dayRegimeId);
        if (regime) {
          dayRegimeInfo = {
            startTime: regime.startTime,
            endTime: regime.endTime,
            periodCount: regime.periodCount,
            periods: regime.periods,
          };
        }
      }

      for (const entry of schedule.entries) {
        if (entry.teacherId === args.teacherId && entry.dayOfWeek === dayOfWeek) {
          // НОВО: Проверяваме дали този час е изключен (има заместник)
          // При "single" заместване - всички часове са изключени
          // При "multiple" заместване - само конкретните слотове
          if (excludeAllSlotsForAbsentTeacher || excludedSlotsForAbsentTeacher.has(`${entry.periodIndex}`)) {
            // Учителят е в отсъствие и има заместник за този час - НЕ показваме
            continue;
          }

          const subject = await ctx.db.get(entry.subjectId);
          if (!subject) continue;

          // Skip entries without valid class (ghost lessons)
          if (!classDoc) continue;

          // Check if lesson exists for this exact date
          const existingLessons = await ctx.db
            .query("lessons")
            .withIndex("by_date", (q) => q.eq("date", normalizedDate))
            .collect();

          const lesson = existingLessons.find(
            (l) =>
              l.classId === schedule.classId &&
              l.subjectId === entry.subjectId &&
              l.periodIndex === entry.periodIndex
          );

          // Use shortName for display in schedule
          const subjectWithShortName = {
            ...subject,
            name: subject.shortName || subject.name,
          };

          // Resolve group name if groupId exists on the schedule entry
          let groupName: string | undefined;
          if (entry.groupId) {
            const group = await ctx.db.get(entry.groupId);
            if (group) {
              groupName = group.name;
            }
          }

          scheduleEntries.push({
            scheduleEntry: entry,
            subject: subjectWithShortName,
            class: classDoc,
            lesson: lesson ?? null,
            dayRegime: dayRegimeInfo,
            groupName,
          });
        }
      }
    }

    // ДОБАВЯМЕ: Проверка за заместващи часове
    for (const absence of allAbsences) {
      if (!absence.substitutions || absence.substitutions.length === 0) continue;

      // Намираме оригиналния учител
      const absentTeacher = await ctx.db.get(absence.teacherId);
      const absentTeacherUser = absentTeacher ? await ctx.db.get(absentTeacher.userId) : null;
      const originalTeacherName = absentTeacherUser 
        ? `${absentTeacherUser.firstName || ""} ${absentTeacherUser.lastName || ""}`.trim()
        : "Учител";

      // Обработка на "single" тип заместване - един заместник за ВСИЧКИ часове
      if (absence.substitutionType === "single" && absence.substitutions.length > 0) {
        const singleSub = absence.substitutions[0];
        
        // Проверяваме дали този учител е заместникът
        if (singleSub.teacherId === args.teacherId && !singleSub.isFree) {
          // Намираме ВСИЧКИ часове на отсъстващия учител за този ден
          for (const schedule of allSchedules) {
            for (const entry of schedule.entries) {
              if (entry.teacherId === absence.teacherId && entry.dayOfWeek === dayOfWeek) {
                const classDoc = await ctx.db.get(schedule.classId);
                if (!classDoc) continue;

                // Проверяваме дали вече не е добавен този час
                const alreadyExists = scheduleEntries.some(
                  e => e.scheduleEntry.periodIndex === entry.periodIndex && e.class._id === classDoc._id
                );
                if (alreadyExists) continue;

                let dayRegimeInfo: {
                  startTime: string;
                  endTime: string;
                  periodCount: number;
                  periods?: Array<{ periodNumber: number; startTime: string; duration: number; endTime: string }>;
                } | null = null;

                if (schedule.dayRegimeId) {
                  const regime = await ctx.db.get(schedule.dayRegimeId);
                  if (regime) {
                    dayRegimeInfo = {
                      startTime: regime.startTime,
                      endTime: regime.endTime,
                      periodCount: regime.periodCount,
                      periods: regime.periods,
                    };
                  }
                }

                // Определяме предмета
                let subjectDoc: Doc<"subjects"> | null = null;
                if (singleSub.isCivicEducation) {
                  subjectDoc = {
                    _id: "civic_education" as Id<"subjects">,
                    _creationTime: Date.now(),
                    name: "Гражданско образование",
                    shortName: "ГО",
                    isPrimary: false,
                    schoolId: classDoc.schoolId || ("" as Id<"schools">),
                  } as Doc<"subjects">;
                } else {
                  // Използваме оригиналния предмет от разписанието
                  subjectDoc = await ctx.db.get(entry.subjectId);
                }

                if (!subjectDoc) continue;

                // Проверяваме за съществуващ урок
                const existingLessons = await ctx.db
                  .query("lessons")
                  .withIndex("by_date", (q) => q.eq("date", normalizedDate))
                  .collect();

                const lesson = existingLessons.find(
                  (l) =>
                    l.classId === classDoc._id &&
                    l.periodIndex === entry.periodIndex
                );

                scheduleEntries.push({
                  scheduleEntry: {
                    dayOfWeek: dayOfWeek,
                    periodIndex: entry.periodIndex,
                    subjectId: subjectDoc._id,
                    teacherId: args.teacherId,
                    roomId: entry.roomId,
                  },
                  subject: {
                    ...subjectDoc,
                    name: subjectDoc.shortName || subjectDoc.name,
                  },
                  class: classDoc,
                  lesson: lesson ?? null,
                  dayRegime: dayRegimeInfo,
                  isSubstitution: true,
                  originalTeacherName: originalTeacherName,
                  isCivicEducation: singleSub.isCivicEducation || false,
                });
              }
            }
          }
        }
      }
      // Обработка на "multiple" тип заместване - различни заместници за различни часове
      else if (absence.substitutionType === "multiple") {
        for (const sub of absence.substitutions) {
          // Проверяваме дали този учител замества в този час
          // Проверка за конкретната дата на заместването
          const subDateMatches = sub.date === undefined || sub.date === normalizedDate;
          
          if (sub.teacherId === args.teacherId && !sub.isFree && sub.dayOfWeek === dayOfWeek && subDateMatches) {
            // Намираме класа от оригиналното разписание
            let classDoc: Doc<"classes"> | null = null;
            let dayRegimeInfo: {
              startTime: string;
              endTime: string;
              periodCount: number;
              periods?: Array<{ periodNumber: number; startTime: string; duration: number; endTime: string }>;
            } | null = null;

            // Търсим в разписанието на отсъстващия учител
            let originalScheduleEntry: {
              dayOfWeek: number;
              periodIndex: number;
              subjectId: Id<"subjects">;
              teacherId: Id<"teachers">;
              roomId?: Id<"rooms">;
            } | null = null;
            
            for (const schedule of allSchedules) {
              for (const entry of schedule.entries) {
                if (entry.teacherId === absence.teacherId && 
                    entry.dayOfWeek === dayOfWeek && 
                    entry.periodIndex === (sub.periodIndex !== undefined ? sub.periodIndex + 1 : 0)) {
                  classDoc = await ctx.db.get(schedule.classId);
                  originalScheduleEntry = entry;
                  
                  if (schedule.dayRegimeId) {
                    const regime = await ctx.db.get(schedule.dayRegimeId);
                    if (regime) {
                      dayRegimeInfo = {
                        startTime: regime.startTime,
                        endTime: regime.endTime,
                        periodCount: regime.periodCount,
                        periods: regime.periods,
                      };
                    }
                  }
                  break;
                }
              }
              if (classDoc) break;
            }

            if (!classDoc) continue;

            // Определяме предмета
            let subjectDoc: Doc<"subjects"> | null = null;
            if (sub.isCivicEducation) {
              subjectDoc = {
                _id: "civic_education" as Id<"subjects">,
                _creationTime: Date.now(),
                name: "Гражданско образование",
                shortName: "ГО",
                isPrimary: false,
                schoolId: classDoc.schoolId || ("" as Id<"schools">),
              } as Doc<"subjects">;
            } else if (sub.subjectId) {
              subjectDoc = await ctx.db.get(sub.subjectId);
            } else if (originalScheduleEntry) {
              // Fallback: използваме оригиналния предмет от разписанието
              subjectDoc = await ctx.db.get(originalScheduleEntry.subjectId);
            }

            if (!subjectDoc) continue;

            // Проверяваме дали вече не е добавен този час
            const periodIndex = sub.periodIndex !== undefined ? sub.periodIndex + 1 : 0;
            const alreadyExists = scheduleEntries.some(
              e => e.scheduleEntry.periodIndex === periodIndex && e.class._id === classDoc!._id
            );

            if (alreadyExists) continue;

            // Проверяваме за съществуващ урок
            const existingLessons = await ctx.db
              .query("lessons")
              .withIndex("by_date", (q) => q.eq("date", normalizedDate))
              .collect();

            const lesson = existingLessons.find(
              (l) =>
                l.classId === classDoc!._id &&
                l.periodIndex === periodIndex
            );

            scheduleEntries.push({
              scheduleEntry: {
                dayOfWeek: dayOfWeek,
                periodIndex: periodIndex,
                subjectId: subjectDoc._id,
                teacherId: args.teacherId,
                roomId: undefined,
              },
              subject: subjectDoc,
              class: classDoc,
              lesson: lesson ?? null,
              dayRegime: dayRegimeInfo,
              isSubstitution: true,
              originalTeacherName: originalTeacherName,
              isCivicEducation: sub.isCivicEducation || false,
            });
          }
        }
      }
    }

    // Deduplicate: for same class+period, if there's a group-specific entry, remove the non-group entry
    const deduplicatedEntries = scheduleEntries.filter((entry, _idx) => {
      // If this entry has no groupId, check if there's a group-specific entry for the same class+period
      if (!entry.scheduleEntry.groupId) {
        const hasGroupEntry = scheduleEntries.some(
          other => other !== entry &&
            other.class._id === entry.class._id &&
            other.scheduleEntry.periodIndex === entry.scheduleEntry.periodIndex &&
            other.scheduleEntry.subjectId === entry.scheduleEntry.subjectId &&
            other.scheduleEntry.groupId
        );
        if (hasGroupEntry) return false; // Skip non-group entry when group entry exists
      }
      return true;
    });

    return deduplicatedEntries.sort((a, b) => a.scheduleEntry.periodIndex - b.scheduleEntry.periodIndex);
  },
});

// GET /lessons/:id/details - Get full lesson details with students, grades, attendance, badges
export const getLessonDetails = query({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, args): Promise<{
    lesson: Doc<"lessons">;
    class: Doc<"classes">;
    subject: Doc<"subjects">;
    teacher: Doc<"teachers"> | null;
    teacherUser: Doc<"users"> | null;
    allTeacherUsers: Array<Doc<"users">>;
    students: Array<{
      student: Doc<"students">;
      user: Doc<"users">;
      attendance: Doc<"attendance"> | null;
      grades: Array<Doc<"grades">>;
      badges: Array<Doc<"badges">>;
    }>;
    curriculumTopics: Array<Doc<"curriculumTopics">>;
    groupInfo?: {
      groupId: Id<"classGroups">;
      name: string;
      groupType: string;
      studentCount: number;
    };
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
      throw new ConvexError({
        message: "Lesson not found",
        code: "NOT_FOUND",
      });
    }

    const classDoc = await ctx.db.get(lesson.classId);
    const subject = await ctx.db.get(lesson.subjectId);

    if (!classDoc || !subject) {
      throw new ConvexError({
        message: "Class or subject not found",
        code: "NOT_FOUND",
      });
    }

    // Get teacher and teacher user
    const teacher = await ctx.db.get(lesson.teacherId);
    const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;

    // Look up teachers for this slot from weekly schedules (for co-teaching classes)
    // Correctly distinguish between co-teaching and substitution:
    // - If lesson teacher IS in the schedule → co-teaching, show all schedule teachers
    // - If lesson teacher is NOT in the schedule → substitution, show only the lesson teacher
    const dateObj = new Date(lesson.date);
    const utcDow = dateObj.getUTCDay();
    const dayOfWeek = utcDow === 0 ? 7 : utcDow;

    // ── Term-aware schedule filtering ──
    const allClassSchedules = await ctx.db
      .query("weeklySchedules")
      .withIndex("by_class", (q) => q.eq("classId", lesson.classId))
      .collect();
    const allTermsForLesson = await ctx.db.query("terms").collect();
    const activeTermForLesson = allTermsForLesson.find(t => lesson.date >= t.startDate && lesson.date <= t.endDate);
    const schedules = allClassSchedules.filter(s => {
      if (!activeTermForLesson) return true;
      if (s.termId && s.termId !== activeTermForLesson._id) return false;
      return true;
    });
    
    const scheduleTeacherIds = new Set<string>();
    const scheduleTeacherUsers: Array<NonNullable<typeof teacherUser>> = [];
    for (const sched of schedules) {
      for (const entry of sched.entries) {
        if (
          entry.dayOfWeek === dayOfWeek &&
          entry.periodIndex === lesson.periodIndex &&
          entry.subjectId === lesson.subjectId &&
          !scheduleTeacherIds.has(entry.teacherId)
        ) {
          // If lesson has a groupId, only match entries with the same groupId
          if (lesson.groupId && entry.groupId && entry.groupId !== lesson.groupId) {
            continue;
          }
          // If lesson has groupId but entry doesn't, skip (don't mix general and group entries)
          if (lesson.groupId && !entry.groupId) {
            continue;
          }
          scheduleTeacherIds.add(entry.teacherId);
          const schedTeacher = await ctx.db.get(entry.teacherId);
          const schedUser = schedTeacher ? await ctx.db.get(schedTeacher.userId) : null;
          if (schedUser) scheduleTeacherUsers.push(schedUser);
        }
      }
    }
    
    // Decide which teachers to display:
    // If lesson teacher is one of the schedule teachers → regular/co-teaching → show all schedule teachers
    // If lesson teacher is NOT in the schedule → substitution → show only the lesson's actual teacher
    const isSubstitution = scheduleTeacherIds.size > 0 && !scheduleTeacherIds.has(lesson.teacherId);
    const allTeacherUsers: Array<NonNullable<typeof teacherUser>> = isSubstitution
      ? (teacherUser ? [teacherUser] : [])
      : (scheduleTeacherUsers.length > 0 ? scheduleTeacherUsers : (teacherUser ? [teacherUser] : []));

    // ── Group info resolution ──
    // First check if the lesson itself has a groupId, then fall back to schedule entry
    let resolvedGroupId: Id<"classGroups"> | undefined = lesson.groupId;
    if (!resolvedGroupId) {
      // Look up groupId from the schedule entry
      for (const sched of schedules) {
        for (const entry of sched.entries) {
          if (
            entry.dayOfWeek === dayOfWeek &&
            entry.periodIndex === lesson.periodIndex &&
            entry.subjectId === lesson.subjectId &&
            entry.groupId
          ) {
            resolvedGroupId = entry.groupId;
            break;
          }
        }
        if (resolvedGroupId) break;
      }
    }

    // Get group details if resolved
    let groupInfo: {
      groupId: Id<"classGroups">;
      name: string;
      groupType: string;
      studentCount: number;
    } | undefined;
    let groupStudentIds: Set<string> | undefined;

    if (resolvedGroupId) {
      const group = await ctx.db.get(resolvedGroupId);
      if (group) {
        groupInfo = {
          groupId: group._id,
          name: group.name,
          groupType: group.groupType,
          studentCount: group.studentIds.length,
        };
        groupStudentIds = new Set(group.studentIds);
      }
    }

    // Get all students in class
    const allClassStudents = await ctx.db
      .query("students")
      .withIndex("by_class", (q) => q.eq("classId", lesson.classId))
      .collect();

    // Filter students by group if applicable
    const students = groupStudentIds
      ? allClassStudents.filter(s => groupStudentIds!.has(s._id))
      : allClassStudents;

    const studentsWithData = (await Promise.all(
      students.map(async (student) => {
        const user = await ctx.db.get(student.userId);
        // Skip students with missing user records
        if (!user) {
          return null;
        }

        // Get attendance - use date range comparison for robustness
        const allAttendance = await ctx.db
          .query("attendance")
          .withIndex("by_student", (q) => q.eq("studentId", student._id))
          .collect();

        const lessonDateStart = new Date(lesson.date);
        lessonDateStart.setUTCHours(0, 0, 0, 0);
        const lessonDateEnd = new Date(lesson.date);
        lessonDateEnd.setUTCHours(23, 59, 59, 999);
        
        const attendance = allAttendance.find(
          (a) => a.date >= lessonDateStart.getTime() && 
                 a.date <= lessonDateEnd.getTime() && 
                 a.period === lesson.periodIndex
        );

        // Get grades for this lesson
        const allGrades = await ctx.db
          .query("grades")
          .withIndex("by_student", (q) => q.eq("studentId", student._id))
          .collect();

        const grades = allGrades.filter(
          (g) => g.lessonId === args.lessonId || (g.date === lesson.date && g.subjectId === lesson.subjectId)
        );

        // Get badges for this lesson
        const allBadges = await ctx.db
          .query("badges")
          .withIndex("by_student", (q) => q.eq("studentId", student._id))
          .collect();

        const badges = allBadges.filter((b) => b.lessonId === args.lessonId);

        return {
          student,
          user,
          attendance: attendance ?? null,
          grades,
          badges,
        };
      })
    )).filter((s): s is NonNullable<typeof s> => s !== null);

    // Sort students alphabetically by name for consistent numbering
    const sortedStudents = studentsWithData.sort((a, b) => {
      const nameA = a.user.name || `${a.user.firstName || ""} ${a.user.middleName || ""} ${a.user.lastName || ""}`.trim();
      const nameB = b.user.name || `${b.user.firstName || ""} ${b.user.middleName || ""} ${b.user.lastName || ""}`.trim();
      return nameA.localeCompare(nameB, "bg");
    });

    // Get curriculum topics
    const curriculumTopics = await ctx.db
      .query("curriculumTopics")
      .withIndex("by_class", (q) => q.eq("classId", lesson.classId))
      .collect();

    // Determine the preparation type for this lesson from the weekly schedule
    let lessonPrepType: string | undefined;
    for (const sched of schedules) {
      for (const entry of sched.entries) {
        if (
          entry.dayOfWeek === dayOfWeek &&
          entry.periodIndex === lesson.periodIndex &&
          entry.subjectId === lesson.subjectId
        ) {
          lessonPrepType = entry.preparationType;
          break;
        }
      }
      if (lessonPrepType !== undefined) break;
    }

    // Normalize preparation type for comparison
    const normalizePrep = (prep: string | undefined): string => {
      if (!prep || prep === "ЗП" || prep === "ООП") return "DEFAULT";
      return prep;
    };
    const normalizedLessonPrep = normalizePrep(lessonPrepType);

    // Show topics that are either:
    // 1. Not covered yet (matching subject AND preparation type), OR
    // 2. Already linked to THIS lesson (so they remain visible for editing)
    const filteredTopics = curriculumTopics
      .filter(
        (t) => t.subjectId === lesson.subjectId && 
               normalizePrep(t.preparationType) === normalizedLessonPrep &&
               (!t.isCovered || t.coveredByLessonId === args.lessonId)
      )
      .sort((a, b) => {
        // Sort by coveredDate descending (most recently covered first)
        // Uncovered topics go to the bottom, sorted by topicNumber descending
        const aCovered = a.isCovered && a.coveredDate ? a.coveredDate : 0;
        const bCovered = b.isCovered && b.coveredDate ? b.coveredDate : 0;
        if (aCovered && bCovered) {
          if (aCovered !== bCovered) return bCovered - aCovered;
          return b.topicNumber - a.topicNumber;
        }
        if (aCovered && !bCovered) return -1;
        if (!aCovered && bCovered) return 1;
        return b.topicNumber - a.topicNumber;
      });

    return {
      lesson,
      class: classDoc,
      subject,
      teacher,
      teacherUser,
      allTeacherUsers,
      students: sortedStudents,
      curriculumTopics: filteredTopics,
      groupInfo,
    };
  },
});

// GET /lessons/:id/lock-status - Get lock status for a lesson
export const getLessonLockStatus = query({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, args): Promise<{
    isLocked: boolean;
    lockTimeRemaining: number | null; // minutes remaining until locked (null if already locked or no lock setting)
    minutesAfterSaveToLock: number;
    markedAsTakenAt: number | null;
    canEdit: boolean; // true if current user can edit (admin can always edit)
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
      throw new ConvexError({
        message: "Lesson not found",
        code: "NOT_FOUND",
      });
    }

    // Get current user
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    const isAdmin = currentUser && (
      currentUser.role === "director" ||
      currentUser.role === "vice_director" ||
      currentUser.role === "system_admin" ||
      currentUser.roles?.includes("director") ||
      currentUser.roles?.includes("vice_director") ||
      currentUser.roles?.includes("system_admin")
    );

    // Get class and settings
    const classDoc = await ctx.db.get(lesson.classId);
    if (!classDoc?.schoolId) {
      return {
        isLocked: false,
        lockTimeRemaining: null,
        minutesAfterSaveToLock: 0,
        markedAsTakenAt: lesson.markedAsTakenAt ?? null,
        canEdit: true,
      };
    }

    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", classDoc.schoolId))
      .unique();

    const minutesAfterSaveToLock = settings?.minutesAfterSaveToLock ?? 0;

    // If no lock setting or lesson not taken, not locked
    if (minutesAfterSaveToLock === 0 || !lesson.isTaken || !lesson.markedAsTakenAt) {
      return {
        isLocked: false,
        lockTimeRemaining: null,
        minutesAfterSaveToLock,
        markedAsTakenAt: lesson.markedAsTakenAt ?? null,
        canEdit: true,
      };
    }

    const now = Date.now();
    const lockTime = lesson.markedAsTakenAt + (minutesAfterSaveToLock * 60 * 1000);
    const isLocked = now > lockTime;

    // Calculate remaining time until lock
    let lockTimeRemaining: number | null = null;
    if (!isLocked) {
      lockTimeRemaining = Math.ceil((lockTime - now) / (60 * 1000));
    }

    return {
      isLocked,
      lockTimeRemaining,
      minutesAfterSaveToLock,
      markedAsTakenAt: lesson.markedAsTakenAt,
      canEdit: !isLocked || !!isAdmin,
    };
  },
});

// POST /lessons/create-or-get - Create lesson or get existing
export const createOrGetLesson = mutation({
  args: {
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    teacherId: v.id("teachers"),
    date: v.number(),
    periodIndex: v.number(),
    groupId: v.optional(v.id("classGroups")),
  },
  handler: async (ctx, args): Promise<Id<"lessons">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get current user for tracking
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    // Normalize date to midnight UTC (args.date should already be a UTC timestamp)
    const date = new Date(args.date);
    const normalizedDate = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0);

    // Check if lesson already exists
    const existingLessons = await ctx.db
      .query("lessons")
      .withIndex("by_date", (q) => q.eq("date", normalizedDate))
      .collect();

    const existing = existingLessons.find(
      (l) =>
        l.classId === args.classId &&
        l.subjectId === args.subjectId &&
        l.periodIndex === args.periodIndex
    );

    if (existing) {
      return existing._id;
    }

    // Create new lesson with tracking fields
    const lessonId = await ctx.db.insert("lessons", {
      classId: args.classId,
      subjectId: args.subjectId,
      teacherId: args.teacherId,
      date: normalizedDate,
      periodIndex: args.periodIndex,
      groupId: args.groupId,
      hasUnsavedChanges: false,
      isTaken: false,
      educationType: "inPerson",
      createdBy: currentUser?._id,
    });

    return lessonId;
  },
});

// POST /lessons/:id/save-full - Save all lesson data at once
export const saveFullLessonData = mutation({
  args: {
    lessonId: v.id("lessons"),
    isTaken: v.boolean(),
    topic: v.optional(v.string()),
    lessonType: v.optional(v.string()), // Тип на урока: НЗ, УПР, ОС, ПК, К, Д
    educationType: v.optional(v.union(v.literal("inPerson"), v.literal("online"))), // Вид обучение
    curriculumTopicId: v.optional(v.id("curriculumTopics")), // Link to single curriculum topic (legacy support)
    curriculumTopicIds: v.optional(v.array(v.id("curriculumTopics"))), // Multiple curriculum topics
    studentData: v.array(
      v.object({
        studentId: v.id("students"),
        attendanceStatus: v.union(
          v.literal("present"),
          v.literal("absent"),
          v.literal("late"),
          v.literal("excused")
        ),
        grade: v.optional(
          v.object({
            value: v.number(),
            gradeType: v.string(),
          })
        ),
        badges: v.array(
          v.union(
            // Похвали (Praises) - 20 типа
            v.literal("general_praise"),
            v.literal("active_participation"),
            v.literal("excellent_presentation"),
            v.literal("completed_task"),
            v.literal("curiosity"),
            v.literal("diligence"),
            v.literal("progress"),
            v.literal("communication"),
            v.literal("sharp_mind"),
            v.literal("concentration"),
            v.literal("creativity"),
            v.literal("teamwork"),
            v.literal("leadership"),
            v.literal("patriotism"),
            v.literal("tolerance"),
            v.literal("emotional_intelligence"),
            v.literal("presentation_skills"),
            v.literal("digital_skills"),
            v.literal("musical_culture"),
            v.literal("physical_culture"),
            // Забележки (Remarks) - 20 типа
            v.literal("general_remark"),
            v.literal("bad_discipline"),
            v.literal("lack_of_attention"),
            v.literal("official_remark"),
            v.literal("disrespect"),
            v.literal("aggression"),
            v.literal("removed_from_class"),
            v.literal("late"),
            v.literal("absence"),
            v.literal("poor_performance"),
            v.literal("unprepared"),
            v.literal("no_homework"),
            v.literal("no_textbook"),
            v.literal("no_materials"),
            v.literal("no_equipment"),
            v.literal("no_uniform"),
            v.literal("breakfast"),
            v.literal("lunch"),
            v.literal("afternoon_sleep"),
            v.literal("afternoon_snack")
          )
        ),
      })
    ),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
      throw new ConvexError({
        message: "Lesson not found",
        code: "NOT_FOUND",
      });
    }

    // Get current user for tracking who marked the lesson
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    // ✅ LOCK CHECK: Check if lesson is locked for editing
    const classDoc = await ctx.db.get(lesson.classId);
    if (classDoc?.schoolId) {
      const settings = await ctx.db
        .query("platformSettings")
        .withIndex("by_school", (q) => q.eq("schoolId", classDoc.schoolId))
        .unique();
      
      const minutesAfterSaveToLock = settings?.minutesAfterSaveToLock ?? 0;
      
      // Check if lesson is already taken and has a markedAsTakenAt timestamp
      if (lesson.isTaken && lesson.markedAsTakenAt && minutesAfterSaveToLock > 0) {
        const now = Date.now();
        const lockTime = lesson.markedAsTakenAt + (minutesAfterSaveToLock * 60 * 1000);
        
        // If lock time has passed, check if user is admin
        if (now > lockTime) {
          const isAdmin = currentUser && (
            currentUser.role === "director" ||
            currentUser.role === "vice_director" ||
            currentUser.role === "system_admin" ||
            currentUser.roles?.includes("director") ||
            currentUser.roles?.includes("vice_director") ||
            currentUser.roles?.includes("system_admin")
          );
          
          if (!isAdmin) {
            const minutesPassed = Math.floor((now - lesson.markedAsTakenAt) / (60 * 1000));
            throw new ConvexError({
              message: `Часът е заключен за редакция. Изминали са ${minutesPassed} минути от запазването. Само администратор може да редактира заключени часове.`,
              code: "FORBIDDEN",
            });
          }
        }
      }
    }

    // ✅ ABSENCE CHECK: Block absent teachers from marking lessons as taken
    if (args.isTaken && currentUser) {
      const isAdmin = currentUser.role === "director" ||
        currentUser.role === "vice_director" ||
        currentUser.role === "system_admin" ||
        currentUser.roles?.includes("director") ||
        currentUser.roles?.includes("vice_director") ||
        currentUser.roles?.includes("system_admin");

      if (!isAdmin) {
        // Get the teacher record for current user
        const currentTeacher = await ctx.db
          .query("teachers")
          .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
          .first();

        if (currentTeacher) {
          // Check if this teacher has an active absence for the lesson date
          const absences = await ctx.db
            .query("absences")
            .filter((q) => q.eq(q.field("teacherId"), currentTeacher._id))
            .collect();

          for (const absence of absences) {
            // Check if lesson date is within absence period
            if (lesson.date >= absence.startDate && lesson.date <= absence.endDate) {
              // Get day of week from lesson date (1-5 for Mon-Fri)
              const lessonDateObj = new Date(lesson.date);
              const dayOfWeek = lessonDateObj.getUTCDay() === 0 ? 7 : lessonDateObj.getUTCDay();
              const periodIndex = lesson.periodIndex - 1; // Convert to 0-based

              // Check if teacher is a substitute for this specific slot (not absent teacher)
              
              if (absence.substitutions && absence.substitutions.length > 0) {
                // This teacher IS the absent teacher - check if someone else is substituting
                // If there's a substitution entry for this class/day/period, teacher cannot mark it
                const substitutionForSlot = absence.substitutions.find(
                  sub => sub.dayOfWeek === dayOfWeek && sub.periodIndex === periodIndex
                );

                if (substitutionForSlot) {
                  // There's a substitute assigned for this slot - original teacher cannot mark it
                  throw new ConvexError({
                    message: "Не можете да отбелязвате този час като взет, защото сте в отсъствие и е назначен заместник.",
                    code: "FORBIDDEN",
                  });
                }
              } else if (absence.substitutionType === "none") {
                // No substitute assigned - original teacher still cannot mark lessons during absence
                throw new ConvexError({
                  message: "Не можете да отбелязвате часове като взети по време на вашето отсъствие.",
                  code: "FORBIDDEN",
                });
              }
            }
          }
        }
      }
    }

    // ✅ PLATFORM SETTINGS: Check if topic is required when marking as taken
    if (args.isTaken && !lesson.isTaken) {
      if (classDoc?.schoolId) {
        const topicRequired = await ctx.runQuery(internal.platformSettings.checkLessonTopicRequired, {
          schoolId: classDoc.schoolId,
        });
        if (topicRequired && (!args.topic || args.topic.trim() === "")) {
          throw new ConvexError({
            message: "Темата на урока е задължителна за да бъде отбелязан като взет.",
            code: "BAD_REQUEST",
          });
        }

        // ✅ PLATFORM SETTINGS: Check time window for marking lesson as taken
        // First check if time window feature is enabled at all
        const settings = await ctx.db
          .query("platformSettings")
          .withIndex("by_school", (q) => q.eq("schoolId", classDoc.schoolId))
          .unique();
        
        const enableTimeWindow = settings?.enableLessonTimeWindow ?? true;
        
        // Only apply restrictions if time window is enabled
        if (enableTimeWindow) {
          const minutesBefore = settings?.minutesBeforeLessonCanMarkTaken ?? 0;
          const minutesAfter = settings?.minutesAfterLessonCanMarkTaken ?? 0;
          
          // Only apply time checks if at least one is set (not both 0)
          if (minutesBefore > 0 || minutesAfter > 0) {
            const now = new Date();
            const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
            const lessonDateStr = new Date(lesson.date).toISOString().split("T")[0];
            
            // ALWAYS block future lessons (different day than today)
            if (lessonDateStr > todayStr) {
              throw new ConvexError({
                message: `Не може да се маркира час за бъдеща дата (${lessonDateStr}). Часът може да бъде отбелязан само в деня на провеждане.`,
                code: "BAD_REQUEST",
              });
            }
            
            // If lesson is today, check the time window
            if (lessonDateStr === todayStr) {
              // Get day regime for this class to get lesson times
              const schedules = await ctx.db
                .query("weeklySchedules")
                .withIndex("by_class", (q) => q.eq("classId", lesson.classId))
                .collect();
              
              if (schedules.length > 0 && schedules[0].dayRegimeId) {
                const dayRegime = await ctx.db.get(schedules[0].dayRegimeId);
                if (dayRegime?.periods && dayRegime.periods.length >= lesson.periodIndex) {
                  const period = dayRegime.periods[lesson.periodIndex - 1];
                  if (period) {
                    const currentMinutes = now.getHours() * 60 + now.getMinutes();
                    const [startHour, startMin] = period.startTime.split(":").map(Number);
                    const [endHour, endMin] = period.endTime.split(":").map(Number);
                    const lessonStartMinutes = startHour * 60 + startMin;
                    const lessonEndMinutes = endHour * 60 + endMin;
                    
                    const windowStart = lessonStartMinutes - minutesBefore;
                    const windowEnd = lessonEndMinutes + minutesAfter;
                    
                    if (currentMinutes < windowStart) {
                      throw new ConvexError({
                        message: `Часът може да бъде отбелязан най-рано ${minutesBefore} минути преди началото му (${period.startTime}).`,
                        code: "BAD_REQUEST",
                      });
                    }
                    
                    if (currentMinutes > windowEnd) {
                      throw new ConvexError({
                        message: `Часът може да бъде отбелязан най-късно ${minutesAfter} минути след края му (${period.endTime}).`,
                        code: "BAD_REQUEST",
                      });
                    }
                  }
                }
              }
            }
            // Past lessons (lessonDateStr < todayStr) are allowed to be marked
          }
        }

        // ✅ PLATFORM SETTINGS: Check for missing absences warning
        const checkMissingAbsences = await ctx.runQuery(internal.platformSettings.checkMissingAbsencesEnabled, {
          schoolId: classDoc.schoolId,
        });
        if (checkMissingAbsences) {
          // Check if any student has an absence recorded for this lesson
          const hasAnyAbsence = args.studentData.some(
            (sd) => sd.attendanceStatus === "absent" || sd.attendanceStatus === "late" || sd.attendanceStatus === "excused"
          );
          if (!hasAnyAbsence && args.studentData.length > 0) {
            // This is just a warning, not a blocking error - we return it in the response
            // The frontend should display this as a warning but allow proceeding
            console.log("[SETTINGS] Warning: No absences marked for lesson - checkMissingAbsences is enabled");
          }
        }
      }
    }

    // Prepare lesson update
    const lessonUpdate: {
      isTaken: boolean;
      topic: string | undefined;
      lessonType: string | undefined;
      educationType?: "inPerson" | "online";
      hasUnsavedChanges: boolean;
      markedAsTakenAt?: number;
      markedAsTakenBy?: Id<"users">;
      lastEditedAt?: number;
      lastEditedBy?: Id<"users">;
      createdBy?: Id<"users">;
    } = {
      isTaken: args.isTaken,
      topic: args.topic,
      lessonType: args.lessonType,
      hasUnsavedChanges: false,
      lastEditedAt: Date.now(),
    };

    // Set educationType if provided
    if (args.educationType) {
      lessonUpdate.educationType = args.educationType;
    }

    // Set createdBy if not already set
    if (!lesson.createdBy && currentUser) {
      lessonUpdate.createdBy = currentUser._id;
    }

    // Set lastEditedBy
    if (currentUser) {
      lessonUpdate.lastEditedBy = currentUser._id;
    }

    // Only set markedAsTakenAt and markedAsTakenBy when marking as taken for the first time
    if (args.isTaken && !lesson.isTaken) {
      lessonUpdate.markedAsTakenAt = Date.now();
      if (currentUser) {
        lessonUpdate.markedAsTakenBy = currentUser._id;
      }
    }

    // Update lesson with simplified fields
    await ctx.db.patch(args.lessonId, lessonUpdate);

    // IMPORTANT: If lesson is being un-marked as taken (was taken, now not taken)
    // We need to mark any curriculum topics that were covered by this lesson as NOT covered
    // BUT we keep all grades, attendance, and badges - they are NOT deleted
    if (!args.isTaken && lesson.isTaken) {
      // Find all curriculum topics that were covered by this lesson
      const coveredTopics = await ctx.db
        .query("curriculumTopics")
        .withIndex("by_class_and_subject", (q) =>
          q.eq("classId", lesson.classId).eq("subjectId", lesson.subjectId)
        )
        .collect();
      
      // Unmark topics that were covered by this lesson
      for (const topic of coveredTopics) {
        if (topic.coveredByLessonId === args.lessonId && topic.isCovered) {
          await ctx.db.patch(topic._id, {
            isCovered: false,
            coveredDate: undefined,
            // Keep coveredByLessonId so we know which lesson it was associated with
          });
        }
      }
    }

    // Handle multiple curriculum topics if provided
    const topicIdsToMark: Id<"curriculumTopics">[] = [];
    
    // Support for multiple topics array
    if (args.curriculumTopicIds && args.curriculumTopicIds.length > 0) {
      topicIdsToMark.push(...args.curriculumTopicIds);
    }
    // Legacy support for single topic
    else if (args.curriculumTopicId) {
      topicIdsToMark.push(args.curriculumTopicId);
    }

    // Mark all selected curriculum topics as covered
    if (topicIdsToMark.length > 0 && args.isTaken) {
      for (const topicId of topicIdsToMark) {
        const curriculumTopic = await ctx.db.get(topicId);
        if (curriculumTopic && !curriculumTopic.isCovered) {
          await ctx.db.patch(topicId, {
            isCovered: true,
            coveredDate: lesson.date,
            coveredByLessonId: args.lessonId,
          });
        }
      }
    }
    
    // If no curriculum topics are provided but topic text is given and lesson is marked as taken,
    // create or link a curriculum topic automatically so it appears in the Topics module
    if (topicIdsToMark.length === 0 && args.topic && args.topic.trim() !== "" && args.isTaken) {
      // Determine preparationType from the weekly schedule entry for this lesson
      const lessonDateObj = new Date(lesson.date);
      const utcDow = lessonDateObj.getUTCDay();
      const lessonDayOfWeek = utcDow === 0 ? 7 : utcDow;
      
      const classSchedules = await ctx.db
        .query("weeklySchedules")
        .withIndex("by_class", (q) => q.eq("classId", lesson.classId))
        .collect();
      
      let lessonPrepType: string | undefined;
      for (const sched of classSchedules) {
        for (const entry of sched.entries) {
          if (
            entry.dayOfWeek === lessonDayOfWeek &&
            entry.periodIndex === lesson.periodIndex &&
            entry.subjectId === lesson.subjectId
          ) {
            lessonPrepType = entry.preparationType;
            break;
          }
        }
        if (lessonPrepType !== undefined) break;
      }
      
      // Normalize preparation type helper
      const normalizePrep = (prep: string | undefined): string => {
        if (!prep || prep === "ЗП" || prep === "ООП") return "DEFAULT";
        return prep;
      };
      const normalizedLessonPrep = normalizePrep(lessonPrepType);

      const existingTopics = await ctx.db
        .query("curriculumTopics")
        .withIndex("by_class_and_subject", (q) => 
          q.eq("classId", lesson.classId).eq("subjectId", lesson.subjectId)
        )
        .collect();
      
      // Filter existing topics by preparationType to avoid cross-contamination
      const existingTopicsForPrep = existingTopics.filter(
        t => normalizePrep(t.preparationType) === normalizedLessonPrep
      );
      
      const topicTextLower = args.topic.toLowerCase().trim();
      
      // Check if this lesson already has a linked curriculum topic with matching title
      const alreadyLinkedToThisLesson = existingTopicsForPrep.some(
        (t) => t.coveredByLessonId === args.lessonId && t.title.toLowerCase() === topicTextLower
      );
      
      if (!alreadyLinkedToThisLesson) {
        // Try to find an uncovered topic with the same title to link to this lesson
        const uncoveredMatch = existingTopicsForPrep.find(
          (t) => !t.isCovered && t.title.toLowerCase() === topicTextLower
        );
        
        if (uncoveredMatch) {
          // Link existing uncovered topic to this lesson
          await ctx.db.patch(uncoveredMatch._id, {
            isCovered: true,
            coveredDate: lesson.date,
            coveredByLessonId: args.lessonId,
          });
        } else {
          // No uncovered match found - check if topic exists but is covered by another lesson
          // (e.g. selected from "past taken topics"). In that case, create a new entry
          // so this lesson also shows its taken topic correctly.
          const topicExistsForDifferentLesson = existingTopicsForPrep.some(
            (t) => t.title.toLowerCase() === topicTextLower && t.coveredByLessonId !== args.lessonId
          );
          
          const topicDoesNotExist = !existingTopicsForPrep.some(
            (t) => t.title.toLowerCase() === topicTextLower
          );
          
          if (topicDoesNotExist || topicExistsForDifferentLesson) {
            // Get the class to determine academic year
            const classDocForYear = await ctx.db.get(lesson.classId);
            const academicYear = classDocForYear?.academicYear || "2024/2025";
            
            // Calculate the next topic number
            const nextTopicNumber = existingTopicsForPrep.length > 0
              ? Math.max(...existingTopicsForPrep.map(t => t.topicNumber)) + 1
              : 1;
            
            // Calculate week number based on date (approximate)
            const lessonDateForWeek = new Date(lesson.date);
            const startOfYear = new Date(lessonDateForWeek.getFullYear(), 8, 1); // September 1st
            const weekNumber = Math.ceil((lessonDateForWeek.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
            
            // Create the curriculum topic linked to this lesson, with correct preparationType
            await ctx.db.insert("curriculumTopics", {
              classId: lesson.classId,
              subjectId: lesson.subjectId,
              title: args.topic.trim(),
              topicNumber: nextTopicNumber,
              weekNumber: Math.max(1, Math.min(weekNumber, 36)), // Clamp between 1-36
              topicType: args.lessonType || "НЗ",
              academicYear,
              isCovered: true,
              coveredDate: lesson.date,
              coveredByLessonId: args.lessonId,
              preparationType: normalizedLessonPrep === "DEFAULT" ? undefined : lessonPrepType,
            });
          }
        }
      }
    }

    // Process each student
    for (const studentData of args.studentData) {
      // Update or create attendance - use date range comparison for robustness
      const existingAttendance = await ctx.db
        .query("attendance")
        .withIndex("by_student", (q) => q.eq("studentId", studentData.studentId))
        .collect();

      const lessonDateStart = new Date(lesson.date);
      lessonDateStart.setUTCHours(0, 0, 0, 0);
      const lessonDateEnd = new Date(lesson.date);
      lessonDateEnd.setUTCHours(23, 59, 59, 999);

      const attendance = existingAttendance.find(
        (a) => a.date >= lessonDateStart.getTime() && 
               a.date <= lessonDateEnd.getTime() && 
               a.period === lesson.periodIndex
      );

      if (attendance) {
        await ctx.db.patch(attendance._id, {
          status: studentData.attendanceStatus,
        });
      } else {
        await ctx.db.insert("attendance", {
          studentId: studentData.studentId,
          classId: lesson.classId,
          subjectId: lesson.subjectId,
          teacherId: lesson.teacherId,
          date: lesson.date,
          period: lesson.periodIndex,
          status: studentData.attendanceStatus,
        });
      }

      // Add grade if provided
      if (studentData.grade) {
        // Check if grade already exists
        const existingGrades = await ctx.db
          .query("grades")
          .withIndex("by_student", (q) => q.eq("studentId", studentData.studentId))
          .collect();

        const gradeForLesson = existingGrades.find(
          (g) => g.lessonId === args.lessonId
        );

        let gradeId: Id<"grades">;
        let isNewGrade = false;

        if (gradeForLesson) {
          await ctx.db.patch(gradeForLesson._id, {
            value: studentData.grade.value,
            gradeType: studentData.grade.gradeType,
          });
          gradeId = gradeForLesson._id;
        } else {
          gradeId = await ctx.db.insert("grades", {
            studentId: studentData.studentId,
            classId: lesson.classId,
            subjectId: lesson.subjectId,
            teacherId: lesson.teacherId,
            value: studentData.grade.value,
            type: "current",
            date: lesson.date,
            gradeType: studentData.grade.gradeType,
            lessonId: args.lessonId,
          });
          isNewGrade = true;
        }

        // ✅ PARENT NOTIFICATION: Send notifications only for new grades
        if (isNewGrade) {
          const subject = await ctx.db.get(lesson.subjectId);
          const studentRecord = await ctx.db.get(studentData.studentId);
          const studentUser = studentRecord ? await ctx.db.get(studentRecord.userId) : null;

          const studentName = studentUser 
            ? [studentUser.firstName, studentUser.lastName].filter(Boolean).join(" ")
            : "Вашето дете";

          // Find parents of this student
          const parentRecords = await ctx.db.query("parents").collect();
          const studentParents = parentRecords.filter(
            p => studentRecord && p.studentIds && p.studentIds.includes(studentRecord._id)
          );

          for (const parent of studentParents) {
            await ctx.db.insert("notifications", {
              userId: parent.userId,
              type: "new_grade",
              title: `Нова оценка за ${studentName}`,
              message: `${studentName} получи оценка ${studentData.grade.value} по ${subject?.name || "предмет"}`,
              isRead: false,
              relatedEntityType: "grade",
              relatedEntityId: gradeId,
              actionUrl: studentRecord ? `/bg/profile/${studentRecord.userId}` : undefined,
              schoolId: studentRecord?.schoolId,
            });
          }
        }
      }

      // Delete existing badges for this lesson
      const existingBadges = await ctx.db
        .query("badges")
        .withIndex("by_student", (q) => q.eq("studentId", studentData.studentId))
        .collect();

      const badgesForLesson = existingBadges.filter(
        (b) => b.lessonId === args.lessonId
      );

      // Store existing badge types to compare
      const existingBadgeTypes = badgesForLesson.map(b => b.type);

      for (const badge of badgesForLesson) {
        await ctx.db.delete(badge._id);
      }

      // Add new badges
      const newBadgeTypes = studentData.badges.filter(b => !existingBadgeTypes.includes(b));
      
      for (const badgeType of studentData.badges) {
        await ctx.db.insert("badges", {
          studentId: studentData.studentId,
          teacherId: lesson.teacherId,
          lessonId: args.lessonId,
          type: badgeType,
          date: lesson.date,
        });
      }

      // ✅ PARENT NOTIFICATION: Notify parents about new badges (praises/remarks)
      if (newBadgeTypes.length > 0) {
        const studentRecord = await ctx.db.get(studentData.studentId);
        const studentUser = studentRecord ? await ctx.db.get(studentRecord.userId) : null;

        const studentName = studentUser 
          ? [studentUser.firstName, studentUser.lastName].filter(Boolean).join(" ")
          : "Вашето дете";

        // Find parents of this student
        const parentRecords = await ctx.db.query("parents").collect();
        const studentParents = parentRecords.filter(
          p => studentRecord && p.studentIds && p.studentIds.includes(studentRecord._id)
        );

        // Determine if these are praises or remarks
        const praiseTypes = ["general_praise", "active_participation", "excellent_presentation", 
          "completed_task", "curiosity", "diligence", "progress", "communication", "sharp_mind",
          "concentration", "creativity", "teamwork", "leadership", "patriotism", "tolerance",
          "emotional_intelligence", "presentation_skills", "digital_skills", "musical_culture", "physical_culture"];
        
        const newPraises = newBadgeTypes.filter(b => praiseTypes.includes(b));
        const newRemarks = newBadgeTypes.filter(b => !praiseTypes.includes(b));

        for (const parent of studentParents) {
          if (newPraises.length > 0) {
            await ctx.db.insert("notifications", {
              userId: parent.userId,
              type: "new_praise",
              title: `Похвала за ${studentName}`,
              message: `${studentName} получи ${newPraises.length === 1 ? "похвала" : newPraises.length + " похвали"}`,
              isRead: false,
              relatedEntityType: "badge",
              actionUrl: studentRecord ? `/bg/profile/${studentRecord.userId}` : undefined,
              schoolId: studentRecord?.schoolId,
            });
          }
          
          if (newRemarks.length > 0) {
            await ctx.db.insert("notifications", {
              userId: parent.userId,
              type: "new_warning",
              title: `Забележка за ${studentName}`,
              message: `${studentName} получи ${newRemarks.length === 1 ? "забележка" : newRemarks.length + " забележки"}`,
              isRead: false,
              relatedEntityType: "badge",
              actionUrl: studentRecord ? `/bg/profile/${studentRecord.userId}` : undefined,
              schoolId: studentRecord?.schoolId,
            });
          }
        }
      }
    }
  },
});

// GET /lessons/:id/random-student - Get random student from lesson's class
export const getRandomStudent = query({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, args): Promise<{
    student: Doc<"students">;
    user: Doc<"users">;
    studentNumber: number;
  } | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
      throw new ConvexError({
        message: "Lesson not found",
        code: "NOT_FOUND",
      });
    }

    // Get all students in class
    const students = await ctx.db
      .query("students")
      .withIndex("by_class", (q) => q.eq("classId", lesson.classId))
      .collect();

    if (students.length === 0) {
      return null;
    }

    // Get user data for all students and sort alphabetically
    const studentsWithUsers = await Promise.all(
      students.map(async (student) => {
        const user = await ctx.db.get(student.userId);
        return { student, user };
      })
    );
    
    // Filter out students without user records and sort alphabetically
    const validStudents = studentsWithUsers.filter(
      (s): s is { student: Doc<"students">; user: Doc<"users"> } => s.user !== null
    ).sort((a, b) => {
      const nameA = a.user.name || `${a.user.firstName || ""} ${a.user.middleName || ""} ${a.user.lastName || ""}`.trim();
      const nameB = b.user.name || `${b.user.firstName || ""} ${b.user.middleName || ""} ${b.user.lastName || ""}`.trim();
      return nameA.localeCompare(nameB, "bg");
    });
    
    if (validStudents.length === 0) {
      return null;
    }

    // Pick a random student from the sorted list
    const randomIndex = Math.floor(Math.random() * validStudents.length);
    const { student: randomStudent, user } = validStudents[randomIndex];
    
    // Find the position of this student in the sorted list (1-based)
    const studentNumber = randomIndex + 1;
    
    return {
      student: randomStudent,
      user,
      studentNumber,
    };
  },
});


// GET /lessons - Get lessons for teacher on a specific date
export const list = query({
  args: {
    teacherId: v.id("teachers"),
    date: v.number(),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    Array<
      Doc<"lessons"> & {
        className: string;
        subjectName: string;
        studentCount: number;
        absentCount: number;
        gradeCount: number;
        badgeCount: number;
      }
    >
  > => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Normalize dates to midnight UTC for comparison (args.date should already be a UTC timestamp)
    const date = new Date(args.date);
    const normalizedDateTimestamp = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0);

    // Get lessons for this teacher and date
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_teacher", (q) => q.eq("teacherId", args.teacherId))
      .collect();

    const filteredLessons = lessons.filter((l) => l.date === normalizedDateTimestamp);

    // Enrich with stats
    const enrichedLessons = await Promise.all(
      filteredLessons.map(async (lesson) => {
        const classDoc = await ctx.db.get(lesson.classId);
        const subject = await ctx.db.get(lesson.subjectId);

        // Get students in class
        const students = await ctx.db
          .query("students")
          .withIndex("by_class", (q) => q.eq("classId", lesson.classId))
          .collect();

        // Get attendance for this lesson
        const attendance = await ctx.db
          .query("attendance")
          .withIndex("by_class", (q) => q.eq("classId", lesson.classId))
          .collect();

        const absentCount = attendance.filter(
          (a) =>
            a.date === lesson.date &&
            a.period === lesson.periodIndex &&
            (a.status === "absent" || a.status === "late")
        ).length;

        // Get grades for this lesson
        const grades = await ctx.db
          .query("grades")
          .withIndex("by_teacher", (q) => q.eq("teacherId", args.teacherId))
          .collect();

        const gradeCount = grades.filter(
          (g) => g.date === lesson.date && g.subjectId === lesson.subjectId
        ).length;

        // Get badges for this lesson
        const badges = await ctx.db
          .query("badges")
          .withIndex("by_lesson", (q) => q.eq("lessonId", lesson._id))
          .collect();

        return {
          ...lesson,
          className: classDoc?.name ?? "Unknown",
          subjectName: subject?.name ?? "Unknown",
          studentCount: students.length,
          absentCount,
          gradeCount,
          badgeCount: badges.length,
        };
      })
    );

    return enrichedLessons;
  },
});

// GET /lessons/past-topics - Get past taken lessons for a class and subject
export const getPastTopics = query({
  args: {
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
  },
  handler: async (ctx, args): Promise<Array<{
    _id: Id<"lessons">;
    date: number;
    topic: string;
    lessonType?: string;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get all taken lessons for this class and subject
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Filter for taken lessons with topics for this subject
    const pastTopics = lessons
      .filter((l) => l.isTaken && l.topic && l.subjectId === args.subjectId)
      .sort((a, b) => b.date - a.date) // Most recent first
      .slice(0, 20) // Limit to last 20 topics
      .map((l) => ({
        _id: l._id,
        date: l.date,
        topic: l.topic || "",
        lessonType: l.lessonType,
      }));

    return pastTopics;
  },
});

// PATCH /lessons/:id - Update lesson
export const update = mutation({
  args: {
    id: v.id("lessons"),
    topic: v.optional(v.string()),
    homework: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      hasUnsavedChanges: false,
    });
  },
});

// POST /lessons/:id/badges - Add badge to student
export const addBadge = mutation({
  args: {
    lessonId: v.id("lessons"),
    studentId: v.id("students"),
    teacherId: v.id("teachers"),
    type: v.union(
      // НОВИ 20 ТИПА - ФИНАЛНА ВЕРСИЯ
      // Забележки (Remarks) - само 20 типа, без похвали
      v.literal("general_remark"),
      v.literal("bad_discipline"),
      v.literal("lack_of_attention"),
      v.literal("official_remark"),
      v.literal("disrespect"),
      v.literal("aggression"),
      v.literal("removed_from_class"),
      v.literal("late"),
      v.literal("absence"),
      v.literal("poor_performance"),
      v.literal("unprepared"),
      v.literal("no_homework"),
      v.literal("no_textbook"),
      v.literal("no_materials"),
      v.literal("no_equipment"),
      v.literal("no_uniform"),
      v.literal("breakfast"),
      v.literal("lunch"),
      v.literal("afternoon_sleep"),
      v.literal("afternoon_snack")
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"badges">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
      throw new ConvexError({
        message: "Lesson not found",
        code: "NOT_FOUND",
      });
    }

    // Create badge
    const badgeId = await ctx.db.insert("badges", {
      studentId: args.studentId,
      teacherId: args.teacherId,
      lessonId: args.lessonId,
      type: args.type,
      date: lesson.date,
      notes: args.notes,
    });

    // TODO: Send notification to parent
    // This would be implemented with a notification system

    return badgeId;
  },
});

// POST /lessons/:id/confirm-no-absences - Confirm no students are absent
export const confirmNoAbsences = mutation({
  args: { id: v.id("lessons") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    await ctx.db.patch(args.id, {
      confirmedNoAbsences: true,
    });
  },
});

// DELETE /lessons/:id/data - Delete all data for lesson (grades, badges, attendance)
export const deleteLessonData = mutation({
  args: { id: v.id("lessons") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const lesson = await ctx.db.get(args.id);
    if (!lesson) {
      throw new ConvexError({
        message: "Lesson not found",
        code: "NOT_FOUND",
      });
    }

    // Delete all badges for this lesson
    const badges = await ctx.db
      .query("badges")
      .withIndex("by_lesson", (q) => q.eq("lessonId", args.id))
      .collect();

    for (const badge of badges) {
      await ctx.db.delete(badge._id);
    }

    // Delete all grades for this lesson
    const grades = await ctx.db
      .query("grades")
      .withIndex("by_date", (q) => q.eq("date", lesson.date))
      .collect();

    const lessonGrades = grades.filter(
      (g) =>
        g.subjectId === lesson.subjectId &&
        g.teacherId === lesson.teacherId &&
        g.classId === lesson.classId
    );

    for (const grade of lessonGrades) {
      await ctx.db.delete(grade._id);
    }

    // Delete all attendance for this lesson
    const attendance = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => q.eq("date", lesson.date))
      .collect();

    const lessonAttendance = attendance.filter(
      (a) =>
        a.period === lesson.periodIndex &&
        a.classId === lesson.classId &&
        a.subjectId === lesson.subjectId
    );

    for (const att of lessonAttendance) {
      await ctx.db.delete(att._id);
    }
  },
});

// Create lesson from schedule entry
export const createFromSchedule = mutation({
  args: {
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    periodIndex: v.number(),
    dayOfWeek: v.number(),
    date: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Id<"lessons">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Find the weekly schedule for this class
    const schedules = await ctx.db
      .query("weeklySchedules")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();
    
    if (schedules.length === 0) {
      throw new ConvexError({
        message: "No schedule found for this class",
        code: "NOT_FOUND",
      });
    }

    // Determine the target date first so we can filter schedules by term
    let lessonDate: number;
    if (args.date) {
      lessonDate = args.date;
    } else {
      const now = new Date();
      const currentDay = now.getUTCDay() === 0 ? 7 : now.getUTCDay();
      const daysToAdd = args.dayOfWeek - currentDay;
      const targetDate = new Date(now);
      targetDate.setUTCDate(targetDate.getUTCDate() + daysToAdd);
      lessonDate = Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0, 0);
    }

    // Normalize date to midnight UTC
    const dateN = new Date(lessonDate);
    const normalizedDate = Date.UTC(dateN.getUTCFullYear(), dateN.getUTCMonth(), dateN.getUTCDate(), 0, 0, 0, 0);

    // Filter schedules by active term for this date
    const classDoc = await ctx.db.get(args.classId);
    let filteredSchedules = schedules;
    if (classDoc) {
      const terms = await ctx.db
        .query("terms")
        .withIndex("by_school", (q) => q.eq("schoolId", classDoc.schoolId))
        .collect();
      const activeTerm = terms.find(t => normalizedDate >= t.startDate && normalizedDate <= t.endDate);
      if (activeTerm) {
        const termFiltered = schedules.filter(s => !s.termId || s.termId === activeTerm._id);
        if (termFiltered.length > 0) {
          filteredSchedules = termFiltered;
        }
      }
    }

    // Find the schedule entry for this specific period (from term-filtered schedules)
    let teacherId: Id<"teachers"> | null = null;
    for (const schedule of filteredSchedules) {
      const entry = schedule.entries.find(
        (e) => 
          e.dayOfWeek === args.dayOfWeek &&
          e.periodIndex === args.periodIndex &&
          e.subjectId === args.subjectId
      );
      if (entry) {
        teacherId = entry.teacherId;
        break;
      }
    }

    if (!teacherId) {
      throw new ConvexError({
        message: "No teacher found for this schedule entry",
        code: "NOT_FOUND",
      });
    }

    // Check if lesson already exists
    const existingLessons = await ctx.db
      .query("lessons")
      .withIndex("by_date", (q) => q.eq("date", normalizedDate))
      .collect();

    const existing = existingLessons.find(
      (l) =>
        l.classId === args.classId &&
        l.subjectId === args.subjectId &&
        l.periodIndex === args.periodIndex
    );

    if (existing) {
      return existing._id;
    }

    // Get current user for tracking
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    // Create new lesson with tracking
    const lessonId = await ctx.db.insert("lessons", {
      classId: args.classId,
      subjectId: args.subjectId,
      teacherId,
      date: normalizedDate,
      periodIndex: args.periodIndex,
      hasUnsavedChanges: false,
      isTaken: false,
      educationType: "inPerson",
      createdBy: currentUser?._id,
    });

    return lessonId;
  },
});

// GET /lessons/weekly-schedule-lessons - Get lessons from weekly schedule for a class and subject
export const getWeeklyScheduleLessonsForSubject = query({
  args: {
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
  },
  handler: async (ctx, args): Promise<Array<{
    dayOfWeek: number;
    periodIndex: number;
    teacherName: string;
    teacherId: Id<"teachers">;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get weekly schedules for this class
    const schedules = await ctx.db
      .query("weeklySchedules")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    const entries: Array<{
      dayOfWeek: number;
      periodIndex: number;
      teacherName: string;
      teacherId: Id<"teachers">;
    }> = [];

    for (const schedule of schedules) {
      for (const entry of schedule.entries) {
        if (entry.subjectId === args.subjectId) {
          // Get teacher name
          const teacher = await ctx.db.get(entry.teacherId);
          let teacherName = "-";
          if (teacher) {
            const teacherUser = await ctx.db.get(teacher.userId);
            if (teacherUser) {
              const firstName = teacherUser.firstName || "";
              const middleInitial = teacherUser.middleName ? ` ${teacherUser.middleName.charAt(0)}.` : "";
              const lastName = teacherUser.lastName || "";
              teacherName = `${firstName}${middleInitial} ${lastName}`.trim();
            }
          }

          entries.push({
            dayOfWeek: entry.dayOfWeek,
            periodIndex: entry.periodIndex,
            teacherName,
            teacherId: entry.teacherId,
          });
        }
      }
    }

    // Sort by day, then period
    return entries.sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return a.periodIndex - b.periodIndex;
    });
  },
});

// GET /lessons/schedule-entry-details - Get detailed information about a specific schedule entry
export const getScheduleEntryDetails = query({
  args: {
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    dayOfWeek: v.number(),
    periodIndex: v.number(),
    date: v.number(),
    teacherUserId: v.optional(v.string()), // Keep for backward compatibility but not used for filtering
    groupId: v.optional(v.id("classGroups")), // Filter by specific group when viewing group lesson
  },
  handler: async (ctx, args): Promise<{
    lessonId: Id<"lessons"> | null;
    className: string;
    subjectName: string;
    subjectShortName: string;
    groupInfo: string;
    studentCount: number;
    dateTime: string;
    educationType: string;
    markedAsTaken: string | null;
    markedAsTakenByName: string | null;
    lastEdited: string | null;
    lastEditedByName: string | null;
    createdAt: string | null;
    createdByName: string | null;
    teacherName: string | null;
    teacherNames: string[]; // All teachers for this entry
    actualTeacherName: string | null;
    isSubstitute: boolean;
    isFreeLesson: boolean;
    isCivicEducation: boolean;
    takenTopics: Array<{
      topicNumber: number;
      weekNumber: number;
      topicType: string;
      title: string;
    }>;
  } | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get class info
    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc) return null;

    // Get subject info
    const subject = await ctx.db.get(args.subjectId);
    if (!subject) return null;

    // Get student count for this class
    const students = await ctx.db
      .query("students")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();
    
    // Filter out students without valid user records
    const validStudents = await Promise.all(
      students.map(async (s) => {
        const user = await ctx.db.get(s.userId);
        return user ? s : null;
      })
    );
    const studentCount = validStudents.filter((s) => s !== null).length;

    // Get day regime to get period times
    const schedules = await ctx.db
      .query("weeklySchedules")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    let startTime = "";
    let endTime = "";
    if (schedules.length > 0 && schedules[0].dayRegimeId) {
      const regime = await ctx.db.get(schedules[0].dayRegimeId);
      if (regime && regime.periods && regime.periods.length > 0) {
        const periodInfo = regime.periods.find((p) => p.periodNumber === args.periodIndex);
        if (periodInfo) {
          startTime = periodInfo.startTime;
          endTime = periodInfo.endTime;
        }
      }
    }

    // Normalize date
    const dateObj = new Date(args.date);
    const normalizedDate = Date.UTC(
      dateObj.getUTCFullYear(),
      dateObj.getUTCMonth(),
      dateObj.getUTCDate(),
      0, 0, 0, 0
    );

    // Find the lesson for this date/period/class/subject
    const existingLessons = await ctx.db
      .query("lessons")
      .withIndex("by_date", (q) => q.eq("date", normalizedDate))
      .collect();

    const lesson = existingLessons.find(
      (l) =>
        l.classId === args.classId &&
        l.subjectId === args.subjectId &&
        l.periodIndex === args.periodIndex
    );

    // Get taken topics linked to this lesson
    const takenTopics: Array<{
      topicNumber: number;
      weekNumber: number;
      topicType: string;
      title: string;
    }> = [];

    if (lesson) {
      const topics = await ctx.db
        .query("curriculumTopics")
        .withIndex("by_class", (q) => q.eq("classId", args.classId))
        .collect();

      const linkedTopics = topics.filter(
        (t) => t.coveredByLessonId === lesson._id && t.subjectId === args.subjectId
      );

      for (const topic of linkedTopics) {
        takenTopics.push({
          topicNumber: topic.topicNumber,
          weekNumber: topic.weekNumber,
          topicType: topic.topicType,
          title: topic.title,
        });
      }
      
      // Fallback: if no curriculum topics are linked but lesson has topic text, show it
      if (takenTopics.length === 0 && lesson.topic && lesson.topic.trim() !== "") {
        takenTopics.push({
          topicNumber: 0,
          weekNumber: 0,
          topicType: lesson.lessonType || "НЗ",
          title: lesson.topic.trim(),
        });
      }
    }

    // Format date for display
    const displayDate = dateObj.toLocaleDateString("bg-BG", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    // Get ALL teachers for this schedule entry (not just one)
    const teacherNames: string[] = [];
    let firstTeacherId: Id<"teachers"> | null = null;
    let scheduleEntryGroupId: Id<"classGroups"> | undefined = args.groupId;
    
    if (schedules.length > 0) {
      // Find entries that match subject/day/period
      let matchingEntries = schedules[0].entries.filter(
        (e) => e.dayOfWeek === args.dayOfWeek && 
               e.periodIndex === args.periodIndex && 
               e.subjectId === args.subjectId
      );
      
      // If groupId is provided, narrow to only entries for that group
      if (args.groupId) {
        const groupFiltered = matchingEntries.filter(e => e.groupId === args.groupId);
        if (groupFiltered.length > 0) {
          matchingEntries = groupFiltered;
        }
      }
      
      // Get groupId from first matching entry if not already provided
      if (!scheduleEntryGroupId && matchingEntries.length > 0 && matchingEntries[0].groupId) {
        scheduleEntryGroupId = matchingEntries[0].groupId;
      }
      
      for (const entry of matchingEntries) {
        if (!firstTeacherId) {
          firstTeacherId = entry.teacherId;
        }
        const teacher = await ctx.db.get(entry.teacherId);
        if (teacher) {
          const teacherUser = await ctx.db.get(teacher.userId);
          if (teacherUser) {
            const firstName = teacherUser.firstName || "";
            const middleInitial = teacherUser.middleName ? ` ${teacherUser.middleName.charAt(0)}.` : "";
            const lastName = teacherUser.lastName || "";
            const fullName = `${firstName}${middleInitial} ${lastName}`.trim();
            if (fullName && !teacherNames.includes(fullName)) {
              teacherNames.push(fullName);
            }
          }
        }
      }
    }
    
    // For backward compatibility, set teacherName to first teacher or joined list
    const teacherName = teacherNames.length > 0 ? teacherNames.join(" | ") : null;

    // Check for teacher absence/substitution on this date (check first teacher only for simplicity)
    let actualTeacherName: string | null = teacherName;
    let isSubstitute = false;
    let isFreeLesson = false;
    let isCivicEducation = false;
    
    if (firstTeacherId) {
      // Check for absences that include this date
      const absences = await ctx.db
        .query("absences")
        .withIndex("by_teacher", (q) => q.eq("teacherId", firstTeacherId!))
        .collect();
      
      // Find absence that covers this date
      const activeAbsence = absences.find((absence) => {
        return absence.startDate <= normalizedDate && absence.endDate >= normalizedDate;
      });
      
      if (activeAbsence && activeAbsence.substitutions) {
        // Find specific substitution for this day/period
        const substitution = activeAbsence.substitutions.find((sub) => {
          // Match by dayOfWeek and periodIndex (0-based in absences, but we need to check)
          const subPeriodIndex = sub.periodIndex !== undefined ? sub.periodIndex : -1;
          return sub.dayOfWeek === args.dayOfWeek && 
                 (subPeriodIndex === args.periodIndex - 1 || subPeriodIndex === args.periodIndex);
        });
        
        if (substitution) {
          if (substitution.isFree) {
            isFreeLesson = true;
            actualTeacherName = "Свободен час";
          } else if (substitution.teacherId) {
            isSubstitute = true;
            isCivicEducation = substitution.isCivicEducation || false;
            const subTeacher = await ctx.db.get(substitution.teacherId);
            if (subTeacher) {
              const subTeacherUser = await ctx.db.get(subTeacher.userId);
              if (subTeacherUser) {
                const firstName = subTeacherUser.firstName || "";
                const middleInitial = subTeacherUser.middleName ? ` ${subTeacherUser.middleName.charAt(0)}.` : "";
                const lastName = subTeacherUser.lastName || "";
                actualTeacherName = `${firstName}${middleInitial} ${lastName}`.trim();
              }
            }
          }
        }
      }
    }

    // Get user who marked as taken
    let markedAsTakenByName: string | null = null;
    if (lesson?.markedAsTakenBy) {
      const markedByUser = await ctx.db.get(lesson.markedAsTakenBy);
      if (markedByUser) {
        const firstName = markedByUser.firstName || "";
        const middleInitial = markedByUser.middleName ? ` ${markedByUser.middleName.charAt(0)}.` : "";
        const lastName = markedByUser.lastName || "";
        markedAsTakenByName = `${firstName}${middleInitial} ${lastName}`.trim();
      }
    }

    // Helper function to format timestamp in Bulgarian timezone
    const formatBulgarianDateTime = (timestamp: number): string => {
      return new Date(timestamp).toLocaleString("bg-BG", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Europe/Sofia",
      });
    };

    // Get created by name - from lesson.createdBy or fall back to schedule creator
    let createdByName: string | null = null;
    let createdAt: string | null = null;
    
    if (lesson?.createdBy) {
      const createdByUser = await ctx.db.get(lesson.createdBy);
      if (createdByUser) {
        const firstName = createdByUser.firstName || "";
        const middleInitial = createdByUser.middleName ? ` ${createdByUser.middleName.charAt(0)}.` : "";
        const lastName = createdByUser.lastName || "";
        createdByName = `${firstName}${middleInitial} ${lastName}`.trim();
      }
      createdAt = formatBulgarianDateTime(lesson._creationTime);
    } else if (schedules.length > 0) {
      // Use schedule creation info as fallback
      const schedule = schedules[0];
      if (schedule.createdBy) {
        const scheduleCreator = await ctx.db.get(schedule.createdBy);
        if (scheduleCreator) {
          const firstName = scheduleCreator.firstName || "";
          const middleInitial = scheduleCreator.middleName ? ` ${scheduleCreator.middleName.charAt(0)}.` : "";
          const lastName = scheduleCreator.lastName || "";
          createdByName = `${firstName}${middleInitial} ${lastName}`.trim();
        }
      }
      createdAt = formatBulgarianDateTime(schedule._creationTime);
    }
    
    // Get last edited info - from lesson if available, or schedule
    let lastEdited: string | null = null;
    let lastEditedByName: string | null = null;
    
    if (lesson?.lastEditedAt && lesson?.lastEditedBy) {
      lastEdited = formatBulgarianDateTime(lesson.lastEditedAt);
      const lastEditedByUser = await ctx.db.get(lesson.lastEditedBy);
      if (lastEditedByUser) {
        const firstName = lastEditedByUser.firstName || "";
        const middleInitial = lastEditedByUser.middleName ? ` ${lastEditedByUser.middleName.charAt(0)}.` : "";
        const lastName = lastEditedByUser.lastName || "";
        lastEditedByName = `${firstName}${middleInitial} ${lastName}`.trim();
      }
    } else if (schedules.length > 0) {
      const schedule = schedules[0];
      if (schedule.lastEditedAt && schedule.lastEditedBy) {
        lastEdited = formatBulgarianDateTime(schedule.lastEditedAt);
        const scheduleEditor = await ctx.db.get(schedule.lastEditedBy);
        if (scheduleEditor) {
          const firstName = scheduleEditor.firstName || "";
          const middleInitial = scheduleEditor.middleName ? ` ${scheduleEditor.middleName.charAt(0)}.` : "";
          const lastName = scheduleEditor.lastName || "";
          lastEditedByName = `${firstName}${middleInitial} ${lastName}`.trim();
        }
      } else {
        // If no edit, show same as created
        lastEdited = createdAt;
        lastEditedByName = createdByName;
      }
    }

    // Build dateTime string with period time (without teacher name)
    let dateTimeStr = `${displayDate} г. / ${args.periodIndex} час`;

    // Determine group info
    let groupInfo = `Обща група за цялата паралелка - ${studentCount} ученици`;
    if (scheduleEntryGroupId) {
      const group = await ctx.db.get(scheduleEntryGroupId);
      if (group) {
        // Count students in this group
        const groupStudentCount = group.studentIds?.length ?? 0;
        const groupTypeLabel = group.groupType === "partial" ? "Частична" :
          group.groupType === "full_class" ? "Обща за паралелката" :
          group.groupType === "ifo" ? "ИФО" : group.groupType;
        groupInfo = `${group.name} (${groupTypeLabel}) - ${groupStudentCount} ученици`;
      }
    }

    return {
      lessonId: lesson?._id ?? null,
      className: classDoc.name,
      subjectName: subject.name,
      subjectShortName: subject.shortName || subject.name,
      groupInfo,
      studentCount,
      dateTime: dateTimeStr,
      educationType: lesson?.isTaken 
        ? (lesson.educationType === "inPerson" ? "Присъствено обучение" : "Дистанционно обучение")
        : "—",
      teacherName,
      teacherNames,
      actualTeacherName,
      isSubstitute,
      isFreeLesson,
      isCivicEducation,
      markedAsTaken: lesson?.markedAsTakenAt
        ? formatBulgarianDateTime(lesson.markedAsTakenAt)
        : null,
      markedAsTakenByName: lesson?.markedAsTakenAt ? markedAsTakenByName : null,
      lastEdited,
      lastEditedByName,
      createdAt,
      createdByName,
      takenTopics,
    };
  },
});

// GET /lessons/by-schedule-entry - Get or create lesson for schedule entry and date
export const getLessonByScheduleEntry = query({
  args: {
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    periodIndex: v.number(),
    dayOfWeek: v.number(), // 1=Monday, 5=Friday
    date: v.optional(v.number()), // If provided, get lesson for specific date
  },
  handler: async (ctx, args): Promise<Id<"lessons"> | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // If date provided, try to find lesson for that date
    if (args.date) {
      const normalizedDate = Date.UTC(
        new Date(args.date).getUTCFullYear(),
        new Date(args.date).getUTCMonth(),
        new Date(args.date).getUTCDate(),
        0,
        0,
        0,
        0
      );

      const existingLessons = await ctx.db
        .query("lessons")
        .withIndex("by_date", (q) => q.eq("date", normalizedDate))
        .collect();

      const lesson = existingLessons.find(
        (l) =>
          l.classId === args.classId &&
          l.subjectId === args.subjectId &&
          l.periodIndex === args.periodIndex
      );

      return lesson?._id ?? null;
    }

    // Otherwise, find the most recent lesson for this combination
    const allLessons = await ctx.db
      .query("lessons")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .order("desc")
      .take(100);

    const matchingLesson = allLessons.find(
      (l) =>
        l.subjectId === args.subjectId &&
        l.periodIndex === args.periodIndex &&
        new Date(l.date).getUTCDay() === (args.dayOfWeek === 7 ? 0 : args.dayOfWeek)
    );

    return matchingLesson?._id ?? null;
  },
});
