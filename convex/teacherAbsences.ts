import { query, mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel";

// Helper function to calculate working days between two dates
function calculateWorkingDays(startDate: number, endDate: number): number {
  let count = 0;
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

// Get all absences with full details
export const getAllAbsences = query({
  args: {},
  handler: async (ctx): Promise<Array<{
    _id: string;
    title: string;
    absentTeacher: string;
    absentTeacherId: string;
    teacherUserId: string;
    period: string;
    workingDays: number;
    substitutes: string;
    reason: string;
    substitutionType: "none" | "single" | "multiple";
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const absences = await ctx.db
      .query("absences")
      .order("desc")
      .collect();

    const result = await Promise.all(
      absences.map(async (absence) => {
        const teacher = await ctx.db.get(absence.teacherId);
        const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;
        const teacherName = teacherUser 
          ? `${teacherUser.firstName || ""} ${teacherUser.lastName || ""}`.trim()
          : "-";

        let substitutesText = "";
        if (absence.substitutionType === "none") {
          substitutesText = "Без заместник";
        } else if (absence.substitutionType === "single" && absence.substitutions && absence.substitutions.length > 0) {
          const sub = absence.substitutions[0];
          if (sub.isFree) {
            substitutesText = "Свободен час";
          } else if (sub.teacherId) {
            const subTeacher = await ctx.db.get(sub.teacherId);
            if (subTeacher) {
              const subUser = await ctx.db.get(subTeacher.userId);
              if (subUser) {
                substitutesText = `${subUser.firstName || ""} ${subUser.lastName || ""}`.trim();
              }
            }
          }
        } else if (absence.substitutionType === "multiple") {
          substitutesText = "Няколко заместници";
        }

        const startDate = new Date(absence.startDate);
        const endDate = new Date(absence.endDate);
        const period = `${startDate.toLocaleDateString('bg-BG')} - ${endDate.toLocaleDateString('bg-BG')} (${absence.workingDays} ${absence.workingDays === 1 ? 'работен ден' : 'работни дни'})`;

        return {
          _id: absence._id,
          title: absence.title,
          absentTeacher: teacherName,
          absentTeacherId: teacher?._id || "",
          teacherUserId: teacherUser?._id || "",
          period,
          workingDays: absence.workingDays,
          substitutes: substitutesText,
          reason: absence.reason,
          substitutionType: absence.substitutionType,
        };
      })
    );

    return result;
  },
});

// Get all teachers for selection
export const getAllTeachers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const teachers = await ctx.db.query("teachers").collect();
    
    // Get all weekly schedules to find subjects from schedule entries
    const allSchedules = await ctx.db.query("weeklySchedules").collect();
    
    // Build a map of teacherId -> Set of subjectIds from schedules
    const teacherScheduleSubjects = new Map<string, Set<string>>();
    for (const schedule of allSchedules) {
      for (const entry of schedule.entries) {
        const teacherIdStr = entry.teacherId as string;
        if (!teacherScheduleSubjects.has(teacherIdStr)) {
          teacherScheduleSubjects.set(teacherIdStr, new Set());
        }
        teacherScheduleSubjects.get(teacherIdStr)!.add(entry.subjectId as string);
      }
    }
    
    const result = await Promise.all(
      teachers.map(async (teacher) => {
        const user = await ctx.db.get(teacher.userId);
        if (!user) return null;
        
        // Filter out teachers without proper names
        if (!user.firstName?.trim() || !user.lastName?.trim()) return null;

        // Merge subjects from user.teacherSubjects AND schedule entries
        const userSubjectIds = new Set<string>(
          (user.teacherSubjects || []).map((id) => id as string)
        );
        const scheduleSubjectIds = teacherScheduleSubjects.get(teacher._id as string) || new Set<string>();
        const allSubjectIds = new Set<string>([...userSubjectIds, ...scheduleSubjectIds]);

        // Resolve subject short names
        const subjectNames = (await Promise.all(
          Array.from(allSubjectIds).map(async (subId) => {
            const subject = await ctx.db.get(subId as Id<"subjects">);
            return subject?.shortName || subject?.name || "";
          })
        )).filter((n: string) => n !== "");

        return {
          _id: teacher._id,
          userId: user._id,
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          specialization: teacher.specialization || "",
          subjectNames,
        };
      })
    );

    return result.filter((t) => t !== null);
  },
});

// Create new absence
export const createAbsence = mutation({
  args: {
    teacherId: v.id("teachers"),
    startDate: v.number(),
    endDate: v.number(),
    reason: v.string(),
    substitutionType: v.union(v.literal("none"), v.literal("single"), v.literal("multiple")),
    substitutions: v.optional(v.array(v.object({
      subjectId: v.optional(v.id("subjects")),
      teacherId: v.optional(v.id("teachers")),
      classId: v.optional(v.id("classes")),
      dayOfWeek: v.optional(v.number()),
      periodIndex: v.optional(v.number()),
      date: v.optional(v.number()),
      isCivicEducation: v.optional(v.boolean()),
      isFree: v.optional(v.boolean()),
    }))),
  },
  handler: async (ctx, args): Promise<string> => {
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

    // ✅ PLATFORM SETTINGS: Check if teachers can enter substitution
    if (currentUser?.schoolId) {
      const canEnter = await ctx.runQuery(internal.platformSettings.checkTeachersCanEnterSubstitution, {
        schoolId: currentUser.schoolId,
        userId: currentUser._id,
      });
      if (!canEnter) {
        throw new ConvexError({
          message: "Учителите нямат право да регистрират отсъствия. Моля, свържете се с администрацията.",
          code: "FORBIDDEN",
        });
      }
    }

    // Check for overlapping absences for the same teacher
    const existingAbsences = await ctx.db
      .query("absences")
      .filter((q) => q.eq(q.field("teacherId"), args.teacherId))
      .collect();

    for (const absence of existingAbsences) {
      // Check if date ranges overlap
      const overlaps = 
        (args.startDate >= absence.startDate && args.startDate <= absence.endDate) ||
        (args.endDate >= absence.startDate && args.endDate <= absence.endDate) ||
        (args.startDate <= absence.startDate && args.endDate >= absence.endDate);

      if (overlaps) {
        throw new ConvexError({
          message: `Учителят вече има отсъствие в този период (${new Date(absence.startDate).toLocaleDateString("bg-BG")} - ${new Date(absence.endDate).toLocaleDateString("bg-BG")})`,
          code: "CONFLICT",
        });
      }
    }

    // Keep all substitutions including free periods
    const finalSubstitutions = args.substitutions;

    // ✅ PLATFORM SETTINGS: Check if absent teachers can be substitutes
    if (finalSubstitutions && finalSubstitutions.length > 0 && currentUser?.schoolId) {
      const allowAbsentAsSubstitutes = await ctx.runQuery(internal.platformSettings.checkAbsentTeachersCanBeSubstitutes, {
        schoolId: currentUser.schoolId,
      });

      if (!allowAbsentAsSubstitutes) {
        // Check if any substitute teacher is also absent on the SPECIFIC DATE they would substitute
        for (const sub of finalSubstitutions) {
          if (sub.teacherId && !sub.isFree) {
            // Check if this substitute has any overlapping absence
            const substituteAbsences = await ctx.db
              .query("absences")
              .filter((q) => q.eq(q.field("teacherId"), sub.teacherId))
              .collect();

            for (const absence of substituteAbsences) {
              // Use the specific substitution date if available, otherwise check overall period
              const dateToCheck = sub.date;
              
              let isAbsentOnDate = false;
              
              if (dateToCheck !== undefined) {
                // Check if the substitute is absent on the SPECIFIC date of this substitution slot
                // Using date string comparison to avoid timezone issues
                const checkDateNoon = new Date(dateToCheck + 12 * 60 * 60 * 1000);
                const checkDateStr = `${checkDateNoon.getUTCFullYear()}-${String(checkDateNoon.getUTCMonth() + 1).padStart(2, '0')}-${String(checkDateNoon.getUTCDate()).padStart(2, '0')}`;
                
                const absStartNoon = new Date(absence.startDate + 12 * 60 * 60 * 1000);
                const absStartStr = `${absStartNoon.getUTCFullYear()}-${String(absStartNoon.getUTCMonth() + 1).padStart(2, '0')}-${String(absStartNoon.getUTCDate()).padStart(2, '0')}`;
                
                // End dates are stored at end-of-day (T21:59:59.999Z), so the UTC date is already the correct calendar date
                // Do NOT add noon offset for end dates as it would push to the next day
                const absEndDate = new Date(absence.endDate);
                const absEndStr = `${absEndDate.getUTCFullYear()}-${String(absEndDate.getUTCMonth() + 1).padStart(2, '0')}-${String(absEndDate.getUTCDate()).padStart(2, '0')}`;
                
                // Check if the substitution date is within the absence period
                isAbsentOnDate = checkDateStr >= absStartStr && checkDateStr <= absEndStr;
              } else {
                // Fallback: check overall period overlap (for single substitution type without specific date)
                isAbsentOnDate = 
                  (args.startDate >= absence.startDate && args.startDate <= absence.endDate) ||
                  (args.endDate >= absence.startDate && args.endDate <= absence.endDate) ||
                  (args.startDate <= absence.startDate && args.endDate >= absence.endDate);
              }

              if (isAbsentOnDate) {
                const subTeacher = await ctx.db.get(sub.teacherId);
                const subUser = subTeacher ? await ctx.db.get(subTeacher.userId) : null;
                const subName = subUser ? `${subUser.firstName || ""} ${subUser.lastName || ""}`.trim() : "Учител";
                
                // Format the specific date if available
                let dateInfo = "";
                if (sub.date !== undefined) {
                  const subDateNoon = new Date(sub.date + 12 * 60 * 60 * 1000);
                  dateInfo = ` на ${subDateNoon.getUTCDate()}.${String(subDateNoon.getUTCMonth() + 1).padStart(2, '0')}.${subDateNoon.getUTCFullYear()}`;
                }
                
                throw new ConvexError({
                  message: `${subName} не може да бъде заместник${dateInfo}, защото също отсъства на тази дата. Настройките на платформата не позволяват отсъстващи учители да бъдат заместници.`,
                  code: "BAD_REQUEST",
                });
              }
            }
          }
        }
      }
    }

    // Calculate working days
    const workingDays = calculateWorkingDays(args.startDate, args.endDate);

    // Get teacher info for title
    const teacher = await ctx.db.get(args.teacherId);
    const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;
    const teacherName = teacherUser 
      ? `${teacherUser.firstName || ""} ${teacherUser.lastName || ""}`.trim()
      : "Учител";

    // Create title with date
    const startDate = new Date(args.startDate);
    const endDate = new Date(args.endDate);
    const title = `Отсъствие #${Date.now().toString().slice(-6)}/${startDate.toLocaleDateString('bg-BG')}`;

    const absenceId = await ctx.db.insert("absences", {
      teacherId: args.teacherId,
      title,
      startDate: args.startDate,
      endDate: args.endDate,
      workingDays,
      reason: args.reason,
      isApproved: true, // Auto-approve for now
      createdBy: currentUser?._id,
      substitutionType: args.substitutionType,
      substitutions: finalSubstitutions && finalSubstitutions.length > 0 ? finalSubstitutions : undefined,
    });

    // Format period for notifications
    const period = `${startDate.toLocaleDateString('bg-BG')} - ${endDate.toLocaleDateString('bg-BG')}`;

    // Send notification to absent teacher
    if (teacherUser) {
      await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
        userId: teacherUser._id,
        type: "teacher_absence_approved",
        title: "Вашето отсъствие е регистрирано",
        message: `Вашето отсъствие от ${period} (${workingDays} ${workingDays === 1 ? 'работен ден' : 'работни дни'}) е одобрено. Причина: ${args.reason}`,
        relatedEntityType: "absence",
        relatedEntityId: absenceId,
        actionUrl: `/bg/lecture-hours/absence-schedule/${absenceId}`,
        schoolId: teacher?.schoolId,
      });
    }

    // Send notifications to substitute teachers (skip free periods)
    if (finalSubstitutions && finalSubstitutions.length > 0) {
      for (const substitution of finalSubstitutions) {
        // Skip free periods
        if (substitution.isFree || !substitution.teacherId) continue;
        
        const substituteTeacher = await ctx.db.get(substitution.teacherId);
        const substituteUser = substituteTeacher ? await ctx.db.get(substituteTeacher.userId) : null;
        
        if (substituteUser) {
          let subjectInfo = "";
          if (substitution.subjectId) {
            const subject = await ctx.db.get(substitution.subjectId);
            if (subject) {
              subjectInfo = ` по ${subject.name}`;
            }
          }

          await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
            userId: substituteUser._id,
            type: "teacher_substitution",
            title: "Заместване на учител",
            message: `Назначени сте да заместите ${teacherName}${subjectInfo} от ${period} (${workingDays} ${workingDays === 1 ? 'работен ден' : 'работни дни'}). Причина: ${args.reason}`,
            relatedEntityType: "absence",
            relatedEntityId: absenceId,
            actionUrl: `/bg/lecture-hours/absence-schedule/${absenceId}`,
            schoolId: substituteTeacher?.schoolId,
          });
        }
      }
    }

    return absenceId;
  },
});

