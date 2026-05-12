import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";
import { buildUserName } from "./users.js";

// Type for unified invitation items
type InvitationItem = {
  _id: string;
  type: "event" | "assignment" | "parentMeeting";
  title: string;
  startDate: number;
  endDate?: number;
  category: string;
  classNames: string[];
  organizerName: string;
  description?: string;
  subjectShortName?: string;
};

// Get all invitations (events, assignments, parent meetings) for a user
export const listAllInvitations = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<InvitationItem[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Get user to check role
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return [];
    }

    const isParent = user.role === "parent" || user.roles?.includes("parent");

    // Collect all relevant classIds for this user
    const relevantClassIds: Id<"classes">[] = [];

    // Check if user is a student and get their class
    const studentRecord = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (studentRecord?.classId) {
      relevantClassIds.push(studentRecord.classId);
    }

    // Check if user is a parent and get their children's classes
    if (isParent) {
      const parentRecord = await ctx.db
        .query("parents")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .first();

      if (parentRecord?.studentIds) {
        for (const studentId of parentRecord.studentIds) {
          const student = await ctx.db.get(studentId);
          if (student?.classId) {
            relevantClassIds.push(student.classId);
          }
        }
      }
    }

    const invitations: InvitationItem[] = [];

    // 1. Get events
    const allEvents = await ctx.db.query("events").collect();
    const relevantEvents = allEvents.filter((e) => {
      // Check if user is directly invited
      if (e.invitedUserIds.includes(args.userId)) {
        return true;
      }
      // Check if any of the user's relevant classes are in the event's classIds
      if (e.classIds && relevantClassIds.length > 0) {
        for (const classId of relevantClassIds) {
          if (e.classIds.includes(classId)) {
            return true;
          }
        }
      }
      return false;
    });

    for (const event of relevantEvents) {
      const organizer = await ctx.db.get(event.organizerId);
      const classNames: string[] = [];
      if (event.classIds) {
        for (const classId of event.classIds) {
          const classDoc = await ctx.db.get(classId);
          if (classDoc) {
            classNames.push(classDoc.name);
          }
        }
      }
      invitations.push({
        _id: event._id,
        type: "event",
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        category: event.category,
        classNames,
        organizerName: buildUserName(organizer),
        description: event.description,
      });
    }

    // 2. Get assignments (контролни работи) for relevant classes - only for non-parents
    if (relevantClassIds.length > 0 && !isParent) {
      const allAssignments = await ctx.db.query("assignments").collect();
      const relevantAssignments = allAssignments.filter((a) =>
        a.classId && relevantClassIds.includes(a.classId)
      );

      for (const assignment of relevantAssignments) {
        const classDoc = assignment.classId ? await ctx.db.get(assignment.classId) : null;
        const teacher = await ctx.db.get(assignment.teacherId);
        let teacherUser = null;
        if (teacher) {
          teacherUser = await ctx.db.get(teacher.userId);
        }
        const subject = assignment.subjectId ? await ctx.db.get(assignment.subjectId) : null;

        invitations.push({
          _id: assignment._id,
          type: "assignment",
          title: assignment.title,
          startDate: assignment.dueDate || assignment.assignedDate,
          category: assignment.type,
          classNames: classDoc ? [classDoc.name] : [],
          organizerName: buildUserName(teacherUser),
          description: assignment.description,
          subjectShortName: subject?.shortName || subject?.name,
        });
      }
    }

    // 3. Get parent meetings for relevant classes (only for parents)
    if (relevantClassIds.length > 0 && isParent) {
      const allMeetings = await ctx.db.query("parentMeetings").collect();
      const relevantMeetings = allMeetings.filter((m) =>
        relevantClassIds.includes(m.classId)
      );

      for (const meeting of relevantMeetings) {
        const classDoc = await ctx.db.get(meeting.classId);
        const creator = await ctx.db.get(meeting.createdById);

        invitations.push({
          _id: meeting._id,
          type: "parentMeeting",
          title: meeting.title,
          startDate: meeting.startDate,
          endDate: meeting.endDate,
          category: "Родителска среща",
          classNames: classDoc ? [classDoc.name] : [],
          organizerName: buildUserName(creator),
          description: meeting.description,
        });
      }
    }

    // Sort by startDate descending
    invitations.sort((a, b) => b.startDate - a.startDate);

    return invitations;
  },
});

