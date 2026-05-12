import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

// Default values for platform settings
const DEFAULT_SETTINGS = {
  // Модул "Дневник"
  eDiaryEnabled: true,
  lessonTopicRequired: false,
  minutesBeforeLessonCanMarkTaken: 5,
  minutesAfterLessonCanMarkTaken: 5,
  minutesAfterSaveToLock: 0, // 0 = without lock, otherwise minutes after save to lock the lesson
  checkMissingAbsences: false,
  lockDiaryPastMonths: false,
  lockDayOfMonth: 3,
  warnUntakenLessonsAfterDays: 1,
  // Автоматично уважаване на отсъствия
  autoExcuseWithMedicalNote: true,
  autoExcuseWithParentNote: false,
  autoExcuseWithOtherNote: false,
  // Известяване на администратори
  notifyAdminsOnGradeDelete: true,
  notifyAdminsOnAbsenceDelete: true,
  notifyAdminsOnReviewDelete: true,
  // Стриктен режим
  strictModeGradeDelete: false,
  strictModeAbsenceDelete: false,
  strictModeReviewDelete: false,
  includeWeekends: false,
  classTeachersCanEditDayRegime: true,
  classTeachersCanEditSchedules: true,
  classTeachersCanMoveStudents: true,
  studentsParentsSeeTopics: true,
  showSecondClassHour: true,
  schoolYearStartDay: 15,

  // Модул "Учителски отсъствия"
  teachersCanEnterSubstitution: true,
  absentTeachersCanBeSubstitutes: true,
  substitutesAccessDays: 10,

  // Модул "Статистики и справки"
  includeGrades1to3InRankings: false,

  // Модул "Администрация"
  studentsSeeTeachersPhones: false,
  studentsSeeTeachersEmails: false,
  parentsSeeTeachersPhones: false,
  parentsSeeTeachersEmails: false,
  parentsSeeClassmatesParents: false,
  parentsAndStudentsSeeClassmates: true,
  parentsCannotSendMessages: false,
  studentsCannotSendMessages: false,
  enableLessonTimeWindow: true, // Когато е изключено, учителите могат да отбелязват часове по всяко време
  studentIdentifierRequired: false,
  teacherIdentifierRequired: false,
  
  // Видимост на модули (всички включени по подразбиране)
  moduleHomeEnabled: true,
  moduleDiaryEnabled: true,
  moduleTasksEnabled: true,
  moduleStatisticsEnabled: true,
  moduleExtracurricularEnabled: true,
  moduleEventsEnabled: true,
  moduleCompetitionsEnabled: true,
  moduleAdminEnabled: true,
  moduleLectureHoursEnabled: true,
  moduleFeesEnabled: true,
  moduleReportsEnabled: true,
  moduleMessagesEnabled: true,
};

// Get platform settings for the current school
export const getPlatformSettings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user?.schoolId) {
      return null;
    }

    // Check if user has admin access
    const isAdmin =
      user.role === "system_admin" ||
      user.role === "director" ||
      user.role === "vice_director" ||
      user.roles?.includes("system_admin") ||
      user.roles?.includes("director") ||
      user.roles?.includes("vice_director");

    if (!isAdmin) {
      return null;
    }

    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .unique();

    // Return settings merged with defaults
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      schoolId: user.schoolId,
      _id: settings?._id,
    };
  },
});

// Get specific setting value (for use throughout the app)
export const getSettingValue = query({
  args: {
    settingKey: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      // Return default value
      return DEFAULT_SETTINGS[args.settingKey as keyof typeof DEFAULT_SETTINGS] ?? null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user?.schoolId) {
      return DEFAULT_SETTINGS[args.settingKey as keyof typeof DEFAULT_SETTINGS] ?? null;
    }

    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .unique();

    if (settings && args.settingKey in settings) {
      const value = settings[args.settingKey as keyof typeof settings];
      if (value !== undefined) {
        return value;
      }
    }

    return DEFAULT_SETTINGS[args.settingKey as keyof typeof DEFAULT_SETTINGS] ?? null;
  },
});

