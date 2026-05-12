import { ConvexError } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel.d.ts";
import { internal } from "./_generated/api.js";
import { checkRateLimit } from "./rateLimiting.js";
import { sanitizeString, validateEmail, validateName, validatePhone } from "./fileValidation.js";

// Helper function to check if user has a specific role (primary or additional)
export function hasRole(user: Doc<"users">, role: string): boolean {
  if (user.role === role) return true;
  if (user.roles && user.roles.includes(role as typeof user.role)) return true;
  return false;
}

// Helper function to check if user is admin
export function isAdmin(user: Doc<"users">): boolean {
  return (
    hasRole(user, "system_admin") ||
    hasRole(user, "director") ||
    hasRole(user, "vice_director") ||
    hasRole(user, "secretary")
  );
}

/**
 * Check if a user has a proper name (firstName AND lastName are set)
 * Used to filter out incomplete user records
 */
export function hasProperName(user: Doc<"users"> | null | undefined): boolean {
  if (!user) return false;
  return Boolean(user.firstName && user.lastName);
}

/**
 * Build a proper user name from firstName, middleName, lastName or fallback to name field
 * Returns "-" if no name data is available
 */
export function buildUserName(user: Doc<"users"> | null | undefined): string {
  if (!user) return "-";
  
  // First try to build from firstName, middleName, lastName
  const { firstName, middleName, lastName } = user;
  if (firstName || lastName) {
    const middleInitial = middleName ? ` ${middleName.charAt(0)}.` : "";
    return `${firstName || ""}${middleInitial} ${lastName || ""}`.trim() || "-";
  }
  
  // Fallback to the name field
  if (user.name) {
    return user.name;
  }
  
  // Fallback to email prefix if available
  if (user.email) {
    const emailPrefix = user.email.split("@")[0];
    return emailPrefix;
  }
  
  return "-";
}

// Get student's class
export const getStudentClass = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<Id<"classes"> | null> => {
    // ✅ SECURITY FIX: Require authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const studentRecord = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    
    return studentRecord?.classId || null;
  },
});

// Get current user by token
export const getUserByToken = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    
    return user;
  },
});

// Get teacher's subjects and classes
export const getTeacherInfo = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<{
    subjects: Array<{ _id: Id<"subjects">; name: string }>;
    classes: Array<{ _id: Id<"classes">; name: string; grade: number; letter: string }>;
    homeroomClass: { _id: Id<"classes">; name: string } | null;
  }> => {
    // ✅ SECURITY FIX: Require authentication
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

    // ✅ SECURITY: Only allow viewing own info or if admin/teacher
    const isAdminOrTeacher = 
      hasRole(currentUser, "system_admin") ||
      hasRole(currentUser, "director") ||
      hasRole(currentUser, "vice_director") ||
      hasRole(currentUser, "secretary") ||
      hasRole(currentUser, "teacher") ||
      hasRole(currentUser, "class_teacher");

    if (currentUser._id !== args.userId && !isAdminOrTeacher) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Нямате право да преглеждате тази информация",
      });
    }

    // Get user
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return { subjects: [], classes: [], homeroomClass: null };
    }
    
    // Get teacher record
    const teacherRecord = await ctx.db
      .query("teachers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    
    if (!teacherRecord) {
      // Even without a teacher record, check if user is homeroom teacher
      const homeroomClassDoc = await ctx.db
        .query("classes")
        .withIndex("by_class_teacher", (q) => q.eq("classTeacherId", args.userId))
        .first();
      const homeroomClass = homeroomClassDoc ? {
        _id: homeroomClassDoc._id,
        name: homeroomClassDoc.name,
      } : null;
      return { subjects: [], classes: [], homeroomClass };
    }
    
    // Check if this teacher is a homeroom teacher for any class
    const homeroomClassDoc = await ctx.db
      .query("classes")
      .withIndex("by_class_teacher", (q) => q.eq("classTeacherId", args.userId))
      .first();
    const homeroomClass = homeroomClassDoc ? {
      _id: homeroomClassDoc._id,
      name: homeroomClassDoc.name,
    } : null;
    
    // Collect subjects ONLY from user.teacherSubjects (canonical source)
    const subjectIdsFromUser = new Set<string>();
    const subjectIds = user.teacherSubjects || [];
    for (const id of subjectIds) {
      subjectIdsFromUser.add(id as string);
    }
    
    // Get all weekly schedules where this teacher teaches
    const allSchedules = await ctx.db.query("weeklySchedules").collect();
    const classIds = new Set<Id<"classes">>();
    
    for (const schedule of allSchedules) {
      for (const entry of schedule.entries) {
        if (entry.teacherId === teacherRecord._id) {
          classIds.add(schedule.classId);
        }
      }
    }
    
    // Use only user.teacherSubjects as the canonical source for subjects
    const allSubjectIds = subjectIdsFromUser;
    
    // Resolve subject details
    const subjects = (await Promise.all(
      Array.from(allSubjectIds).map(async (subjectId) => {
        const subject = await ctx.db.get(subjectId as Id<"subjects">);
        return subject ? { _id: subject._id, name: subject.name } : null;
      })
    )).filter((s): s is { _id: Id<"subjects">; name: string } => s !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
    
    // Get class details
    const classes = (await Promise.all(
      Array.from(classIds).map(async (classId) => {
        const classDoc = await ctx.db.get(classId);
        return classDoc ? {
          _id: classDoc._id,
          name: classDoc.name,
          grade: classDoc.grade,
          letter: classDoc.letter,
        } : null;
      })
    )).filter((c): c is { _id: Id<"classes">; name: string; grade: number; letter: string } => c !== null)
      .sort((a, b) => {
        if (a.grade !== b.grade) return a.grade - b.grade;
        return a.letter.localeCompare(b.letter);
      });
    
    return {
      subjects,
      classes,
      homeroomClass,
    };
  },
});

// Get detailed teacher info (for teacher profile section)
export const getTeacherDetails = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<{
    staffNumber: string | null;
    homeroomClass: { _id: Id<"classes">; name: string } | null;
    classCount: number;
    studentCount: number;
    subjects: Array<{ _id: Id<"subjects">; name: string }>;
  }> => {
    // ✅ SECURITY FIX: Require authentication
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

    // ✅ SECURITY: Only allow viewing own info or if admin/teacher
    const isAdminOrTeacher = 
      hasRole(currentUser, "system_admin") ||
      hasRole(currentUser, "director") ||
      hasRole(currentUser, "vice_director") ||
      hasRole(currentUser, "secretary") ||
      hasRole(currentUser, "teacher") ||
      hasRole(currentUser, "class_teacher");

    if (currentUser._id !== args.userId && !isAdminOrTeacher) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Нямате право да преглеждате тази информация",
      });
    }

    // Get user
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return {
        staffNumber: null,
        homeroomClass: null,
        classCount: 0,
        studentCount: 0,
        subjects: [],
      };
    }
    
    // Staff number (using identifier field if available)
    const staffNumber = user.identifier || null;
    
    // Get teacher record
    const teacherRecord = await ctx.db
      .query("teachers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    
    if (!teacherRecord) {
      return {
        staffNumber,
        homeroomClass: null,
        classCount: 0,
        studentCount: 0,
        subjects: [],
      };
    }
    
    // Check if this teacher is a homeroom teacher for any class
    const homeroomClassDoc = await ctx.db
      .query("classes")
      .withIndex("by_class_teacher", (q) => q.eq("classTeacherId", args.userId))
      .first();
    
    const homeroomClass = homeroomClassDoc ? {
      _id: homeroomClassDoc._id,
      name: homeroomClassDoc.name,
    } : null;
    
    // Get subjects for this teacher from user record ONLY (canonical source)
    const subjectIdsFromUser = new Set<string>();
    const userSubjectIds = user.teacherSubjects || [];
    for (const id of userSubjectIds) {
      subjectIdsFromUser.add(id as string);
    }
    
    // Get all weekly schedules where this teacher teaches
    const allSchedules = await ctx.db.query("weeklySchedules").collect();
    const classIds = new Set<Id<"classes">>();
    
    for (const schedule of allSchedules) {
      for (const entry of schedule.entries) {
        if (entry.teacherId === teacherRecord._id) {
          classIds.add(schedule.classId);
        }
      }
    }
    
    // Use only user.teacherSubjects as the canonical source
    const allSubjectIds = subjectIdsFromUser;
    
    // Resolve subject details
    const subjects = (await Promise.all(
      Array.from(allSubjectIds).map(async (subjectId) => {
        const subject = await ctx.db.get(subjectId as Id<"subjects">);
        return subject ? { _id: subject._id, name: subject.name } : null;
      })
    )).filter((s): s is { _id: Id<"subjects">; name: string } => s !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
    
    // Count students across all classes this teacher teaches
    let studentCount = 0;
    for (const classId of classIds) {
      const studentsInClass = await ctx.db
        .query("students")
        .withIndex("by_class", (q) => q.eq("classId", classId))
        .collect();
      studentCount += studentsInClass.length;
    }
    
    return {
      staffNumber,
      homeroomClass,
      classCount: classIds.size,
      studentCount,
      subjects,
    };
  },
});

