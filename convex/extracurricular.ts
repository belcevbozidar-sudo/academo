import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";

// Activity categories
export const ACTIVITY_CATEGORIES = [
  "Бойни изкуства",
  "Информационни Технологии",
  "Култура",
  "Музика",
  "Образование и наука",
  "Разни",
  "Спорт",
  "Танци",
  "Туризъм",
  "Чужди езици",
] as const;

// Helper to check if user has admin/teacher role
function isAuthorizedRole(role: string, roles?: string[]): boolean {
  const authorizedRoles = ["system_admin", "director", "vice_director", "teacher", "class_teacher"];
  if (authorizedRoles.includes(role)) return true;
  if (roles?.some(r => authorizedRoles.includes(r))) return true;
  return false;
}

// List all extracurricular activities (for admins/teachers)
export const listAllActivities = query({
  args: {
    includeDeleted: v.optional(v.boolean()),
    onlyMine: v.optional(v.boolean()),
    category: v.optional(v.string()),
    classId: v.optional(v.id("classes")),
    teacherId: v.optional(v.id("teachers")),
  },
  handler: async (ctx, args): Promise<Array<{
    _id: Id<"extracurricularActivities">;
    name: string;
    description?: string;
    startDate?: number;
    endDate?: number;
    category?: string;
    capacity?: number;
    enrolledCount: number;
    studentCount: number;
    parentCount: number;
    totalParticipants: number;
    participantNames: Array<{ name: string; type: "student" | "parent" }>;
    classNames: string[];
    classGrades: string;
    teacherName: string;
    teacherId: Id<"teachers">;
    paymentType?: "free" | "paid";
    pricePerWeek?: number;
    pricePeriod?: "weekly" | "monthly";
    scheduleDays?: number[];
    scheduleStartTime?: string;
    scheduleEndTime?: string;
    isDeleted?: boolean;
    createdAt?: number;
    createdByName?: string;
    lastEditedAt?: number;
    lastEditedByName?: string;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    if (!user.schoolId) {
      return [];
    }

    // Check authorization
    if (!isAuthorizedRole(user.role, user.roles)) {
      throw new ConvexError({ message: "Not authorized", code: "FORBIDDEN" });
    }

    let activities = await ctx.db
      .query("extracurricularActivities")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .collect();

    // Filter deleted
    if (!args.includeDeleted) {
      activities = activities.filter(a => !a.isDeleted);
    }

    // Filter by teacher if onlyMine
    if (args.onlyMine) {
      const teacher = await ctx.db
        .query("teachers")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();
      if (teacher) {
        activities = activities.filter(a => a.teacherId === teacher._id);
      } else {
        activities = [];
      }
    }

    // Filter by specific teacher
    if (args.teacherId) {
      activities = activities.filter(a => a.teacherId === args.teacherId);
    }

    // Filter by category
    if (args.category) {
      activities = activities.filter(a => a.category === args.category);
    }

    // Filter by class
    if (args.classId) {
      activities = activities.filter(a => a.classIds?.includes(args.classId!));
    }

    // Enrich with additional data
    return Promise.all(
      activities.map(async (activity) => {
        // Get teacher info
        const teacher = await ctx.db.get(activity.teacherId);
        const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;
        const teacherName = teacherUser
          ? `${teacherUser.firstName || ""} ${teacherUser.lastName || ""}`.trim() || teacherUser.name || "Неизвестен"
          : "Неизвестен";

        // Get class names
        let classNames: string[] = [];
        let classGrades: string[] = [];
        if (activity.classIds && activity.classIds.length > 0) {
          const classes = await Promise.all(
            activity.classIds.map(id => ctx.db.get(id))
          );
          classNames = classes.filter(Boolean).map(c => c!.name);
          classGrades = [...new Set(classes.filter(Boolean).map(c => String(c!.grade)))];
        }

        // Get created by name
        let createdByName: string | undefined;
        if (activity.createdBy) {
          const creator = await ctx.db.get(activity.createdBy);
          createdByName = creator
            ? `${creator.firstName || ""} ${creator.lastName || ""}`.trim() || creator.name
            : undefined;
        }

        // Get edited by name
        let lastEditedByName: string | undefined;
        if (activity.lastEditedBy) {
          const editor = await ctx.db.get(activity.lastEditedBy);
          lastEditedByName = editor
            ? `${editor.firstName || ""} ${editor.lastName || ""}`.trim() || editor.name
            : undefined;
        }

        // Get participant counts and names
        const studentCount = activity.studentIds.length;
        const parentCount = activity.parentIds?.length || 0;
        const totalParticipants = studentCount + parentCount;

        // Get participant names for display
        const participantNames: Array<{ name: string; type: "student" | "parent" }> = [];
        
        // Get student names
        for (const studentId of activity.studentIds) {
          const student = await ctx.db.get(studentId);
          if (student) {
            const studentUser = await ctx.db.get(student.userId);
            if (studentUser) {
              const name = `${studentUser.firstName || ""} ${studentUser.lastName || ""}`.trim() || studentUser.name || "";
              if (name && name !== "Неизвестен" && name !== "Unknown") {
                participantNames.push({ name, type: "student" });
              }
            }
          }
        }
        
        // Get parent names
        for (const parentId of activity.parentIds || []) {
          const parentUser = await ctx.db.get(parentId);
          if (parentUser) {
            const name = `${parentUser.firstName || ""} ${parentUser.lastName || ""}`.trim() || parentUser.name || "";
            if (name && name !== "Неизвестен" && name !== "Unknown") {
              participantNames.push({ name, type: "parent" });
            }
          }
        }

        return {
          _id: activity._id,
          name: activity.name,
          description: activity.description,
          startDate: activity.startDate,
          endDate: activity.endDate,
          category: activity.category,
          capacity: activity.capacity,
          enrolledCount: activity.studentIds.length,
          studentCount,
          parentCount,
          totalParticipants,
          participantNames,
          classNames,
          classGrades: classGrades.length > 0 ? classGrades.sort((a, b) => Number(a) - Number(b)).join("-") : "",
          teacherName,
          teacherId: activity.teacherId,
          paymentType: activity.paymentType,
          pricePerWeek: activity.pricePerWeek,
          pricePeriod: activity.pricePeriod,
          scheduleDays: activity.scheduleDays,
          scheduleStartTime: activity.scheduleStartTime,
          scheduleEndTime: activity.scheduleEndTime,
          isDeleted: activity.isDeleted,
          createdAt: activity.createdAt,
          createdByName,
          lastEditedAt: activity.lastEditedAt,
          lastEditedByName,
        };
      })
    );
  },
});