// Update platform settings
export const updatePlatformSettings = mutation({
  args: {
    // Модул "Дневник"
    eDiaryEnabled: v.optional(v.boolean()),
    lessonTopicRequired: v.optional(v.boolean()),
    minutesBeforeLessonCanMarkTaken: v.optional(v.number()),
    minutesAfterLessonCanMarkTaken: v.optional(v.number()),
    minutesAfterSaveToLock: v.optional(v.number()),
    checkMissingAbsences: v.optional(v.boolean()),
    lockDiaryPastMonths: v.optional(v.boolean()),
    lockDayOfMonth: v.optional(v.number()),
    warnUntakenLessonsAfterDays: v.optional(v.number()),
    // Автоматично уважаване на отсъствия
    autoExcuseWithMedicalNote: v.optional(v.boolean()),
    autoExcuseWithParentNote: v.optional(v.boolean()),
    autoExcuseWithOtherNote: v.optional(v.boolean()),
    // Известяване на администратори
    notifyAdminsOnGradeDelete: v.optional(v.boolean()),
    notifyAdminsOnAbsenceDelete: v.optional(v.boolean()),
    notifyAdminsOnReviewDelete: v.optional(v.boolean()),
    strictModeGradeDelete: v.optional(v.boolean()),
    strictModeAbsenceDelete: v.optional(v.boolean()),
    strictModeReviewDelete: v.optional(v.boolean()),
    includeWeekends: v.optional(v.boolean()),
    classTeachersCanEditDayRegime: v.optional(v.boolean()),
    classTeachersCanEditSchedules: v.optional(v.boolean()),
    classTeachersCanMoveStudents: v.optional(v.boolean()),
    studentsParentsSeeTopics: v.optional(v.boolean()),
    showSecondClassHour: v.optional(v.boolean()),
    schoolYearStartDay: v.optional(v.number()),

    // Модул "Учителски отсъствия"
    teachersCanEnterSubstitution: v.optional(v.boolean()),
    absentTeachersCanBeSubstitutes: v.optional(v.boolean()),
    substitutesAccessDays: v.optional(v.number()),

    // Модул "Статистики и справки"
    includeGrades1to3InRankings: v.optional(v.boolean()),

    // Модул "Администрация"
    studentsSeeTeachersPhones: v.optional(v.boolean()),
    studentsSeeTeachersEmails: v.optional(v.boolean()),
    parentsSeeTeachersPhones: v.optional(v.boolean()),
    parentsSeeTeachersEmails: v.optional(v.boolean()),
    parentsSeeClassmatesParents: v.optional(v.boolean()),
    parentsAndStudentsSeeClassmates: v.optional(v.boolean()),
    parentsCannotSendMessages: v.optional(v.boolean()),
    studentsCannotSendMessages: v.optional(v.boolean()),
    enableLessonTimeWindow: v.optional(v.boolean()),
    // Deprecated fields - kept for backward compatibility
    classTeachersCanApproveRegistrations: v.optional(v.boolean()),
    sendDataToMON: v.optional(v.boolean()),
    studentIdentifierRequired: v.optional(v.boolean()),
    teacherIdentifierRequired: v.optional(v.boolean()),
    // Module visibility
    moduleHomeEnabled: v.optional(v.boolean()),
    moduleDiaryEnabled: v.optional(v.boolean()),
    moduleTasksEnabled: v.optional(v.boolean()),
    moduleStatisticsEnabled: v.optional(v.boolean()),
    moduleExtracurricularEnabled: v.optional(v.boolean()),
    moduleEventsEnabled: v.optional(v.boolean()),
    moduleCompetitionsEnabled: v.optional(v.boolean()),
    moduleAdminEnabled: v.optional(v.boolean()),
    moduleLectureHoursEnabled: v.optional(v.boolean()),
    moduleFeesEnabled: v.optional(v.boolean()),
    moduleReportsEnabled: v.optional(v.boolean()),
    moduleMessagesEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "Not authenticated",
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

    const isAdmin =
      user.role === "system_admin" ||
      user.role === "director" ||
      user.role === "vice_director" ||
      user.roles?.includes("system_admin") ||
      user.roles?.includes("director") ||
      user.roles?.includes("vice_director");

    if (!isAdmin) {
      throw new ConvexError({
        message: "Access denied. Only admins, directors, and vice directors can access settings.",
        code: "FORBIDDEN",
      });
    }

    if (!user.schoolId) {
      throw new ConvexError({
        message: "User has no school assigned",
        code: "BAD_REQUEST",
      });
    }

    // Check if settings exist
    const existingSettings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .unique();

    const updateData = {
      ...args,
      lastEditedBy: user._id,
      lastEditedAt: Date.now(),
    };

    if (existingSettings) {
      // Update existing settings
      await ctx.db.patch(existingSettings._id, updateData);
      return existingSettings._id;
    } else {
      // Create new settings
      const settingsId = await ctx.db.insert("platformSettings", {
        schoolId: user.schoolId,
        ...updateData,
      });
      return settingsId;
    }
  },
});

// Check if user can access settings page
export const canAccessSettings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      return false;
    }

    return (
      user.role === "system_admin" ||
      user.role === "director" ||
      user.role === "vice_director" ||
      user.roles?.includes("system_admin") ||
      user.roles?.includes("director") ||
      user.roles?.includes("vice_director")
    );
  },
});