// EVENTS
export const listEvents = query({
  args: {
    schoolId: v.optional(v.id("schools")),
    organizerId: v.optional(v.id("users")),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    let events;
    if (args.schoolId) {
      events = await ctx.db
        .query("events")
        .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
        .collect();
    } else if (args.organizerId) {
      events = await ctx.db
        .query("events")
        .withIndex("by_organizer", (q) => q.eq("organizerId", args.organizerId!))
        .collect();
    } else {
      events = await ctx.db.query("events").collect();
    }

    // Filter by invited user or by class (for students/parents)
    let filteredEvents = events;
    if (args.userId) {
      // Get user to check role
      const user = await ctx.db.get(args.userId);
      
      // Collect all relevant classIds for this user
      const relevantClassIds: Id<"classes">[] = [];
      
      // Check if user is a student and get their class
      const studentRecord = await ctx.db
        .query("students")
        .withIndex("by_user", (q) => q.eq("userId", args.userId!))
        .first();
      
      if (studentRecord?.classId) {
        relevantClassIds.push(studentRecord.classId);
      }
      
      // Check if user is a parent and get their children's classes
      if (user?.role === "parent" || user?.roles?.includes("parent")) {
        const parentRecord = await ctx.db
          .query("parents")
          .withIndex("by_user", (q) => q.eq("userId", args.userId!))
          .first();
        
        if (parentRecord?.studentIds) {
          for (const studentId of parentRecord.studentIds) {
            const student = await ctx.db.get(studentId);
            if (student?.classId) {
              relevantClassIds.push(student.classId);
            }
          }
        }
      }

      // Filter events where user is directly invited OR their class/children's classes are targeted
      filteredEvents = events.filter((e) => {
        // Check if user is directly invited
        if (e.invitedUserIds.includes(args.userId!)) {
          return true;
        }
        // Check if any of the user's relevant classes are in the event's classIds
        if (e.classIds && relevantClassIds.length > 0) {
          for (const classId of relevantClassIds) {
            if (e.classIds.includes(classId)) {
              return true;
            }
          }
        }
        return false;
      });
    }

    // Sort by start date
    filteredEvents.sort((a, b) => b.startDate - a.startDate);

    // Enrich with organizer name and class names
    const enrichedEvents = await Promise.all(
      filteredEvents.map(async (event) => {
        const organizer = await ctx.db.get(event.organizerId);
        
        // Get class names if event has classIds
        const classNames: string[] = [];
        if (event.classIds) {
          for (const classId of event.classIds) {
            const classDoc = await ctx.db.get(classId);
            if (classDoc) {
              classNames.push(classDoc.name);
            }
          }
        }
        
        return {
          ...event,
          organizerName: buildUserName(organizer),
          classNames,
        };
      })
    );

    return enrichedEvents;
  },
});

// Helper to check if year is in the past
function isPastYear(academicYear?: string): boolean {
  if (!academicYear) return false;
  const currentYear = new Date().getFullYear();
  const [startYear] = academicYear.split("/").map(Number);
  return startYear < currentYear;
}