// Get single activity details
export const getActivityById = query({
  args: { id: v.id("extracurricularActivities") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    const activity = await ctx.db.get(args.id);
    if (!activity) {
      throw new ConvexError({ message: "Activity not found", code: "NOT_FOUND" });
    }

    // Get teacher info
    const teacher = await ctx.db.get(activity.teacherId);
    const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;
    const teacherName = teacherUser
      ? `${teacherUser.firstName || ""} ${teacherUser.lastName || ""}`.trim() || teacherUser.name || "Неизвестен"
      : "Неизвестен";

    // Get class names and grades
    let classNames: string[] = [];
    let classGrades: number[] = [];
    if (activity.classIds && activity.classIds.length > 0) {
      const classes = await Promise.all(
        activity.classIds.map(id => ctx.db.get(id))
      );
      classNames = classes.filter(Boolean).map(c => c!.name);
      classGrades = [...new Set(classes.filter(Boolean).map(c => c!.grade))].sort((a, b) => a - b);
    }

    // Get enrolled students
    const enrolledStudents = await Promise.all(
      activity.studentIds.map(async (studentId) => {
        const student = await ctx.db.get(studentId);
        if (!student) return null;
        const studentUser = await ctx.db.get(student.userId);
        const studentClass = await ctx.db.get(student.classId);
        return {
          _id: studentId,
          name: studentUser
            ? `${studentUser.firstName || ""} ${studentUser.lastName || ""}`.trim() || studentUser.name
            : "Неизвестен",
          className: studentClass?.name || "",
        };
      })
    );

    // Get enrolled parents
    const enrolledParents = await Promise.all(
      (activity.parentIds || []).map(async (parentId) => {
        const parentUser = await ctx.db.get(parentId);
        if (!parentUser) return null;
        return {
          _id: parentId,
          name: `${parentUser.firstName || ""} ${parentUser.lastName || ""}`.trim() || parentUser.name || "Неизвестен",
        };
      })
    );

    // Calculate participant counts
    const studentCount = activity.studentIds.length;
    const parentCount = activity.parentIds?.length || 0;
    const totalParticipants = studentCount + parentCount;

    // Get created by info
    let createdByInfo: { name: string; at: number } | undefined;
    if (activity.createdBy && activity.createdAt) {
      const creator = await ctx.db.get(activity.createdBy);
      createdByInfo = {
        name: creator
          ? `${creator.firstName || ""} ${creator.lastName || ""}`.trim() || creator.name || "Неизвестен"
          : "Неизвестен",
        at: activity.createdAt,
      };
    }

    // Get edited by info
    let lastEditedByInfo: { name: string; at: number } | undefined;
    if (activity.lastEditedBy && activity.lastEditedAt) {
      const editor = await ctx.db.get(activity.lastEditedBy);
      lastEditedByInfo = {
        name: editor
          ? `${editor.firstName || ""} ${editor.lastName || ""}`.trim() || editor.name || "Неизвестен"
          : "Неизвестен",
        at: activity.lastEditedAt,
      };
    }

    return {
      _id: activity._id,
      name: activity.name,
      description: activity.description,
      startDate: activity.startDate,
      endDate: activity.endDate,
      category: activity.category,
      paymentType: activity.paymentType,
      pricePerWeek: activity.pricePerWeek,
      pricePeriod: activity.pricePeriod,
      scheduleDays: activity.scheduleDays,
      scheduleStartTime: activity.scheduleStartTime,
      scheduleEndTime: activity.scheduleEndTime,
      teacherName,
      teacherId: activity.teacherId,
      classNames,
      classGrades,
      enrolledStudents: enrolledStudents.filter(Boolean),
      enrolledParents: enrolledParents.filter(Boolean),
      enrolledCount: activity.studentIds.length,
      studentCount,
      parentCount,
      totalParticipants,
      createdByInfo,
      lastEditedByInfo,
      academicYear: activity.academicYear,
    };
  },
});