export const updateCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Check if we've already stored this identity before.
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (user !== null) {
      // Check if user is deleted
      if (user.isDeleted) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Акаунтът е деактивиран и не може да влиза в системата",
        });
      }
      // Record login session
      await ctx.db.insert("loginHistory", {
        userId: user._id,
        timestamp: Date.now(),
        sessionType: "hercules_auth",
      });
      return user._id;
    }

    // NEW USER: Find if admin created this user by email match
    // Match by email regardless of tokenIdentifier prefix (supports both
    // pre-created users and users who previously linked with a different
    // Hercules Auth account)
    const allUsers = await ctx.db.query("users").collect();
    const preCreatedUser = allUsers.find(u => 
      u.email && identity.email && u.email === identity.email
    );

    if (preCreatedUser) {
      // STRICT CHECK: User must be active and not deleted
      if (preCreatedUser.isDeleted) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Акаунтът е деактивиран и не може да влиза в системата",
        });
      }

      if (!preCreatedUser.isActive) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Акаунтът не е активен. Свържете се с администратор",
        });
      }

      // Link this Hercules Auth identity to existing user
      // Keep the roles EXACTLY as admin set them
      await ctx.db.patch(preCreatedUser._id, {
        tokenIdentifier: identity.tokenIdentifier,
      });

      // Record login session for linked user
      await ctx.db.insert("loginHistory", {
        userId: preCreatedUser._id,
        timestamp: Date.now(),
        sessionType: "hercules_auth",
      });

      return preCreatedUser._id;
    }

    // CRITICAL: Only allow first-time admin creation if NO users exist
    const existingUsers = await ctx.db.query("users").collect();
    if (existingUsers.length > 0) {
      // There are existing users, so this person MUST be invited by admin
      // Return null instead of throwing - the frontend will show a friendly message
      return null;
    }

    // First user ever - create as admin (initial setup only)
    return await ctx.db.insert("users", {
      name: identity.name,
      email: identity.email,
      tokenIdentifier: identity.tokenIdentifier,
      role: "system_admin",
      status: "active",
      isActive: true,
    });
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      // Return null instead of throwing error - allows graceful handling
      return null;
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    
    // Deleted users are treated as non-existent so the frontend
    // shows the unauthenticated / "no account" state instead of crashing
    if (user?.isDeleted) {
      return null;
    }
    
    return user;
  },
});

export const getAuthSetupStatus = query({
  args: {},
  handler: async (ctx) => {
    const firstUser = await ctx.db.query("users").first();
    return {
      hasUsers: firstUser !== null,
    };
  },
});

// Internal mutation for creating user (called from action after password is hashed)
export const createUserInternal = internalMutation({
  args: {
    firstName: v.string(),
    middleName: v.optional(v.string()),
    lastName: v.string(),
    identifier: v.string(),
    identifierType: v.union(v.literal("egn"), v.literal("lnch"), v.literal("other")),
    birthDate: v.optional(v.string()),
    birthPlace: v.optional(v.string()),
    citizenship: v.optional(v.string()),
    gender: v.union(v.literal("male"), v.literal("female"), v.literal("other")),
    phone: v.string(),
    email: v.string(),
    isActive: v.boolean(),
    username: v.optional(v.string()),
    hashedPassword: v.optional(v.string()),
    role: v.union(
      v.literal("teacher"),
      v.literal("student"),
      v.literal("parent"),
      v.literal("director"),
      v.literal("vice_director"),
      v.literal("system_admin"),
      v.literal("secretary"),
      v.literal("pedagogical_counselor"),
      v.literal("housekeeper"),
      v.literal("class_teacher")
    ),
    roles: v.optional(v.array(v.union(
      v.literal("teacher"),
      v.literal("student"),
      v.literal("parent"),
      v.literal("director"),
      v.literal("vice_director"),
      v.literal("system_admin"),
      v.literal("secretary"),
      v.literal("pedagogical_counselor"),
      v.literal("housekeeper"),
      v.literal("class_teacher")
    ))),
    schoolId: v.optional(v.id("schools")),
    appointmentDate: v.optional(v.string()),
    positionType: v.optional(v.union(v.literal("titular"), v.literal("substitute"))),
    staffQuota: v.optional(v.union(v.literal("1"), v.literal("0.5"), v.literal("0.25"))),
    personnelType: v.optional(v.string()),
    positionName: v.optional(v.string()),
    appointedFor: v.optional(v.string()),
    contractType: v.optional(v.string()),
    contractBasis: v.optional(v.string()),
    contractNumber: v.optional(v.string()),
    contractYear: v.optional(v.string()),
    contractStructure: v.optional(v.string()),
    totalExperienceYears: v.optional(v.number()),
    totalExperienceMonths: v.optional(v.number()),
    totalExperienceDays: v.optional(v.number()),
    specialtyExperienceYears: v.optional(v.number()),
    specialtyExperienceMonths: v.optional(v.number()),
    specialtyExperienceDays: v.optional(v.number()),
    teachingExperienceYears: v.optional(v.number()),
    teachingExperienceMonths: v.optional(v.number()),
    teachingExperienceDays: v.optional(v.number()),
    educationDegree: v.optional(v.string()),
    university: v.optional(v.string()),
    specialty: v.optional(v.string()),
    diplomaNumber: v.optional(v.string()),
    diplomaDate: v.optional(v.string()),
    isPedagogicalQualification: v.optional(v.boolean()),
    teachingSubjects: v.optional(v.array(v.string())),
    teacherSubjects: v.optional(v.array(v.id("subjects"))),
    scientificTitle: v.optional(v.string()),
    classId: v.optional(v.id("classes")),
    teachingClassIds: v.optional(v.array(v.id("classes"))),
    studentIds: v.optional(v.array(v.id("students"))), // For parent role - IDs of student records
    studentNumber: v.optional(v.number()),
    parent1Name: v.optional(v.string()),
    parent2Name: v.optional(v.string()),
    personalDoctor: v.optional(v.string()),
    address: v.optional(v.string()),
    skipValidation: v.optional(v.boolean()), // For bulk import - skip strict validation
  },
  handler: async (ctx, args): Promise<Id<"users">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // ✅ FIX: Get current user for rate limiting and audit log
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

    // ✅ SECURITY: Block students from creating users
    if (currentUser.role === "student") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Учениците нямат право да създават потребители",
      });
    }

    // ✅ FIX 1: Rate limiting (skip for bulk imports)
    if (!args.skipValidation) {
      await checkRateLimit(ctx, currentUser._id, "create_user");
    }

    // ✅ FIX 4: Input validation (skip if bulk import with skipValidation flag)
    if (!args.skipValidation) {
      if (!validateEmail(args.email)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Невалиден имейл адрес",
        });
      }

      if (args.phone && !validatePhone(args.phone)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Невалиден телефонен номер",
        });
      }

      if (args.firstName && !validateName(args.firstName)) {
        throw new ConvexError({
          code: "BAD_REQUEST",
          message: "Невалидно име",
        });
      }
    }

    // ✅ FIX 4: Sanitize text inputs
    const sanitizedFirstName = args.firstName ? sanitizeString(args.firstName, 100) : undefined;
    const sanitizedMiddleName = args.middleName ? sanitizeString(args.middleName, 100) : undefined;
    const sanitizedLastName = args.lastName ? sanitizeString(args.lastName, 100) : undefined;

    // ✅ Check identifier required settings (skip if bulk import with skipValidation flag)
    if (args.schoolId && !args.skipValidation) {
      const settings = await ctx.db
        .query("platformSettings")
        .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
        .unique();

      const isTeacher = args.role === "teacher" || args.role === "class_teacher" || 
        args.roles?.includes("teacher") || args.roles?.includes("class_teacher");
      const isStudent = args.role === "student" || args.roles?.includes("student");

      // Check teacherIdentifierRequired
      if (isTeacher && (settings?.teacherIdentifierRequired ?? false)) {
        if (!args.identifier || args.identifier.trim() === "") {
          throw new ConvexError({
            code: "BAD_REQUEST",
            message: "Идентификаторът (ЕГН/ЛНЧ) е задължителен за учители",
          });
        }
      }

      // Check studentIdentifierRequired
      if (isStudent && (settings?.studentIdentifierRequired ?? false)) {
        if (!args.identifier || args.identifier.trim() === "") {
          throw new ConvexError({
            code: "BAD_REQUEST",
            message: "Идентификаторът (ЕГН/ЛНЧ) е задължителен за ученици",
          });
        }
      }
    }

    // Create a unique token identifier for the new user
    const tokenIdentifier = `temp_${Date.now()}_${Math.random()}`;

    // Build user name
    const fullName = [sanitizedFirstName, sanitizedMiddleName, sanitizedLastName]
      .filter(Boolean)
      .join(" ");

    // Insert user (password already hashed by action)
    const userId = await ctx.db.insert("users", {
      tokenIdentifier,
      name: fullName,
      email: args.email,
      role: args.role,
      roles: args.roles,
      teacherSubjects: args.teacherSubjects,
      status: args.isActive ? "active" : "new_inactive",
      schoolId: args.schoolId,
      isActive: args.isActive,
      isDeleted: false, // Важно: потребителят е активен при създаване
      username: args.username,
      password: args.hashedPassword,
      firstName: sanitizedFirstName,
      middleName: sanitizedMiddleName,
      lastName: sanitizedLastName,
      phone: args.phone,
      birthDate: args.birthDate,
      birthPlace: args.birthPlace,
      gender: args.gender,
      scientificTitle: args.scientificTitle,
      identifier: args.identifier,
      identifierType: args.identifierType,
      parent1Name: args.parent1Name,
      parent2Name: args.parent2Name,
      personalDoctor: args.personalDoctor,
      address: args.address,
    });

    // ✅ FIX 3: Audit log
    await ctx.db.insert("auditLog", {
      userId: currentUser._id,
      action: "create_user",
      targetType: "user",
      targetId: userId,
      details: JSON.stringify({
        email: args.email,
        role: args.role,
        roles: args.roles,
      }),
      schoolId: args.schoolId,
    });

    // If teacher role, create teacher record and class associations
    if ((args.role === "teacher" || args.roles?.includes("teacher")) && args.schoolId) {
      const teacherId = await ctx.db.insert("teachers", {
        userId,
        schoolId: args.schoolId,
        specialization: args.appointedFor,
        hasLeft: false,
      });

      // Create class-teacher associations for teaching classes
      if (args.teachingClassIds && args.teachingClassIds.length > 0 && args.teacherSubjects && args.teacherSubjects.length > 0) {
        // Get current academic year from first class or use default
        const firstClass = await ctx.db.get(args.teachingClassIds[0]);
        const academicYear = firstClass?.academicYear || "2024/2025";

        // Create classSubjects entries for each class-subject combination
        for (const classId of args.teachingClassIds) {
          for (const subjectId of args.teacherSubjects) {
            await ctx.db.insert("classSubjects", {
              classId,
              subjectId,
              teacherId,
              hoursPerWeek: 0, // Default value, can be updated later
              academicYear,
            });
          }
        }
      }
    }

    // If student role, create student record
    if ((args.role === "student" || args.roles?.includes("student")) && args.classId) {
      // Get the class to retrieve schoolId
      const classData = await ctx.db.get(args.classId);
      if (classData) {
        await ctx.db.insert("students", {
          userId,
          classId: args.classId,
          schoolId: classData.schoolId,
          studentNumber: args.studentNumber,
        });
      }
    }

    // If parent role, create parent record
    if ((args.role === "parent" || args.roles?.includes("parent")) && args.studentIds && args.studentIds.length > 0) {
      await ctx.db.insert("parents", {
        userId,
        studentIds: args.studentIds,
        schoolId: args.schoolId,
      });
    }

    return userId;
  },
});