// Check if a date is locked for diary editing (grades, absences, reviews)
// Returns { isLocked: boolean, message?: string }
export const isDiaryLockedForDate = query({
  args: {
    targetDate: v.number(), // Timestamp of the date to check
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { isLocked: false };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user?.schoolId) {
      return { isLocked: false };
    }

    // Admins, directors, and vice directors can always edit
    const isAdmin =
      user.role === "system_admin" ||
      user.role === "director" ||
      user.role === "vice_director" ||
      user.roles?.includes("system_admin") ||
      user.roles?.includes("director") ||
      user.roles?.includes("vice_director");

    if (isAdmin) {
      return { isLocked: false };
    }

    // Get platform settings
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .unique();

    const lockDiaryPastMonths = settings?.lockDiaryPastMonths ?? DEFAULT_SETTINGS.lockDiaryPastMonths;
    
    if (!lockDiaryPastMonths) {
      return { isLocked: false };
    }

    const lockDayOfMonth = settings?.lockDayOfMonth ?? DEFAULT_SETTINGS.lockDayOfMonth;
    
    // Get current date info
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    const currentDay = now.getDate();

    // Get target date info
    const targetDateObj = new Date(args.targetDate);
    const targetYear = targetDateObj.getFullYear();
    const targetMonth = targetDateObj.getMonth();

    // Calculate the lock boundary date
    // If we're past the lock day, previous months are locked
    // If we're before the lock day, the month before that is also not locked
    let lockBoundaryMonth: number;
    let lockBoundaryYear: number;

    if (currentDay >= lockDayOfMonth) {
      // We're past the lock day - previous month and earlier are locked
      lockBoundaryMonth = currentMonth - 1;
      lockBoundaryYear = currentYear;
      if (lockBoundaryMonth < 0) {
        lockBoundaryMonth = 11;
        lockBoundaryYear = currentYear - 1;
      }
    } else {
      // We're before the lock day - the month before previous and earlier are locked
      lockBoundaryMonth = currentMonth - 2;
      lockBoundaryYear = currentYear;
      if (lockBoundaryMonth < 0) {
        lockBoundaryMonth = 12 + lockBoundaryMonth;
        lockBoundaryYear = currentYear - 1;
      }
    }

    // Check if target date is in a locked month
    // Target is locked if it's in or before the lock boundary month
    const isLocked =
      targetYear < lockBoundaryYear ||
      (targetYear === lockBoundaryYear && targetMonth <= lockBoundaryMonth);

    if (isLocked) {
      const monthNames = [
        "януари", "февруари", "март", "април", "май", "юни",
        "юли", "август", "септември", "октомври", "ноември", "декември"
      ];
      return {
        isLocked: true,
        message: `Дневникът за ${monthNames[targetMonth]} ${targetYear} е заключен. Редакцията не е възможна след ${lockDayOfMonth}-о число на следващия месец.`,
      };
    }

    return { isLocked: false };
  },
});

// Get all platform settings for use in app (not just for admins)
// This is used to check settings like lockDiaryPastMonths
export const getAllSettings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return DEFAULT_SETTINGS;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user?.schoolId) {
      return DEFAULT_SETTINGS;
    }

    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .unique();

    return {
      ...DEFAULT_SETTINGS,
      ...settings,
    };
  },
});

// Query to check if e-diary is fully enabled (for frontend display)
export const isEDiaryEnabled = query({
  args: {},
  handler: async (ctx): Promise<{ enabled: boolean; message?: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { enabled: true }; // Default to enabled for unauthenticated
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user?.schoolId) {
      return { enabled: true };
    }

    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .unique();

    const enabled = settings?.eDiaryEnabled ?? DEFAULT_SETTINGS.eDiaryEnabled;
    
    return {
      enabled,
      message: enabled ? undefined : "Училището използва хибриден режим (електронен + хартиен дневник)",
    };
  },
});

// ============================================================================
// Internal functions for use in other modules (grades, attendance, reviews)
// ============================================================================

// Internal query to check if diary is locked for a given date
// This can be called from other mutations
export const checkDiaryLock = internalQuery({
  args: {
    schoolId: v.id("schools"),
    userId: v.id("users"),
    targetDate: v.number(),
  },
  handler: async (ctx, args): Promise<{ isLocked: boolean; message?: string }> => {
    // Get user to check if admin
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return { isLocked: false };
    }

    // Admins, directors, and vice directors can always edit
    const isAdmin =
      user.role === "system_admin" ||
      user.role === "director" ||
      user.role === "vice_director" ||
      user.roles?.includes("system_admin") ||
      user.roles?.includes("director") ||
      user.roles?.includes("vice_director");

    if (isAdmin) {
      return { isLocked: false };
    }

    // Get platform settings
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    const lockDiaryPastMonths = settings?.lockDiaryPastMonths ?? DEFAULT_SETTINGS.lockDiaryPastMonths;
    
    if (!lockDiaryPastMonths) {
      return { isLocked: false };
    }

    const lockDayOfMonth = settings?.lockDayOfMonth ?? DEFAULT_SETTINGS.lockDayOfMonth;
    
    // Get current date info
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    // Get target date info
    const targetDateObj = new Date(args.targetDate);
    const targetYear = targetDateObj.getFullYear();
    const targetMonth = targetDateObj.getMonth();

    // Calculate the lock boundary
    let lockBoundaryMonth: number;
    let lockBoundaryYear: number;

    if (currentDay >= lockDayOfMonth) {
      lockBoundaryMonth = currentMonth - 1;
      lockBoundaryYear = currentYear;
      if (lockBoundaryMonth < 0) {
        lockBoundaryMonth = 11;
        lockBoundaryYear = currentYear - 1;
      }
    } else {
      lockBoundaryMonth = currentMonth - 2;
      lockBoundaryYear = currentYear;
      if (lockBoundaryMonth < 0) {
        lockBoundaryMonth = 12 + lockBoundaryMonth;
        lockBoundaryYear = currentYear - 1;
      }
    }

    const isLocked =
      targetYear < lockBoundaryYear ||
      (targetYear === lockBoundaryYear && targetMonth <= lockBoundaryMonth);

    if (isLocked) {
      const monthNames = [
        "януари", "февруари", "март", "април", "май", "юни",
        "юли", "август", "септември", "октомври", "ноември", "декември"
      ];
      return {
        isLocked: true,
        message: `Дневникът за ${monthNames[targetMonth]} ${targetYear} е заключен. Редакцията не е възможна след ${lockDayOfMonth}-о число на следващия месец.`,
      };
    }

    return { isLocked: false };
  },
});

