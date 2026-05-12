import { v } from "convex/values";
import { query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { api } from "./_generated/api.js";

// Get all attendance records for a student
export const getStudentAttendance = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const attendanceRecords = await ctx.db
      .query("attendance")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .order("desc")
      .collect();

    const processedRecords = await Promise.all(
      attendanceRecords.map(async (record) => {
        const subject = await ctx.db.get(record.subjectId);
        const teacher = await ctx.db.get(record.teacherId);
        const teacherUser = teacher ? await ctx.db.get(teacher.userId) : null;

        return {
          _id: record._id,
          date: record.date,
          period: record.period,
          status: record.status,
          subjectName: subject?.name || "Unknown",
          teacherName: teacherUser
            ? [teacherUser.firstName, teacherUser.lastName]
                .filter(Boolean)
                .join(" ")
            : "Unknown",
          notes: record.notes,
        };
      })
    );

    // Group by status
    const absent = processedRecords.filter((r) => r.status === "absent");
    const late = processedRecords.filter((r) => r.status === "late");
    const excused = processedRecords.filter((r) => r.status === "excused");

    return {
      all: processedRecords,
      absent,
      late,
      excused,
      stats: {
        totalAbsent: absent.length,
        totalLate: late.length,
        totalExcused: excused.length,
      },
    };
  },
});

// Get attendance by userId
export const getStudentAttendanceByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<{
    all: Array<{
      _id: string;
      date: number;
      period: number;
      status: "present" | "absent" | "late" | "excused";
      subjectName: string;
      teacherName: string;
      notes?: string;
    }>;
    absent: Array<{
      _id: string;
      date: number;
      period: number;
      status: "present" | "absent" | "late" | "excused";
      subjectName: string;
      teacherName: string;
      notes?: string;
    }>;
    late: Array<{
      _id: string;
      date: number;
      period: number;
      status: "present" | "absent" | "late" | "excused";
      subjectName: string;
      teacherName: string;
      notes?: string;
    }>;
    excused: Array<{
      _id: string;
      date: number;
      period: number;
      status: "present" | "absent" | "late" | "excused";
      subjectName: string;
      teacherName: string;
      notes?: string;
    }>;
    stats: {
      totalAbsent: number;
      totalLate: number;
      totalExcused: number;
    };
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Find student record
    const student = await ctx.db
      .query("students")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!student) {
      return {
        all: [],
        absent: [],
        late: [],
        excused: [],
        stats: { totalAbsent: 0, totalLate: 0, totalExcused: 0 },
      };
    }

    const result = await ctx.runQuery(api.attendanceQueries.getStudentAttendance, {
      studentId: student._id,
    });
    
    return result;
  },
});

// Get raw attendance records for a student (simpler version)
export const getAttendanceByStudent = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    const attendanceRecords = await ctx.db
      .query("attendance")
      .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
      .collect();

    return attendanceRecords;
  },
});