export const createFirstAdminInternal = internalMutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    username: v.string(),
    hashedPassword: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"users">> => {
    const existingUser = await ctx.db.query("users").first();
    if (existingUser) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Началният администратор вече е създаден",
      });
    }

    const allUsers = await ctx.db.query("users").collect();
    const duplicate = allUsers.find(
      (user) => user.email === args.email || user.username === args.username,
    );
    if (duplicate) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Вече съществува потребител с този имейл или потребителско име",
      });
    }

    const fullName = [args.firstName, args.lastName].filter(Boolean).join(" ");

    return await ctx.db.insert("users", {
      tokenIdentifier: `temp_setup_${Date.now()}_${Math.random()}`,
      name: fullName,
      email: args.email,
      role: "system_admin",
      roles: ["system_admin"],
      status: "active",
      isActive: true,
      username: args.username,
      firstName: args.firstName,
      lastName: args.lastName,
      password: args.hashedPassword,
      isDeleted: false,
    });
  },
});

// Internal mutation to link a parent user to a student by searching for student name
export const linkParentToStudentInternal = internalMutation({
  args: {
    parentUserId: v.id("users"),
    studentNameOrIdentifier: v.string(),
    schoolId: v.optional(v.id("schools")),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const searchTerm = args.studentNameOrIdentifier.trim().toLowerCase();
    
    // Get all students
    const students = args.schoolId
      ? await ctx.db.query("students").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!)).collect()
      : await ctx.db.query("students").collect();
    
    // Find matching student by name or identifier
    let foundStudent = null;
    let foundUser = null;
    
    for (const student of students) {
      const user = await ctx.db.get(student.userId);
      if (!user) continue;
      
      // Check by identifier (EGN)
      if (user.identifier && user.identifier.toLowerCase() === searchTerm) {
        foundStudent = student;
        foundUser = user;
        break;
      }
      
      // Check by full name
      const fullName = [user.firstName, user.middleName, user.lastName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      
      if (fullName.includes(searchTerm) || searchTerm.includes(fullName)) {
        foundStudent = student;
        foundUser = user;
        break;
      }
      
      // Check by name parts
      if (
        (user.firstName && searchTerm.includes(user.firstName.toLowerCase())) ||
        (user.lastName && searchTerm.includes(user.lastName.toLowerCase()))
      ) {
        foundStudent = student;
        foundUser = user;
        break;
      }
    }
    
    if (!foundStudent) {
      return { success: false, error: `Ученикът "${args.studentNameOrIdentifier}" не е намерен` };
    }
    
    // Get parent user and ensure they have parent role
    const parentUser = await ctx.db.get(args.parentUserId);
    if (!parentUser) {
      return { success: false, error: "Родителят не е намерен" };
    }
    
    // Update parent user to have parent role if not already
    const currentRoles = parentUser.roles || [];
    if (!currentRoles.includes("parent")) {
      await ctx.db.patch(args.parentUserId, {
        role: "parent",
        roles: [...currentRoles.filter(r => r !== "parent"), "parent"],
      });
    }
    
    // Check if parent record already exists
    const existingParent = await ctx.db
      .query("parents")
      .withIndex("by_user", (q) => q.eq("userId", args.parentUserId))
      .unique();
    
    if (existingParent) {
      // Add student to existing parent record if not already linked
      if (!existingParent.studentIds.includes(foundStudent._id)) {
        await ctx.db.patch(existingParent._id, {
          studentIds: [...existingParent.studentIds, foundStudent._id],
        });
      }
    } else {
      // Create new parent record
      await ctx.db.insert("parents", {
        userId: args.parentUserId,
        studentIds: [foundStudent._id],
        schoolId: args.schoolId,
      });
    }
    
    return { success: true };
  },
});

// Internal mutation to update student's personal doctor by searching for student name
export const updateStudentPersonalDoctorInternal = internalMutation({
  args: {
    doctorName: v.string(),
    studentNameOrIdentifier: v.string(),
    schoolId: v.optional(v.id("schools")),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const searchTerm = args.studentNameOrIdentifier.trim().toLowerCase();
    
    // Get all students
    const students = args.schoolId
      ? await ctx.db.query("students").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!)).collect()
      : await ctx.db.query("students").collect();
    
    // Find matching student by name or identifier
    let foundStudent = null;
    let foundUser = null;
    
    for (const student of students) {
      const user = await ctx.db.get(student.userId);
      if (!user) continue;
      
      // Check by identifier (EGN)
      if (user.identifier && user.identifier.toLowerCase() === searchTerm) {
        foundStudent = student;
        foundUser = user;
        break;
      }
      
      // Check by full name
      const fullName = [user.firstName, user.middleName, user.lastName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      
      if (fullName.includes(searchTerm) || searchTerm.includes(fullName)) {
        foundStudent = student;
        foundUser = user;
        break;
      }
      
      // Check by name parts
      if (
        (user.firstName && searchTerm.includes(user.firstName.toLowerCase())) ||
        (user.lastName && searchTerm.includes(user.lastName.toLowerCase()))
      ) {
        foundStudent = student;
        foundUser = user;
        break;
      }
    }
    
    if (!foundStudent || !foundUser) {
      return { success: false, error: `Ученикът "${args.studentNameOrIdentifier}" не е намерен` };
    }
    
    // Update the user's personalDoctor field
    await ctx.db.patch(foundUser._id, {
      personalDoctor: args.doctorName,
    });
    
    return { success: true };
  },
});

