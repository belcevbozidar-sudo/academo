import { ConvexError } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";
import { isAdmin as checkIsAdmin, buildUserName, hasProperName } from "./users.js";

// Helper function to check if user is admin
async function isAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;
  
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  
  if (!user) return false;
  
  // Use helper function from users.ts that checks both primary and additional roles
  return checkIsAdmin(user);
}

// Get or create default school
export const getDefaultSchool = query({
  args: {},
  handler: async (ctx): Promise<{ schoolId: Id<"schools"> | null }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Get first school
    const school = await ctx.db.query("schools").first();
    
    return { schoolId: school?._id || null };
  },
});

// Get school details with all fields
export const getSchoolDetails = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Get first school (we only support one school for now)
    const school = await ctx.db.query("schools").first();
    
    if (!school) {
      return null;
    }

    // Get directors (users with director role) - for backwards compatibility
    const directors = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "director"))
      .collect();
    
    // Get vice directors - for backwards compatibility
    const viceDirectors = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), "vice_director"))
      .collect();

    // Get current user to check if admin
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    
    const isUserAdmin = currentUser?.role && ["system_admin", "director", "vice_director", "secretary"].includes(currentUser.role);

    // Populate leadership positions with user data and filter hidden for non-admins
    let leadershipPositions = school.leadershipPositions || [];
    if (!isUserAdmin) {
      leadershipPositions = leadershipPositions.filter(pos => !pos.isHidden);
    }
    
    const populatedLeadership = await Promise.all(
      leadershipPositions.map(async (pos) => {
        if (pos.userId) {
          const user = await ctx.db.get(pos.userId);
          return {
            ...pos,
            user: user ? {
              _id: user._id,
              firstName: user.firstName,
              middleName: user.middleName,
              lastName: user.lastName,
              name: user.name,
            } : null,
          };
        }
        return { ...pos, user: null };
      })
    );

    // Filter custom data for non-admins
    let customData = school.customData || [];
    if (!isUserAdmin) {
      customData = customData.filter(data => !data.isHidden);
    }

    // Filter hidden fields for non-admins
    const hiddenFields = isUserAdmin ? [] : (school.hiddenFields || []);

    return {
      ...school,
      directors,
      viceDirectors,
      leadershipPositions: populatedLeadership,
      customData,
      hiddenFields,
      isUserAdmin,
    };
  },
});

// Get users by role for leadership selector
export const getUsersByRoles = query({
  args: {
    roles: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Check if user is admin
    if (!(await isAdmin(ctx))) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only administrators can view users by role",
      });
    }

    const allUsers = await ctx.db.query("users").collect();
    
    // If no roles specified, get all non-student users
    if (!args.roles || args.roles.length === 0) {
      return allUsers
        .filter(u => u.role !== "student" && u.role !== "parent" && !u.isDeleted)
        .map(u => ({
          _id: u._id,
          name: u.name || [u.firstName, u.middleName, u.lastName].filter(Boolean).join(" ") || "—",
          role: u.role,
          firstName: u.firstName,
          middleName: u.middleName,
          lastName: u.lastName,
        }));
    }

    // Filter by specified roles
    return allUsers
      .filter(u => args.roles?.includes(u.role) && !u.isDeleted)
      .map(u => ({
        _id: u._id,
        name: u.name || [u.firstName, u.middleName, u.lastName].filter(Boolean).join(" ") || "—",
        role: u.role,
        firstName: u.firstName,
        middleName: u.middleName,
        lastName: u.lastName,
      }));
  },
});