// Internal query to get settings for a school
export const getSchoolSettings = internalQuery({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    return {
      ...DEFAULT_SETTINGS,
      ...settings,
    };
  },
});

// Internal query to check if strict mode blocks deletion (not just notify)
export const checkStrictModeDelete = internalQuery({
  args: {
    schoolId: v.id("schools"),
    userId: v.id("users"),
    entityType: v.union(v.literal("grade"), v.literal("absence"), v.literal("review")),
  },
  handler: async (ctx, args): Promise<{ isBlocked: boolean; message?: string }> => {
    // Get user to check if admin
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return { isBlocked: false };
    }

    // Admins are never blocked by strict mode
    const isAdminUser =
      user.role === "system_admin" ||
      user.role === "director" ||
      user.role === "vice_director" ||
      user.roles?.includes("system_admin") ||
      user.roles?.includes("director") ||
      user.roles?.includes("vice_director");

    if (isAdminUser) {
      return { isBlocked: false };
    }

    // Get platform settings
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    let isStrictMode = false;
    let entityName = "";

    if (args.entityType === "grade") {
      isStrictMode = settings?.strictModeGradeDelete ?? DEFAULT_SETTINGS.strictModeGradeDelete;
      entityName = "оценки";
    } else if (args.entityType === "absence") {
      isStrictMode = settings?.strictModeAbsenceDelete ?? DEFAULT_SETTINGS.strictModeAbsenceDelete;
      entityName = "отсъствия";
    } else if (args.entityType === "review") {
      isStrictMode = settings?.strictModeReviewDelete ?? DEFAULT_SETTINGS.strictModeReviewDelete;
      entityName = "отзиви";
    }

    if (isStrictMode) {
      return {
        isBlocked: true,
        message: `Стриктен режим: Само администратори могат да изтриват ${entityName}.`,
      };
    }

    return { isBlocked: false };
  },
});

// Internal query to check if lesson topic is required
export const checkLessonTopicRequired = internalQuery({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    return settings?.lessonTopicRequired ?? DEFAULT_SETTINGS.lessonTopicRequired;
  },
});

// Internal query to check if user can mark lesson as taken based on time window
export const checkLessonTimeWindow = internalQuery({
  args: {
    schoolId: v.id("schools"),
    lessonDate: v.string(), // YYYY-MM-DD format
    lessonStartTime: v.string(), // HH:MM format
    lessonEndTime: v.string(), // HH:MM format
  },
  handler: async (ctx, args): Promise<{ canMark: boolean; message?: string }> => {
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    const minutesBefore = settings?.minutesBeforeLessonCanMarkTaken ?? DEFAULT_SETTINGS.minutesBeforeLessonCanMarkTaken;
    const minutesAfter = settings?.minutesAfterLessonCanMarkTaken ?? DEFAULT_SETTINGS.minutesAfterLessonCanMarkTaken;

    // If both are 0, no time restriction
    if (minutesBefore === 0 && minutesAfter === 0) {
      return { canMark: true };
    }

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD format

    // Check if the lesson is in the future (different day)
    if (args.lessonDate > todayStr) {
      return {
        canMark: false,
        message: `Не може да се маркира час за бъдеща дата (${args.lessonDate}). Часът може да бъде отбелязан само в деня на провеждане.`,
      };
    }

    // Check if the lesson is in the past (different day)
    if (args.lessonDate < todayStr) {
      // Allow marking past lessons within minutesAfter window - but since it's a past day,
      // we can be more lenient here and allow it (teachers may need to catch up)
      // Or we can restrict it - let's allow past lessons to be marked but show a note
      // For now, let's allow past lessons to be marked (common school workflow)
      return { canMark: true };
    }

    // Lesson is today - check time window
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Parse lesson times
    const [startHour, startMin] = args.lessonStartTime.split(":").map(Number);
    const [endHour, endMin] = args.lessonEndTime.split(":").map(Number);
    const lessonStartMinutes = startHour * 60 + startMin;
    const lessonEndMinutes = endHour * 60 + endMin;

    // Calculate allowed window
    const windowStart = lessonStartMinutes - minutesBefore;
    const windowEnd = lessonEndMinutes + minutesAfter;

    if (currentMinutes < windowStart) {
      return {
        canMark: false,
        message: `Часът може да бъде отбелязан най-рано ${minutesBefore} минути преди началото му (${args.lessonStartTime}).`,
      };
    }

    if (currentMinutes > windowEnd) {
      return {
        canMark: false,
        message: `Часът може да бъде отбелязан най-късно ${minutesAfter} минути след края му (${args.lessonEndTime}).`,
      };
    }

    return { canMark: true };
  },
});