// GET /events - List events with confirmations stats (for admin views)
export const listEventsWithStats = query({
  args: {
    schoolId: v.optional(v.id("schools")),
    classId: v.optional(v.id("classes")),
    category: v.optional(v.string()),
    includeAssignments: v.optional(v.boolean()),
    includeParentMeetings: v.optional(v.boolean()),
    includePastEvents: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    Array<{
      _id: Id<"events"> | Id<"assignments"> | Id<"parentMeetings">;
      title: string;
      startDate: number;
      endDate?: number;
      category: string;
      organizerName: string;
      classNames: string[];
      seenCount: number;
      confirmedCount: number;
      isPastYear: boolean;
      type: "event" | "assignment" | "parentMeeting";
      subjectName?: string;
    }>
  > => {
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
    
    const isAdminRole = currentUser && (
      currentUser.role === "director" ||
      currentUser.role === "vice_director" ||
      currentUser.role === "system_admin" ||
      currentUser.roles?.includes("director") ||
      currentUser.roles?.includes("vice_director") ||
      currentUser.roles?.includes("system_admin")
    );

    const results: Array<{
      _id: Id<"events"> | Id<"assignments"> | Id<"parentMeetings">;
      title: string;
      startDate: number;
      endDate?: number;
      category: string;
      organizerName: string;
      classNames: string[];
      seenCount: number;
      confirmedCount: number;
      isPastYear: boolean;
      type: "event" | "assignment" | "parentMeeting";
      subjectName?: string;
    }> = [];

    // Current time for filtering past events
    const now = Date.now();
    // Show events from the last 30 days and all future events
    const pastCutoff = now - (30 * 24 * 60 * 60 * 1000);

    // Fetch events
    let events;
    if (args.schoolId) {
      events = await ctx.db
        .query("events")
        .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
        .collect();
    } else {
      events = await ctx.db.query("events").collect();
    }

    // Filter by classId
    if (args.classId) {
      events = events.filter(
        (e) => e.classIds && e.classIds.includes(args.classId!)
      );
    }

    // Filter by category
    if (args.category) {
      events = events.filter((e) => e.category === args.category);
    }

    // Filter past events (only show events from last 30 days or future)
    if (!args.includePastEvents) {
      events = events.filter((e) => e.startDate >= pastCutoff);
    }

    // Enrich events with stats
    for (const event of events) {
      // Get organizer name
      const organizer = await ctx.db.get(event.organizerId);

      // Get class names
      const classNames: string[] = [];
      if (event.classIds) {
        for (const classId of event.classIds) {
          const classDoc = await ctx.db.get(classId);
          if (classDoc) {
            classNames.push(classDoc.name);
          }
        }
      }

      // Get confirmations
      const confirmations = await ctx.db
        .query("eventConfirmations")
        .withIndex("by_event", (q) => q.eq("eventId", event._id))
        .collect();

      const seenCount = confirmations.filter(
        (c) => c.status === "seen" || c.status === "confirmed"
      ).length;
      const confirmedCount = confirmations.filter(
        (c) => c.status === "confirmed"
      ).length;

      results.push({
        _id: event._id,
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        category: event.category,
        organizerName: buildUserName(organizer),
        classNames,
        seenCount,
        confirmedCount,
        isPastYear: isPastYear(event.academicYear),
        type: "event",
      });
    }

    // Include assignments for admin roles if requested
    if (args.includeAssignments !== false && isAdminRole) {
      let assignments = await ctx.db.query("assignments").collect();
      
      // Filter by classId if provided
      if (args.classId) {
        assignments = assignments.filter((a) => a.classId === args.classId);
      }
      
      // Filter past assignments (only show from last 30 days or future)
      if (!args.includePastEvents) {
        assignments = assignments.filter((a) => {
          const assignmentDate = a.dueDate || a.assignedDate;
          return assignmentDate >= pastCutoff;
        });
      }
      
      for (const assignment of assignments) {
        const teacher = await ctx.db.get(assignment.teacherId);
        let teacherUser = null;
        if (teacher) {
          teacherUser = await ctx.db.get(teacher.userId);
        }
        
        const classDoc = assignment.classId ? await ctx.db.get(assignment.classId) : null;
        const subject = assignment.subjectId ? await ctx.db.get(assignment.subjectId) : null;
        
        results.push({
          _id: assignment._id as Id<"assignments">,
          title: assignment.title,
          startDate: assignment.dueDate || assignment.assignedDate,
          category: assignment.type,
          organizerName: buildUserName(teacherUser),
          classNames: classDoc ? [classDoc.name] : [],
          seenCount: 0,
          confirmedCount: 0,
          isPastYear: false,
          type: "assignment",
          subjectName: subject?.name,
        });
      }
    }

    // Include parent meetings for admin roles if requested (default: true)
    if (args.includeParentMeetings !== false && isAdminRole) {
      let parentMeetings = await ctx.db.query("parentMeetings").collect();
      
      // Filter by classId if provided
      if (args.classId) {
        parentMeetings = parentMeetings.filter((m) => m.classId === args.classId);
      }
      
      // Filter past meetings (only show from last 30 days or future)
      if (!args.includePastEvents) {
        parentMeetings = parentMeetings.filter((m) => m.startDate >= pastCutoff);
      }
      
      for (const meeting of parentMeetings) {
        const creator = await ctx.db.get(meeting.createdById);
        const classDoc = await ctx.db.get(meeting.classId);
        
        results.push({
          _id: meeting._id as Id<"parentMeetings">,
          title: meeting.title,
          startDate: meeting.startDate,
          endDate: meeting.endDate,
          category: "Родителска среща",
          organizerName: buildUserName(creator),
          classNames: classDoc ? [classDoc.name] : [],
          seenCount: 0,
          confirmedCount: 0,
          isPastYear: false,
          type: "parentMeeting",
        });
      }
    }

    // Sort by start date (newest first)
    results.sort((a, b) => b.startDate - a.startDate);

    return results;
  },
});

export const createEvent = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.number(),
    location: v.optional(v.string()),
    organizerId: v.id("users"),
    schoolId: v.id("schools"),
    invitedUserIds: v.array(v.id("users")),
    classIds: v.optional(v.array(v.id("classes"))),
    category: v.string(),
    isPaid: v.optional(v.boolean()),
    isSchoolCalendar: v.optional(v.boolean()),
    registrationDeadline: v.optional(v.number()),
    minRegistrants: v.optional(v.number()),
    maxRegistrants: v.optional(v.number()),
    fileIds: v.optional(v.array(v.id("_storage"))),
    locationAddress: v.optional(v.string()),
    locationCity: v.optional(v.string()),
    locationDescription: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"events">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Verify user is admin/director/vice_director
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }

    const isAdminRole =
      currentUser.role === "director" ||
      currentUser.role === "vice_director" ||
      currentUser.role === "system_admin" ||
      currentUser.roles?.includes("director") ||
      currentUser.roles?.includes("vice_director") ||
      currentUser.roles?.includes("system_admin");

    if (!isAdminRole) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Нямате права за създаване на събития",
      });
    }

    const eventId = await ctx.db.insert("events", {
      title: args.title,
      description: args.description,
      startDate: args.startDate,
      endDate: args.endDate,
      location: args.location,
      organizerId: args.organizerId,
      schoolId: args.schoolId,
      invitedUserIds: args.invitedUserIds,
      classIds: args.classIds,
      category: args.category,
      isPaid: args.isPaid,
      isSchoolCalendar: args.isSchoolCalendar,
      registrationDeadline: args.registrationDeadline,
      minRegistrants: args.minRegistrants,
      maxRegistrants: args.maxRegistrants,
      fileIds: args.fileIds,
      locationAddress: args.locationAddress,
      locationCity: args.locationCity,
      locationDescription: args.locationDescription,
    });

    // Send notifications to all invited users
    const organizerName = buildUserName(currentUser);
    for (const userId of args.invitedUserIds) {
      await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
        userId,
        type: "new_event",
        title: "Нова покана за събитие",
        message: `Поканени сте на „${args.title}" от ${organizerName}`,
        relatedEntityType: "event",
        relatedEntityId: eventId,
        actionUrl: `/events/my-invitations`,
      });
    }

    return eventId;
  },
});

