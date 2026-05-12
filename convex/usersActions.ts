"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api.js";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";
import { issueAuthToken } from "./authSession.js";

// Action to create a user with password hashing
export const createUserAction = action({
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
    password: v.optional(v.string()),
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
    teachingClassIds: v.optional(v.array(v.id("classes"))),
    studentIds: v.optional(v.array(v.id("students"))), // For parent role
  },
  handler: async (ctx, args): Promise<Id<"users">> => {
    // Hash password if provided
    let hashedPassword: string | undefined;
    if (args.password) {
      hashedPassword = await ctx.runAction(internal.passwords.hashPassword, {
        password: args.password,
      });
    }

    // Remove password field before passing to internal mutation
    const { password, ...argsWithoutPassword } = args;

    // Call internal mutation to create user
    return await ctx.runMutation(internal.users.createUserInternal, {
      ...argsWithoutPassword,
      hashedPassword,
    });
  },
});

// Action to change password with hashing
export const changePasswordAction = action({
  args: {
    newPassword: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    // Hash password
    const hashedPassword = await ctx.runAction(internal.passwords.hashPassword, {
      password: args.newPassword,
    });

    // Call internal mutation to update password
    await ctx.runMutation(internal.users.changePasswordInternal, {
      hashedPassword,
    });
  },
});

// Action for admin to change user password
export const adminChangeUserPasswordAction = action({
  args: {
    userId: v.id("users"),
    newPassword: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    // Hash password
    const hashedPassword = await ctx.runAction(internal.passwords.hashPassword, {
      password: args.newPassword,
    });

    // Call internal mutation to update password
    await ctx.runMutation(internal.users.adminChangeUserPasswordInternal, {
      userId: args.userId,
      hashedPassword,
    });
  },
});

// Action for pre-authentication check
export const verifyPreAuthAction = action({
  args: {
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; email?: string; message?: string }> => {
    // Get user data and check password
    const result = await ctx.runMutation(internal.users.verifyPreAuthInternal, {
      username: args.username,
    });

    if (!result.success || !result.hashedPassword) {
      return { success: false, message: result.message };
    }

    // Verify password with bcrypt
    const isValid = await ctx.runAction(internal.passwords.verifyPassword, {
      password: args.password,
      hashedPassword: result.hashedPassword,
    });

    if (!isValid) {
      // Record failed attempt
      await ctx.runMutation(internal.users.recordFailedAttempt, {
        username: args.username,
      });
      return { success: false, message: "Грешно потребителско име или парола" };
    }

    // Record successful login
    if (result.userId) {
      await ctx.runMutation(internal.users.recordSuccessfulLogin, {
        userId: result.userId,
      });
    }

    return { success: true, email: result.email };
  },
});

export const signInWithPasswordAction = action({
  args: {
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<{ token: string }> => {
    const result = await ctx.runMutation(internal.users.verifyPreAuthInternal, {
      username: args.username,
    });

    if (!result.success || !result.hashedPassword || !result.userId) {
      throw new ConvexError(result.message ?? "Грешно потребителско име или парола");
    }

    const isValid = await ctx.runAction(internal.passwords.verifyPassword, {
      password: args.password,
      hashedPassword: result.hashedPassword,
    });

    if (!isValid) {
      await ctx.runMutation(internal.users.recordFailedAttempt, {
        username: args.username,
      });
      throw new ConvexError("Грешно потребителско име или парола");
    }

    await ctx.runMutation(internal.users.recordSuccessfulLogin, {
      userId: result.userId,
    });

    const token = await issueAuthToken({
      userId: result.userId,
      email: result.email,
      name: result.name,
      firstName: result.firstName,
      lastName: result.lastName,
      role: result.role ?? "system_admin",
    });

    return { token };
  },
});

export const bootstrapFirstAdminAction = action({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<{ token: string }> => {
    const hashedPassword = await ctx.runAction(internal.passwords.hashPassword, {
      password: args.password,
    });

    const userId = await ctx.runMutation(internal.users.createFirstAdminInternal, {
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      username: args.username,
      hashedPassword,
    });

    await ctx.runMutation(internal.users.recordSuccessfulLogin, {
      userId,
    });

    const token = await issueAuthToken({
      userId,
      email: args.email,
      name: `${args.firstName} ${args.lastName}`.trim(),
      firstName: args.firstName,
      lastName: args.lastName,
      role: "system_admin",
    });

    return { token };
  },
});

// User data for bulk import
const bulkUserValidator = v.object({
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
  username: v.string(),
  password: v.string(),
  role: v.union(
    v.literal("teacher"),
    v.literal("student"),
    v.literal("parent"),
    v.literal("director"),
    v.literal("vice_director"),
    v.literal("system_admin"),
    v.literal("secretary"),
    v.literal("pedagogical_counselor"),
    v.literal("housekeeper")
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
    v.literal("housekeeper")
  ))),
  classId: v.optional(v.id("classes")),
  studentNumber: v.optional(v.number()),
  parent1Name: v.optional(v.string()),
  parent2Name: v.optional(v.string()),
  personalDoctor: v.optional(v.string()),
  address: v.optional(v.string()),
  schoolId: v.optional(v.id("schools")),
  // New fields for parent/doctor linking during Excel import
  parentOfStudent: v.optional(v.string()), // Name or identifier of student this parent is linked to
  doctorOfStudent: v.optional(v.string()), // Name or identifier of student this doctor is assigned to
});