// Update absence
export const updateAbsence = mutation({
  args: {
    absenceId: v.id("absences"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    reason: v.optional(v.string()),
    substitutionType: v.optional(v.union(v.literal("none"), v.literal("single"), v.literal("multiple"))),
    substitutions: v.optional(v.array(v.object({
      subjectId: v.optional(v.id("subjects")),
      teacherId: v.optional(v.id("teachers")),
      classId: v.optional(v.id("classes")),
      dayOfWeek: v.optional(v.number()),
      periodIndex: v.optional(v.number()),
      date: v.optional(v.number()),
      isCivicEducation: v.optional(v.boolean()),
      isFree: v.optional(v.boolean()),
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

    const absence = await ctx.db.get(args.absenceId);
    if (!absence) {
      throw new ConvexError({
        message: "Absence not found",
        code: "NOT_FOUND",
      });
    }

    // Keep all substitutions including free periods
    const finalSubstitutions = args.substitutions;

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};
    
    if (args.startDate !== undefined) {
      updates.startDate = args.startDate;
    }
    if (args.endDate !== undefined) {
      updates.endDate = args.endDate;
    }
    if (args.reason !== undefined) {
      updates.reason = args.reason;
    }
    if (args.substitutionType !== undefined) {
      updates.substitutionType = args.substitutionType;
    }
    if (finalSubstitutions !== undefined) {
      updates.substitutions = finalSubstitutions.length > 0 ? finalSubstitutions : undefined;
    }
    
    // Recalculate working days if dates changed
    if (args.startDate !== undefined || args.endDate !== undefined) {
      const start = args.startDate ?? absence.startDate;
      const end = args.endDate ?? absence.endDate;
      updates.workingDays = calculateWorkingDays(start, end);

      // Clean up substitutions whose specific date falls outside the new date range
      // Start dates are stored at midnight local (T22:00:00Z) - add noon offset to get correct calendar date
      const toStartDateStr = (ts: number): string => {
        const d = new Date(ts + 12 * 60 * 60 * 1000);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      };
      // End dates are stored at end-of-day (T21:59:59.999Z) - UTC date is already correct
      const toEndDateStr = (ts: number): string => {
        const d = new Date(ts);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      };
      // Substitution dates are stored at midnight UTC - noon offset is safe
      const toSubDateStr = (ts: number): string => {
        const d = new Date(ts + 12 * 60 * 60 * 1000);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      };

      // Use provided substitutions if present, otherwise clean existing ones
      const subsToClean = finalSubstitutions !== undefined
        ? (finalSubstitutions.length > 0 ? finalSubstitutions : [])
        : (absence.substitutions || []);

      if (subsToClean.length > 0) {
        const startStr = toStartDateStr(start);
        const endStr = toEndDateStr(end);

        const cleanedSubs = subsToClean.filter(sub => {
          if (sub.date === undefined) return true; // Keep substitutions without specific dates
          const subStr = toSubDateStr(sub.date);
          return subStr >= startStr && subStr <= endStr;
        });

        updates.substitutions = cleanedSubs.length > 0 ? cleanedSubs : undefined;
      }
    }

    await ctx.db.patch(args.absenceId, updates);
  },
});

// Delete absence
export const deleteAbsence = mutation({
  args: { absenceId: v.id("absences") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    await ctx.db.delete(args.absenceId);
  },
});

// Update absence substitutions
export const updateAbsenceSubstitutions = mutation({
  args: {
    absenceId: v.id("absences"),
    substitutions: v.array(v.object({
      subjectId: v.optional(v.id("subjects")),
      teacherId: v.optional(v.id("teachers")),
      classId: v.optional(v.id("classes")),
      dayOfWeek: v.optional(v.number()),
      periodIndex: v.optional(v.number()),
      date: v.optional(v.number()),
      isCivicEducation: v.optional(v.boolean()),
      isFree: v.optional(v.boolean()),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const absence = await ctx.db.get(args.absenceId);
    if (!absence) {
      throw new ConvexError({
        message: "Absence not found",
        code: "NOT_FOUND",
      });
    }

    // Update substitutions
    await ctx.db.patch(args.absenceId, {
      substitutions: args.substitutions,
    });
  },
});

// Get my substitutions
export const getMySubstitutions = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

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

    const teacher = await ctx.db
      .query("teachers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();

    if (!teacher) {
      return [];
    }

    // Find all absences where current teacher is a substitute
    const allAbsences = await ctx.db.query("absences").collect();
    
    const mySubstitutions = [];
    
    for (const absence of allAbsences) {
      if (!absence.substitutions) continue;
      
      const isSubstitute = absence.substitutions.some(sub => sub.teacherId === teacher._id);
      
      if (isSubstitute) {
        const absentTeacher = await ctx.db.get(absence.teacherId);
        const absentUser = absentTeacher ? await ctx.db.get(absentTeacher.userId) : null;
        const absentTeacherName = absentUser 
          ? `${absentUser.firstName || ""} ${absentUser.lastName || ""}`.trim()
          : "-";

        const startDate = new Date(absence.startDate);
        const endDate = new Date(absence.endDate);
        const period = `${startDate.toLocaleDateString('bg-BG')} - ${endDate.toLocaleDateString('bg-BG')} (${absence.workingDays} ${absence.workingDays === 1 ? 'работен ден' : 'работни дни'})`;

        mySubstitutions.push({
          _id: absence._id,
          title: absence.title,
          period,
          absentTeacher: absentTeacherName,
          reason: absence.reason,
        });
      }
    }

    return mySubstitutions;
  },
});

// Get absences for a specific week and class (only returns absences that affect this class)
export const getAbsencesForWeek = query({
  args: { 
    startDate: v.number(),
    endDate: v.number(),
    classId: v.optional(v.id("classes")),
  },
  handler: async (ctx, args): Promise<Array<{
    _id: string;
    teacherId: string | undefined;
    teacherName: string;
    teacherUserId?: string;
    teacherFirstName?: string;
    teacherMiddleName?: string;
    teacherLastName?: string;
    startDate: number;
    endDate: number;
    reason: string;
    substitutionType: "none" | "single" | "multiple";
    affectedEntries: Array<{
      dayOfWeek: number;
      periodIndex: number;
      subjectName: string;
      substituteTeacherName: string | null;
      substituteTeacherUserId?: string;
      substituteTeacherFirstName?: string;
      substituteTeacherMiddleName?: string;
      substituteTeacherLastName?: string;
      isCivicEducation?: boolean;
      isFree?: boolean;
    }>;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get all absences
    const allAbsences = await ctx.db.query("absences").collect();
    
    // Filter absences that overlap with this week
    const weekAbsences: Array<{
      _id: string;
      teacherId: string | undefined;
      teacherName: string;
      teacherUserId?: string;
      teacherFirstName?: string;
      teacherMiddleName?: string;
      teacherLastName?: string;
      startDate: number;
      endDate: number;
      reason: string;
      substitutionType: "none" | "single" | "multiple";
      affectedEntries: Array<{
        dayOfWeek: number;
        periodIndex: number;
        subjectName: string;
        substituteTeacherName: string | null;
        substituteTeacherUserId?: string;
        substituteTeacherFirstName?: string;
        substituteTeacherMiddleName?: string;
        substituteTeacherLastName?: string;
        isCivicEducation?: boolean;
        isFree?: boolean;
      }>;
    }> = [];
    
    for (const absence of allAbsences) {
      // Check if absence overlaps with week
      const absenceStart = absence.startDate;
      const absenceEnd = absence.endDate;
      const weekStart = args.startDate;
      const weekEnd = args.endDate;
      
      // Check overlap: absence starts before week ends AND absence ends after week starts
      if (absenceStart <= weekEnd && absenceEnd >= weekStart) {
        const teacher = await ctx.db.get(absence.teacherId);
        const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;
        
        // Get teacher's schedule entries for this class (if classId provided)
        let affectedEntries: Array<{ dayOfWeek: number; periodIndex: number; subjectName: string; substituteTeacherName: string | null; substituteTeacherUserId?: string; substituteTeacherFirstName?: string; substituteTeacherMiddleName?: string; substituteTeacherLastName?: string; isCivicEducation?: boolean; isFree?: boolean }> = [];
        
        if (args.classId && teacher) {
          // Get weekly schedule for this class (term-aware)
          const classSchedulesRaw = await ctx.db
            .query("weeklySchedules")
            .withIndex("by_class", (q) => q.eq("classId", args.classId!))
            .collect();
          const termsForWeek = await ctx.db.query("terms").collect();
          const activeTermForWeek = termsForWeek.find(t => args.startDate >= t.startDate && args.startDate <= t.endDate);
          const classSchedules = classSchedulesRaw.filter(s => {
            if (!activeTermForWeek) return true;
            if (s.termId && s.termId !== activeTermForWeek._id) return false;
            return true;
          });
          
          if (classSchedules.length > 0) {
            const schedule = classSchedules[0];
            
            // Find entries where this teacher teaches
            for (const entry of schedule.entries) {
              if (entry.teacherId === teacher._id && entry.dayOfWeek >= 1 && entry.dayOfWeek <= 5) {
                const subject = await ctx.db.get(entry.subjectId);
                
                // Calculate the specific date for this day of week in this week
                // Input weekStart is UTC midnight, so we work with UTC throughout
                
                // Helper to get Monday of a given date using UTC methods
                const getMondayOfWeekUtc = (timestamp: number): Date => {
                  const d = new Date(timestamp);
                  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
                  const diff = (day === 0 ? -6 : 1) - day;
                  d.setUTCDate(d.getUTCDate() + diff);
                  d.setUTCHours(0, 0, 0, 0);
                  return d;
                };
                
                // Get the Monday of the week using UTC
                const mondayUtc = getMondayOfWeekUtc(weekStart);
                
                // Calculate target date for this day of week (entry.dayOfWeek: 1=Mon, 5=Fri)
                const targetDate = new Date(mondayUtc.getTime() + (entry.dayOfWeek - 1) * 24 * 60 * 60 * 1000);
                const targetTimestamp = targetDate.getTime();
                
                // Check if this specific date is within the absence period
                // Use YYYY-MM-DD string comparison to avoid timezone issues
                const targetDateNoon = new Date(targetTimestamp + 12 * 60 * 60 * 1000);
                const targetStr = `${targetDateNoon.getUTCFullYear()}-${String(targetDateNoon.getUTCMonth() + 1).padStart(2, '0')}-${String(targetDateNoon.getUTCDate()).padStart(2, '0')}`;
                
                const absStartNoon = new Date(absenceStart + 12 * 60 * 60 * 1000);
                const absStartStr = `${absStartNoon.getUTCFullYear()}-${String(absStartNoon.getUTCMonth() + 1).padStart(2, '0')}-${String(absStartNoon.getUTCDate()).padStart(2, '0')}`;
                
                // End dates are stored at end-of-day (T21:59:59.999Z) - UTC date is already the correct calendar date
                // Do NOT add noon offset for end dates as it would push to the next day
                const absEndDate = new Date(absenceEnd);
                const absEndStr = `${absEndDate.getUTCFullYear()}-${String(absEndDate.getUTCMonth() + 1).padStart(2, '0')}-${String(absEndDate.getUTCDate()).padStart(2, '0')}`;
                
                if (targetStr < absStartStr || targetStr > absEndStr) {
                  continue; // This specific day is outside the absence period
                }
                
                // Find substitute for this entry
                let substituteTeacherName: string | null = null;
                let substituteTeacherUserId: string | undefined = undefined;
                let substituteTeacherFirstName: string | undefined = undefined;
                let substituteTeacherMiddleName: string | undefined = undefined;
                let substituteTeacherLastName: string | undefined = undefined;
                let isCivicEducation = false;
                let isFree = false;
                let hasSubstitution = false;
                
                if (absence.substitutions && absence.substitutions.length > 0) {
                  if (absence.substitutionType === "single") {
                    // Single substitute for all classes
                    hasSubstitution = true;
                    if (absence.substitutions[0].isFree) {
                      isFree = true;
                    } else if (absence.substitutions[0].teacherId) {
                      const subTeacher = await ctx.db.get(absence.substitutions[0].teacherId);
                      if (subTeacher) {
                        const subUser = await ctx.db.get(subTeacher.userId);
                        if (subUser) {
                          substituteTeacherName = `${subUser.firstName || ""} ${subUser.lastName || ""}`.trim();
                          substituteTeacherUserId = subUser._id;
                          substituteTeacherFirstName = subUser.firstName || undefined;
                          substituteTeacherMiddleName = subUser.middleName || undefined;
                          substituteTeacherLastName = subUser.lastName || undefined;
                        }
                      }
                    }
                    isCivicEducation = absence.substitutions[0].isCivicEducation || false;
                  } else if (absence.substitutionType === "multiple") {
                    // Multiple substitutes - match by classId, dayOfWeek, periodIndex AND date
                    const substitution = absence.substitutions.find(sub => {
                      // Check classId if present (for backwards compatibility, allow missing classId)
                      if (sub.classId && sub.classId !== schedule.classId) {
                        return false;
                      }
                      
                      // entry.periodIndex is 1-based, sub.periodIndex is 0-based
                      // So entry.periodIndex - 1 should equal sub.periodIndex
                      if (sub.dayOfWeek !== entry.dayOfWeek || sub.periodIndex !== (entry.periodIndex - 1)) {
                        return false;
                      }
                      
                      // Compare timestamps directly - both should be UTC midnight
                      if (sub.date !== undefined) {
                        return sub.date === targetTimestamp;
                      }
                      return false;
                    });
                    
                    if (substitution) {
                      hasSubstitution = true;
                      if (substitution.isFree) {
                        isFree = true;
                      } else if (substitution.teacherId) {
                        const subTeacher = await ctx.db.get(substitution.teacherId);
                        if (subTeacher) {
                          const subUser = await ctx.db.get(subTeacher.userId);
                          if (subUser) {
                            substituteTeacherName = `${subUser.firstName || ""} ${subUser.lastName || ""}`.trim();
                            substituteTeacherUserId = subUser._id;
                            substituteTeacherFirstName = subUser.firstName || undefined;
                            substituteTeacherMiddleName = subUser.middleName || undefined;
                            substituteTeacherLastName = subUser.lastName || undefined;
                          }
                        }
                      }
                      isCivicEducation = substitution.isCivicEducation || false;
                    }
                  }
                }
                
                // Only add to affected entries if there's an EXPLICIT substitution defined
                // (either substitute teacher, civic education, or free period)
                // If no substitution is defined, the original teacher will come to teach that specific class
                if (hasSubstitution) {
                  affectedEntries.push({
                    dayOfWeek: entry.dayOfWeek,
                    periodIndex: entry.periodIndex - 1,
                    subjectName: subject?.shortName || subject?.name || "Unknown",
                    substituteTeacherName,
                    substituteTeacherUserId,
                    substituteTeacherFirstName,
                    substituteTeacherMiddleName,
                    substituteTeacherLastName,
                    isCivicEducation,
                    isFree,
                  });
                }
              }
            }
          }
        }
        
        // Only add absence if it actually affects this class (has entries)
        if (!args.classId || affectedEntries.length > 0) {
          weekAbsences.push({
            _id: absence._id,
            teacherId: teacher?._id,
            teacherName: teacherUser ? `${teacherUser.firstName || ""} ${teacherUser.lastName || ""}`.trim() : "-",
            teacherUserId: teacherUser?._id,
            teacherFirstName: teacherUser?.firstName || undefined,
            teacherMiddleName: teacherUser?.middleName || undefined,
            teacherLastName: teacherUser?.lastName || undefined,
            startDate: absence.startDate,
            endDate: absence.endDate,
            reason: absence.reason,
            substitutionType: absence.substitutionType,
            affectedEntries,
          });
        }
      }
    }
    
    return weekAbsences;
  },
});

// Get absences for a specific user's schedule
export const getAbsencesForUserSchedule = query({
  args: {
    userId: v.id("users"),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args): Promise<Array<{
    _id: string;
    teacherId: string | undefined;
    teacherName: string;
    teacherUserId?: string;
    teacherFirstName?: string;
    teacherMiddleName?: string;
    teacherLastName?: string;
    startDate: number;
    endDate: number;
    reason: string;
    substitutionType: "none" | "single" | "multiple";
    affectedEntries: Array<{
      dayOfWeek: number;
      periodIndex: number;
      subjectName: string;
      substituteTeacherName: string | null;
      isCivicEducation?: boolean;
      isFree?: boolean;
      isSubstitute?: boolean;
      className?: string;
      classId?: string;
      subjectId?: string;
    }>;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      return [];
    }

    const weekAbsences: Array<{
      _id: string;
      teacherId: string | undefined;
      teacherName: string;
      teacherUserId?: string;
      teacherFirstName?: string;
      teacherMiddleName?: string;
      teacherLastName?: string;
      startDate: number;
      endDate: number;
      reason: string;
      substitutionType: "none" | "single" | "multiple";
      affectedEntries: Array<{
        dayOfWeek: number;
        periodIndex: number;
        subjectName: string;
        substituteTeacherName: string | null;
        isCivicEducation?: boolean;
        isFree?: boolean;
        isSubstitute?: boolean;
        className?: string;
        classId?: string;
        subjectId?: string;
      }>;
    }> = [];

    // Check if user is a teacher
    const teacherRecord = await ctx.db
      .query("teachers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    // ✅ PLATFORM SETTING: Get substitutesAccessDays setting
    let substitutesAccessDays = 10; // Default value
    if (user.schoolId) {
      const settings = await ctx.db
        .query("platformSettings")
        .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
        .unique();
      substitutesAccessDays = settings?.substitutesAccessDays ?? 10;
    }

    if (teacherRecord) {
      // Get absences where this teacher is absent
      const absences = await ctx.db
        .query("absences")
        .filter((q) => 
          q.and(
            q.eq(q.field("teacherId"), teacherRecord._id),
            q.gte(q.field("endDate"), args.startDate),
            q.lte(q.field("startDate"), args.endDate)
          )
        )
        .collect();

      for (const absence of absences) {
        const teacherUser = await ctx.db.get(teacherRecord.userId);
        const affectedEntries: Array<{
          dayOfWeek: number;
          periodIndex: number;
          subjectName: string;
          substituteTeacherName: string | null;
          isCivicEducation?: boolean;
          isFree?: boolean;
          isSubstitute?: boolean;
          className?: string;
          classId?: string;
          subjectId?: string;
        }> = [];

        // Find all schedule entries where this teacher teaches
        const schedulesRaw = await ctx.db
          .query("weeklySchedules")
          .collect();
        
        // ── Term-aware schedule filtering ──
        const allTermsForAbsence = await ctx.db.query("terms").collect();
        const activeTermForAbsence = allTermsForAbsence.find(t => args.startDate >= t.startDate && args.startDate <= t.endDate);
        const schedules = schedulesRaw.filter(s => {
          if (!activeTermForAbsence) return true;
          if (s.termId && s.termId !== activeTermForAbsence._id) return false;
          return true;
        });

        for (const schedule of schedules) {
          for (const entry of schedule.entries) {
            if (entry.teacherId === teacherRecord._id && entry.dayOfWeek >= 1 && entry.dayOfWeek <= 5) {
              // Calculate the specific date for this day of week in the viewed week
              // Use args.startDate directly (week start from client) and add day offsets in ms
              // This avoids timezone issues since toDateStr adds 12h to handle UTC offsets
              const MS_PER_DAY = 86400000;
              const specificDateTimestamp = args.startDate + (entry.dayOfWeek - 1) * MS_PER_DAY;
              
              // Check if this specific date is within the absence period
              const toDateStr = (ts: number): string => {
                const d = new Date(ts + 12 * 60 * 60 * 1000);
                return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
              };
              // End dates are stored at end-of-day (T21:59:59.999Z) - UTC date is already correct
              const toEndDateStr = (ts: number): string => {
                const d = new Date(ts);
                return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
              };
              
              const specificStr = toDateStr(specificDateTimestamp);
              const absStartStr = toDateStr(absence.startDate);
              const absEndStr = toEndDateStr(absence.endDate);
              
              if (specificStr < absStartStr || specificStr > absEndStr) {
                continue; // This specific day is outside the absence period
              }
              
              const subject = await ctx.db.get(entry.subjectId);
              
              // Find substitute for this entry
              let subName: string | null = null;
              let isCivicEducation = false;
              let isFree = false;
              let hasSubstitution = false;
              
              if (absence.substitutions && absence.substitutions.length > 0) {
                if (absence.substitutionType === "single") {
                  // Single substitute for all classes
                  hasSubstitution = true;
                  if (absence.substitutions[0].isFree) {
                    isFree = true;
                  } else if (absence.substitutions[0].teacherId) {
                    const subTeacher = await ctx.db.get(absence.substitutions[0].teacherId);
                    if (subTeacher) {
                      const subUser = await ctx.db.get(subTeacher.userId);
                      if (subUser) {
                        subName = `${subUser.firstName || ""} ${subUser.lastName || ""}`.trim();
                      }
                    }
                  }
                  isCivicEducation = absence.substitutions[0].isCivicEducation || false;
                } else if (absence.substitutionType === "multiple") {
                  // Multiple substitutes - match by dayOfWeek, periodIndex AND date
                  // For user schedule view, we're showing generic week view, so we match any substitution with same day/period
                  const substitution = absence.substitutions.find(
                    sub => sub.dayOfWeek === entry.dayOfWeek && sub.periodIndex === entry.periodIndex - 1
                  );
                  
                  if (substitution) {
                    hasSubstitution = true;
                    if (substitution.isFree) {
                      isFree = true;
                    } else if (substitution.teacherId) {
                      const subTeacher = await ctx.db.get(substitution.teacherId);
                      if (subTeacher) {
                        const subUser = await ctx.db.get(subTeacher.userId);
                        if (subUser) {
                          subName = `${subUser.firstName || ""} ${subUser.lastName || ""}`.trim();
                        }
                      }
                    }
                    isCivicEducation = substitution.isCivicEducation || false;
                  }
                }
              }

              // Only add to affected entries if this slot has a substitution
              if (hasSubstitution) {
                affectedEntries.push({
                  dayOfWeek: entry.dayOfWeek,
                  periodIndex: entry.periodIndex - 1,
                  subjectName: isCivicEducation ? "ГО" : (subject?.shortName || subject?.name || "Unknown"),
                  substituteTeacherName: subName,
                  isCivicEducation,
                  isFree,
                });
              }
            }
          }
        }

        weekAbsences.push({
          _id: absence._id,
          teacherId: teacherRecord._id,
          teacherName: teacherUser ? `${teacherUser.firstName || ""} ${teacherUser.lastName || ""}`.trim() : "-",
          teacherUserId: teacherUser?._id,
          teacherFirstName: teacherUser?.firstName || undefined,
          teacherMiddleName: teacherUser?.middleName || undefined,
          teacherLastName: teacherUser?.lastName || undefined,
          startDate: absence.startDate,
          endDate: absence.endDate,
          reason: absence.reason,
          substitutionType: absence.substitutionType,
          affectedEntries,
        });
      }

      // НОВО: Добавяме часовете където учителят замества
      const allAbsences = await ctx.db
        .query("absences")
        .filter((q) => 
          q.and(
            q.gte(q.field("endDate"), args.startDate),
            q.lte(q.field("startDate"), args.endDate)
          )
        )
        .collect();

      // Вземаме всички седмични разписания за да намерим класовете
      const allSchedulesRaw = await ctx.db.query("weeklySchedules").collect();
      
      // ── Term-aware schedule filtering ──
      const allTermsForSubst = await ctx.db.query("terms").collect();
      const activeTermForSubst = allTermsForSubst.find(t => args.startDate >= t.startDate && args.startDate <= t.endDate);
      const allSchedules = allSchedulesRaw.filter(s => {
        if (!activeTermForSubst) return true;
        if (s.termId && s.termId !== activeTermForSubst._id) return false;
        return true;
      });

      // Helper: Изчислява понеделника на седмицата
      const getWeekMonday = (timestamp: number): Date => {
        const date = new Date(timestamp);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(date);
        monday.setDate(diff);
        monday.setHours(0, 0, 0, 0);
        return monday;
      };

      // Helper: Проверява дали дадена дата е в периода на отсъствието
      // Uses YYYY-MM-DD string comparison to avoid timezone issues
      const isDateInAbsencePeriod = (date: Date, absenceStart: number, absenceEnd: number): boolean => {
        // Get date string for the specific date (add 12h to handle timezone offset)
        const dateNoon = new Date(date.getTime() + 12 * 60 * 60 * 1000);
        const dateYear = dateNoon.getUTCFullYear();
        const dateMonth = String(dateNoon.getUTCMonth() + 1).padStart(2, '0');
        const dateDay = String(dateNoon.getUTCDate()).padStart(2, '0');
        const dateStr = `${dateYear}-${dateMonth}-${dateDay}`;
        
        // Get absence start date string
        const absStartNoon = new Date(absenceStart + 12 * 60 * 60 * 1000);
        const absStartYear = absStartNoon.getUTCFullYear();
        const absStartMonth = String(absStartNoon.getUTCMonth() + 1).padStart(2, '0');
        const absStartDay = String(absStartNoon.getUTCDate()).padStart(2, '0');
        const absStartStr = `${absStartYear}-${absStartMonth}-${absStartDay}`;
        
        // Get absence end date string
        // End dates are stored at end-of-day (T21:59:59.999Z) - UTC date is already the correct calendar date
        // Do NOT add noon offset for end dates as it would push to the next day
        const absEndDirect = new Date(absenceEnd);
        const absEndYear = absEndDirect.getUTCFullYear();
        const absEndMonth = String(absEndDirect.getUTCMonth() + 1).padStart(2, '0');
        const absEndDay = String(absEndDirect.getUTCDate()).padStart(2, '0');
        const absEndStr = `${absEndYear}-${absEndMonth}-${absEndDay}`;
        
        return dateStr >= absStartStr && dateStr <= absEndStr;
      };

      // Изчисляваме понеделника на избраната седмица
      const weekMonday = getWeekMonday(args.startDate);

      for (const absence of allAbsences) {
        // Проверяваме дали този учител замества в това отсъствие
        if (!absence.substitutions || absence.substitutions.length === 0) {
          continue;
        }

        const substituteEntries: Array<{
          dayOfWeek: number;
          periodIndex: number;
          subjectName: string;
          substituteTeacherName: string | null;
          isCivicEducation?: boolean;
          isFree?: boolean;
          isSubstitute?: boolean;
          className?: string;
          classId?: string;
          subjectId?: string;
        }> = [];

        // Проверяваме дали нашият учител е в списъка на заместниците
        const isSubstituteInThisAbsence = absence.substitutions.some(sub => sub.teacherId === teacherRecord._id && !sub.isFree);
        
        if (!isSubstituteInThisAbsence) {
          continue;
        }

        // ✅ PLATFORM SETTING: Check substitutesAccessDays - limit how long substitutes have access
        const absenceEndDate = new Date(absence.endDate);
        const now = new Date();
        const daysSinceAbsenceEnd = Math.floor((now.getTime() - absenceEndDate.getTime()) / (24 * 60 * 60 * 1000));
        
        if (daysSinceAbsenceEnd > substitutesAccessDays) {
          continue; // Substitution access has expired
        }

        // Обработка за "single" тип заместване - един заместник за всички часове
        if (absence.substitutionType === "single" && absence.substitutions.length > 0) {
          const singleSub = absence.substitutions[0];
          
          // Проверяваме дали този учител е единствения заместник
          if (singleSub.teacherId === teacherRecord._id && !singleSub.isFree) {
            // Намираме всички часове на отсъстващия учител от разписанията
            for (const schedule of allSchedules) {
              for (const entry of schedule.entries) {
                if (entry.teacherId === absence.teacherId && entry.dayOfWeek >= 1 && entry.dayOfWeek <= 5) {
                  // ВАЖНО: Изчисляваме конкретната дата за този ден от седмицата
                  const specificDate = new Date(weekMonday);
                  specificDate.setDate(specificDate.getDate() + (entry.dayOfWeek - 1));
                  
                  // Проверяваме дали тази дата е в периода на отсъствието
                  if (!isDateInAbsencePeriod(specificDate, absence.startDate, absence.endDate)) {
                    continue; // Пропускаме този запис - датата е извън периода на отсъствието
                  }
                  
                  // Проверяваме дали нашият учител е отсъстващ на тази конкретна дата
                  // Ако е, не трябва да вижда заместващите часове
                  const specificTimestamp = specificDate.getTime();
                  const isOurTeacherAbsentOnThisDate = absences.some(abs => 
                    specificTimestamp >= abs.startDate && specificTimestamp <= abs.endDate
                  );
                  if (isOurTeacherAbsentOnThisDate) {
                    continue; // Пропускаме - нашият учител е отсъстващ на тази дата
                  }
                  
                  const subject = await ctx.db.get(entry.subjectId);
                  const classDoc = await ctx.db.get(schedule.classId);
                  
                  const subjectName = singleSub.isCivicEducation 
                    ? "Гражданско образование" 
                    : (subject?.shortName || subject?.name || "—");
                  
                  substituteEntries.push({
                    dayOfWeek: entry.dayOfWeek,
                    periodIndex: entry.periodIndex - 1, // Convert to 0-based
                    subjectName: subjectName,
                    substituteTeacherName: null,
                    isCivicEducation: singleSub.isCivicEducation || false,
                    isFree: false,
                    isSubstitute: true,
                    className: classDoc?.name || "—",
                    classId: schedule.classId,
                    subjectId: singleSub.isCivicEducation ? undefined : entry.subjectId,
                  });
                }
              }
            }
          }
        } 
        // Обработка за "multiple" тип заместване - различни заместници за различни часове
        else if (absence.substitutionType === "multiple") {
          for (const sub of absence.substitutions) {
            // Проверяваме дали нашият учител замества в този период
            if (sub.teacherId === teacherRecord._id && !sub.isFree && sub.dayOfWeek !== undefined && sub.periodIndex !== undefined) {
              // Изчисляваме датата за тази подмяна
              let targetDateTimestamp: number | undefined = sub.date;
              
              // Ако няма конкретна дата в sub.date, изчисляваме я от dayOfWeek и избраната седмица
              if (!targetDateTimestamp) {
                // Изчисляваме конкретната дата за този ден от седмицата в избрания период
                const targetDate = new Date(weekMonday);
                targetDate.setDate(targetDate.getDate() + (sub.dayOfWeek - 1)); // dayOfWeek: 1=Mon, 2=Tue, etc.
                targetDateTimestamp = targetDate.getTime();
              }
              
              // Проверяваме дали нашият учител е отсъстващ на конкретната дата на заместването
              // Ако е, не трябва да вижда тези заместващи часове
              const isOurTeacherAbsentOnSubDate = absences.some(abs => 
                targetDateTimestamp! >= abs.startDate && targetDateTimestamp! <= abs.endDate
              );
              if (isOurTeacherAbsentOnSubDate) {
                continue; // Пропускаме - нашият учител е отсъстващ на тази дата
              }
              
              // Use noon-ish approach for date comparison to avoid timezone issues
              const subDateNoon = new Date(targetDateTimestamp + 12 * 60 * 60 * 1000);
              const subYear = subDateNoon.getUTCFullYear();
              const subMonth = String(subDateNoon.getUTCMonth() + 1).padStart(2, '0');
              const subDay = String(subDateNoon.getUTCDate()).padStart(2, '0');
              const subDateStr = `${subYear}-${subMonth}-${subDay}`;
              
              const weekStartNoon = new Date(args.startDate + 12 * 60 * 60 * 1000);
              const wsYear = weekStartNoon.getUTCFullYear();
              const wsMonth = String(weekStartNoon.getUTCMonth() + 1).padStart(2, '0');
              const wsDay = String(weekStartNoon.getUTCDate()).padStart(2, '0');
              const weekStartStr = `${wsYear}-${wsMonth}-${wsDay}`;
              
              const weekEndNoon = new Date(args.endDate + 12 * 60 * 60 * 1000);
              const weYear = weekEndNoon.getUTCFullYear();
              const weMonth = String(weekEndNoon.getUTCMonth() + 1).padStart(2, '0');
              const weDay = String(weekEndNoon.getUTCDate()).padStart(2, '0');
              const weekEndStr = `${weYear}-${weMonth}-${weDay}`;
              
              // Проверяваме дали датата на заместването е в избраната седмица
              if (subDateStr < weekStartStr || subDateStr > weekEndStr) {
                continue; // Датата на заместването е извън избраната седмица
              }
              
              // ДОПЪЛНИТЕЛНА ПРОВЕРКА: Проверяваме дали тази дата е в периода на отсъствието
              if (!isDateInAbsencePeriod(subDateNoon, absence.startDate, absence.endDate)) {
                continue; // Датата е извън периода на отсъствието
              }
              
              let subjectName = "—";
              let subjectId: string | undefined = undefined;
              
              if (sub.isCivicEducation) {
                subjectName = "Гражданско образование";
              } else if (sub.subjectId) {
                const subject = await ctx.db.get(sub.subjectId);
                subjectName = subject?.shortName || subject?.name || "—";
                subjectId = sub.subjectId;
              }

              // Намираме класа от седмичното разписание на отсъстващия учител
              let className = "—";
              let classId: string | undefined = undefined;
              
              const subDayOfWeek = sub.dayOfWeek;
              const subPeriodIndex = sub.periodIndex;
              
              for (const schedule of allSchedules) {
                // periodIndex в substitutions е 0-based, а в schedule.entries е 1-based
                const scheduleEntry = schedule.entries.find(
                  e => e.teacherId === absence.teacherId && 
                       e.dayOfWeek === subDayOfWeek && 
                       e.periodIndex === (subPeriodIndex + 1)
                );
                
                if (scheduleEntry) {
                  const classDoc = await ctx.db.get(schedule.classId);
                  if (classDoc) {
                    className = classDoc.name;
                    classId = schedule.classId;
                    // Ако нямаме предмет от substitution, вземаме от разписанието
                    // НО: ако е гражданско образование, НЕ презаписваме предмета
                    if (!sub.isCivicEducation && !subjectId && scheduleEntry.subjectId) {
                      const subject = await ctx.db.get(scheduleEntry.subjectId);
                      subjectName = subject?.shortName || subject?.name || subjectName;
                      subjectId = scheduleEntry.subjectId;
                    }
                    break;
                  }
                }
              }

              substituteEntries.push({
                dayOfWeek: sub.dayOfWeek,
                periodIndex: sub.periodIndex,
                subjectName: subjectName,
                substituteTeacherName: null,
                isCivicEducation: sub.isCivicEducation || false,
                isFree: false,
                isSubstitute: true,
                className: className,
                classId: classId,
                subjectId: subjectId,
              });
            }
          }
        }

        // Добавяме отсъствието само ако има записи за заместване
        if (substituteEntries.length > 0) {
          const absentTeacher = await ctx.db.get(absence.teacherId);
          const absentTeacherUser = absentTeacher ? await ctx.db.get(absentTeacher.userId) : null;
          
          weekAbsences.push({
            _id: `substitute_${absence._id}`, // Уникално ID за заместващите часове
            teacherId: absentTeacher?._id,
            teacherName: absentTeacherUser ? `${absentTeacherUser.firstName || ""} ${absentTeacherUser.lastName || ""}`.trim() : "-",
            teacherUserId: absentTeacherUser?._id,
            teacherFirstName: absentTeacherUser?.firstName || undefined,
            teacherMiddleName: absentTeacherUser?.middleName || undefined,
            teacherLastName: absentTeacherUser?.lastName || undefined,
            startDate: absence.startDate,
            endDate: absence.endDate,
            reason: `Заместване на ${absentTeacherUser ? `${absentTeacherUser.firstName || ""} ${absentTeacherUser.lastName || ""}`.trim() : "учител"}`,
            substitutionType: absence.substitutionType,
            affectedEntries: substituteEntries,
          });
        }
      }
    }

    // Check if user is a student - get absences for their class
    const studentRecord = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (studentRecord && studentRecord.classId) {
      // Get all absences that affect this student's class (term-aware)
      const classSchedulesRawStudent = await ctx.db
        .query("weeklySchedules")
        .withIndex("by_class", (q) => q.eq("classId", studentRecord.classId))
        .collect();
      const termsForStudent = await ctx.db.query("terms").collect();
      const activeTermForStudent = termsForStudent.find(t => args.startDate >= t.startDate && args.startDate <= t.endDate);
      const classSchedules = classSchedulesRawStudent.filter(s => {
        if (!activeTermForStudent) return true;
        if (s.termId && s.termId !== activeTermForStudent._id) return false;
        return true;
      });

      for (const schedule of classSchedules) {
        // Get all absences that overlap with the requested date range
        const allAbsences = await ctx.db
          .query("absences")
          .filter((q) => 
            q.and(
              q.gte(q.field("endDate"), args.startDate),
              q.lte(q.field("startDate"), args.endDate)
            )
          )
          .collect();

        for (const absence of allAbsences) {
          const teacher = await ctx.db.get(absence.teacherId);
          if (!teacher) continue;

          const teacherUser = await ctx.db.get(teacher.userId);
          const affectedEntries: Array<{
            dayOfWeek: number;
            periodIndex: number;
            subjectName: string;
            substituteTeacherName: string | null;
            isCivicEducation?: boolean;
            isFree?: boolean;
          }> = [];

          // Find entries where this teacher teaches this class
          for (const entry of schedule.entries) {
            if (entry.teacherId === teacher._id && entry.dayOfWeek >= 1 && entry.dayOfWeek <= 5) {
              const subject = await ctx.db.get(entry.subjectId);
              
              // Find substitute for this entry
              let substituteTeacherName: string | null = null;
              let isCivicEducation = false;
              let isFree = false;
              let hasSubstitution = false;
              
              if (absence.substitutions && absence.substitutions.length > 0) {
                if (absence.substitutionType === "single") {
                  hasSubstitution = true;
                  if (absence.substitutions[0].isFree) {
                    isFree = true;
                  } else if (absence.substitutions[0].teacherId) {
                    const subTeacher = await ctx.db.get(absence.substitutions[0].teacherId);
                    if (subTeacher) {
                      const subUser = await ctx.db.get(subTeacher.userId);
                      if (subUser) {
                        substituteTeacherName = `${subUser.firstName || ""} ${subUser.lastName || ""}`.trim();
                      }
                    }
                  }
                  isCivicEducation = absence.substitutions[0].isCivicEducation || false;
                } else if (absence.substitutionType === "multiple") {
                  const substitution = absence.substitutions.find(
                    sub => sub.dayOfWeek === entry.dayOfWeek && sub.periodIndex === entry.periodIndex - 1
                  );
                  
                  if (substitution) {
                    hasSubstitution = true;
                    if (substitution.isFree) {
                      isFree = true;
                    } else if (substitution.teacherId) {
                      const subTeacher = await ctx.db.get(substitution.teacherId);
                      if (subTeacher) {
                        const subUser = await ctx.db.get(subTeacher.userId);
                        if (subUser) {
                          substituteTeacherName = `${subUser.firstName || ""} ${subUser.lastName || ""}`.trim();
                        }
                      }
                    }
                    isCivicEducation = substitution.isCivicEducation || false;
                  }
                }
              }
              
              // Only add to affected entries if this slot has a substitution
              if (hasSubstitution) {
                affectedEntries.push({
                  dayOfWeek: entry.dayOfWeek,
                  periodIndex: entry.periodIndex - 1,
                  // If civic education, show "ГО", otherwise show original subject (shortName)
                  // When substitute teaches same subject, the subject doesn't change
                  subjectName: isCivicEducation ? "ГО" : (subject?.shortName || subject?.name || "Unknown"),
                  substituteTeacherName,
                  isCivicEducation,
                  isFree,
                });
              }
            }
          }

          if (affectedEntries.length > 0) {
            // Check if we already added this absence
            const existingAbsence = weekAbsences.find(a => a._id === absence._id);
            if (!existingAbsence) {
              weekAbsences.push({
                _id: absence._id,
                teacherId: teacher._id,
                teacherName: teacherUser ? `${teacherUser.firstName || ""} ${teacherUser.lastName || ""}`.trim() : "-",
                teacherUserId: teacherUser?._id,
                teacherFirstName: teacherUser?.firstName || undefined,
                teacherMiddleName: teacherUser?.middleName || undefined,
                teacherLastName: teacherUser?.lastName || undefined,
                startDate: absence.startDate,
                endDate: absence.endDate,
                reason: absence.reason,
                substitutionType: absence.substitutionType,
                affectedEntries,
              });
            }
          }
        }
      }
    }

    return weekAbsences;
  },
});

// Get taken lessons for a week and class
export const getTakenLessonsForWeek = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    classId: v.optional(v.id("classes")),
  },
  handler: async (ctx, args): Promise<Record<string, boolean>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get all lessons in this date range
    const lessons = await ctx.db.query("lessons").collect();
    
    // Filter lessons for this class and date range, and that are taken
    const takenMap: Record<string, boolean> = {};
    
    for (const lesson of lessons) {
      // Check if lesson is in date range
      if (lesson.date >= args.startDate && lesson.date <= args.endDate) {
        // Check if lesson is for this class (if classId provided)
        if (!args.classId || lesson.classId === args.classId) {
          // Check if lesson is taken
          if (lesson.isTaken) {
            // Create key: dayOfWeek_periodIndex
            const lessonDate = new Date(lesson.date);
            const dayOfWeek = lessonDate.getUTCDay() === 0 ? 7 : lessonDate.getUTCDay();
            const key = `${dayOfWeek}_${lesson.periodIndex}`;
            takenMap[key] = true;
          }
        }
      }
    }
    
    return takenMap;
  },
});

// Get taken lessons for a user's schedule
export const getTakenLessonsForUserSchedule = query({
  args: {
    userId: v.id("users"),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args): Promise<Record<string, boolean>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const user = await ctx.db.get(args.userId);
    if (!user) {
      return {};
    }

    const takenMap: Record<string, boolean> = {};

    // Check if user is a teacher
    const teacherRecord = await ctx.db
      .query("teachers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (teacherRecord) {
      // Get lessons where this teacher is teaching
      const lessons = await ctx.db.query("lessons").collect();
      
      for (const lesson of lessons) {
        if (lesson.date >= args.startDate && lesson.date <= args.endDate && lesson.teacherId === teacherRecord._id && lesson.isTaken) {
          const lessonDate = new Date(lesson.date);
          const dayOfWeek = lessonDate.getUTCDay() === 0 ? 7 : lessonDate.getUTCDay();
          const key = `${dayOfWeek}_${lesson.periodIndex}`;
          takenMap[key] = true;
        }
      }
    }

    // Check if user is a student
    const studentRecord = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (studentRecord && studentRecord.classId) {
      // Get lessons for this student's class
      const lessons = await ctx.db.query("lessons").collect();
      
      for (const lesson of lessons) {
        if (lesson.date >= args.startDate && lesson.date <= args.endDate && lesson.classId === studentRecord.classId && lesson.isTaken) {
          const lessonDate = new Date(lesson.date);
          const dayOfWeek = lessonDate.getUTCDay() === 0 ? 7 : lessonDate.getUTCDay();
          const key = `${dayOfWeek}_${lesson.periodIndex}`;
          takenMap[key] = true;
        }
      }
    }

    return takenMap;
  },
});