export const updateEvent = mutation({
  args: {
    id: v.id("events"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    location: v.optional(v.string()),
    invitedUserIds: v.optional(v.array(v.id("users"))),
    classIds: v.optional(v.array(v.id("classes"))),
    category: v.optional(v.string()),
    isPaid: v.optional(v.boolean()),
    isSchoolCalendar: v.optional(v.boolean()),
    registrationDeadline: v.optional(v.number()),
    minRegistrants: v.optional(v.number()),
    maxRegistrants: v.optional(v.number()),
    fileIds: v.optional(v.array(v.id("_storage"))),
    locationAddress: v.optional(v.string()),
    locationCity: v.optional(v.string()),
    locationDescription: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Verify user is admin/director/vice_director
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }

    const isAdminRole =
      currentUser.role === "director" ||
      currentUser.role === "vice_director" ||
      currentUser.role === "system_admin" ||
      currentUser.roles?.includes("director") ||
      currentUser.roles?.includes("vice_director") ||
      currentUser.roles?.includes("system_admin");

    if (!isAdminRole) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Нямате права за редактиране на събития",
      });
    }

    const { id, ...updates } = args;

    // Get old event to detect newly invited users
    const oldEvent = await ctx.db.get(id);

    await ctx.db.patch(id, updates);

    // If invitedUserIds changed, notify newly added users
    if (updates.invitedUserIds && oldEvent) {
      const oldIds = new Set(oldEvent.invitedUserIds);
      const newlyInvited = updates.invitedUserIds.filter((uid) => !oldIds.has(uid));
      const organizerName = buildUserName(currentUser);
      const eventTitle = updates.title || oldEvent.title;
      for (const userId of newlyInvited) {
        await ctx.scheduler.runAfter(0, internal.notifications.createNotification, {
          userId,
          type: "new_event",
          title: "Нова покана за събитие",
          message: `Поканени сте на „${eventTitle}" от ${organizerName}`,
          relatedEntityType: "event",
          relatedEntityId: id,
          actionUrl: `/events/my-invitations`,
        });
      }
    }
  },
});