// Get activity class IDs (for edit form)
export const getActivityClassIds = query({
  args: { id: v.id("extracurricularActivities") },
  handler: async (ctx, args): Promise<Id<"classes">[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const activity = await ctx.db.get(args.id);
    if (!activity) {
      return [];
    }

    return activity.classIds || [];
  },
});

// Create extracurricular activity
export const createActivity = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    category: v.optional(v.string()),
    paymentType: v.optional(v.union(v.literal("free"), v.literal("paid"))),
    pricePerWeek: v.optional(v.number()),
    pricePeriod: v.optional(v.union(v.literal("weekly"), v.literal("monthly"))),
    classIds: v.optional(v.array(v.id("classes"))),
    studentIds: v.optional(v.array(v.id("students"))),
    parentIds: v.optional(v.array(v.id("users"))),
    teacherId: v.optional(v.id("teachers")),
    scheduleDays: v.optional(v.array(v.number())),
    scheduleStartTime: v.optional(v.string()),
    scheduleEndTime: v.optional(v.string()),
    academicYear: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"extracurricularActivities">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user || !user.schoolId) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    // Check authorization
    if (!isAuthorizedRole(user.role, user.roles)) {
      throw new ConvexError({ message: "Not authorized", code: "FORBIDDEN" });
    }

    // Get teacher ID - use provided or current user's teacher record
    let teacherId = args.teacherId;
    if (!teacherId) {
      const teacher = await ctx.db
        .query("teachers")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();
      if (teacher) {
        teacherId = teacher._id;
      } else {
        throw new ConvexError({ message: "Teacher record not found", code: "NOT_FOUND" });
      }
    }

    const activityId = await ctx.db.insert("extracurricularActivities", {
      name: args.name,
      description: args.description,
      teacherId,
      schoolId: user.schoolId,
      studentIds: args.studentIds || [],
      parentIds: args.parentIds || [],
      academicYear: args.academicYear,
      startDate: args.startDate,
      endDate: args.endDate,
      category: args.category,
      paymentType: args.paymentType,
      pricePerWeek: args.pricePerWeek,
      pricePeriod: args.pricePeriod,
      classIds: args.classIds,
      scheduleDays: args.scheduleDays,
      scheduleStartTime: args.scheduleStartTime,
      scheduleEndTime: args.scheduleEndTime,
      createdBy: user._id,
      createdAt: Date.now(),
    });

    return activityId;
  },
});