// Get absence by ID with full details including schedule
export const getAbsenceById = query({
  args: { absenceId: v.id("absences") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const absence = await ctx.db.get(args.absenceId);
    if (!absence) {
      return null;
    }

    // Get teacher info
    const teacher = await ctx.db.get(absence.teacherId);
    const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;
    const teacherName = teacherUser 
      ? `${teacherUser.firstName || ""} ${teacherUser.lastName || ""}`.trim()
      : "-";

    // Format dates
    const startDate = new Date(absence.startDate);
    const endDate = new Date(absence.endDate);
    const period = `${startDate.toLocaleDateString('bg-BG')} - ${endDate.toLocaleDateString('bg-BG')} (${absence.workingDays} ${absence.workingDays === 1 ? 'работен ден' : 'работни дни'})`;

    // Get creator info
    const createdAt = new Date(absence._creationTime).toLocaleDateString('bg-BG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    let createdBy = "Система";
    if (absence.createdBy) {
      const creator = await ctx.db.get(absence.createdBy);
      if (creator) {
        const firstName = creator.firstName || "";
        const lastName = creator.lastName || "";
        const fullName = `${firstName} ${lastName}`.trim();
        createdBy = fullName || creator.email || "Система";
      }
    }

    // Get teacher's weekly schedule to build absence schedule
    const allSchedulesGridRaw = await ctx.db.query("weeklySchedules").collect();
    
    // ── Term-aware schedule filtering ──
    const allTermsForGrid = await ctx.db.query("terms").collect();
    const activeTermForGrid = allTermsForGrid.find(t => absence.startDate >= t.startDate && absence.startDate <= t.endDate);
    const allSchedules = allSchedulesGridRaw.filter(s => {
      if (!activeTermForGrid) return true;
      if (s.termId && s.termId !== activeTermForGrid._id) return false;
      return true;
    });
    
    // Build schedule grid: array of periods with days
    type SchedulePeriod = {
      time: string;
      days: Array<{
        hasClass: boolean;
        subject?: string;
        class?: string;
        substitute?: string;
        status?: string;
      }>;
    };
    
    const scheduleGrid: SchedulePeriod[] = [];
    const maxPeriods = 8; // Assume max 8 periods per day

    // Initialize grid
    for (let p = 0; p < maxPeriods; p++) {
      scheduleGrid.push({
        time: `${7 + p}:30 - ${8 + p}:05`, // Placeholder time
        days: Array(5).fill(null).map(() => ({ hasClass: false })),
      });
    }

    // Find all schedule entries for this teacher
    for (const schedule of allSchedules) {
      for (const entry of schedule.entries) {
        if (entry.teacherId === teacher?._id && entry.dayOfWeek >= 1 && entry.dayOfWeek <= 5) {
          const subject = await ctx.db.get(entry.subjectId);
          const classDoc = await ctx.db.get(schedule.classId);
          
          // Find substitute for this entry
          let substituteName = "Без заместник";
          let displaySubject = subject?.name || "—";
          
          if (absence.substitutionType === "single" && absence.substitutions && absence.substitutions.length > 0) {
            const sub = absence.substitutions[0];
            if (sub.isFree) {
              substituteName = "Свободен час";
            } else if (sub.teacherId) {
              const subTeacher = await ctx.db.get(sub.teacherId);
              if (subTeacher) {
                const subUser = await ctx.db.get(subTeacher.userId);
                if (subUser) {
                  substituteName = `${subUser.firstName || ""} ${subUser.lastName || ""}`.trim();
                  if (sub.isCivicEducation) {
                    substituteName += " (Гражданско образование)";
                    displaySubject = "Гражданско образование";
                  }
                }
              }
            }
          } else if (absence.substitutionType === "multiple" && absence.substitutions) {
            // Find matching substitute for this specific day/period combination
            const matchingSub = absence.substitutions.find(
              s => s.dayOfWeek === entry.dayOfWeek && s.periodIndex === entry.periodIndex - 1
            );
            if (matchingSub) {
              if (matchingSub.isFree) {
                substituteName = "Свободен час";
              } else if (matchingSub.teacherId) {
                const subTeacher = await ctx.db.get(matchingSub.teacherId);
                if (subTeacher) {
                  const subUser = await ctx.db.get(subTeacher.userId);
                  if (subUser) {
                    substituteName = `${subUser.firstName || ""} ${subUser.lastName || ""}`.trim();
                    if (matchingSub.isCivicEducation) {
                      substituteName += " (Гражданско образование)";
                      displaySubject = "Гражданско образование";
                    }
                  }
                }
              }
            }
          }

          // Map dayOfWeek (1=Monday, 5=Friday) to grid index (0-4)
          const dayIndex = entry.dayOfWeek - 1;
          // Convert 1-based periodIndex to 0-based array index
          const periodIndex = entry.periodIndex - 1;
          if (dayIndex >= 0 && dayIndex < 5 && periodIndex >= 0 && periodIndex < maxPeriods) {
            scheduleGrid[periodIndex].days[dayIndex] = {
              hasClass: true,
              subject: displaySubject,
              class: classDoc?.name || "—",
              substitute: substituteName,
              status: absence.substitutionType === "none" ? "🚫 ①①" : "👤 ①①",
            };
          }
        }
      }
    }

    // Remove empty periods at the end
    while (scheduleGrid.length > 0 && scheduleGrid[scheduleGrid.length - 1].days.every(d => !d.hasClass)) {
      scheduleGrid.pop();
    }

    return {
      _id: absence._id,
      title: absence.title,
      absentTeacher: teacherName,
      teacherId: absence.teacherId,
      teacherUserId: teacherUser?._id || "",
      startDate: absence.startDate,
      endDate: absence.endDate,
      period,
      reason: absence.reason,
      createdAt,
      createdBy,
      documents: [], // TODO: Add document support
      schedule: scheduleGrid,
      substitutions: absence.substitutions,
    };
  },
});

// Get teacher schedule for absence period
// Get existing absences for the selected teacher
export const getTeacherAbsences = query({
  args: { teacherId: v.id("teachers") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const absences = await ctx.db
      .query("absences")
      .filter((q) => q.eq(q.field("teacherId"), args.teacherId))
      .collect();

    return absences.map((absence) => ({
      _id: absence._id,
      startDate: absence.startDate,
      endDate: absence.endDate,
      reason: absence.reason,
    }));
  },
});

export const getTeacherScheduleForPeriod = query({
  args: {
    teacherId: v.id("teachers"),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Validate teacher exists
    const teacher = await ctx.db.get(args.teacherId);
    if (!teacher) {
      throw new ConvexError({
        message: "Teacher not found",
        code: "NOT_FOUND",
      });
    }

    // Limit date range to 12 weeks maximum to prevent memory issues
    const maxWeeks = 12;
    const weekInMs = 7 * 24 * 60 * 60 * 1000;
    const dateRangeMs = args.endDate - args.startDate;
    const weekCount = dateRangeMs / weekInMs;
    
    if (weekCount > maxWeeks) {
      throw new ConvexError({
        message: `Периодът не може да надвишава ${maxWeeks} седмици.`,
        code: "BAD_REQUEST",
      });
    }

    // Get all schedules
    const allSchedulesPeriodRaw = await ctx.db.query("weeklySchedules").collect();
    
    // ── Term-aware schedule filtering ──
    const allTermsForPeriod = await ctx.db.query("terms").collect();
    const activeTermForPeriod = allTermsForPeriod.find(t => args.startDate >= t.startDate && args.startDate <= t.endDate);
    const allSchedules = allSchedulesPeriodRaw.filter(s => {
      if (!activeTermForPeriod) return true;
      if (s.termId && s.termId !== activeTermForPeriod._id) return false;
      return true;
    });
    
    // Pre-process: Find all entries for this teacher and organize by day
    const teacherEntriesByDay = new Map<number, Array<{ 
      periodIndex: number;
      subjectId: Id<"subjects">;
      subjectName: string;
      classId: Id<"classes">;
      className: string;
    }>>();
    
    // Get all subjects and classes in one go to avoid repeated queries
    const subjectIds = new Set<Id<"subjects">>();
    const classIds = new Set<Id<"classes">>();
    
    for (const schedule of allSchedules) {
      for (const entry of schedule.entries) {
        if (entry.teacherId === args.teacherId) {
          subjectIds.add(entry.subjectId);
          classIds.add(schedule.classId);
        }
      }
    }
    
    // Fetch all subjects and classes at once
    const subjects = new Map<Id<"subjects">, { name: string; shortName: string }>();
    for (const subjectId of subjectIds) {
      const subject = await ctx.db.get(subjectId);
      if (subject) subjects.set(subjectId, { name: subject.name, shortName: subject.shortName });
    }
    
    const classes = new Map<Id<"classes">, string>();
    for (const classId of classIds) {
      const classDoc = await ctx.db.get(classId);
      if (classDoc) classes.set(classId, classDoc.name);
    }
    
    // Organize entries by day (only weekdays, exclude Saturday=6 and Sunday=7)
    // Also filter out entries without valid class (ghost lessons)
    for (const schedule of allSchedules) {
      // Skip schedules without a valid class
      const className = classes.get(schedule.classId);
      if (!className || className === "—") continue;
      
      for (const entry of schedule.entries) {
        if (entry.teacherId === args.teacherId && entry.dayOfWeek >= 1 && entry.dayOfWeek <= 5) {
          if (!teacherEntriesByDay.has(entry.dayOfWeek)) {
            teacherEntriesByDay.set(entry.dayOfWeek, []);
          }
          teacherEntriesByDay.get(entry.dayOfWeek)!.push({
            periodIndex: entry.periodIndex,
            subjectId: entry.subjectId,
            subjectName: subjects.get(entry.subjectId)?.shortName || subjects.get(entry.subjectId)?.name || "—",
            classId: schedule.classId,
            className: className,
          });
        }
      }
    }

    // НОВO: Добавяме часовете където учителя замества
    const absences = await ctx.db.query("absences").collect();
    const substituteEntriesByDate = new Map<string, Array<{ 
      periodIndex: number;
      subjectId: string;
      subjectName: string;
      classId: string;
      className: string;
      isSubstitute: boolean;
      originalAbsenceId: string;
    }>>();

    for (const absence of absences) {
      // Проверяваме дали отсъствието е в нашия период
      if (absence.endDate < args.startDate || absence.startDate > args.endDate) {
        continue;
      }

      // Проверяваме дали нашия учител замества в това отсъствие
      if (!absence.substitutions || absence.substitutions.length === 0) {
        continue;
      }

      for (const sub of absence.substitutions) {
        if (sub.teacherId === args.teacherId && sub.date && sub.dayOfWeek !== undefined && sub.periodIndex !== undefined && !sub.isFree) {
          const dateKey = `${sub.date}_${sub.dayOfWeek}_${sub.periodIndex}`;
          if (!substituteEntriesByDate.has(dateKey)) {
            substituteEntriesByDate.set(dateKey, []);
          }

          // Намираме информация за заместващия час
          let subjectName = "—";
          let className = "—";
          // Resolve classId and subjectId from substitution data or original schedule
          let resolvedClassId: string = sub.classId || "";
          let resolvedSubjectId: string = sub.subjectId || "";
          
          if (sub.isCivicEducation) {
            subjectName = "Гражданско образование";
          } else if (sub.subjectId) {
            const subject = await ctx.db.get(sub.subjectId);
            subjectName = subject?.shortName || subject?.name || "—";
          }

          // Намираме класа от оригиналното разписание на отсъстващия учител
          const absentTeacher = await ctx.db.get(absence.teacherId);
          if (absentTeacher) {
            for (const schedule of allSchedules) {
              for (const entry of schedule.entries) {
                // sub.periodIndex е 0-based, entry.periodIndex е 1-based, затова добавяме 1
                if (entry.teacherId === absence.teacherId && 
                    entry.dayOfWeek === sub.dayOfWeek && 
                    entry.periodIndex === sub.periodIndex + 1) {
                  const classDoc = await ctx.db.get(schedule.classId);
                  if (classDoc) {
                    className = classDoc.name;
                    if (!resolvedClassId) resolvedClassId = schedule.classId;
                    if (!resolvedSubjectId) resolvedSubjectId = entry.subjectId;
                    // Get subject name from schedule if not already set
                    if (!sub.isCivicEducation && !sub.subjectId) {
                      const subject = await ctx.db.get(entry.subjectId);
                      subjectName = subject?.shortName || subject?.name || "—";
                    }
                  }
                  break;
                }
              }
            }
          }

          substituteEntriesByDate.get(dateKey)!.push({
            periodIndex: sub.periodIndex,
            subjectId: resolvedSubjectId,
            subjectName: subjectName,
            classId: resolvedClassId,
            className: className,
            isSubstitute: true,
            originalAbsenceId: absence._id,
          });
        }
      }
    }
    
    // Build weeks array
    const weeks = [];
    const startTime = args.startDate;
    const endTime = args.endDate;
    
    // Helper to get Monday of a given date
    // Input is UTC midnight timestamp, so we use UTC methods throughout
    function getMondayOfWeek(date: Date): Date {
      const d = new Date(date);
      const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const diff = (day === 0 ? -6 : 1) - day;
      d.setUTCDate(d.getUTCDate() + diff);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    }
    
    // Helper to add days to a date (using UTC)
    function addDays(date: Date, days: number): Date {
      const result = new Date(date);
      result.setUTCDate(result.getUTCDate() + days);
      return result;
    }
    
    // Find the Monday of the week containing the start date
    let weekStart = getMondayOfWeek(new Date(startTime));
    let processedWeeks = 0;
    
    // Process each week
    while (weekStart.getTime() <= endTime && processedWeeks < maxWeeks) {
      const weekEnd = addDays(weekStart, 4); // Friday
      
      // Check if this week overlaps with the absence period
      if (weekEnd.getTime() >= startTime) {
        const weekDays = [];
        
        // Always add all 5 weekdays (Monday to Friday)
        for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
          const currentDate = addDays(weekStart, dayOffset);
          const currentTimestamp = currentDate.getTime();
          const dayOfWeek = dayOffset + 1; // 1 = Monday, 5 = Friday
          
          // Get entries for this day of week
          const dayEntries = teacherEntriesByDay.get(dayOfWeek) || [];
          
          // Build periods array
          const periods = [];
          
          // Only populate periods if this day is within the absence period
          if (currentTimestamp >= startTime && currentTimestamp <= endTime) {
            for (const entry of dayEntries) {
              // Convert 1-based periodIndex to 0-based array index
              const arrayIndex = entry.periodIndex - 1;
              if (arrayIndex < 0) continue;
              
              // Extend periods array if needed
              while (periods.length <= arrayIndex) {
                periods.push(null);
              }
              
              periods[arrayIndex] = {
                periodIndex: arrayIndex,
                time: `${7 + arrayIndex}:30 - ${8 + arrayIndex}:15`,
                subjectId: entry.subjectId,
                subjectName: entry.subjectName,
                classId: entry.classId,
                className: entry.className,
                hasSubstitute: false,
              };
            }

            // НОВO: Добавяме заместващите часове за този ден
            for (const [dateKey, substitutes] of substituteEntriesByDate.entries()) {
              const [dateStr, dayOfWeekStr, periodIndexStr] = dateKey.split('_');
              const subDate = parseInt(dateStr);
              const subDayOfWeek = parseInt(dayOfWeekStr);
              const subPeriodIndex = parseInt(periodIndexStr);

              if (subDate === currentTimestamp && subDayOfWeek === dayOfWeek) {
                for (const subEntry of substitutes) {
                  // subPeriodIndex is already 0-based from substitutions
                  const arrayIndex = subPeriodIndex;
                  if (arrayIndex < 0) continue;

                  // Extend periods array if needed
                  while (periods.length <= arrayIndex) {
                    periods.push(null);
                  }

                  // Добавяме заместващия час (само ако няма вече час на това място)
                  if (!periods[arrayIndex]) {
                    periods[arrayIndex] = {
                      periodIndex: arrayIndex,
                      time: `${7 + arrayIndex}:30 - ${8 + arrayIndex}:15`,
                      subjectId: subEntry.subjectId,
                      subjectName: `${subEntry.subjectName} (замества)`,
                      classId: subEntry.classId,
                      className: subEntry.className,
                      hasSubstitute: true,
                      isSubstitute: true,
                      originalAbsenceId: subEntry.originalAbsenceId,
                    };
                  }
                }
              }
            }
          }
          
          // Always add the day (even if no periods)
          weekDays.push({
            date: currentTimestamp,
            dayOfWeek: dayOfWeek,
            periods: periods,
          });
        }
        
        // Add the week if at least one day has periods
        const hasRelevantPeriods = weekDays.some(day => day.periods.length > 0);
        if (hasRelevantPeriods) {
          weeks.push({
            weekStart: weekStart.getTime(),
            weekEnd: weekEnd.getTime(),
            days: weekDays,
          });
          processedWeeks++;
        }
      }
      
      // Move to next week (always 7 days forward)
      weekStart = addDays(weekStart, 7);
    }

    return { weeks };
  },
});