// Update school details (admin only)
export const updateSchoolDetails = mutation({
  args: {
    name: v.optional(v.string()),
    shortName: v.optional(v.string()),
    schoolType: v.optional(v.string()),
    ownership: v.optional(v.string()),
    isCentral: v.optional(v.boolean()),
    isProtected: v.optional(v.boolean()),
    isInnovative: v.optional(v.boolean()),
    isStateFunded: v.optional(v.boolean()),
    isNationalImportance: v.optional(v.boolean()),
    providesProfessionalTraining: v.optional(v.boolean()),
    fundingSource: v.optional(v.string()),
    isDelegatedBudget: v.optional(v.boolean()),
    approvedBudget: v.optional(v.string()),
    createdByInternationalAgreement: v.optional(v.boolean()),
    city: v.optional(v.string()),
    district: v.optional(v.string()),
    address: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    phone: v.optional(v.string()),
    phone2: v.optional(v.string()),
    fax: v.optional(v.string()),
    website: v.optional(v.string()),
    email: v.optional(v.string()),
    email2: v.optional(v.string()),
    neispuoCode: v.optional(v.string()),
    iban: v.optional(v.string()),
    bank: v.optional(v.string()),
    bic: v.optional(v.string()),
    accountHolder: v.optional(v.string()),
    leadershipPositions: v.optional(v.array(v.object({
      positionTitle: v.string(),
      userId: v.optional(v.id("users")),
      isHidden: v.optional(v.boolean()),
    }))),
    customData: v.optional(v.array(v.object({
      label: v.string(),
      value: v.string(),
      isHidden: v.optional(v.boolean()),
    }))),
    hiddenFields: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Check if user is admin
    if (!(await isAdmin(ctx))) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only administrators can update school details",
      });
    }

    // Get first school
    let school = await ctx.db.query("schools").first();
    
    if (!school) {
      // Create school if doesn't exist
      const schoolId = await ctx.db.insert("schools", {
        name: args.name || "Училище",
        address: args.address,
        phone: args.phone,
        email: args.email,
      });
      return schoolId;
    }

    // Update school
    await ctx.db.patch(school._id, args);
    
    return school._id;
  },
});

// Create default school if doesn't exist
export const ensureDefaultSchool = mutation({
  args: {},
  handler: async (ctx): Promise<Id<"schools">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Check if school already exists
    const existingSchool = await ctx.db.query("schools").first();
    if (existingSchool) {
      return existingSchool._id;
    }

    // Create default school
    const schoolId = await ctx.db.insert("schools", {
      name: "Основно училище",
      address: "",
      phone: "",
      email: "",
    });

    return schoolId;
  },
});

// Get students by class
export const getStudentsByClass = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args): Promise<Array<{
    _id: Id<"students">;
    userId: Id<"users">;
    name: string;
    studentNumber?: number;
    user?: {
      birthDate?: string;
      birthPlace?: string;
      parent1Name?: string;
      parent2Name?: string;
      personalDoctor?: string;
    };
    parents: Array<{
      _id: Id<"users">;
      name: string;
    }>;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const students = await ctx.db
      .query("students")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Get all parent records to find parents for each student
    const allParentRecords = await ctx.db.query("parents").collect();

    const studentsWithNames = await Promise.all(
      students.map(async (student) => {
        const user = await ctx.db.get(student.userId);
        
        // Skip users without proper names (firstName AND lastName required)
        if (!hasProperName(user)) {
          return null;
        }
        
        // Find parents for this student from the parents table
        const parentRecords = allParentRecords.filter((pr) =>
          pr.studentIds.includes(student._id)
        );
        
        // Get parent user details
        const parents = await Promise.all(
          parentRecords.map(async (parentRecord) => {
            const parentUser = await ctx.db.get(parentRecord.userId);
            return parentUser ? {
              _id: parentUser._id,
              name: buildUserName(parentUser),
            } : null;
          })
        );
        
        const validParents = parents.filter((p): p is { _id: Id<"users">; name: string } => p !== null);
        
        return {
          _id: student._id,
          userId: student.userId,
          name: buildUserName(user),
          studentNumber: student.studentNumber,
          user: user ? {
            birthDate: user.birthDate,
            birthPlace: user.birthPlace,
            parent1Name: user.parent1Name,
            parent2Name: user.parent2Name,
            personalDoctor: user.personalDoctor,
          } : undefined,
          parents: validParents,
        };
      })
    );

    // Filter out null entries (students without proper names)
    const validStudents = studentsWithNames.filter((s): s is NonNullable<typeof s> => s !== null);

    // Always sort alphabetically by name for consistent student numbering across the platform
    return validStudents.sort((a, b) => a.name.localeCompare(b.name, "bg"));
  },
});