export const deleteEvent = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Verify user is admin/director/vice_director
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!currentUser) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }

    const isAdminRole =
      currentUser.role === "director" ||
      currentUser.role === "vice_director" ||
      currentUser.role === "system_admin" ||
      currentUser.roles?.includes("director") ||
      currentUser.roles?.includes("vice_director") ||
      currentUser.roles?.includes("system_admin");

    if (!isAdminRole) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Нямате права за изтриване на събития",
      });
    }

    // Delete related confirmations
    const confirmations = await ctx.db
      .query("eventConfirmations")
      .withIndex("by_event", (q) => q.eq("eventId", args.id))
      .collect();
    for (const c of confirmations) {
      await ctx.db.delete(c._id);
    }

    await ctx.db.delete(args.id);
  },
});

// Get a single event by ID (for edit page)
export const getEvent = query({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    }
    const event = await ctx.db.get(args.id);
    if (!event) return null;

    // Enrich with file URLs
    const fileUrls: string[] = [];
    if (event.fileIds) {
      for (const fileId of event.fileIds) {
        const url = await ctx.storage.getUrl(fileId);
        if (url) fileUrls.push(url);
      }
    }

    return { ...event, fileUrls };
  },
});

// Generate upload URL for event files
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    }
    return await ctx.storage.generateUploadUrl();
  },
});

// List users for invitation tab with filtering
export const listUsersForInvite = query({
  args: {
    classId: v.optional(v.id("classes")),
    roleFilter: v.optional(v.array(v.string())),
    searchQuery: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    Array<{
      _id: Id<"users">;
      name: string;
      role: string;
      className: string;
    }>
  > => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    }

    const allUsers = await ctx.db.query("users").collect();
    const activeUsers = allUsers.filter((u) => !u.isDeleted && u.isActive);

    // Build a map of userId -> className(s)
    const students = await ctx.db.query("students").collect();
    const classes = await ctx.db.query("classes").collect();
    const classMap = new Map(classes.map((c) => [c._id, c.name]));
    const userClassMap = new Map<string, string[]>();
    for (const s of students) {
      const cName = classMap.get(s.classId) || "";
      const existing = userClassMap.get(s.userId) || [];
      existing.push(cName);
      userClassMap.set(s.userId, existing);
    }

    // Parents: map through children
    const parents = await ctx.db.query("parents").collect();
    for (const p of parents) {
      const childClasses: string[] = [];
      if (p.studentIds) {
        for (const sid of p.studentIds) {
          const student = students.find((s) => s._id === sid);
          if (student) {
            const cName = classMap.get(student.classId);
            if (cName) childClasses.push(cName);
          }
        }
      }
      if (childClasses.length > 0) {
        userClassMap.set(p.userId, childClasses);
      }
    }

    // Role display names
    const roleLabels: Record<string, string> = {
      student: "Ученик",
      parent: "Родител",
      teacher: "Учител",
      class_teacher: "Класен ръководител",
      director: "Директор",
      vice_director: "Зам. директор",
      system_admin: "Администратор",
      secretary: "Секретар",
      pedagogical_counselor: "Педагогически съветник",
      housekeeper: "Домакин",
    };

    let filtered = activeUsers;

    // Filter by role
    if (args.roleFilter && args.roleFilter.length > 0) {
      filtered = filtered.filter((u) => {
        if (args.roleFilter!.includes(u.role)) return true;
        if (u.roles?.some((r) => args.roleFilter!.includes(r))) return true;
        return false;
      });
    }

    // Filter by class
    if (args.classId) {
      const studentsInClass = new Set(
        students.filter((s) => s.classId === args.classId).map((s) => s.userId)
      );
      // Also include parents of students in this class
      const parentUserIds = new Set<string>();
      for (const p of parents) {
        if (p.studentIds?.some((sid) => {
          const st = students.find((s) => s._id === sid);
          return st?.classId === args.classId;
        })) {
          parentUserIds.add(p.userId);
        }
      }
      filtered = filtered.filter(
        (u) => studentsInClass.has(u._id) || parentUserIds.has(u._id)
      );
    }

    // Search by name
    if (args.searchQuery) {
      const q = args.searchQuery.toLowerCase();
      filtered = filtered.filter((u) => {
        const fullName = buildUserName(u).toLowerCase();
        return fullName.includes(q);
      });
    }

    // Sort alphabetically
    filtered.sort((a, b) => buildUserName(a).localeCompare(buildUserName(b), "bg"));

    return filtered.map((u) => ({
      _id: u._id,
      name: buildUserName(u),
      role: u.role === "parent"
        ? `Родител на ${[u.parent1Name, u.parent2Name].filter(Boolean).join(", ") || "—"}`
        : roleLabels[u.role] || u.role,
      className: (userClassMap.get(u._id) || []).join(", "),
    }));
  },
});