// Get teacher IDs that are absent during a given date range
// Used to filter out absent teachers from the "Add for all" dialog
export const getAbsentTeacherIdsForPeriod = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    excludeTeacherId: v.optional(v.id("teachers")),
  },
  handler: async (ctx, args): Promise<string[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const absences = await ctx.db.query("absences").collect();
    const absentTeacherIds = new Set<string>();

    for (const absence of absences) {
      // Skip the teacher we're creating absence for
      if (args.excludeTeacherId && absence.teacherId === args.excludeTeacherId) continue;

      // Check if absence overlaps with the given period
      if (absence.startDate <= args.endDate && absence.endDate >= args.startDate) {
        absentTeacherIds.add(absence.teacherId);
      }
    }

    return Array.from(absentTeacherIds);
  },
});

// Get available teachers for a specific period slot
export const getAvailableTeachersForSlot = query({
  args: {
    dayOfWeek: v.number(),
    periodIndex: v.number(),
    excludeTeacherId: v.id("teachers"),
    showAll: v.optional(v.boolean()),
    subjectId: v.optional(v.id("subjects")),
    date: v.optional(v.number()), // Date timestamp to check for absences
  },
  handler: async (ctx, args): Promise<Array<{
    _id: string;
    userId: string;
    firstName: string;
    lastName: string;
    specialization: string;
    teacherSubjects: Id<"subjects">[];
    subjectNames: string[];
    isBusy?: boolean;
    teachesSubject?: boolean;
    isAbsent?: boolean;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get all teachers
    const allTeachers = await ctx.db.query("teachers").collect();
    
    // Get all schedules
    const allSchedulesSlotRaw = await ctx.db.query("weeklySchedules").collect();
    
    // ── Term-aware schedule filtering (only when date is provided) ──
    let allSchedules = allSchedulesSlotRaw;
    if (args.date !== undefined) {
      const date = args.date;
      const allTermsForSlot = await ctx.db.query("terms").collect();
      const activeTermForSlot = allTermsForSlot.find(t => date >= t.startDate && date <= t.endDate);
      allSchedules = allSchedulesSlotRaw.filter(s => {
        if (!activeTermForSlot) return true;
        if (s.termId && s.termId !== activeTermForSlot._id) return false;
        return true;
      });
    }
    
    // Find busy teachers for this slot (only weekdays)
    const busyTeacherIds = new Set<Id<"teachers">>();
    for (const schedule of allSchedules) {
      for (const entry of schedule.entries) {
        if (entry.dayOfWeek === args.dayOfWeek && 
            entry.periodIndex === args.periodIndex + 1 && // Convert 0-based to 1-based
            entry.dayOfWeek >= 1 && 
            entry.dayOfWeek <= 5) {
          busyTeacherIds.add(entry.teacherId);
        }
      }
    }
    
    // Find teachers who are absent on this date for this period
    const absentTeacherIds = new Set<Id<"teachers">>();
    if (args.date) {
      const absences = await ctx.db.query("absences").collect();
      for (const absence of absences) {
        // Skip the excluded teacher's absence (we're assigning substitutes FOR them)
        if (absence.teacherId === args.excludeTeacherId) continue;
        
        // Check if the absence covers this date
        if (absence.startDate <= args.date && absence.endDate >= args.date) {
          // Check if the teacher has classes on this day and period
          // by looking at their schedule or just mark them as absent for the whole day
          absentTeacherIds.add(absence.teacherId);
        }
      }
    }
    
    // Filter teachers based on showAll flag
    // Always exclude absent teachers from the available list (even with showAll)
    const filteredTeachers = args.showAll 
      ? allTeachers.filter(t => t._id !== args.excludeTeacherId && !absentTeacherIds.has(t._id))
      : allTeachers.filter(t => t._id !== args.excludeTeacherId && !busyTeacherIds.has(t._id) && !absentTeacherIds.has(t._id));
    
    // Enrich with user data and subject names
    const enriched = await Promise.all(
      filteredTeachers.map(async (teacher) => {
        const user = await ctx.db.get(teacher.userId);
        const subjectIds = user?.teacherSubjects || [];
        
        // Get subject names (use shortName)
        const subjectNames = await Promise.all(
          subjectIds.map(async (subId) => {
            const subject = await ctx.db.get(subId);
            return subject?.shortName || "";
          })
        );
        
        // Check if teacher teaches the specified subject
        const teachesSubject = args.subjectId ? subjectIds.includes(args.subjectId) : undefined;
        
        return {
          _id: teacher._id,
          userId: teacher.userId,
          firstName: user?.firstName || "",
          lastName: user?.lastName || "",
          specialization: teacher.specialization || "",
          teacherSubjects: subjectIds,
          subjectNames: subjectNames.filter((n: string) => n !== ""), // Remove empty names
          isBusy: args.showAll ? busyTeacherIds.has(teacher._id) : undefined,
          teachesSubject,
        };
      })
    );
    
    // Filter out teachers without proper names
    return enriched.filter(t => t.firstName.trim() !== "" && t.lastName.trim() !== "");
  },
});