// Internal query to check if class teacher can edit day regimes
export const checkClassTeacherCanEditDayRegime = internalQuery({
  args: {
    schoolId: v.id("schools"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const user = await ctx.db.get(args.userId);
    if (!user) return false;

    // Admins can always edit
    const isAdminUser =
      user.role === "system_admin" ||
      user.role === "director" ||
      user.role === "vice_director" ||
      user.roles?.includes("system_admin") ||
      user.roles?.includes("director") ||
      user.roles?.includes("vice_director");

    if (isAdminUser) return true;

    // Check if user is a class teacher
    const isClassTeacher = user.role === "class_teacher" || user.roles?.includes("class_teacher");
    if (!isClassTeacher) return false;

    // Check setting
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    return settings?.classTeachersCanEditDayRegime ?? DEFAULT_SETTINGS.classTeachersCanEditDayRegime;
  },
});

// Internal query to check if class teacher can edit schedules
export const checkClassTeacherCanEditSchedules = internalQuery({
  args: {
    schoolId: v.id("schools"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const user = await ctx.db.get(args.userId);
    if (!user) return false;

    // Admins can always edit
    const isAdminUser =
      user.role === "system_admin" ||
      user.role === "director" ||
      user.role === "vice_director" ||
      user.roles?.includes("system_admin") ||
      user.roles?.includes("director") ||
      user.roles?.includes("vice_director");

    if (isAdminUser) return true;

    // Check if user is a class teacher
    const isClassTeacher = user.role === "class_teacher" || user.roles?.includes("class_teacher");
    if (!isClassTeacher) return false;

    // Check setting
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    return settings?.classTeachersCanEditSchedules ?? DEFAULT_SETTINGS.classTeachersCanEditSchedules;
  },
});

// Internal query to check if class teacher can move students
export const checkClassTeacherCanMoveStudents = internalQuery({
  args: {
    schoolId: v.id("schools"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const user = await ctx.db.get(args.userId);
    if (!user) return false;

    // Admins can always move
    const isAdminUser =
      user.role === "system_admin" ||
      user.role === "director" ||
      user.role === "vice_director" ||
      user.roles?.includes("system_admin") ||
      user.roles?.includes("director") ||
      user.roles?.includes("vice_director");

    if (isAdminUser) return true;

    // Check if user is a class teacher
    const isClassTeacher = user.role === "class_teacher" || user.roles?.includes("class_teacher");
    if (!isClassTeacher) return false;

    // Check setting
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    return settings?.classTeachersCanMoveStudents ?? DEFAULT_SETTINGS.classTeachersCanMoveStudents;
  },
});

// Internal query to check messaging permissions
export const checkCanSendMessages = internalQuery({
  args: {
    schoolId: v.id("schools"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<{ canSend: boolean; message?: string }> => {
    const user = await ctx.db.get(args.userId);
    if (!user) return { canSend: false, message: "Потребителят не е намерен" };

    // Admins and teachers can always send
    const isAdminOrTeacher =
      user.role === "system_admin" ||
      user.role === "director" ||
      user.role === "vice_director" ||
      user.role === "teacher" ||
      user.role === "class_teacher" ||
      user.roles?.includes("system_admin") ||
      user.roles?.includes("director") ||
      user.roles?.includes("vice_director") ||
      user.roles?.includes("teacher") ||
      user.roles?.includes("class_teacher");

    if (isAdminOrTeacher) return { canSend: true };

    // Get settings
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    const isStudent = user.role === "student" || user.roles?.includes("student");
    const isParent = user.role === "parent" || user.roles?.includes("parent");

    if (isStudent && (settings?.studentsCannotSendMessages ?? DEFAULT_SETTINGS.studentsCannotSendMessages)) {
      return { canSend: false, message: "Учениците не могат да изпращат съобщения в тази система." };
    }

    if (isParent && (settings?.parentsCannotSendMessages ?? DEFAULT_SETTINGS.parentsCannotSendMessages)) {
      return { canSend: false, message: "Родителите не могат да изпращат съобщения в тази система." };
    }

    return { canSend: true };
  },
});

// Internal query to check if teachers can enter substitution
export const checkTeachersCanEnterSubstitution = internalQuery({
  args: {
    schoolId: v.id("schools"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const user = await ctx.db.get(args.userId);
    if (!user) return false;

    // Admins can always enter
    const isAdminUser =
      user.role === "system_admin" ||
      user.role === "director" ||
      user.role === "vice_director" ||
      user.roles?.includes("system_admin") ||
      user.roles?.includes("director") ||
      user.roles?.includes("vice_director");

    if (isAdminUser) return true;

    // Check if user is a teacher
    const isTeacher = user.role === "teacher" || user.role === "class_teacher" || 
      user.roles?.includes("teacher") || user.roles?.includes("class_teacher");
    if (!isTeacher) return false;

    // Check setting
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    return settings?.teachersCanEnterSubstitution ?? DEFAULT_SETTINGS.teachersCanEnterSubstitution;
  },
});

// Internal query to check visibility settings for contact info
export const checkContactVisibility = internalQuery({
  args: {
    schoolId: v.id("schools"),
    viewerUserId: v.id("users"),
    targetRole: v.union(v.literal("teacher"), v.literal("classmate"), v.literal("parent")),
    fieldType: v.union(v.literal("phone"), v.literal("email")),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const viewer = await ctx.db.get(args.viewerUserId);
    if (!viewer) return false;

    // Admins and teachers can see everything
    const isAdminOrTeacher =
      viewer.role === "system_admin" ||
      viewer.role === "director" ||
      viewer.role === "vice_director" ||
      viewer.role === "teacher" ||
      viewer.role === "class_teacher" ||
      viewer.roles?.includes("system_admin") ||
      viewer.roles?.includes("director") ||
      viewer.roles?.includes("vice_director") ||
      viewer.roles?.includes("teacher") ||
      viewer.roles?.includes("class_teacher");

    if (isAdminOrTeacher) return true;

    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    const isStudent = viewer.role === "student" || viewer.roles?.includes("student");
    const isParent = viewer.role === "parent" || viewer.roles?.includes("parent");

    // Check teacher contact visibility
    if (args.targetRole === "teacher") {
      if (isStudent) {
        if (args.fieldType === "phone") {
          return settings?.studentsSeeTeachersPhones ?? DEFAULT_SETTINGS.studentsSeeTeachersPhones;
        } else {
          return settings?.studentsSeeTeachersEmails ?? DEFAULT_SETTINGS.studentsSeeTeachersEmails;
        }
      }
      if (isParent) {
        if (args.fieldType === "phone") {
          return settings?.parentsSeeTeachersPhones ?? DEFAULT_SETTINGS.parentsSeeTeachersPhones;
        } else {
          return settings?.parentsSeeTeachersEmails ?? DEFAULT_SETTINGS.parentsSeeTeachersEmails;
        }
      }
    }

    // Check classmate visibility
    if (args.targetRole === "classmate") {
      if (isStudent || isParent) {
        return settings?.parentsAndStudentsSeeClassmates ?? DEFAULT_SETTINGS.parentsAndStudentsSeeClassmates;
      }
    }

    // Check parent visibility for other parents
    if (args.targetRole === "parent") {
      if (isParent) {
        return settings?.parentsSeeClassmatesParents ?? DEFAULT_SETTINGS.parentsSeeClassmatesParents;
      }
    }

    return false;
  },
});

// Internal query for grades 1-3 inclusion in rankings
export const checkIncludeGrades1to3 = internalQuery({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    return settings?.includeGrades1to3InRankings ?? DEFAULT_SETTINGS.includeGrades1to3InRankings;
  },
});

// Internal mutation to notify admins about deletions
export const notifyAdminsOnDelete = internalMutation({
  args: {
    schoolId: v.id("schools"),
    deletedByUserId: v.id("users"),
    entityType: v.union(v.literal("grade"), v.literal("absence"), v.literal("review")),
    entityDetails: v.string(),
    studentId: v.optional(v.id("students")),
  },
  handler: async (ctx, args): Promise<void> => {
    // Get school settings
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    // Check if notification is enabled for this entity type
    let shouldNotify = false;
    if (args.entityType === "grade") {
      shouldNotify = settings?.notifyAdminsOnGradeDelete ?? DEFAULT_SETTINGS.notifyAdminsOnGradeDelete;
    } else if (args.entityType === "absence") {
      shouldNotify = settings?.notifyAdminsOnAbsenceDelete ?? DEFAULT_SETTINGS.notifyAdminsOnAbsenceDelete;
    } else if (args.entityType === "review") {
      shouldNotify = settings?.notifyAdminsOnReviewDelete ?? DEFAULT_SETTINGS.notifyAdminsOnReviewDelete;
    }

    if (!shouldNotify) {
      return;
    }

    // Get the user who deleted
    const deletedByUser = await ctx.db.get(args.deletedByUserId);
    const deletedByName = deletedByUser
      ? [deletedByUser.firstName, deletedByUser.lastName].filter(Boolean).join(" ")
      : "Потребител";

    // Get all admins, directors, and vice directors in this school
    const allUsers = await ctx.db
      .query("users")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .collect();

    const admins = allUsers.filter(u => 
      u.role === "system_admin" ||
      u.role === "director" ||
      u.role === "vice_director" ||
      u.roles?.includes("system_admin") ||
      u.roles?.includes("director") ||
      u.roles?.includes("vice_director")
    );

    // Create notification for each admin
    const entityTypeLabels: Record<string, string> = {
      grade: "оценка",
      absence: "отсъствие",
      review: "отзив",
    };

    const title = `Изтрита ${entityTypeLabels[args.entityType]}`;
    const message = `${deletedByName} изтри ${entityTypeLabels[args.entityType]}: ${args.entityDetails}`;

    for (const admin of admins) {
      // Don't notify the user who deleted
      if (admin._id === args.deletedByUserId) continue;

      await ctx.db.insert("notifications", {
        userId: admin._id,
        type: "admin_alert",
        title,
        message,
        isRead: false,
        schoolId: args.schoolId,
      });
    }
  },
});

// Internal query to check if lesson time window is enabled
export const isLessonTimeWindowEnabled = internalQuery({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    return settings?.enableLessonTimeWindow ?? DEFAULT_SETTINGS.enableLessonTimeWindow;
  },
});

// Internal query to check if identifier is required for a role
export const checkIdentifierRequired = internalQuery({
  args: {
    schoolId: v.id("schools"),
    roleType: v.union(v.literal("student"), v.literal("teacher")),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    if (args.roleType === "student") {
      return settings?.studentIdentifierRequired ?? DEFAULT_SETTINGS.studentIdentifierRequired;
    } else {
      return settings?.teacherIdentifierRequired ?? DEFAULT_SETTINGS.teacherIdentifierRequired;
    }
  },
});

// ============================================================================
// New internal functions for remaining settings
// ============================================================================

// Internal query to check if absent teachers can be substitutes
export const checkAbsentTeachersCanBeSubstitutes = internalQuery({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    return settings?.absentTeachersCanBeSubstitutes ?? DEFAULT_SETTINGS.absentTeachersCanBeSubstitutes;
  },
});

// Internal query to get substitutes access days limit
export const getSubstitutesAccessDays = internalQuery({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args): Promise<number> => {
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    return settings?.substitutesAccessDays ?? DEFAULT_SETTINGS.substitutesAccessDays;
  },
});

// Internal query to check if weekends should be included in schedules
export const checkIncludeWeekends = internalQuery({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    return settings?.includeWeekends ?? DEFAULT_SETTINGS.includeWeekends;
  },
});

// Internal query to get school year start day
export const getSchoolYearStartDay = internalQuery({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args): Promise<number> => {
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    return settings?.schoolYearStartDay ?? DEFAULT_SETTINGS.schoolYearStartDay;
  },
});