export const getAllTeachers = query({
  args: { schoolId: v.optional(v.id("schools")) },
  handler: async (ctx, args): Promise<Array<{ _id: Id<"users">; name: string; email: string | undefined }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Get all users
    const allUsers = await ctx.db.query("users").collect();
    
    // Filter users who have "teacher" role either in role field or in roles array
    const teachers = allUsers.filter(user => 
      user.role === "teacher" || (user.roles && user.roles.includes("teacher"))
    );

    // Filter by school if provided
    const filteredTeachers = args.schoolId
      ? teachers.filter((t) => t.schoolId === args.schoolId)
      : teachers;

    return filteredTeachers.map((teacher) => ({
      _id: teacher._id,
      name: buildUserName(teacher),
      email: teacher.email,
    }));
  },
});

export const getAllStudents = query({
  args: { schoolId: v.optional(v.id("schools")) },
  handler: async (ctx, args): Promise<Array<{ _id: Id<"users">; studentRecordId: Id<"students">; name: string; className: string }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Get all student records
    const allStudentRecords = args.schoolId
      ? await ctx.db.query("students").withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!)).collect()
      : await ctx.db.query("students").collect();

    // Get user and class details for each student
    const students = await Promise.all(
      allStudentRecords.map(async (studentRecord) => {
        const user = await ctx.db.get(studentRecord.userId);
        const classDoc = await ctx.db.get(studentRecord.classId);
        
        // Build full name from firstName, middleName, lastName
        const nameParts = [
          user?.firstName,
          user?.middleName,
          user?.lastName
        ].filter(Boolean);
        const fullName = nameParts.length > 0 ? nameParts.join(" ") : "";
        
        // Skip users without names or deleted users
        if (!fullName || user?.isDeleted) {
          return null;
        }
        
        return {
          _id: user?._id || studentRecord.userId,
          studentRecordId: studentRecord._id,
          name: fullName,
          className: classDoc?.name || "",
        };
      })
    );

    // Filter out null entries (deleted or unnamed users)
    const validStudents = students.filter((s): s is NonNullable<typeof s> => s !== null);

    // Sort by class name and then by student name
    return validStudents.sort((a, b) => {
      if (a.className !== b.className) {
        return a.className.localeCompare(b.className);
      }
      return a.name.localeCompare(b.name);
    });
  },
});

// Get parents for a student
export const getStudentParents = query({
  args: { studentId: v.id("users") },
  handler: async (ctx, args): Promise<Array<{ _id: Id<"users">; name: string; email: string | undefined; phone: string | undefined }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Get the student record
    const studentRecord = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", args.studentId))
      .first();

    if (!studentRecord) {
      return [];
    }

    // Find all parent records that include this student
    const allParentRecords = await ctx.db.query("parents").collect();
    const parentRecords = allParentRecords.filter((pr) =>
      pr.studentIds.includes(studentRecord._id)
    );

    // Get parent user details
    const parents = await Promise.all(
      parentRecords.map(async (parentRecord) => {
        const user = await ctx.db.get(parentRecord.userId);
        return user ? {
          _id: user._id,
          name: buildUserName(user),
          email: user.email,
          phone: user.phone,
        } : null;
      })
    );

    return parents.filter((p): p is { _id: Id<"users">; name: string; email: string | undefined; phone: string | undefined } => p !== null);
  },
});

// Get parent record by user ID
export const getParentByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Find parent record for this user
    const parentRecord = await ctx.db
      .query("parents")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    return parentRecord;
  },
});

// Get parent's children with full details
export const getParentChildren = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<Array<{
    _id: Id<"students">;
    userId: Id<"users">;
    classId: Id<"classes">;
    name: string;
    className: string;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Find parent record for this user
    const parentRecord = await ctx.db
      .query("parents")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!parentRecord || !parentRecord.studentIds) {
      return [];
    }

    // Get all student records for parent's children
    const children = await Promise.all(
      parentRecord.studentIds.map(async (studentId) => {
        const studentRecord = await ctx.db.get(studentId);
        if (!studentRecord) return null;

        const user = await ctx.db.get(studentRecord.userId);
        if (!user) return null;
        
        const classDoc = await ctx.db.get(studentRecord.classId);
        
        // Build full name from firstName, middleName, lastName
        const nameParts = [
          user.firstName,
          user.middleName,
          user.lastName
        ].filter(Boolean);
        const fullName = nameParts.length > 0 ? nameParts.join(" ") : "";
        
        // Skip users without names or deleted users
        if (!fullName || user.isDeleted) {
          return null;
        }

        return {
          _id: studentRecord._id,
          userId: user._id,
          classId: studentRecord.classId,
          name: fullName,
          className: classDoc?.name || "",
        };
      })
    );

    // Filter out null entries
    return children.filter((c): c is NonNullable<typeof c> => c !== null);
  },
});

// Get teacher contact info with visibility settings applied
export const getTeacherContactInfo = query({
  args: { teacherUserId: v.id("users") },
  handler: async (ctx, args): Promise<{
    _id: Id<"users">;
    name: string;
    email?: string;
    phone?: string;
    subjects: string[];
  } | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Get current user
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

    // Get the teacher
    const teacher = await ctx.db.get(args.teacherUserId);
    if (!teacher) {
      return null;
    }

    // Check if current user is admin/teacher (they can always see contact info)
    const isAdminOrTeacher =
      currentUser.role === "system_admin" ||
      currentUser.role === "director" ||
      currentUser.role === "vice_director" ||
      currentUser.role === "teacher" ||
      currentUser.role === "class_teacher" ||
      currentUser.roles?.includes("system_admin") ||
      currentUser.roles?.includes("director") ||
      currentUser.roles?.includes("vice_director") ||
      currentUser.roles?.includes("teacher") ||
      currentUser.roles?.includes("class_teacher");

    // Get subject names
    const subjectNames: string[] = [];
    if (teacher.teacherSubjects) {
      for (const subjectId of teacher.teacherSubjects) {
        const subject = await ctx.db.get(subjectId);
        if (subject) {
          subjectNames.push(subject.name);
        }
      }
    }

    // If admin/teacher, return full info
    if (isAdminOrTeacher) {
      return {
        _id: teacher._id,
        name: buildUserName(teacher),
        email: teacher.email,
        phone: teacher.phone,
        subjects: subjectNames,
      };
    }

    // For students/parents, check platform settings
    const isStudent = currentUser.role === "student" || currentUser.roles?.includes("student");
    const isParent = currentUser.role === "parent" || currentUser.roles?.includes("parent");

    if (!currentUser.schoolId) {
      return {
        _id: teacher._id,
        name: buildUserName(teacher),
        subjects: subjectNames,
      };
    }

    const settings = await ctx.db
      .query("platformSettings")
      .withIndex("by_school", (q) => q.eq("schoolId", currentUser.schoolId!))
      .unique();

    let showEmail = false;
    let showPhone = false;

    if (isStudent) {
      showEmail = settings?.studentsSeeTeachersEmails ?? false;
      showPhone = settings?.studentsSeeTeachersPhones ?? false;
    } else if (isParent) {
      showEmail = settings?.parentsSeeTeachersEmails ?? false;
      showPhone = settings?.parentsSeeTeachersPhones ?? false;
    }

    return {
      _id: teacher._id,
      name: buildUserName(teacher),
      email: showEmail ? teacher.email : undefined,
      phone: showPhone ? teacher.phone : undefined,
      subjects: subjectNames,
    };
  },
});

// Get classmates for a student with visibility settings applied
export const getClassmatesWithVisibility = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args): Promise<{
    canView: boolean;
    message?: string;
    classmates: Array<{
      _id: Id<"students">;
      userId: Id<"users">;
      name: string;
      studentNumber?: number;
    }>;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Get current user
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

    // Check if current user is admin/teacher (they can always see classmates)
    const isAdminOrTeacher =
      currentUser.role === "system_admin" ||
      currentUser.role === "director" ||
      currentUser.role === "vice_director" ||
      currentUser.role === "teacher" ||
      currentUser.role === "class_teacher" ||
      currentUser.roles?.includes("system_admin") ||
      currentUser.roles?.includes("director") ||
      currentUser.roles?.includes("vice_director") ||
      currentUser.roles?.includes("teacher") ||
      currentUser.roles?.includes("class_teacher");

    const isStudent = currentUser.role === "student" || currentUser.roles?.includes("student");
    const isParent = currentUser.role === "parent" || currentUser.roles?.includes("parent");

    // Check visibility setting for students/parents
    if ((isStudent || isParent) && currentUser.schoolId) {
      const settings = await ctx.db
        .query("platformSettings")
        .withIndex("by_school", (q) => q.eq("schoolId", currentUser.schoolId!))
        .unique();

      const canSeeClassmates = settings?.parentsAndStudentsSeeClassmates ?? true;

      if (!canSeeClassmates) {
        return {
          canView: false,
          message: "Преглеждането на съученици не е разрешено от настройките на училището.",
          classmates: [],
        };
      }
    }

    // Get all students in the class
    const students = await ctx.db
      .query("students")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    const classmates = await Promise.all(
      students.map(async (student) => {
        const user = await ctx.db.get(student.userId);
        if (!user || user.isDeleted) return null;

        const nameParts = [user.firstName, user.middleName, user.lastName].filter(Boolean);
        const fullName = nameParts.length > 0 ? nameParts.join(" ") : "";

        if (!fullName) return null;

        return {
          _id: student._id,
          userId: student.userId,
          name: fullName,
          studentNumber: student.studentNumber,
        };
      })
    );

    const validClassmates = classmates.filter((c): c is NonNullable<typeof c> => c !== null);

    // Sort by student number or name
    validClassmates.sort((a, b) => {
      if (a.studentNumber && b.studentNumber) {
        return a.studentNumber - b.studentNumber;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      canView: true,
      classmates: validClassmates,
    };
  },
});