// CLASSES
export const getClassById = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args): Promise<{
    _id: Id<"classes">;
    name: string;
    grade: number;
    letter: string;
    schoolId: Id<"schools">;
    classTeacherId?: Id<"users">;
    diaryType: string;
    shiftNumber: 1 | 2;
    academicYear: string;
    _creationTime: number;
    classTeacher?: {
      _id: Id<"users">;
      firstName?: string;
      lastName?: string;
      email?: string;
    } | null;
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

    const classData = await ctx.db.get(args.classId);
    if (!classData) {
      return null;
    }

    // Check if current user is a student
    const isStudent = currentUser.role === "student" || currentUser.roles?.includes("student");

    // If student, verify they belong to this class
    if (isStudent) {
      const studentRecord = await ctx.db
        .query("students")
        .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
        .first();

      if (!studentRecord || studentRecord.classId !== args.classId) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Students can only view their own class",
        });
      }
    }

    let classTeacher = null;
    if (classData.classTeacherId) {
      const teacher = await ctx.db.get(classData.classTeacherId);
      if (teacher) {
        classTeacher = {
          _id: teacher._id,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          email: teacher.email,
        };
      }
    }

    return {
      ...classData,
      classTeacher,
    };
  },
});

// Get teacher by user ID
export const getTeacherByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<{
    _id: Id<"teachers">;
    userId: Id<"users">;
    schoolId: Id<"schools">;
    specialization?: string;
    hasLeft: boolean;
  } | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    try {
      const teacher = await ctx.db
        .query("teachers")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .first();

      return teacher ?? null;
    } catch (error) {
      console.error("Error fetching teacher by user ID:", error);
      return null;
    }
  },
});

export const listClasses = query({
  args: { schoolId: v.optional(v.id("schools")) },
  handler: async (ctx, args): Promise<Array<{
    _id: Id<"classes">;
    name: string;
    grade: number;
    letter: string;
    schoolId: Id<"schools">;
    classTeacherId?: Id<"users">;
    diaryType: string;
    shiftNumber: 1 | 2;
    academicYear: string;
    organizationalForm?: string;
    admissionAfter?: string;
    educationForm?: string;
    organizationOfDay?: string;
    financedBy?: string;
    isMerged?: boolean;
    isSpecial?: boolean;
    preparationType?: string;
    _creationTime: number;
    classTeacher?: { name?: string; hasLeft: boolean; userId?: Id<"users"> } | null;
    studentCount: number;
    teacherCount: number;
    subjectCount: number;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Get current user to check role
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

    // Check if user is admin or director
    const isAdminOrDirector = currentUser.role === "system_admin" ||
                              currentUser.role === "director" ||
                              currentUser.role === "vice_director" ||
                              currentUser.roles?.includes("system_admin") ||
                              currentUser.roles?.includes("director") ||
                              currentUser.roles?.includes("vice_director");

    let classes = args.schoolId
      ? await ctx.db
          .query("classes")
          .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
          .collect()
      : await ctx.db.query("classes").collect();
    
    // Filter classes for teachers (not admin/director)
    const isTeacherRole = currentUser.role === "teacher" || currentUser.role === "class_teacher" ||
                          currentUser.roles?.includes("teacher") || currentUser.roles?.includes("class_teacher");
    
    if (!isAdminOrDirector && isTeacherRole) {
      const teacher = await ctx.db
        .query("teachers")
        .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
        .unique();
      
      if (teacher) {
        // Get class IDs from classSubjects
        const classSubjects = await ctx.db
          .query("classSubjects")
          .withIndex("by_teacher", (q) => q.eq("teacherId", teacher._id))
          .collect();
        
        const teacherClassIds = new Set(classSubjects.map(cs => cs.classId));
        
        // Also get class IDs from weeklySchedules
        const allSchedules = await ctx.db.query("weeklySchedules").collect();
        for (const schedule of allSchedules) {
          for (const entry of schedule.entries) {
            if (entry.teacherId === teacher._id) {
              teacherClassIds.add(schedule.classId);
              break; // Found at least one entry, no need to check more for this schedule
            }
          }
        }
        
        // Filter classes to only those where the teacher teaches
        classes = classes.filter(cls => 
          teacherClassIds.has(cls._id) || cls.classTeacherId === currentUser._id
        );
      }
    }
    
    // Enrich with additional data
    const enrichedClasses = await Promise.all(
      classes.map(async (cls) => {
        let classTeacher = null;
        if (cls.classTeacherId) {
          const teacher = await ctx.db
            .query("teachers")
            .withIndex("by_user", (q) => q.eq("userId", cls.classTeacherId!))
            .first();
          if (teacher) {
            const user = await ctx.db.get(cls.classTeacherId);
            classTeacher = {
              name: user?.name,
              hasLeft: teacher.hasLeft,
              userId: cls.classTeacherId,
            };
          }
        }

        const studentCount = (await ctx.db
          .query("students")
          .withIndex("by_class", (q) => q.eq("classId", cls._id))
          .collect()).length;

        const classSubjects = await ctx.db
          .query("classSubjects")
          .withIndex("by_class", (q) => q.eq("classId", cls._id))
          .collect();

        const teacherIds = new Set(classSubjects.map((cs) => cs.teacherId));
        const subjectIds = new Set(classSubjects.map((cs) => cs.subjectId));

        return {
          ...cls,
          classTeacher,
          studentCount,
          teacherCount: teacherIds.size,
          subjectCount: subjectIds.size,
        };
      })
    );

    // Sort by grade (ascending) and then by letter (alphabetical)
    enrichedClasses.sort((a, b) => {
      if (a.grade !== b.grade) {
        return a.grade - b.grade;
      }
      return a.letter.localeCompare(b.letter);
    });

    return enrichedClasses;
  },
});