// COMPETITIONS
export const listCompetitions = query({
  args: {
    schoolId: v.optional(v.id("schools")),
    subjectId: v.optional(v.id("subjects")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const competitions = args.schoolId
      ? await ctx.db
          .query("competitions")
          .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
          .collect()
      : await ctx.db.query("competitions").collect();

    // Filter by subject
    const filteredCompetitions = args.subjectId
      ? competitions.filter((c) => c.subjectId === args.subjectId)
      : competitions;

    // Sort by date
    filteredCompetitions.sort((a, b) => b.date - a.date);

    // Enrich with subject name
    const enrichedCompetitions = await Promise.all(
      filteredCompetitions.map(async (competition) => {
        const subject = competition.subjectId
          ? await ctx.db.get(competition.subjectId)
          : null;
        return {
          ...competition,
          subjectName: subject?.name,
          participantCount: competition.participantIds.length,
        };
      })
    );

    return enrichedCompetitions;
  },
});

export const createCompetition = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    date: v.number(),
    location: v.optional(v.string()),
    schoolId: v.id("schools"),
    subjectId: v.optional(v.id("subjects")),
    participantIds: v.array(v.id("students")),
  },
  handler: async (ctx, args): Promise<Id<"competitions">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    return await ctx.db.insert("competitions", args);
  },
});

export const addCompetitionResult = mutation({
  args: {
    competitionId: v.id("competitions"),
    studentId: v.id("students"),
    place: v.number(),
    points: v.optional(v.number()),
    award: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"competitionResults">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    return await ctx.db.insert("competitionResults", args);
  },
});

export const getCompetitionResults = query({
  args: { competitionId: v.id("competitions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const results = await ctx.db
      .query("competitionResults")
      .withIndex("by_competition", (q) => q.eq("competitionId", args.competitionId))
      .collect();

    // Sort by place
    results.sort((a, b) => a.place - b.place);

    // Enrich with student names
    const enrichedResults = await Promise.all(
      results.map(async (result) => {
        const student = await ctx.db.get(result.studentId);
        const studentUser = student ? await ctx.db.get(student.userId) : null;
        return {
          ...result,
          studentName: studentUser?.name,
        };
      })
    );

    return enrichedResults;
  },
});

// EXTRACURRICULAR ACTIVITIES
export const listExtracurricularActivities = query({
  args: {
    schoolId: v.optional(v.id("schools")),
    teacherId: v.optional(v.id("teachers")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    let activities;
    if (args.schoolId) {
      activities = await ctx.db
        .query("extracurricularActivities")
        .withIndex("by_school", (q) => q.eq("schoolId", args.schoolId!))
        .collect();
    } else if (args.teacherId) {
      activities = await ctx.db
        .query("extracurricularActivities")
        .withIndex("by_teacher", (q) => q.eq("teacherId", args.teacherId!))
        .collect();
    } else {
      activities = await ctx.db.query("extracurricularActivities").collect();
    }

    // Enrich with teacher name
    const enrichedActivities = await Promise.all(
      activities.map(async (activity) => {
        const teacher = await ctx.db.get(activity.teacherId);
        const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;
        return {
          ...activity,
          teacherName: teacherUser?.name,
          studentCount: activity.studentIds.length,
        };
      })
    );

    return enrichedActivities;
  },
});

export const createExtracurricularActivity = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    teacherId: v.id("teachers"),
    schoolId: v.id("schools"),
    schedule: v.optional(v.string()),
    studentIds: v.array(v.id("students")),
    academicYear: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"extracurricularActivities">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    return await ctx.db.insert("extracurricularActivities", args);
  },
});