// Internal query to check auto-excuse settings for different note types
export const checkAutoExcuse = internalQuery({
  args: {
    schoolId: v.id("schools"),
    noteType: v.union(v.literal("medical"), v.literal("parent"), v.literal("other")),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    if (args.noteType === "medical") {
      return settings?.autoExcuseWithMedicalNote ?? DEFAULT_SETTINGS.autoExcuseWithMedicalNote;
    } else if (args.noteType === "parent") {
      return settings?.autoExcuseWithParentNote ?? DEFAULT_SETTINGS.autoExcuseWithParentNote;
    } else {
      return settings?.autoExcuseWithOtherNote ?? DEFAULT_SETTINGS.autoExcuseWithOtherNote;
    }
  },
});

// Internal query to check if missing absences check is enabled
export const checkMissingAbsencesEnabled = internalQuery({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    return settings?.checkMissingAbsences ?? DEFAULT_SETTINGS.checkMissingAbsences;
  },
});

// Internal query to check if students/parents can see topics
export const checkStudentsParentsSeeTopics = internalQuery({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    return settings?.studentsParentsSeeTopics ?? DEFAULT_SETTINGS.studentsParentsSeeTopics;
  },
});

// Internal query to check if second class hour section should be shown
export const checkShowSecondClassHour = internalQuery({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    return settings?.showSecondClassHour ?? DEFAULT_SETTINGS.showSecondClassHour;
  },
});