// Action to bulk create users from Excel import
export const bulkCreateUsersAction = action({
  args: {
    users: v.array(bulkUserValidator),
    skipValidation: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ success: number; failed: number; errors: string[] }> => {
    const results = { success: 0, failed: 0, errors: [] as string[] };
    
    // Track users that need parent-student linking or doctor updates
    const parentLinks: Array<{ userId: Id<"users">; studentName: string; schoolId?: Id<"schools"> }> = [];
    const doctorUpdates: Array<{ doctorName: string; studentName: string; schoolId?: Id<"schools"> }> = [];
    
    for (const userData of args.users) {
      try {
        // Hash password
        const hashedPassword = await ctx.runAction(internal.passwords.hashPassword, {
          password: userData.password,
        });

        // Remove password and linking fields before passing to internal mutation
        const { password, parentOfStudent, doctorOfStudent, ...argsWithoutPassword } = userData;

        // If parentOfStudent is set, ensure role is parent
        if (parentOfStudent) {
          argsWithoutPassword.role = "parent";
          argsWithoutPassword.roles = ["parent"];
        }

        // Call internal mutation to create user
        const userId = await ctx.runMutation(internal.users.createUserInternal, {
          ...argsWithoutPassword,
          hashedPassword,
          // Make validation optional based on skipValidation flag
          skipValidation: args.skipValidation,
        });
        
        // Track for parent linking
        if (parentOfStudent && userId) {
          parentLinks.push({
            userId,
            studentName: parentOfStudent,
            schoolId: argsWithoutPassword.schoolId,
          });
        }
        
        // Track for doctor updates
        if (doctorOfStudent) {
          const doctorName = [argsWithoutPassword.firstName, argsWithoutPassword.middleName, argsWithoutPassword.lastName]
            .filter(Boolean)
            .join(" ");
          doctorUpdates.push({
            doctorName,
            studentName: doctorOfStudent,
            schoolId: argsWithoutPassword.schoolId,
          });
        }
        
        results.success++;
      } catch (error) {
        results.failed++;
        const userName = `${userData.firstName} ${userData.lastName}`.trim() || userData.email;
        const errorMsg = error instanceof Error ? error.message : "Неизвестна грешка";
        results.errors.push(`${userName}: ${errorMsg}`);
      }
    }
    
    // Process parent-student links
    for (const link of parentLinks) {
      try {
        const result = await ctx.runMutation(internal.users.linkParentToStudentInternal, {
          parentUserId: link.userId,
          studentNameOrIdentifier: link.studentName,
          schoolId: link.schoolId,
        });
        if (!result.success && result.error) {
          results.errors.push(`Свързване на родител: ${result.error}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Неизвестна грешка";
        results.errors.push(`Свързване на родител: ${errorMsg}`);
      }
    }
    
    // Process personal doctor updates
    for (const update of doctorUpdates) {
      try {
        const result = await ctx.runMutation(internal.users.updateStudentPersonalDoctorInternal, {
          doctorName: update.doctorName,
          studentNameOrIdentifier: update.studentName,
          schoolId: update.schoolId,
        });
        if (!result.success && result.error) {
          results.errors.push(`Личен лекар: ${result.error}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Неизвестна грешка";
        results.errors.push(`Личен лекар: ${errorMsg}`);
      }
    }
    
    return results;
  },
});

// Validator for student with parents import
const studentWithParentsValidator = v.object({
  // Student data
  studentNumber: v.optional(v.number()),
  studentName: v.string(), // Full name "Име Презиме Фамилия"
  // Parent 1 data (баща)
  parent1FirstName: v.optional(v.string()),
  parent1MiddleName: v.optional(v.string()),
  parent1LastName: v.optional(v.string()),
  parent1Phone: v.optional(v.string()),
  parent1Email: v.optional(v.string()),
  // Parent 2 data (майка)
  parent2FirstName: v.optional(v.string()),
  parent2MiddleName: v.optional(v.string()),
  parent2LastName: v.optional(v.string()),
  parent2Phone: v.optional(v.string()),
  parent2Email: v.optional(v.string()),
  // Common data
  address: v.optional(v.string()),
});

// Helper function to parse Bulgarian full name into parts
function parseFullName(fullName: string): { firstName: string; middleName?: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }
  if (parts.length === 2) {
    return { firstName: parts[0], lastName: parts[1] };
  }
  // 3+ parts: first is firstName, last is lastName, middle is middleName
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

// Helper function to generate username from name
function generateUsername(firstName: string, lastName: string, index: number): string {
  const first = firstName.toLowerCase().replace(/[^a-zа-я0-9]/gi, "").slice(0, 10);
  const last = lastName.toLowerCase().replace(/[^a-zа-я0-9]/gi, "").slice(0, 10);
  // Transliterate Bulgarian to Latin
  const translit = (str: string) => str
    .replace(/а/g, "a").replace(/б/g, "b").replace(/в/g, "v").replace(/г/g, "g")
    .replace(/д/g, "d").replace(/е/g, "e").replace(/ж/g, "zh").replace(/з/g, "z")
    .replace(/и/g, "i").replace(/й/g, "y").replace(/к/g, "k").replace(/л/g, "l")
    .replace(/м/g, "m").replace(/н/g, "n").replace(/о/g, "o").replace(/п/g, "p")
    .replace(/р/g, "r").replace(/с/g, "s").replace(/т/g, "t").replace(/у/g, "u")
    .replace(/ф/g, "f").replace(/х/g, "h").replace(/ц/g, "ts").replace(/ч/g, "ch")
    .replace(/ш/g, "sh").replace(/щ/g, "sht").replace(/ъ/g, "a").replace(/ь/g, "")
    .replace(/ю/g, "yu").replace(/я/g, "ya");
  return `${translit(first)}${translit(last)}${index}`;
}

// Action to import students with their parents from Excel
export const importStudentsWithParentsAction = action({
  args: {
    rows: v.array(studentWithParentsValidator),
    classId: v.id("classes"),
    schoolId: v.id("schools"),
  },
  handler: async (ctx, args): Promise<{ 
    success: number; 
    failed: number; 
    errors: string[];
    studentsCreated: number;
    parentsCreated: number;
  }> => {
    const results = { 
      success: 0, 
      failed: 0, 
      errors: [] as string[],
      studentsCreated: 0,
      parentsCreated: 0,
    };
    
    let index = 0;
    for (const row of args.rows) {
      index++;
      try {
        // Parse student name
        const studentNameParts = parseFullName(row.studentName);
        if (!studentNameParts.firstName || !studentNameParts.lastName) {
          results.errors.push(`Ред ${index}: Невалидно име на ученик "${row.studentName}"`);
          results.failed++;
          continue;
        }
        
        // Generate student credentials
        const studentUsername = generateUsername(studentNameParts.firstName, studentNameParts.lastName, index);
        const studentPassword = `Student${index}!`;
        const studentEmail = `${studentUsername}@student.local`;
        
        // Hash password for student
        const studentHashedPassword = await ctx.runAction(internal.passwords.hashPassword, {
          password: studentPassword,
        });
        
        // Create student user
        const studentUserId = await ctx.runMutation(internal.users.createUserInternal, {
          firstName: studentNameParts.firstName,
          middleName: studentNameParts.middleName,
          lastName: studentNameParts.lastName,
          identifier: `TEMP_STUDENT_${Date.now()}_${index}`,
          identifierType: "other" as const,
          gender: "other" as const,
          phone: "+359000000000",
          email: studentEmail,
          username: studentUsername,
          hashedPassword: studentHashedPassword,
          role: "student" as const,
          roles: ["student" as const],
          schoolId: args.schoolId,
          classId: args.classId,
          studentNumber: row.studentNumber,
          address: row.address,
          isActive: true,
          skipValidation: true,
        });
        
        results.studentsCreated++;
        
        // Get the student record that was just created
        const studentRecord = await ctx.runQuery(api.users.getStudentByUserId, { userId: studentUserId });
        
        // Create Parent 1 if data exists
        if (row.parent1FirstName && row.parent1LastName) {
          try {
            const parent1Username = generateUsername(row.parent1FirstName, row.parent1LastName, index * 100 + 1);
            const parent1Password = `Parent${index}A!`;
            const parent1Email = row.parent1Email || `${parent1Username}@parent.local`;
            
            const parent1HashedPassword = await ctx.runAction(internal.passwords.hashPassword, {
              password: parent1Password,
            });
            
            const parent1UserId = await ctx.runMutation(internal.users.createUserInternal, {
              firstName: row.parent1FirstName,
              middleName: row.parent1MiddleName,
              lastName: row.parent1LastName,
              identifier: `TEMP_PARENT1_${Date.now()}_${index}`,
              identifierType: "other" as const,
              gender: "male" as const, // Баща
              phone: row.parent1Phone || "+359000000000",
              email: parent1Email,
              username: parent1Username,
              hashedPassword: parent1HashedPassword,
              role: "parent" as const,
              roles: ["parent" as const],
              schoolId: args.schoolId,
              address: row.address,
              isActive: true,
              skipValidation: true,
              studentIds: studentRecord ? [studentRecord._id] : undefined,
            });
            
            results.parentsCreated++;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Неизвестна грешка";
            results.errors.push(`Ред ${index}: Грешка при създаване на Родител 1: ${errorMsg}`);
          }
        }
        
        // Create Parent 2 if data exists
        if (row.parent2FirstName && row.parent2LastName) {
          try {
            const parent2Username = generateUsername(row.parent2FirstName, row.parent2LastName, index * 100 + 2);
            const parent2Password = `Parent${index}B!`;
            const parent2Email = row.parent2Email || `${parent2Username}@parent.local`;
            
            const parent2HashedPassword = await ctx.runAction(internal.passwords.hashPassword, {
              password: parent2Password,
            });
            
            const parent2UserId = await ctx.runMutation(internal.users.createUserInternal, {
              firstName: row.parent2FirstName,
              middleName: row.parent2MiddleName,
              lastName: row.parent2LastName,
              identifier: `TEMP_PARENT2_${Date.now()}_${index}`,
              identifierType: "other" as const,
              gender: "female" as const, // Майка
              phone: row.parent2Phone || "+359000000000",
              email: parent2Email,
              username: parent2Username,
              hashedPassword: parent2HashedPassword,
              role: "parent" as const,
              roles: ["parent" as const],
              schoolId: args.schoolId,
              address: row.address,
              isActive: true,
              skipValidation: true,
              studentIds: studentRecord ? [studentRecord._id] : undefined,
            });
            
            results.parentsCreated++;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Неизвестна грешка";
            results.errors.push(`Ред ${index}: Грешка при създаване на Родител 2: ${errorMsg}`);
          }
        }
        
        results.success++;
      } catch (error) {
        results.failed++;
        const errorMsg = error instanceof Error ? error.message : "Неизвестна грешка";
        results.errors.push(`Ред ${index} (${row.studentName}): ${errorMsg}`);
      }
    }
    
    return results;
  },
});

// Action to update a user
export const updateUserAction = action({
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
    password: v.optional(v.string()), // New: optional password update
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
    // Hash password if provided
    let hashedPassword: string | undefined;
    if (args.password && args.password.trim().length > 0) {
      hashedPassword = await ctx.runAction(internal.passwords.hashPassword, {
        password: args.password,
      });
    }

    // Get current user identity for auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const currentUser = await ctx.runQuery(api.users.getUserByToken, {});

    if (!currentUser) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not found",
      });
    }

    // ✅ SECURITY: Block students from updating users
    if (currentUser.role === "student") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Учениците нямат право да редактират потребители",
      });
    }

    // ✅ PLATFORM SETTING: Check if class teachers can move students
    const isClassTeacher = currentUser.role === "class_teacher" || currentUser.roles?.includes("class_teacher");
    const isAdmin = currentUser.role === "system_admin" || currentUser.role === "director" || 
      currentUser.role === "vice_director" || currentUser.roles?.includes("system_admin") || 
      currentUser.roles?.includes("director") || currentUser.roles?.includes("vice_director");
    
    if (isClassTeacher && !isAdmin && args.classId !== undefined) {
      // Check if this is actually moving a student (changing classId)
      const targetUser = await ctx.runQuery(api.users.getUserById, { userId: args.userId });
      if (targetUser) {
        const isStudent = args.role === "student" || args.roles?.includes("student");
        if (isStudent) {
          // Get current student record to see if classId is changing
          const studentRecord = await ctx.runQuery(api.users.getStudentByUserId, { userId: args.userId });
          const currentClassId = studentRecord?.classId;
          
          // Only check permission if classId is actually changing
          if (currentClassId && currentClassId !== args.classId) {
            const canMove = await ctx.runQuery(api.platformSettings.getSettingValue, { settingKey: "classTeachersCanMoveStudents" });
            if (!canMove) {
              throw new ConvexError({
                code: "FORBIDDEN",
                message: "Класните ръководители нямат право да преместват ученици между класове. Свържете се с администратор.",
              });
            }
          }
        }
      }
    }

    // Remove password field before passing to internal mutation
    const { password, ...argsWithoutPassword } = args;

    // Call internal mutation to update user
    await ctx.runMutation(internal.users.updateUserInternal, {
      ...argsWithoutPassword,
      hashedPassword,
    });
  },
});