// Get parents of classmates with visibility settings applied
export const getClassmatesParents = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args): Promise<{
    canView: boolean;
    message?: string;
    parents: Array<{
      studentName: string;
      parentName: string;
      phone?: string;
      email?: string;
    }>;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Get current user
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

    // Check if current user is admin/teacher (they can always see)
    const isAdminOrTeacher =
      currentUser.role === "system_admin" ||
      currentUser.role === "director" ||
      currentUser.role === "vice_director" ||
      currentUser.role === "teacher" ||
      currentUser.role === "class_teacher" ||
      currentUser.roles?.includes("system_admin") ||
      currentUser.roles?.includes("director") ||
      currentUser.roles?.includes("vice_director") ||
      currentUser.roles?.includes("teacher") ||
      currentUser.roles?.includes("class_teacher");

    const isParent = currentUser.role === "parent" || currentUser.roles?.includes("parent");

    // Check visibility setting for parents
    if (isParent && currentUser.schoolId) {
      const settings = await ctx.db
        .query("platformSettings")
        .withIndex("by_school", (q) => q.eq("schoolId", currentUser.schoolId!))
        .unique();

      const canSeeParents = settings?.parentsSeeClassmatesParents ?? false;

      if (!canSeeParents) {
        return {
          canView: false,
          message: "Преглеждането на родители на съученици не е разрешено от настройките на училището.",
          parents: [],
        };
      }
    }

    // For non-parents who are not admin/teacher, deny access
    if (!isAdminOrTeacher && !isParent) {
      return {
        canView: false,
        message: "Само родители могат да виждат информация за други родители.",
        parents: [],
      };
    }

    // Get all students in the class
    const students = await ctx.db
      .query("students")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    const allParentRecords = await ctx.db.query("parents").collect();

    const parentsData: Array<{
      studentName: string;
      parentName: string;
      phone?: string;
      email?: string;
    }> = [];

    for (const student of students) {
      const studentUser = await ctx.db.get(student.userId);
      if (!studentUser || studentUser.isDeleted) continue;

      const studentName = buildUserName(studentUser);
      if (studentName === "-") continue;

      // Find parents for this student
      const studentParents = allParentRecords.filter(p => p.studentIds.includes(student._id));

      for (const parentRecord of studentParents) {
        const parentUser = await ctx.db.get(parentRecord.userId);
        if (!parentUser || parentUser.isDeleted) continue;

        parentsData.push({
          studentName,
          parentName: buildUserName(parentUser),
          phone: parentUser.phone,
          email: parentUser.email,
        });
      }
    }

    return {
      canView: true,
      parents: parentsData,
    };
  },
});

export const updateProfile = mutation({
  args: {
    // Основни данни
    firstName: v.optional(v.string()),
    middleName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("other"))),
    birthDate: v.optional(v.string()),
    birthPlace: v.optional(v.string()),
    scientificTitle: v.optional(v.string()),
    identifier: v.optional(v.string()),
    identifierType: v.optional(v.union(v.literal("egn"), v.literal("lnch"), v.literal("other"))),
    citizenship: v.optional(v.string()),
    roles: v.optional(v.array(v.union(
      v.literal("student"),
      v.literal("teacher"),
      v.literal("parent"),
      v.literal("class_teacher"),
      v.literal("director"),
      v.literal("vice_director"),
      v.literal("secretary"),
      v.literal("pedagogical_counselor"),
      v.literal("housekeeper"),
      v.literal("system_admin")
    ))),
    // Длъжност
    appointmentDate: v.optional(v.string()),
    positionType: v.optional(v.union(v.literal("titular"), v.literal("substitute"))),
    staffQuota: v.optional(v.union(v.literal("1"), v.literal("0.5"), v.literal("0.25"))),
    personnelType: v.optional(v.string()),
    positionName: v.optional(v.string()),
    appointedFor: v.optional(v.string()),
    // Договор
    contractType: v.optional(v.string()),
    contractBasis: v.optional(v.string()),
    contractNumber: v.optional(v.string()),
    contractYear: v.optional(v.string()),
    contractStructure: v.optional(v.string()),
    // Трудов стаж
    totalExperienceYears: v.optional(v.number()),
    totalExperienceMonths: v.optional(v.number()),
    totalExperienceDays: v.optional(v.number()),
    specialtyExperienceYears: v.optional(v.number()),
    specialtyExperienceMonths: v.optional(v.number()),
    specialtyExperienceDays: v.optional(v.number()),
    teachingExperienceYears: v.optional(v.number()),
    teachingExperienceMonths: v.optional(v.number()),
    teachingExperienceDays: v.optional(v.number()),
    // Образование
    educationDegree: v.optional(v.string()),
    university: v.optional(v.string()),
    specialty: v.optional(v.string()),
    diplomaNumber: v.optional(v.string()),
    diplomaDate: v.optional(v.string()),
    isPedagogicalQualification: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Update full name if name parts are provided
    const nameParts = [args.firstName, args.middleName, args.lastName].filter(Boolean);
    const fullName = nameParts.length > 0 ? nameParts.join(" ") : user.name;

    // Валидация: ако е администратор, винаги включваме teacher
    let finalRoles = args.roles;
    if (args.roles !== undefined && user.role === "system_admin") {
      if (!args.roles.includes("teacher")) {
        finalRoles = [...args.roles, "teacher"];
      }
    }

    await ctx.db.patch(user._id, {
      // Основни данни
      firstName: args.firstName,
      middleName: args.middleName,
      lastName: args.lastName,
      name: fullName,
      phone: args.phone,
      gender: args.gender,
      birthDate: args.birthDate,
      birthPlace: args.birthPlace,
      scientificTitle: args.scientificTitle,
      identifier: args.identifier,
      identifierType: args.identifierType,
      citizenship: args.citizenship,
      roles: finalRoles,
      // Длъжност
      appointmentDate: args.appointmentDate,
      positionType: args.positionType,
      staffQuota: args.staffQuota,
      personnelType: args.personnelType,
      positionName: args.positionName,
      appointedFor: args.appointedFor,
      // Договор
      contractType: args.contractType,
      contractBasis: args.contractBasis,
      contractNumber: args.contractNumber,
      contractYear: args.contractYear,
      contractStructure: args.contractStructure,
      // Трудов стаж
      totalExperienceYears: args.totalExperienceYears,
      totalExperienceMonths: args.totalExperienceMonths,
      totalExperienceDays: args.totalExperienceDays,
      specialtyExperienceYears: args.specialtyExperienceYears,
      specialtyExperienceMonths: args.specialtyExperienceMonths,
      specialtyExperienceDays: args.specialtyExperienceDays,
      teachingExperienceYears: args.teachingExperienceYears,
      teachingExperienceMonths: args.teachingExperienceMonths,
      teachingExperienceDays: args.teachingExperienceDays,
      // Образование
      educationDegree: args.educationDegree,
      university: args.university,
      specialty: args.specialty,
      diplomaNumber: args.diplomaNumber,
      diplomaDate: args.diplomaDate,
      isPedagogicalQualification: args.isPedagogicalQualification,
    });
  },
});

// Internal mutation for changing password (called from action after password is hashed)
export const changePasswordInternal = internalMutation({
  args: {
    hashedPassword: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    await ctx.db.patch(user._id, {
      password: args.hashedPassword,
    });
  },
});

export const getLoginHistory = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    const loginHistory = await ctx.db
      .query("loginHistory")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(20);

    return loginHistory;
  },
});

// Get login history for a specific user (admin access)
export const getUserLoginHistory = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Get current user
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Current user not found",
      });
    }

    // Check if current user has admin rights
    const adminRoles = ["system_admin", "director", "vice_director", "teacher", "class_teacher"];
    const hasAccess = adminRoles.includes(currentUser.role) || 
                      currentUser.roles?.some(r => adminRoles.includes(r));
    
    if (!hasAccess) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Access denied",
      });
    }

    const loginHistory = await ctx.db
      .query("loginHistory")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(20);

    return loginHistory;
  },
});

export const sendTwoFactorCode = mutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Code expires in 10 minutes
    const expiry = Date.now() + 10 * 60 * 1000;

    await ctx.db.patch(user._id, {
      twoFactorCode: code,
      twoFactorCodeExpiry: expiry,
    });

    // In a real app, send code via email using Resend or similar service
    // For now, we'll just log it (in production, this should be removed)
    console.log(`2FA Code for ${user.email}: ${code}`);
  },
});