export const createClass = mutation({
  args: {
    name: v.string(),
    grade: v.number(),
    letter: v.string(),
    schoolId: v.id("schools"),
    classTeacherId: v.optional(v.id("users")),
    diaryType: v.string(),
    shiftNumber: v.union(v.literal(1), v.literal(2)),
    academicYear: v.string(),
    organizationalForm: v.optional(v.string()),
    admissionAfter: v.optional(v.string()),
    educationForm: v.optional(v.string()),
    organizationOfDay: v.optional(v.string()),
    financedBy: v.optional(v.string()),
    isMerged: v.optional(v.boolean()),
    isSpecial: v.optional(v.boolean()),
    preparationType: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"classes">> => {
    if (!(await isAdmin(ctx))) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only administrators can create classes",
      });
    }

    return await ctx.db.insert("classes", args);
  },
});

export const updateClass = mutation({
  args: {
    id: v.id("classes"),
    name: v.optional(v.string()),
    grade: v.optional(v.number()),
    letter: v.optional(v.string()),
    diaryType: v.optional(v.string()),
    classTeacherId: v.optional(v.id("users")),
    shiftNumber: v.optional(v.union(v.literal(1), v.literal(2))),
    organizationalForm: v.optional(v.string()),
    admissionAfter: v.optional(v.string()),
    educationForm: v.optional(v.string()),
    organizationOfDay: v.optional(v.string()),
    financedBy: v.optional(v.string()),
    isMerged: v.optional(v.boolean()),
    isSpecial: v.optional(v.boolean()),
    preparationType: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    if (!(await isAdmin(ctx))) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only administrators can update classes",
      });
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const deleteClass = mutation({
  args: { id: v.id("classes") },
  handler: async (ctx, args): Promise<void> => {
    if (!(await isAdmin(ctx))) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only administrators can delete classes",
      });
    }

    await ctx.db.delete(args.id);
  },
});

// Update class subjects and teachers
export const updateClassSubjectsTeachers = mutation({
  args: {
    classId: v.id("classes"),
    subjectsTeachers: v.array(v.object({
      subjectId: v.id("subjects"),
      userId: v.id("users"),
      preparationType: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args): Promise<void> => {
    if (!(await isAdmin(ctx))) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only administrators can update class subjects",
      });
    }

    // Get the class to get schoolId and academicYear
    const classData = await ctx.db.get(args.classId);
    if (!classData) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Class not found",
      });
    }

    // Delete all existing classSubjects for this class
    const existingClassSubjects = await ctx.db
      .query("classSubjects")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    for (const cs of existingClassSubjects) {
      await ctx.db.delete(cs._id);
    }

    // Insert new classSubjects
    for (const st of args.subjectsTeachers) {
      // Find teacher record by userId
      let teacher = await ctx.db
        .query("teachers")
        .withIndex("by_user", (q) => q.eq("userId", st.userId))
        .first();

      // If no teacher record exists, create one
      if (!teacher) {
        const teacherId = await ctx.db.insert("teachers", {
          userId: st.userId,
          schoolId: classData.schoolId,
          hasLeft: false,
        });
        teacher = await ctx.db.get(teacherId);
      }

      if (teacher) {
        await ctx.db.insert("classSubjects", {
          classId: args.classId,
          subjectId: st.subjectId,
          teacherId: teacher._id,
          hoursPerWeek: 1, // Default value
          academicYear: classData.academicYear,
          preparationType: st.preparationType || "ЗП",
        });
      }
    }
  },
});