// Internal query to check if e-diary is enabled
export const checkEDiaryEnabled = internalQuery({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    return settings?.eDiaryEnabled ?? DEFAULT_SETTINGS.eDiaryEnabled;
  },
});

// Internal query to get warnUntakenLessonsAfterDays setting
export const getWarnUntakenLessonsAfterDays = internalQuery({
  args: {
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args): Promise<number> => {
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId))
      .unique();

    return settings?.warnUntakenLessonsAfterDays ?? DEFAULT_SETTINGS.warnUntakenLessonsAfterDays;
  },
});

// Query to check for untaken lessons and create warnings for teachers
// This should be called when teacher loads their dashboard or lessons page
export const checkUntakenLessonsWarning = query({
  args: {},
  handler: async (ctx): Promise<{
    hasWarning: boolean;
    untakenCount: number;
    daysThreshold: number;
    lessons: Array<{
      classId: Id<"classes">;
      className: string;
      subjectName: string;
      date: number;
      periodIndex: number;
      daysSinceScheduled: number;
    }>;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { hasWarning: false, untakenCount: 0, daysThreshold: 0, lessons: [] };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user?.schoolId) {
      return { hasWarning: false, untakenCount: 0, daysThreshold: 0, lessons: [] };
    }

    // Check if user is a teacher
    const isTeacher =
      user.role === "teacher" ||
      user.role === "class_teacher" ||
      user.roles?.includes("teacher") ||
      user.roles?.includes("class_teacher");

    if (!isTeacher) {
      return { hasWarning: false, untakenCount: 0, daysThreshold: 0, lessons: [] };
    }

    // Get warnUntakenLessonsAfterDays setting
    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .unique();

    const daysThreshold = settings?.warnUntakenLessonsAfterDays ?? DEFAULT_SETTINGS.warnUntakenLessonsAfterDays;
    
    if (daysThreshold <= 0) {
      return { hasWarning: false, untakenCount: 0, daysThreshold: 0, lessons: [] };
    }

    // Get teacher record
    const teacher = await ctx.db
      .query("teachers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!teacher) {
      return { hasWarning: false, untakenCount: 0, daysThreshold, lessons: [] };
    }

    // Calculate the threshold date (today minus daysThreshold)
    const now = new Date();
    const todayMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
    const thresholdDate = todayMidnight - (daysThreshold * 24 * 60 * 60 * 1000);

    // Get lessons for this teacher that are:
    // 1. Not taken (isTaken = false or null)
    // 2. Date is before the threshold (more than X days ago)
    const teacherLessons = await ctx.db
      .query("lessons")
      .withIndex("by_teacher", (q) => q.eq("teacherId", teacher._id))
      .collect();

    const untakenLessons = teacherLessons.filter(
      (l) => !l.isTaken && l.date < thresholdDate && l.date <= todayMidnight
    );

    // Enrich with class and subject names
    const enrichedLessons = await Promise.all(
      untakenLessons.slice(0, 10).map(async (lesson) => {
        const classDoc = await ctx.db.get(lesson.classId);
        const subject = await ctx.db.get(lesson.subjectId);
        const daysSinceScheduled = Math.floor((todayMidnight - lesson.date) / (24 * 60 * 60 * 1000));

        return {
          classId: lesson.classId,
          className: classDoc?.name ?? "Непознат клас",
          subjectName: subject?.name ?? "Непознат предмет",
          date: lesson.date,
          periodIndex: lesson.periodIndex,
          daysSinceScheduled,
        };
      })
    );

    return {
      hasWarning: untakenLessons.length > 0,
      untakenCount: untakenLessons.length,
      daysThreshold,
      lessons: enrichedLessons,
    };
  },
});