export const verifyTwoFactorCode = mutation({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Check if code matches and hasn't expired
    if (
      user.twoFactorCode === args.code &&
      user.twoFactorCodeExpiry &&
      user.twoFactorCodeExpiry > Date.now()
    ) {
      // Enable 2FA and clear the code
      await ctx.db.patch(user._id, {
        twoFactorEnabled: true,
        twoFactorCode: undefined,
        twoFactorCodeExpiry: undefined,
      });
      return true;
    }

    return false;
  },
});

export const disableTwoFactor = mutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    await ctx.db.patch(user._id, {
      twoFactorEnabled: false,
      twoFactorCode: undefined,
      twoFactorCodeExpiry: undefined,
    });
  },
});

export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const updateAvatar = mutation({
  args: {
    storageId: v.id("_storage"),
    userId: v.optional(v.id("users")), // Optional: admin can update any user's avatar
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
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Determine which user to update
    let targetUserId = currentUser._id;
    
    if (args.userId && args.userId !== currentUser._id) {
      // Check if current user has admin rights to update other users' avatars
      const isAdmin = currentUser.role === "system_admin" || 
                      currentUser.role === "director" || 
                      currentUser.role === "vice_director" ||
                      currentUser.roles?.includes("system_admin") ||
                      currentUser.roles?.includes("director") ||
                      currentUser.roles?.includes("vice_director");
      
      if (!isAdmin) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Нямате права да променяте снимки на други потребители",
        });
      }
      
      // Verify target user exists
      const targetUser = await ctx.db.get(args.userId);
      if (!targetUser) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Потребителят не е намерен",
        });
      }
      
      targetUserId = args.userId;
    }

    await ctx.db.patch(targetUserId, {
      avatarStorageId: args.storageId,
    });
  },
});

export const getAvatarUrl = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    let user;
    if (args.userId) {
      user = await ctx.db.get(args.userId);
    } else {
      user = await ctx.db
        .query("users")
        .withIndex("by_token", (q) =>
          q.eq("tokenIdentifier", identity.tokenIdentifier),
        )
        .unique();
    }

    if (!user || !user.avatarStorageId) {
      return null;
    }

    return await ctx.storage.getUrl(user.avatarStorageId);
  },
});

export const getUserById = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Safely try to get user - return null if not found instead of throwing
    let user;
    try {
      user = await ctx.db.get(args.userId);
    } catch (e) {
      // Invalid ID format or other error
      return null;
    }
    
    if (!user) {
      return null;
    }

    // Get parent record if user is a parent
    let studentIds: Id<"students">[] = [];
    if (user.role === "parent" || user.roles?.includes("parent")) {
      const parentRecord = await ctx.db
        .query("parents")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .first();
      
      if (parentRecord) {
        studentIds = parentRecord.studentIds;
      }
    }

    return { ...user, studentIds };
  },
});

// Admin functions for editing other users
export const adminUpdateUserProfile = mutation({
  args: {
    userId: v.id("users"),
    firstName: v.optional(v.string()),
    middleName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("other"))),
    birthDate: v.optional(v.string()),
    birthPlace: v.optional(v.string()),
    scientificTitle: v.optional(v.string()),
    role: v.optional(v.union(
      v.literal("director"),
      v.literal("vice_director"),
      v.literal("system_admin"),
      v.literal("teacher"),
      v.literal("class_teacher"),
      v.literal("parent"),
      v.literal("student"),
      v.literal("secretary"),
      v.literal("pedagogical_counselor"),
      v.literal("housekeeper")
    )),
    roles: v.optional(v.array(v.union(
      v.literal("director"),
      v.literal("vice_director"),
      v.literal("system_admin"),
      v.literal("teacher"),
      v.literal("class_teacher"),
      v.literal("parent"),
      v.literal("student"),
      v.literal("secretary"),
      v.literal("pedagogical_counselor"),
      v.literal("housekeeper")
    ))),
    status: v.optional(v.union(
      v.literal("new_inactive"),
      v.literal("inactive_entering_data"),
      v.literal("active_awaiting_parent_approval"),
      v.literal("active_unconfirmed_email"),
      v.literal("active")
    )),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Check if current user is admin
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!currentUser || !isAdmin(currentUser)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only admins can edit other users",
      });
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Build full name if name parts are provided
    const nameParts = [
      args.firstName || targetUser.firstName,
      args.middleName || targetUser.middleName,
      args.lastName || targetUser.lastName
    ].filter(Boolean);
    const fullName = nameParts.length > 0 ? nameParts.join(" ") : targetUser.name;

    const updates: Partial<typeof targetUser> = {};
    if (args.firstName !== undefined) updates.firstName = args.firstName;
    if (args.middleName !== undefined) updates.middleName = args.middleName;
    if (args.lastName !== undefined) updates.lastName = args.lastName;
    if (fullName) updates.name = fullName;
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.email !== undefined) updates.email = args.email;
    if (args.gender !== undefined) updates.gender = args.gender;
    if (args.birthDate !== undefined) updates.birthDate = args.birthDate;
    if (args.birthPlace !== undefined) updates.birthPlace = args.birthPlace;
    if (args.scientificTitle !== undefined) updates.scientificTitle = args.scientificTitle;
    if (args.role !== undefined) updates.role = args.role;
    if (args.status !== undefined) updates.status = args.status;
    if (args.isActive !== undefined) updates.isActive = args.isActive;
    
    // ВАЖНО: Автоматично добавяме "teacher" роля ако е избран "system_admin"
    if (args.roles !== undefined) {
      const rolesSet = new Set(args.roles);
      // Ако има system_admin в основната роля или в допълнителните роли, добавяме teacher
      if (args.role === "system_admin" || rolesSet.has("system_admin")) {
        rolesSet.add("teacher");
      }
      updates.roles = Array.from(rolesSet);
    } else if (args.role === "system_admin") {
      // Ако променяме само основната роля на system_admin
      const existingRoles = targetUser.roles || [];
      const rolesSet = new Set(existingRoles);
      rolesSet.add("teacher");
      updates.roles = Array.from(rolesSet);
    }

    await ctx.db.patch(args.userId, updates);

    // ✅ FIX 3: Audit log
    await ctx.db.insert("auditLog", {
      userId: currentUser._id,
      action: "update_user",
      targetType: "user",
      targetId: args.userId,
      details: JSON.stringify({
        updates: Object.keys(updates),
      }),
      schoolId: targetUser.schoolId,
    });
  },
});

// Internal mutation for admin changing user password (called from action after password is hashed)
export const adminChangeUserPasswordInternal = internalMutation({
  args: {
    userId: v.id("users"),
    hashedPassword: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Check if current user is admin
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!currentUser || !isAdmin(currentUser)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only admins can change other users' passwords",
      });
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    await ctx.db.patch(args.userId, {
      password: args.hashedPassword,
    });
  },
});

export const softDeleteUser = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Check if current user is admin
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!currentUser || !isAdmin(currentUser)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only admins can delete users",
      });
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    await ctx.db.patch(args.userId, {
      isDeleted: true,
      deletedAt: Date.now(),
    });

    // ✅ FIX 3: Audit log
    await ctx.db.insert("auditLog", {
      userId: currentUser._id,
      action: "delete_user",
      targetType: "user",
      targetId: args.userId,
      details: JSON.stringify({
        userEmail: targetUser.email,
        userName: targetUser.name,
      }),
      schoolId: targetUser.schoolId,
    });
  },
});

export const restoreUser = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Check if current user is admin
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!currentUser || !isAdmin(currentUser)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only admins can restore users",
      });
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    await ctx.db.patch(args.userId, {
      isDeleted: false,
      deletedAt: undefined,
    });

    // ✅ FIX 3: Audit log
    await ctx.db.insert("auditLog", {
      userId: currentUser._id,
      action: "restore_user",
      targetType: "user",
      targetId: args.userId,
      details: JSON.stringify({
        userEmail: targetUser.email,
        userName: targetUser.name,
      }),
      schoolId: targetUser.schoolId,
    });
  },
});

// Permanent delete user (completely removes from database)
// Add teacher role to all administrators
export const addTeacherRoleToAdmins = mutation({
  args: {},
  handler: async (ctx): Promise<{ updated: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Check if current user is admin
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!currentUser || !isAdmin(currentUser)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only admins can perform this operation",
      });
    }

    // Get all users with system_admin role
    const allUsers = await ctx.db.query("users").collect();
    const admins = allUsers.filter(u => 
      u.role === "system_admin" || 
      (u.roles && u.roles.includes("system_admin"))
    );

    let updated = 0;
    for (const admin of admins) {
      const roles = admin.roles || [];
      // Add "teacher" role if not already present
      if (!roles.includes("teacher")) {
        await ctx.db.patch(admin._id, {
          roles: [...roles, "teacher"],
        });
        updated++;
      }
    }

    return { updated };
  },
});