// Update extracurricular activity
export const updateActivity = mutation({
  args: {
    id: v.id("extracurricularActivities"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    category: v.optional(v.string()),
    paymentType: v.optional(v.union(v.literal("free"), v.literal("paid"))),
    pricePerWeek: v.optional(v.number()),
    pricePeriod: v.optional(v.union(v.literal("weekly"), v.literal("monthly"))),
    classIds: v.optional(v.array(v.id("classes"))),
    studentIds: v.optional(v.array(v.id("students"))),
    parentIds: v.optional(v.array(v.id("users"))),
    teacherId: v.optional(v.id("teachers")),
    scheduleDays: v.optional(v.array(v.number())),
    scheduleStartTime: v.optional(v.string()),
    scheduleEndTime: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    // Check authorization
    if (!isAuthorizedRole(user.role, user.roles)) {
      throw new ConvexError({ message: "Not authorized", code: "FORBIDDEN" });
    }

    const updates: Record<string, unknown> = {
      lastEditedBy: user._id,
      lastEditedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.startDate !== undefined) updates.startDate = args.startDate;
    if (args.endDate !== undefined) updates.endDate = args.endDate;
    if (args.category !== undefined) updates.category = args.category;
    if (args.paymentType !== undefined) updates.paymentType = args.paymentType;
    if (args.pricePerWeek !== undefined) updates.pricePerWeek = args.pricePerWeek;
    if (args.pricePeriod !== undefined) updates.pricePeriod = args.pricePeriod;
    if (args.classIds !== undefined) updates.classIds = args.classIds;
    if (args.studentIds !== undefined) updates.studentIds = args.studentIds;
    if (args.parentIds !== undefined) updates.parentIds = args.parentIds;
    if (args.teacherId !== undefined) updates.teacherId = args.teacherId;
    if (args.scheduleDays !== undefined) updates.scheduleDays = args.scheduleDays;
    if (args.scheduleStartTime !== undefined) updates.scheduleStartTime = args.scheduleStartTime;
    if (args.scheduleEndTime !== undefined) updates.scheduleEndTime = args.scheduleEndTime;

    await ctx.db.patch(args.id, updates);
  },
});

// Soft delete activity
export const deleteActivity = mutation({
  args: { id: v.id("extracurricularActivities") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    // Check authorization
    if (!isAuthorizedRole(user.role, user.roles)) {
      throw new ConvexError({ message: "Not authorized", code: "FORBIDDEN" });
    }

    await ctx.db.patch(args.id, {
      isDeleted: true,
      deletedAt: Date.now(),
    });
  },
});

// Permanently delete activity (only for deleted activities)
export const permanentlyDeleteActivity = mutation({
  args: { id: v.id("extracurricularActivities") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    }

    // Check authorization
    if (!isAuthorizedRole(user.role, user.roles)) {
      throw new ConvexError({ message: "Not authorized", code: "FORBIDDEN" });
    }

    const activity = await ctx.db.get(args.id);
    if (!activity) {
      throw new ConvexError({ message: "Activity not found", code: "NOT_FOUND" });
    }

    if (!activity.isDeleted) {
      throw new ConvexError({ message: "Activity must be soft deleted first", code: "BAD_REQUEST" });
    }

    await ctx.db.delete(args.id);
  },
});