// ============================================================================
// Module Visibility
// ============================================================================

// Get module visibility settings (accessible by all authenticated users)
export const getModuleVisibility = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      // Return all modules enabled for unauthenticated users
      return {
        moduleHomeEnabled: true,
        moduleDiaryEnabled: true,
        moduleTasksEnabled: true,
        moduleStatisticsEnabled: true,
        moduleExtracurricularEnabled: true,
        moduleEventsEnabled: true,
        moduleCompetitionsEnabled: true,
        moduleAdminEnabled: true,
        moduleLectureHoursEnabled: true,
        moduleFeesEnabled: true,
        moduleReportsEnabled: true,
        moduleMessagesEnabled: true,
      };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user?.schoolId) {
      // Return defaults if no school
      return {
        moduleHomeEnabled: DEFAULT_SETTINGS.moduleHomeEnabled,
        moduleDiaryEnabled: DEFAULT_SETTINGS.moduleDiaryEnabled,
        moduleTasksEnabled: DEFAULT_SETTINGS.moduleTasksEnabled,
        moduleStatisticsEnabled: DEFAULT_SETTINGS.moduleStatisticsEnabled,
        moduleExtracurricularEnabled: DEFAULT_SETTINGS.moduleExtracurricularEnabled,
        moduleEventsEnabled: DEFAULT_SETTINGS.moduleEventsEnabled,
        moduleCompetitionsEnabled: DEFAULT_SETTINGS.moduleCompetitionsEnabled,
        moduleAdminEnabled: DEFAULT_SETTINGS.moduleAdminEnabled,
        moduleLectureHoursEnabled: DEFAULT_SETTINGS.moduleLectureHoursEnabled,
        moduleFeesEnabled: DEFAULT_SETTINGS.moduleFeesEnabled,
        moduleReportsEnabled: DEFAULT_SETTINGS.moduleReportsEnabled,
        moduleMessagesEnabled: DEFAULT_SETTINGS.moduleMessagesEnabled,
      };
    }

    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .unique();

    // Check if user is admin (they always see admin settings link even if moduleAdminEnabled is false)
    const isAdmin =
      user.role === "system_admin" ||
      user.role === "director" ||
      user.role === "vice_director" ||
      user.roles?.includes("system_admin") ||
      user.roles?.includes("director") ||
      user.roles?.includes("vice_director");

    // For admin module: even if disabled, admins should still see the settings link
    // So we return a special flag for this
    const moduleAdminSetting = settings?.moduleAdminEnabled ?? DEFAULT_SETTINGS.moduleAdminEnabled;

    return {
      moduleHomeEnabled: settings?.moduleHomeEnabled ?? DEFAULT_SETTINGS.moduleHomeEnabled,
      moduleDiaryEnabled: settings?.moduleDiaryEnabled ?? DEFAULT_SETTINGS.moduleDiaryEnabled,
      moduleTasksEnabled: settings?.moduleTasksEnabled ?? DEFAULT_SETTINGS.moduleTasksEnabled,
      moduleStatisticsEnabled: settings?.moduleStatisticsEnabled ?? DEFAULT_SETTINGS.moduleStatisticsEnabled,
      moduleExtracurricularEnabled: settings?.moduleExtracurricularEnabled ?? DEFAULT_SETTINGS.moduleExtracurricularEnabled,
      moduleEventsEnabled: settings?.moduleEventsEnabled ?? DEFAULT_SETTINGS.moduleEventsEnabled,
      moduleCompetitionsEnabled: settings?.moduleCompetitionsEnabled ?? DEFAULT_SETTINGS.moduleCompetitionsEnabled,
      // For admin module: disabled for non-admins when setting is false, but admins always see settings
      moduleAdminEnabled: moduleAdminSetting || isAdmin,
      moduleAdminSettingsOnlyForAdmins: !moduleAdminSetting && isAdmin, // Special flag: only show settings link
      moduleLectureHoursEnabled: settings?.moduleLectureHoursEnabled ?? DEFAULT_SETTINGS.moduleLectureHoursEnabled,
      moduleFeesEnabled: settings?.moduleFeesEnabled ?? DEFAULT_SETTINGS.moduleFeesEnabled,
      moduleReportsEnabled: settings?.moduleReportsEnabled ?? DEFAULT_SETTINGS.moduleReportsEnabled,
      moduleMessagesEnabled: settings?.moduleMessagesEnabled ?? DEFAULT_SETTINGS.moduleMessagesEnabled,
    };
  },
});