export const permanentDeleteUser = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Check if current user is admin
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!currentUser || !isAdmin(currentUser)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only admins can permanently delete users",
      });
    }

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Audit log before deletion
    await ctx.db.insert("auditLog", {
      userId: currentUser._id,
      action: "permanent_delete_user",
      targetType: "user",
      targetId: args.userId,
      details: JSON.stringify({
        userEmail: targetUser.email,
        userName: targetUser.name,
        userRole: targetUser.role,
      }),
      schoolId: targetUser.schoolId,
    });

    // Permanently delete user
    await ctx.db.delete(args.userId);
  },
});

// Internal mutation for pre-auth check (returns user data, action will verify password)
export const verifyPreAuthInternal = internalMutation({
  args: {
    username: v.string(),
  },
  handler: async (ctx, args): Promise<{ 
    success: boolean; 
    hashedPassword?: string; 
    email?: string; 
    message?: string;
    userId?: Id<"users">;
    name?: string;
    firstName?: string;
    lastName?: string;
    role?: Doc<"users">["role"];
  }> => {
    // Find user by username OR email
    const allUsers = await ctx.db.query("users").collect();
    const user = allUsers.find(u => 
      u.username === args.username || u.email === args.username
    );

    if (!user) {
      return { success: false, message: "Грешно потребителско име или парола" };
    }

    // ✅ SECURITY FIX: Check for rate limiting (max 5 failed attempts per hour)
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentAttempts = await ctx.db
      .query("loginHistory")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.gte(q.field("timestamp"), oneHourAgo))
      .collect();
    
    const failedCount = recentAttempts.filter(a => a.device === "failed_preauth").length;
    if (failedCount >= 5) {
      return { 
        success: false, 
        message: "Твърде много неуспешни опити. Опитайте отново след 1 час." 
      };
    }

    // Check if user is deleted
    if (user.isDeleted) {
      return { success: false, message: "Акаунтът е деактивиран" };
    }

    // Check if user is active
    if (!user.isActive) {
      return { success: false, message: "Акаунтът не е активен. Свържете се с администратор" };
    }

    if (!user.password) {
      return { success: false, message: "Грешно потребителско име или парола" };
    }

    // Return hashed password for action to verify
    return { 
      success: true, 
      hashedPassword: user.password,
      email: user.email,
      userId: user._id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };
  },
});

// Internal mutation to record failed login attempt
export const recordFailedAttempt = internalMutation({
  args: {
    username: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const allUsers = await ctx.db.query("users").collect();
    const user = allUsers.find((u) => u.username === args.username);
    
    if (!user) return; // Don't reveal if user exists
    
    await ctx.db.insert("loginHistory", {
      userId: user._id,
      timestamp: Date.now(),
      device: "failed_preauth",
      browser: undefined,
      ipAddress: undefined,
    });
  },
});

// Internal mutation to record successful login
export const recordSuccessfulLogin = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.insert("loginHistory", {
      userId: args.userId,
      timestamp: Date.now(),
      device: "successful_preauth",
      browser: undefined,
      ipAddress: undefined,
    });
  },
});

// Internal mutation to update a user
export const updateUserInternal = internalMutation({
  args: {
    userId: v.id("users"),
    firstName: v.string(),
    middleName: v.optional(v.string()),
    lastName: v.string(),
    identifier: v.string(),
    identifierType: v.union(v.literal("egn"), v.literal("lnch"), v.literal("other")),
    birthDate: v.optional(v.string()),
    birthPlace: v.optional(v.string()),
    citizenship: v.optional(v.string()),
    gender: v.union(v.literal("male"), v.literal("female"), v.literal("other")),
    phone: v.string(),
    email: v.string(),
    username: v.string(),
    hashedPassword: v.optional(v.string()), // New: optional password update
    role: v.union(
      v.literal("teacher"),
      v.literal("student"),
      v.literal("parent"),
      v.literal("director"),
      v.literal("vice_director"),
      v.literal("system_admin"),
      v.literal("secretary"),
      v.literal("pedagogical_counselor"),
      v.literal("housekeeper"),
      v.literal("class_teacher")
    ),
    roles: v.optional(v.array(v.union(
      v.literal("teacher"),
      v.literal("student"),
      v.literal("parent"),
      v.literal("director"),
      v.literal("vice_director"),
      v.literal("system_admin"),
      v.literal("secretary"),
      v.literal("pedagogical_counselor"),
      v.literal("housekeeper"),
      v.literal("class_teacher")
    ))),
    schoolId: v.optional(v.id("schools")),
    appointmentDate: v.optional(v.string()),
    positionType: v.optional(v.union(v.literal("titular"), v.literal("substitute"))),
    staffQuota: v.optional(v.union(v.literal("1"), v.literal("0.5"), v.literal("0.25"))),
    personnelType: v.optional(v.string()),
    positionName: v.optional(v.string()),
    appointedFor: v.optional(v.string()),
    contractType: v.optional(v.string()),
    contractBasis: v.optional(v.string()),
    contractNumber: v.optional(v.string()),
    contractYear: v.optional(v.string()),
    contractStructure: v.optional(v.string()),
    totalExperienceYears: v.optional(v.number()),
    totalExperienceMonths: v.optional(v.number()),
    totalExperienceDays: v.optional(v.number()),
    specialtyExperienceYears: v.optional(v.number()),
    specialtyExperienceMonths: v.optional(v.number()),
    specialtyExperienceDays: v.optional(v.number()),
    teachingExperienceYears: v.optional(v.number()),
    teachingExperienceMonths: v.optional(v.number()),
    teachingExperienceDays: v.optional(v.number()),
    educationDegree: v.optional(v.string()),
    university: v.optional(v.string()),
    specialty: v.optional(v.string()),
    diplomaNumber: v.optional(v.string()),
    diplomaDate: v.optional(v.string()),
    isPedagogicalQualification: v.optional(v.boolean()),
    teachingSubjects: v.optional(v.array(v.string())),
    teacherSubjects: v.optional(v.array(v.id("subjects"))),
    scientificTitle: v.optional(v.string()),
    classId: v.optional(v.id("classes")),
    personalDoctor: v.optional(v.string()),
    studentIds: v.optional(v.array(v.id("students"))), // For parent role
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
        code: "UNAUTHENTICATED",
        message: "User not found",
      });
    }

    // Check if user exists
    const existingUser = await ctx.db.get(args.userId);
    if (!existingUser) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // If the email changed, reset tokenIdentifier to temp_ so the old
    // Hercules Auth link is broken and the user must re-authenticate with
    // the new email.  This also allows another user to claim the freed email.
    const emailChanged = existingUser.email !== args.email;
    if (emailChanged && !existingUser.tokenIdentifier.startsWith("temp_")) {
      // Reset to temp token so the old auth session no longer matches
      const newTempToken = `temp_${Date.now()}_${Math.random()}`;
      await ctx.db.patch(args.userId, { tokenIdentifier: newTempToken });
    }

    // Build user name
    const fullName = [args.firstName, args.middleName, args.lastName]
      .filter(Boolean)
      .join(" ");

    // Build update object
    const updates: Record<string, unknown> = {
      name: fullName,
      email: args.email,
      role: args.role,
      roles: args.roles,
      teacherSubjects: args.teacherSubjects,
      status: "active",
      schoolId: args.schoolId,
      username: args.username,
      firstName: args.firstName,
      middleName: args.middleName,
      lastName: args.lastName,
      phone: args.phone,
      birthDate: args.birthDate,
      birthPlace: args.birthPlace,
      gender: args.gender,
      scientificTitle: args.scientificTitle,
      // Identifier fields
      identifier: args.identifier,
      identifierType: args.identifierType,
      citizenship: args.citizenship,
      // Длъжност (за персонал)
      appointmentDate: args.appointmentDate,
      positionType: args.positionType,
      staffQuota: args.staffQuota,
      personnelType: args.personnelType,
      positionName: args.positionName,
      appointedFor: args.appointedFor,
      // Договор
      contractType: args.contractType,
      contractBasis: args.contractBasis,
      contractNumber: args.contractNumber,
      contractYear: args.contractYear,
      contractStructure: args.contractStructure,
      // Трудов стаж
      totalExperienceYears: args.totalExperienceYears,
      totalExperienceMonths: args.totalExperienceMonths,
      totalExperienceDays: args.totalExperienceDays,
      specialtyExperienceYears: args.specialtyExperienceYears,
      specialtyExperienceMonths: args.specialtyExperienceMonths,
      specialtyExperienceDays: args.specialtyExperienceDays,
      teachingExperienceYears: args.teachingExperienceYears,
      teachingExperienceMonths: args.teachingExperienceMonths,
      teachingExperienceDays: args.teachingExperienceDays,
      // Образование
      educationDegree: args.educationDegree,
      university: args.university,
      specialty: args.specialty,
      diplomaNumber: args.diplomaNumber,
      diplomaDate: args.diplomaDate,
      isPedagogicalQualification: args.isPedagogicalQualification,
      teachingSubjects: args.teachingSubjects,
      classId: args.classId,
      personalDoctor: args.personalDoctor,
    };

    // Update password only if provided
    if (args.hashedPassword) {
      updates.password = args.hashedPassword;
    }

    // Update user
    await ctx.db.patch(args.userId, updates);
    
    // Handle student class assignment
    const isStudent = args.role === "student" || args.roles?.includes("student");
    if (isStudent) {
      // Check if student record exists
      const existingStudentRecord = await ctx.db
        .query("students")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .first();
      
      if (args.classId) {
        // Get class to retrieve schoolId
        const classData = await ctx.db.get(args.classId);
        
        if (existingStudentRecord) {
          // Update existing student record
          await ctx.db.patch(existingStudentRecord._id, {
            classId: args.classId,
            schoolId: classData?.schoolId || args.schoolId,
          });
        } else if (classData) {
          // Create new student record
          await ctx.db.insert("students", {
            userId: args.userId,
            classId: args.classId,
            schoolId: classData.schoolId,
          });
        }
      } else if (existingStudentRecord) {
        // If classId is null/empty and student record exists, delete it
        await ctx.db.delete(existingStudentRecord._id);
      }
    }
    
    // Auto-create teacher record if user is admin with subjects and doesn't have one
    if (args.teacherSubjects && args.teacherSubjects.length > 0) {
      const isAdminRole = args.role === "director" || args.role === "vice_director" || args.role === "system_admin" ||
        args.roles?.includes("director") || args.roles?.includes("vice_director") || args.roles?.includes("system_admin");
      
      if (isAdminRole) {
        // Check if teacher record already exists
        const existingTeacher = await ctx.db
          .query("teachers")
          .withIndex("by_user", (q) => q.eq("userId", args.userId))
          .first();
        
        if (!existingTeacher && args.schoolId) {
          // Create teacher record
          await ctx.db.insert("teachers", {
            userId: args.userId,
            schoolId: args.schoolId,
            hasLeft: false,
          });
        }
      }
    }

    // Handle parent-student relationships
    const isParent = args.role === "parent" || args.roles?.includes("parent");
    
    // Check if parent record exists
    const existingParentRecord = await ctx.db
      .query("parents")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    
    if (isParent && args.studentIds && args.studentIds.length > 0) {
      if (existingParentRecord) {
        // Update existing parent record with new student IDs
        const updateData: { studentIds: Id<"students">[]; schoolId?: Id<"schools"> } = {
          studentIds: args.studentIds,
        };
        if (args.schoolId) {
          updateData.schoolId = args.schoolId;
        }
        await ctx.db.patch(existingParentRecord._id, updateData);
      } else {
        // Create new parent record
        await ctx.db.insert("parents", {
          userId: args.userId,
          studentIds: args.studentIds,
          schoolId: args.schoolId,
        });
      }
    } else if ((!isParent || !args.studentIds || args.studentIds.length === 0) && existingParentRecord) {
      // If user is not a parent anymore or has no students, remove parent record
      await ctx.db.delete(existingParentRecord._id);
    }

    // Audit log
    await ctx.db.insert("auditLog", {
      userId: currentUser._id,
      action: "update_user",
      targetType: "user",
      targetId: args.userId,
      details: JSON.stringify({
        email: args.email,
        role: args.role,
        passwordChanged: !!args.hashedPassword,
      }),
      schoolId: args.schoolId,
    });
  },
});