// Get students for class selection (for adding to activity)
export const getStudentsForActivity = query({
  args: { classIds: v.array(v.id("classes")) },
  handler: async (ctx, args): Promise<Array<{
    classId: Id<"classes">;
    className: string;
    students: Array<{
      _id: Id<"students">;
      name: string;
      studentNumber?: number;
    }>;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }

    const result = await Promise.all(
      args.classIds.map(async (classId) => {
        const classDoc = await ctx.db.get(classId);
        if (!classDoc) return null;

        const students = await ctx.db
          .query("students")
          .withIndex("by_class", (q) => q.eq("classId", classId))
          .collect();

        const studentsWithNames = await Promise.all(
          students.map(async (student) => {
            const user = await ctx.db.get(student.userId);
            const name = user
              ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.name || ""
              : "";
            return {
              _id: student._id,
              name,
              studentNumber: student.studentNumber,
            };
          })
        );

        // Filter out students without valid names
        const validStudents = studentsWithNames.filter(
          s => s.name && s.name !== "Неизвестен" && s.name !== "Unknown" && s.name.trim() !== ""
        );

        // Sort by student number then by name
        validStudents.sort((a, b) => {
          if (a.studentNumber && b.studentNumber) {
            return a.studentNumber - b.studentNumber;
          }
          return a.name.localeCompare(b.name, "bg");
        });

        return {
          classId,
          className: classDoc.name,
          students: validStudents,
        };
      })
    );

    return result.filter(Boolean) as Array<{
      classId: Id<"classes">;
      className: string;
      students: Array<{
        _id: Id<"students">;
        name: string;
        studentNumber?: number;
      }>;
    }>;
  },
});

// List activities for a student, teacher, or parent (my activities)
export const listMyActivities = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      // Return empty array for unauthenticated users instead of throwing
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      // Return empty array if user not found
      return [];
    }

    // Check if user is a student
    const student = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    // Check if user is a teacher
    const teacher = await ctx.db
      .query("teachers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    // Check if user is a parent
    const isParent = user.role === "parent" || user.roles?.includes("parent");

    // Get schoolId from user, student, or teacher record
    const schoolId = user.schoolId || student?.schoolId || teacher?.schoolId;
    
    if (!schoolId) {
      // Return empty array if no school found
      return [];
    }

    // Get all activities for the school
    const activities = await ctx.db
      .query("extracurricularActivities")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();

    // Filter activities where user is enrolled (as student), is the teacher, or is a parent
    const myActivities = activities.filter(activity => {
      if (activity.isDeleted) return false;
      
      // Check if user is enrolled as student
      if (student && activity.studentIds.includes(student._id)) {
        return true;
      }
      
      // Check if user is the teacher
      if (teacher && activity.teacherId === teacher._id) {
        return true;
      }
      
      // Check if user is a parent linked to this activity
      if (isParent && activity.parentIds?.includes(user._id)) {
        return true;
      }
      
      return false;
    });

    // Enrich with additional data
    return Promise.all(
      myActivities.map(async (activity) => {
        // Get teacher info
        const activityTeacher = await ctx.db.get(activity.teacherId);
        const teacherUser = activityTeacher ? await ctx.db.get(activityTeacher.userId) : null;
        const teacherName = teacherUser
          ? `${teacherUser.firstName || ""} ${teacherUser.lastName || ""}`.trim() || teacherUser.name || "Неизвестен"
          : "Неизвестен";

        // Get class names
        let classNames: string[] = [];
        if (activity.classIds && activity.classIds.length > 0) {
          const classes = await Promise.all(
            activity.classIds.map(id => ctx.db.get(id))
          );
          classNames = classes.filter(Boolean).map(c => c!.name);
        }

        // Calculate participant counts
        const studentCount = activity.studentIds.length;
        const parentCount = activity.parentIds?.length || 0;
        const totalParticipants = studentCount + parentCount;

        return {
          _id: activity._id,
          name: activity.name,
          description: activity.description,
          startDate: activity.startDate,
          endDate: activity.endDate,
          category: activity.category,
          capacity: activity.capacity,
          enrolledCount: activity.studentIds.length,
          studentCount,
          parentCount,
          totalParticipants,
          classNames,
          teacherName,
          isTeacher: teacher ? activity.teacherId === teacher._id : false,
        };
      })
    );
  },
});

// Get all teachers for dropdown
export const getAllTeachers = query({
  args: {},
  handler: async (ctx): Promise<Array<{
    _id: Id<"teachers">;
    name: string;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user || !user.schoolId) {
      return [];
    }

    const teachers = await ctx.db
      .query("teachers")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .collect();

    const teachersWithNames = await Promise.all(
      teachers.filter(t => !t.hasLeft).map(async (teacher) => {
        const teacherUser = await ctx.db.get(teacher.userId);
        const name = teacherUser
          ? `${teacherUser.firstName || ""} ${teacherUser.lastName || ""}`.trim() || teacherUser.name || ""
          : "";
        return {
          _id: teacher._id,
          name,
        };
      })
    );
    
    // Filter out teachers without valid names
    return teachersWithNames.filter(t => t.name && t.name !== "Неизвестен" && t.name !== "Unknown" && t.name.trim() !== "");
  },
});