// Get class subjects and teachers
export const getClassSubjectsTeachers = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args): Promise<Array<{
    _id: string;
    subjectId: Id<"subjects">;
    subjectName: string;
    teacherId: Id<"teachers">;
    userId: Id<"users"> | null;
    teacherName: string;
    preparationType: string;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // First try classSubjects table
    const classSubjects = await ctx.db
      .query("classSubjects")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    if (classSubjects.length > 0) {
      const result = await Promise.all(
        classSubjects.map(async (cs) => {
          const subject = await ctx.db.get(cs.subjectId);
          const teacher = await ctx.db.get(cs.teacherId);
          const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;
          
          return {
            _id: cs._id,
            subjectId: cs.subjectId,
            subjectName: subject?.name || "—",
            teacherId: cs.teacherId,
            userId: teacher?.userId || null,
            teacherName: teacherUser ? `${teacherUser.firstName} ${teacherUser.lastName}` : "—",
            preparationType: cs.preparationType || "ЗП",
          };
        })
      );
      return result;
    }

    // If classSubjects is empty, extract from weeklySchedules
    const weeklySchedules = await ctx.db
      .query("weeklySchedules")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Extract unique subject-teacher-preparationType combinations from all weekly schedules
    const uniquePairs = new Map<string, { subjectId: Id<"subjects">; teacherId: Id<"teachers">; preparationType?: string }>();
    
    for (const ws of weeklySchedules) {
      if (ws.entries && Array.isArray(ws.entries)) {
        for (const entry of ws.entries) {
          if (entry.subjectId && entry.teacherId) {
            // Include preparationType in key to avoid losing different prep types for same subject-teacher
            const prepType = entry.preparationType || "ЗП";
            const key = `${entry.subjectId}-${entry.teacherId}-${prepType}`;
            if (!uniquePairs.has(key)) {
              uniquePairs.set(key, {
                subjectId: entry.subjectId as Id<"subjects">,
                teacherId: entry.teacherId as Id<"teachers">,
                preparationType: prepType,
              });
            }
          }
        }
      }
    }

    // Convert to result format
    const result = await Promise.all(
      Array.from(uniquePairs.entries()).map(async ([key, pair]) => {
        const subject = await ctx.db.get(pair.subjectId);
        const teacher = await ctx.db.get(pair.teacherId);
        const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;
        
        return {
          _id: key, // Use composite key as ID since these aren't from classSubjects table
          subjectId: pair.subjectId,
          subjectName: subject?.name || "—",
          teacherId: pair.teacherId,
          userId: teacher?.userId || null,
          teacherName: teacherUser ? `${teacherUser.firstName} ${teacherUser.lastName}` : "—",
          preparationType: pair.preparationType || "ЗП",
        };
      })
    );

    return result;
  },
});

// SUBJECTS
export const listSubjects = query({
  args: { schoolId: v.optional(v.id("schools")) },
  handler: async (ctx, args): Promise<Array<{
    _id: Id<"subjects">;
    name: string;
    shortName: string;
    group?: string;
    isPrimary: boolean;
    schoolId: Id<"schools">;
    _creationTime: number;
    teacherCount: number;
    classCount: number;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const subjects = args.schoolId
      ? await ctx.db
          .query("subjects")
          .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
          .collect()
      : await ctx.db.query("subjects").collect();
    
    // Enrich with additional data
    const enrichedSubjects = await Promise.all(
      subjects.map(async (subject) => {
        const classSubjects = await ctx.db
          .query("classSubjects")
          .withIndex("by_subject", (q) => q.eq("subjectId", subject._id))
          .collect();

        const teacherIds = new Set(classSubjects.map((cs) => cs.teacherId));
        const classIds = new Set(classSubjects.map((cs) => cs.classId));

        return {
          ...subject,
          teacherCount: teacherIds.size,
          classCount: classIds.size,
        };
      })
    );

    return enrichedSubjects;
  },
});