// Helper query for fixing isDeleted field
export const getAllUsersForFix = internalQuery({
  args: {},
  handler: async (ctx): Promise<Array<{ _id: Id<"users">; isDeleted?: boolean }>> => {
    const users = await ctx.db.query("users").collect();
    return users.map(u => ({ _id: u._id, isDeleted: u.isDeleted }));
  },
});

// Helper mutation for fixing isDeleted field
export const setIsDeletedFalse = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.userId, {
      isDeleted: false,
    });
  },
});

// Get student record by user ID
export const getStudentByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<{ _id: Id<"students">; classId?: Id<"classes"> } | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const student = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!student) return null;

    return {
      _id: student._id,
      classId: student.classId,
    };
  },
});

// Get staff parent info - check if current user is a staff member with children
export const getStaffParentInfo = query({
  args: {},
  handler: async (ctx): Promise<{
    hasChildren: boolean;
    isStaff: boolean;
    children: Array<{
      _id: Id<"students">;
      userId: Id<"users">;
      classId: Id<"classes">;
      name: string;
      className: string;
    }>;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { hasChildren: false, isStaff: false, children: [] };
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      return { hasChildren: false, isStaff: false, children: [] };
    }

    // Check if user is a staff member (not student, not parent-only)
    const staffRoles = ["teacher", "class_teacher", "director", "vice_director", "system_admin", "secretary", "pedagogical_counselor", "housekeeper"];
    const isStaff = staffRoles.includes(currentUser.role) || 
      (currentUser.roles?.some(r => staffRoles.includes(r)) ?? false);

    if (!isStaff) {
      return { hasChildren: false, isStaff: false, children: [] };
    }

    // Check if user has children linked via parents table
    const parentRecord = await ctx.db
      .query("parents")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .first();

    if (!parentRecord || !parentRecord.studentIds || parentRecord.studentIds.length === 0) {
      return { hasChildren: false, isStaff: true, children: [] };
    }

    // Get children details
    const children = await Promise.all(
      parentRecord.studentIds.map(async (studentId) => {
        const studentRecord = await ctx.db.get(studentId);
        if (!studentRecord) return null;

        const user = await ctx.db.get(studentRecord.userId);
        if (!user) return null;

        const classDoc = await ctx.db.get(studentRecord.classId);

        // Build full name
        const nameParts = [user.firstName, user.middleName, user.lastName].filter(Boolean);
        const fullName = nameParts.length > 0 ? nameParts.join(" ") : "";

        if (!fullName || user.isDeleted) {
          return null;
        }

        return {
          _id: studentRecord._id,
          userId: user._id,
          classId: studentRecord.classId,
          name: fullName,
          className: classDoc?.name || "",
        };
      })
    );

    const validChildren = children.filter((c): c is NonNullable<typeof c> => c !== null);

    return {
      hasChildren: validChildren.length > 0,
      isStaff: true,
      children: validChildren,
    };
  },
});

// Restore all deleted users (no auth required - emergency restore)
export const restoreAllDeletedUsers = mutation({
  args: {},
  handler: async (ctx): Promise<{ restored: number }> => {
    const allUsers = await ctx.db.query("users").collect();
    const deletedUsers = allUsers.filter((u) => u.isDeleted === true);

    let restored = 0;
    for (const user of deletedUsers) {
      await ctx.db.patch(user._id, { isDeleted: false });
      restored++;
    }

    return { restored };
  },
});

// Get user session history (admin only, or own profile)
export const getUserSessions = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
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
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Only admins can view other users' sessions, users can see their own
    const isAdminUser = isAdmin(currentUser);
    if (currentUser._id !== args.userId && !isAdminUser) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Нямате право да преглеждате сесиите на този потребител",
      });
    }

    const pageSize = args.limit ?? 50;

    const sessions = await ctx.db
      .query("loginHistory")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(pageSize);

    return sessions.map((s) => ({
      _id: s._id,
      timestamp: s.timestamp,
      logoutTimestamp: s.logoutTimestamp,
      sessionType: s.sessionType ?? "preauth",
      device: s.device,
      browser: s.browser,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
    }));
  },
});

// Record logout event for the current user
export const recordLogout = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) return;

    // Find the most recent login session without a logout timestamp
    const recentSessions = await ctx.db
      .query("loginHistory")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(5);

    const openSession = recentSessions.find(
      (s) => !s.logoutTimestamp
    );

    if (openSession) {
      // Mark the session as ended
      await ctx.db.patch(openSession._id, {
        logoutTimestamp: Date.now(),
      });
    } else {
      // No open session found, create a logout-only entry
      await ctx.db.insert("loginHistory", {
        userId: user._id,
        timestamp: Date.now(),
        sessionType: "logout",
      });
    }
  },
});

// Record login with device info (called from frontend after successful auth)
export const recordLoginSession = mutation({
  args: {
    userAgent: v.optional(v.string()),
    device: v.optional(v.string()),
    browser: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) return;

    // Find the most recent session (created in updateCurrentUser) and enrich with device info
    const recentSessions = await ctx.db
      .query("loginHistory")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(3);

    // Find a session created in the last 30 seconds without device info
    const recentSession = recentSessions.find(
      (s) =>
        s.sessionType === "hercules_auth" &&
        !s.userAgent &&
        Date.now() - s.timestamp < 30000
    );

    if (recentSession) {
      await ctx.db.patch(recentSession._id, {
        userAgent: args.userAgent,
        device: args.device,
        browser: args.browser,
      });
    }
  },
});