// Get only teachers who are leading activities (for filter dropdown)
export const getTeachersWithActivities = query({
  args: {},
  handler: async (ctx): Promise<Array<{
    _id: Id<"teachers">;
    name: string;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ message: "User not logged in", code: "UNAUTHENTICATED" });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user || !user.schoolId) {
      return [];
    }

    // Get all activities for this school
    const activities = await ctx.db
      .query("extracurricularActivities")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .collect();

    // Get unique teacher IDs from non-deleted activities
    const teacherIds = [...new Set(
      activities
        .filter(a => !a.isDeleted)
        .map(a => a.teacherId)
    )];

    // Get teacher info for each unique ID
    const teachersWithNames = await Promise.all(
      teacherIds.map(async (teacherId) => {
        const teacher = await ctx.db.get(teacherId);
        if (!teacher) return null;
        
        const teacherUser = await ctx.db.get(teacher.userId);
        const name = teacherUser
          ? `${teacherUser.firstName || ""} ${teacherUser.lastName || ""}`.trim() || teacherUser.name || ""
          : "";
        
        // Skip if no valid name
        if (!name || name === "Неизвестен" || name === "Unknown" || name.trim() === "") {
          return null;
        }
        
        return {
          _id: teacherId,
          name,
        };
      })
    );
    
    // Filter out nulls and sort by name
    return teachersWithNames
      .filter((t): t is { _id: Id<"teachers">; name: string } => t !== null)
      .sort((a, b) => a.name.localeCompare(b.name, "bg"));
  },
});

// Get parents for selected students (for activity creation/edit)
export const getParentsForStudents = query({
  args: { studentIds: v.array(v.id("students")) },
  handler: async (ctx, args): Promise<Array<{
    studentId: Id<"students">;
    studentName: string;
    parents: Array<{
      _id: Id<"users">;
      name: string;
    }>;
  }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const result: Array<{
      studentId: Id<"students">;
      studentName: string;
      parents: Array<{
        _id: Id<"users">;
        name: string;
      }>;
    }> = [];

    // Get all parents from the school to find those linked to our students
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user || !user.schoolId) {
      return [];
    }

    // Get all parent records for this school
    const allParents = await ctx.db
      .query("parents")
      .withIndex("by_school", (q) => q.eq("schoolId", user.schoolId!))
      .collect();

    for (const studentId of args.studentIds) {
      const student = await ctx.db.get(studentId);
      if (!student) continue;

      const studentUser = await ctx.db.get(student.userId);
      const studentName = studentUser
        ? `${studentUser.firstName || ""} ${studentUser.lastName || ""}`.trim() || studentUser.name || "Неизвестен"
        : "Неизвестен";

      // Skip students with invalid names
      if (studentName === "Неизвестен" || studentName === "Unknown" || !studentName.trim()) {
        continue;
      }

      // Find parents that have this student in their studentIds array
      const studentParents: Array<{ _id: Id<"users">; name: string }> = [];

      for (const parentRecord of allParents) {
        if (parentRecord.studentIds?.includes(studentId)) {
          const parentUser = await ctx.db.get(parentRecord.userId);
          if (!parentUser) continue;

          const parentName = `${parentUser.firstName || ""} ${parentUser.lastName || ""}`.trim() || parentUser.name || "";
          
          // Skip parents with invalid names
          if (!parentName || parentName === "Неизвестен" || parentName === "Unknown") {
            continue;
          }

          studentParents.push({
            _id: parentUser._id,
            name: parentName,
          });
        }
      }

      if (studentParents.length > 0) {
        result.push({
          studentId,
          studentName,
          parents: studentParents,
        });
      }
    }

    return result;
  },
});

// Get activity parent IDs (for edit form)
export const getActivityParentIds = query({
  args: { id: v.id("extracurricularActivities") },
  handler: async (ctx, args): Promise<Id<"users">[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const activity = await ctx.db.get(args.id);
    if (!activity) {
      return [];
    }

    return activity.parentIds || [];
  },
});