// Reassign a specific substitute within an existing absence
// Used when a substitute teacher becomes absent and a new substitute needs to take over
export const reassignSubstitute = mutation({
  args: {
    absenceId: v.id("absences"),
    dayOfWeek: v.number(),
    periodIndex: v.number(),
    date: v.number(),
    newTeacherId: v.optional(v.id("teachers")),
    isCivicEducation: v.optional(v.boolean()),
    isFree: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }

    const absence = await ctx.db.get(args.absenceId);
    if (!absence) {
      throw new ConvexError({ message: "Absence not found", code: "NOT_FOUND" });
    }

    if (!absence.substitutions || absence.substitutions.length === 0) {
      throw new ConvexError({ message: "No substitutions to update", code: "BAD_REQUEST" });
    }

    // Find and update the specific substitution
    const updatedSubs = absence.substitutions.map(sub => {
      if (sub.dayOfWeek === args.dayOfWeek && 
          sub.periodIndex === args.periodIndex &&
          sub.date === args.date) {
        return {
          ...sub,
          teacherId: args.newTeacherId,
          isCivicEducation: args.isCivicEducation ?? sub.isCivicEducation,
          isFree: args.isFree ?? false,
        };
      }
      return sub;
    });

    await ctx.db.patch(args.absenceId, { substitutions: updatedSubs });

    // Send notification to new substitute teacher
    if (args.newTeacherId && !args.isFree) {
      const subTeacher = await ctx.db.get(args.newTeacherId);
      const subUser = subTeacher ? await ctx.db.get(subTeacher.userId) : null;

      const absentTeacher = await ctx.db.get(absence.teacherId);
      const absentUser = absentTeacher ? await ctx.db.get(absentTeacher.userId) : null;
      const absentName = absentUser ? `${absentUser.firstName || ""} ${absentUser.lastName || ""}`.trim() : "учител";

      if (subUser) {
        const startDate = new Date(absence.startDate);
        const endDate = new Date(absence.endDate);
        const period = `${startDate.toLocaleDateString('bg-BG')} - ${endDate.toLocaleDateString('bg-BG')}`;

        await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
          userId: subUser._id,
          type: "teacher_substitution",
          title: "Назначено ново заместване",
          message: `Назначени сте да заместите ${absentName} от ${period}.`,
          relatedEntityType: "absence",
          relatedEntityId: absence._id,
          actionUrl: `/bg/lecture-hours/absence-schedule/${absence._id}`,
          schoolId: subTeacher?.schoolId,
        });
      }
    }
  },
});