// Get subject by ID
export const getSubjectById = query({
  args: { subjectId: v.id("subjects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const subject = await ctx.db.get(args.subjectId);
    if (!subject) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Subject not found",
      });
    }

    return subject;
  },
});

export const createSubject = mutation({
  args: {
    name: v.string(),
    shortName: v.string(),
    group: v.optional(v.string()),
    isPrimary: v.boolean(),
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args): Promise<Id<"subjects">> => {
    if (!(await isAdmin(ctx))) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only administrators can create subjects",
      });
    }

    return await ctx.db.insert("subjects", args);
  },
});

export const updateSubject = mutation({
  args: {
    id: v.id("subjects"),
    name: v.optional(v.string()),
    shortName: v.optional(v.string()),
    group: v.optional(v.string()),
    isPrimary: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    if (!(await isAdmin(ctx))) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only administrators can update subjects",
      });
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const deleteSubject = mutation({
  args: { id: v.id("subjects") },
  handler: async (ctx, args): Promise<void> => {
    if (!(await isAdmin(ctx))) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only administrators can delete subjects",
      });
    }

    await ctx.db.delete(args.id);
  },
});

// USERS MANAGEMENT
export const listUsers = query({
  args: { 
    schoolId: v.optional(v.id("schools")),
    role: v.optional(v.string()),
  },
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
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not found",
      });
    }

    // Get all users
    const users = args.schoolId
      ? await ctx.db
          .query("users")
          .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
          .collect()
      : await ctx.db.query("users").collect();
    
    let filteredUsers = users;
    if (args.role) {
      filteredUsers = filteredUsers.filter((u) => u.role === args.role);
    }

    // If current user is student, filter to show only:
    // 1. Students from the same class
    // 2. Teachers who teach them
    // 3. Admins and directors
    if (currentUser.role === "student" || currentUser.roles?.includes("student")) {
      // Get student's class
      const studentRecord = await ctx.db
        .query("students")
        .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
        .first();
      
      if (studentRecord) {
        const classId = studentRecord.classId;
        
        // Get all students from the same class
        const classmatesRecords = await ctx.db
          .query("students")
          .withIndex("by_class", (q) => q.eq("classId", classId))
          .collect();
        
        const classmateUserIds = new Set(classmatesRecords.map(s => s.userId));
        
        // Get all teachers who teach this class
        const weeklySchedules = await ctx.db.query("weeklySchedules").collect();
        const teacherIds = new Set<Id<"teachers">>();
        
        for (const schedule of weeklySchedules) {
          if (schedule.classId === classId) {
            for (const entry of schedule.entries) {
              if (entry.teacherId) {
                teacherIds.add(entry.teacherId);
              }
            }
          }
        }
        
        // Get user IDs of teachers
        const teacherRecords = await Promise.all(
          Array.from(teacherIds).map(async (teacherId) => {
            const teacher = await ctx.db.get(teacherId);
            return teacher?.userId;
          })
        );
        
        const teacherUserIds = new Set(teacherRecords.filter((id): id is Id<"users"> => id !== null && id !== undefined));
        
        // Filter users: classmates + teachers + admins/directors
        filteredUsers = filteredUsers.filter((u) => {
          // Show classmates
          if (classmateUserIds.has(u._id)) return true;
          
          // Show teachers who teach this class
          if (teacherUserIds.has(u._id)) return true;
          
          // Show admins and directors
          if (
            u.role === "system_admin" ||
            u.role === "director" ||
            u.role === "vice_director" ||
            u.role === "secretary" ||
            u.role === "pedagogical_counselor" ||
            u.role === "housekeeper" ||
            u.roles?.includes("system_admin") ||
            u.roles?.includes("director") ||
            u.roles?.includes("vice_director") ||
            u.roles?.includes("secretary") ||
            u.roles?.includes("pedagogical_counselor") ||
            u.roles?.includes("housekeeper")
          ) {
            return true;
          }
          
          return false;
        });
      }
    }

    // Add avatar URLs
    const usersWithAvatars = await Promise.all(
      filteredUsers.map(async (user) => {
        let avatarUrl = null;
        if (user.avatarStorageId) {
          avatarUrl = await ctx.storage.getUrl(user.avatarStorageId);
        }
        return {
          ...user,
          avatarUrl,
        };
      })
    );
    
    return usersWithAvatars;
  },
});

export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
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
    ),
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
    if (!(await isAdmin(ctx))) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only administrators can update user roles",
      });
    }

    const { userId, ...updates } = args;
    await ctx.db.patch(userId, updates);
  },
});

// TEACHERS
export const listTeachers = query({
  args: { schoolId: v.optional(v.id("schools")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const teachers = args.schoolId
      ? await ctx.db
          .query("teachers")
          .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
          .collect()
      : await ctx.db.query("teachers").collect();
    
    return teachers;
  },
});

export const listTeachersWithNames = query({
  args: { schoolId: v.optional(v.id("schools")) },
  handler: async (ctx, args): Promise<Array<{ _id: Id<"teachers">; userId: Id<"users">; name: string; hasLeft: boolean; subjectIds?: Id<"subjects">[] }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const teachers = args.schoolId
      ? await ctx.db
          .query("teachers")
          .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
          .collect()
      : await ctx.db.query("teachers").collect();
    
    const enriched = await Promise.all(
      teachers.map(async (teacher) => {
        const user = await ctx.db.get(teacher.userId);
        return {
          _id: teacher._id,
          userId: teacher.userId,
          name: buildUserName(user),
          hasLeft: teacher.hasLeft,
          subjectIds: user?.teacherSubjects,
        };
      })
    );
    
    return enriched;
  },
});

// List teachers with their subjects for scheduling
export const listTeachersWithSubjects = query({
  args: { schoolId: v.optional(v.id("schools")) },
  handler: async (ctx, args): Promise<Array<{ 
    _id: Id<"teachers">; 
    userId: Id<"users">; 
    name: string; 
    hasLeft: boolean;
    subjectIds: Array<Id<"subjects">>;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const teachers = args.schoolId
      ? await ctx.db
          .query("teachers")
          .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
          .collect()
      : await ctx.db.query("teachers").collect();
    
    const enriched = await Promise.all(
      teachers.map(async (teacher) => {
        const user = await ctx.db.get(teacher.userId);
        
        // Get subjects for this user (includes teachers and admins)
        const subjectIds = user?.teacherSubjects ?? [];
        
        return {
          _id: teacher._id,
          userId: teacher.userId,
          name: user?.name ?? "",
          hasLeft: teacher.hasLeft,
          subjectIds,
          isDeleted: user?.isDeleted ?? false,
        };
      })
    );
    
    // Include users with admin roles that can also teach (with or without teacher record)
    const allUsers = await ctx.db.query("users").collect();
    const adminUsers = allUsers.filter(u => 
      !u.isDeleted && 
      (u.role === "director" || u.role === "vice_director" || u.role === "system_admin" ||
       u.roles?.includes("director") || u.roles?.includes("vice_director") || u.roles?.includes("system_admin")) &&
      u.teacherSubjects && u.teacherSubjects.length > 0
    );
    
    // For each admin user, add them if not already included
    for (const adminUser of adminUsers) {
      const existingTeacher = enriched.find(t => t.userId === adminUser._id);
      if (!existingTeacher) {
        // Check if teacher record exists in DB
        const dbTeacher = await ctx.db
          .query("teachers")
          .withIndex("by_user", (q) => q.eq("userId", adminUser._id))
          .first();
        
        if (dbTeacher) {
          // Has teacher record - use it
          enriched.push({
            _id: dbTeacher._id,
            userId: adminUser._id,
            name: adminUser.name ?? "",
            hasLeft: false,
            subjectIds: adminUser.teacherSubjects ?? [],
            isDeleted: false,
          });
        } else {
          // No teacher record - use userId as temporary _id
          // This will be auto-created when schedule is saved
          enriched.push({
            _id: adminUser._id as unknown as Id<"teachers">,
            userId: adminUser._id,
            name: adminUser.name ?? "",
            hasLeft: false,
            subjectIds: adminUser.teacherSubjects ?? [],
            isDeleted: false,
          });
        }
      }
    }
    
    // Filter out teachers without names or who are deleted
    return enriched.filter(t => t.name && t.name.trim() !== "" && !t.isDeleted);
  },
});

// STUDENTS
export const listStudents = query({
  args: { schoolId: v.optional(v.id("schools")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const students = args.schoolId
      ? await ctx.db
          .query("students")
          .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
          .collect()
      : await ctx.db.query("students").collect();
    
    return students;
  },
});

// SCHOOLS
export const listSchools = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    return await ctx.db.query("schools").collect();
  },
});

export const createSchool = mutation({
  args: {
    name: v.string(),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"schools">> => {
    if (!(await isAdmin(ctx))) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only administrators can create schools",
      });
    }

    return await ctx.db.insert("schools", args);
  },
});

export const updateSchool = mutation({
  args: {
    id: v.id("schools"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    principalId: v.optional(v.id("users")),
  },
  handler: async (ctx, args): Promise<void> => {
    if (!(await isAdmin(ctx))) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only administrators can update schools",
      });
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

// Sync teachers - automatically create teacher records for all users with teacher role
export const syncTeachers = mutation({
  args: {},
  handler: async (ctx): Promise<{ created: number; existing: number; errors: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Get default school
    const school = await ctx.db.query("schools").first();
    if (!school) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "No school found. Please create a school first.",
      });
    }

    // Get all users with teacher role
    const allUsers = await ctx.db.query("users").collect();
    const teacherUsers = allUsers.filter(
      (u) => u.role === "teacher" || u.role === "class_teacher"
    );

    let created = 0;
    let existing = 0;
    let errors = 0;

    for (const user of teacherUsers) {
      try {
        // Check if teacher record already exists
        const existingTeacher = await ctx.db
          .query("teachers")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .first();

        if (existingTeacher) {
          existing++;
        } else {
          // Create new teacher record
          await ctx.db.insert("teachers", {
            userId: user._id,
            schoolId: user.schoolId || school._id,
            hasLeft: false,
          });
          created++;
        }
      } catch (error) {
        console.error(`Error syncing teacher ${user._id}:`, error);
        errors++;
      }
    }

    return { created, existing, errors };
  },
});

// Ensure teacher records exist for given user IDs (including admins)
export const ensureTeacherRecords = mutation({
  args: {
    userIds: v.array(v.union(v.id("users"), v.id("teachers"))),
  },
  handler: async (ctx, args): Promise<Array<Id<"teachers">>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Get default school
    const school = await ctx.db.query("schools").first();
    if (!school) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "No school found.",
      });
    }

    const teacherIds: Array<Id<"teachers">> = [];

    for (const id of args.userIds) {
      // First check if this is already a teacher ID
      const existingTeacher = await ctx.db.get(id as Id<"teachers">);
      if (existingTeacher && "userId" in existingTeacher) {
        // It's a valid teacher record
        teacherIds.push(id as Id<"teachers">);
        continue;
      }

      // Otherwise treat as userId and find/create teacher record
      const userId = id as Id<"users">;
      
      // Check if teacher record exists for this user
      let teacher = await ctx.db
        .query("teachers")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();

      if (!teacher) {
        // Get user to find their school
        const user = await ctx.db.get(userId);
        if (!user) {
          throw new ConvexError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        // Create teacher record
        const teacherId = await ctx.db.insert("teachers", {
          userId: userId,
          schoolId: user.schoolId || school._id,
          hasLeft: false,
        });

        teacherIds.push(teacherId);
      } else {
        teacherIds.push(teacher._id);
      }
    }

    return teacherIds;
  },
});

// Assign school to user
export const assignSchoolToUser = mutation({
  args: {
    userId: v.id("users"),
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args) => {
    // Check if requester is admin
    if (!await isAdmin(ctx)) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only admins can assign schools to users",
      });
    }

    // Verify user exists
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Verify school exists
    const school = await ctx.db.get(args.schoolId);
    if (!school) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "School not found",
      });
    }

    // Update user with schoolId
    await ctx.db.patch(args.userId, { schoolId: args.schoolId });

    return { success: true };
  },
});

// Assign school to current user (for self-service)
export const assignSchoolToCurrentUser = mutation({
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
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // If user already has schoolId, nothing to do
    if (user.schoolId) {
      return { success: true, alreadyAssigned: true };
    }

    // Get first/default school
    const school = await ctx.db.query("schools").first();
    if (!school) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "No school found in the system",
      });
    }

    // Update user with schoolId
    await ctx.db.patch(user._id, { schoolId: school._id });

    return { success: true, alreadyAssigned: false };
  },
});
