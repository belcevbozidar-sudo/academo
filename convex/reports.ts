import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id} from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { buildUserName } from "./users";

// Types for dynamic report data
type DynamicReportData = {
  columns: Array<{ key: string; label: string; type: "text" | "number" | "badge" }>;
  rows: Array<Record<string, string | number>>;
  summary?: Record<string, string | number>;
};

// Helper function to generate dynamic report data based on report type
async function generateDynamicReportData(
  ctx: QueryCtx | MutationCtx,
  reportType: string,
  elementType: string,
  scopeSchool: string,
  scopeYear: string,
  scopeGrades: string
): Promise<DynamicReportData> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return { columns: [], rows: [] };
  }

  const currentUser = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  if (!currentUser?.schoolId) {
    return { columns: [], rows: [] };
  }

  const schoolId = currentUser.schoolId;

  // Get all classes
  const allClasses = await ctx.db
    .query("classes")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .collect();

  // Filter classes based on scope
  let filteredClasses = allClasses;
  if (scopeSchool !== "whole-school") {
    filteredClasses = allClasses.filter((c) => c._id === scopeSchool);
  }

  // Get all students
  const allStudentRecords = await ctx.db
    .query("students")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .collect();

  // OPTIMIZED: Get users by school instead of full table scan
  const schoolUsers = await ctx.db
    .query("users")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .collect();
  const userMap = new Map(schoolUsers.map((u) => [u._id, u]));

  // OPTIMIZED: Get grades and attendance by class instead of full table scan
  const allSubjects = await ctx.db
    .query("subjects")
    .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
    .collect();
  const subjectMap = new Map(allSubjects.map((s) => [s._id, s]));

  // Read grades per filtered class (indexed) instead of full table scan
  const gradeArrays = await Promise.all(
    filteredClasses.map((cls) =>
      ctx.db.query("grades").withIndex("by_class", (q) => q.eq("classId", cls._id)).collect()
    )
  );
  const allGrades = gradeArrays.flat();

  // Read attendance per filtered class (indexed) instead of full table scan
  const attendanceArrays = await Promise.all(
    filteredClasses.map((cls) =>
      ctx.db.query("attendance").withIndex("by_class", (q) => q.eq("classId", cls._id)).collect()
    )
  );
  const allAttendance = attendanceArrays.flat();

  // Filter by classes
  const filteredClassIds = new Set(filteredClasses.map((c) => c._id));
  const filteredStudents = allStudentRecords.filter((s) => s.classId && filteredClassIds.has(s.classId));

  // Generate data based on report type
  switch (reportType) {
    case "average-grade": {
      // Среден успех - показва данни по ПРЕДМЕТ (не по ученик)
      // Както на снимката: Предмет, Успех, Оценки, Ученици
      const columns = [
        { key: "subject", label: "Предмет", type: "text" as const },
        { key: "averageGrade", label: "Успех", type: "text" as const },
        { key: "gradesCount", label: "Оценки", type: "number" as const },
        { key: "studentsCount", label: "Ученици", type: "number" as const },
      ];

      const rows: Array<Record<string, string | number>> = [];
      
      // Get all grades for filtered students
      const filteredStudentIds = new Set(filteredStudents.map((s) => s._id));
      const relevantGrades = allGrades.filter(
        (g) => filteredStudentIds.has(g.studentId) && typeof g.value === "number"
      );

      // Calculate totals first (row "Всички предмети")
      const allNumericGrades = relevantGrades.map((g) => g.value as number);
      const allStudentsWithGrades = new Set(relevantGrades.map((g) => g.studentId));
      const allAvg = allNumericGrades.length > 0
        ? (allNumericGrades.reduce((sum, g) => sum + g, 0) / allNumericGrades.length).toFixed(2)
        : "--";
      
      rows.push({
        subject: "Всички предмети",
        averageGrade: allAvg,
        gradesCount: allNumericGrades.length,
        studentsCount: allStudentsWithGrades.size,
      });

      // Now calculate per subject
      for (const subject of allSubjects) {
        const subjectGrades = relevantGrades.filter((g) => g.subjectId === subject._id);
        if (subjectGrades.length === 0) continue;
        
        const numericGrades = subjectGrades.map((g) => g.value as number);
        const studentsWithGrades = new Set(subjectGrades.map((g) => g.studentId));
        const avg = numericGrades.length > 0
          ? (numericGrades.reduce((sum, g) => sum + g, 0) / numericGrades.length).toFixed(2)
          : "--";
        
        rows.push({
          subject: subject.name,
          averageGrade: avg,
          gradesCount: numericGrades.length,
          studentsCount: studentsWithGrades.size,
        });
      }

      return { columns, rows };
    }

    case "average-grade-breakdown": {
      // Среден успех (разбивка по оценки) - по ученик
      const columns = [
        { key: "className", label: "Паралелка", type: "text" as const },
        { key: "studentNumber", label: "№", type: "number" as const },
        { key: "studentName", label: "Ученик", type: "text" as const },
        { key: "averageGrade", label: "Успех", type: "text" as const },
        { key: "gradesCount", label: "Оценки", type: "number" as const },
        { key: "grade6", label: "6", type: "number" as const },
        { key: "grade5", label: "5", type: "number" as const },
        { key: "grade4", label: "4", type: "number" as const },
        { key: "grade3", label: "3", type: "number" as const },
        { key: "grade2", label: "2", type: "number" as const },
      ];

      const rows: Array<Record<string, string | number>> = [];
      for (const cls of filteredClasses) {
        const classStudents = filteredStudents.filter((s) => s.classId === cls._id);
        let num = 1;
        for (const student of classStudents) {
          const user = userMap.get(student.userId);
          if (!user) continue;
          const studentGrades = allGrades.filter(
            (g) => g.studentId === student._id && typeof g.value === "number"
          );
          const numericGrades = studentGrades.map((g) => g.value as number);
          const avg = numericGrades.length > 0
            ? (numericGrades.reduce((sum, g) => sum + g, 0) / numericGrades.length).toFixed(2)
            : "--";
          
          rows.push({
            className: `${cls.grade}${cls.letter || ""}`,
            studentNumber: student.studentNumber || num,
            studentName: buildUserName(user),
            averageGrade: avg,
            gradesCount: numericGrades.length,
            grade6: numericGrades.filter((g) => g === 6).length,
            grade5: numericGrades.filter((g) => g === 5).length,
            grade4: numericGrades.filter((g) => g === 4).length,
            grade3: numericGrades.filter((g) => g === 3).length,
            grade2: numericGrades.filter((g) => g === 2).length,
          });
          num++;
        }
      }
      return { columns, rows };
    }

    case "low-grades": {
      // Слаби оценки
      const columns = [
        { key: "className", label: "Паралелка", type: "text" as const },
        { key: "studentNumber", label: "№", type: "number" as const },
        { key: "studentName", label: "Ученик", type: "text" as const },
        { key: "subject", label: "Предмет", type: "text" as const },
        { key: "grade", label: "Оценка", type: "number" as const },
        { key: "date", label: "Дата", type: "text" as const },
      ];

      const rows: Array<Record<string, string | number>> = [];
      for (const cls of filteredClasses) {
        const classStudents = filteredStudents.filter((s) => s.classId === cls._id);
        for (const student of classStudents) {
          const user = userMap.get(student.userId);
          if (!user) continue;
          const lowGrades = allGrades.filter(
            (g) => g.studentId === student._id && typeof g.value === "number" && (g.value as number) <= 3
          );
          for (const grade of lowGrades) {
            const subject = grade.subjectId ? subjectMap.get(grade.subjectId) : null;
            rows.push({
              className: `${cls.grade}${cls.letter || ""}`,
              studentNumber: student.studentNumber || 0,
              studentName: buildUserName(user),
              subject: subject?.name || "Неизвестен предмет",
              grade: grade.value as number,
              date: new Date(grade._creationTime).toLocaleDateString("bg-BG"),
            });
          }
        }
      }
      return { columns, rows };
    }

    case "absences-total":
    case "absent-students": {
      // Отсъствия (общ брой) / Отсъстващи ученици
      const columns = [
        { key: "className", label: "Паралелка", type: "text" as const },
        { key: "studentNumber", label: "№", type: "number" as const },
        { key: "studentName", label: "Ученик", type: "text" as const },
        { key: "excused", label: "Извинени", type: "number" as const },
        { key: "unexcused", label: "Неизвинени", type: "number" as const },
        { key: "total", label: "Общо", type: "number" as const },
      ];

      const rows: Array<Record<string, string | number>> = [];
      for (const cls of filteredClasses) {
        const classStudents = filteredStudents.filter((s) => s.classId === cls._id);
        let num = 1;
        for (const student of classStudents) {
          const user = userMap.get(student.userId);
          if (!user) continue;
          const studentAttendance = allAttendance.filter((a) => a.studentId === student._id);
          const excused = studentAttendance.filter((a) => a.status === "excused").length;
          const unexcused = studentAttendance.filter((a) => a.status === "absent").length;
          
          if (reportType === "absent-students" && excused + unexcused === 0) continue;
          
          rows.push({
            className: `${cls.grade}${cls.letter || ""}`,
            studentNumber: student.studentNumber || num,
            studentName: buildUserName(user),
            excused,
            unexcused,
            total: excused + unexcused,
          });
          num++;
        }
      }
      return { columns, rows };
    }

    case "praises-count":
    case "remarks-count": {
      // Похвали / Забележки (общ брой)
      // OPTIMIZED: Use by_date index (recent year) instead of full table scan
      const remarks = await ctx.db
        .query("remarks")
        .withIndex("by_date", (q) => q.gte("date", Date.now() - 365 * 24 * 60 * 60 * 1000))
        .collect();
      const type = reportType === "praises-count" ? "praise" : "warning";
      const label = reportType === "praises-count" ? "Похвали" : "Забележки";
      
      const columns = [
        { key: "className", label: "Паралелка", type: "text" as const },
        { key: "studentNumber", label: "№", type: "number" as const },
        { key: "studentName", label: "Ученик", type: "text" as const },
        { key: "count", label: label, type: "number" as const },
      ];

      const rows: Array<Record<string, string | number>> = [];
      for (const cls of filteredClasses) {
        const classStudents = filteredStudents.filter((s) => s.classId === cls._id);
        let num = 1;
        for (const student of classStudents) {
          const user = userMap.get(student.userId);
          if (!user) continue;
          const count = remarks.filter((r) => r.studentId === student._id && r.type === type).length;
          if (count === 0) continue;
          
          rows.push({
            className: `${cls.grade}${cls.letter || ""}`,
            studentNumber: student.studentNumber || num,
            studentName: buildUserName(user),
            count,
          });
          num++;
        }
      }
      return { columns, rows };
    }

    case "students-count": {
      // Ученици (общ брой)
      const columns = [
        { key: "className", label: "Паралелка", type: "text" as const },
        { key: "count", label: "Брой ученици", type: "number" as const },
        { key: "boys", label: "Момчета", type: "number" as const },
        { key: "girls", label: "Момичета", type: "number" as const },
      ];

      const rows: Array<Record<string, string | number>> = [];
      for (const cls of filteredClasses) {
        const classStudents = filteredStudents.filter((s) => s.classId === cls._id);
        const boys = classStudents.filter((s) => {
          const user = userMap.get(s.userId);
          return user?.gender === "male";
        }).length;
        const girls = classStudents.filter((s) => {
          const user = userMap.get(s.userId);
          return user?.gender === "female";
        }).length;
        
        rows.push({
          className: `${cls.grade}${cls.letter || ""}`,
          count: classStudents.length,
          boys,
          girls,
        });
      }
      
      // Add summary
      const summary = {
        className: "ОБЩО",
        count: filteredStudents.length,
        boys: rows.reduce((sum, r) => sum + (r.boys as number), 0),
        girls: rows.reduce((sum, r) => sum + (r.girls as number), 0),
      };
      
      return { columns, rows, summary };
    }

    case "untaken-lessons": {
      // Невзети занятия
      // OPTIMIZED: Read lessons per filtered class instead of full table scan
      const lessonArrays = await Promise.all(
        filteredClasses.map((cls) =>
          ctx.db.query("lessons").withIndex("by_class", (q) => q.eq("classId", cls._id)).collect()
        )
      );
      const lessons = lessonArrays.flat();
      const untakenLessons = lessons.filter((l) => !l.isTaken);
      
      const columns = [
        { key: "className", label: "Паралелка", type: "text" as const },
        { key: "subject", label: "Предмет", type: "text" as const },
        { key: "date", label: "Дата", type: "text" as const },
        { key: "lessonNumber", label: "Час", type: "number" as const },
      ];

      const rows: Array<Record<string, string | number>> = [];
      for (const lesson of untakenLessons) {
        const cls = allClasses.find((c) => c._id === lesson.classId);
        if (!cls || !filteredClassIds.has(cls._id)) continue;
        
        const subject = lesson.subjectId ? subjectMap.get(lesson.subjectId) : null;
        
        rows.push({
          className: `${cls.grade}${cls.letter || ""}`,
          subject: subject?.name || "Неизвестен предмет",
          date: new Date(lesson.date).toLocaleDateString("bg-BG"),
          lessonNumber: lesson.periodIndex || 0,
        });
      }
      return { columns, rows };
    }

    case "lessons-no-topic": {
      // Взети занятия без тема
      // OPTIMIZED: Read lessons per filtered class instead of full table scan
      const lessonArrays2 = await Promise.all(
        filteredClasses.map((cls) =>
          ctx.db.query("lessons").withIndex("by_class", (q) => q.eq("classId", cls._id)).collect()
        )
      );
      const lessons2 = lessonArrays2.flat();
      const lessonsNoTopic = lessons2.filter((l) => l.isTaken && (!l.topic || l.topic.trim() === ""));
      
      const columns = [
        { key: "className", label: "Паралелка", type: "text" as const },
        { key: "subject", label: "Предмет", type: "text" as const },
        { key: "date", label: "Дата", type: "text" as const },
        { key: "lessonNumber", label: "Час", type: "number" as const },
      ];

      const rows: Array<Record<string, string | number>> = [];
      for (const lesson of lessonsNoTopic) {
        const cls = allClasses.find((c) => c._id === lesson.classId);
        if (!cls || !filteredClassIds.has(cls._id)) continue;
        
        const subject = lesson.subjectId ? subjectMap.get(lesson.subjectId) : null;
        
        rows.push({
          className: `${cls.grade}${cls.letter || ""}`,
          subject: subject?.name || "Неизвестен предмет",
          date: new Date(lesson.date).toLocaleDateString("bg-BG"),
          lessonNumber: lesson.periodIndex || 0,
        });
      }
      return { columns, rows };
    }

    case "teacher-activity": {
      // Учителска активност
      // OPTIMIZED: Use by_school index for teachers
      const allTeachers = await ctx.db
        .query("teachers")
        .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
        .collect();
      // OPTIMIZED: Read lessons per filtered class instead of full table scan
      const teacherLessonArrays = await Promise.all(
        filteredClasses.map((cls) =>
          ctx.db.query("lessons").withIndex("by_class", (q) => q.eq("classId", cls._id)).collect()
        )
      );
      const lessons3 = teacherLessonArrays.flat();
      
      const columns = [
        { key: "teacherName", label: "Учител", type: "text" as const },
        { key: "totalLessons", label: "Общо часове", type: "number" as const },
        { key: "takenLessons", label: "Взети", type: "number" as const },
        { key: "gradesGiven", label: "Оценки", type: "number" as const },
      ];

      const rows: Array<Record<string, string | number>> = [];
      for (const teacher of allTeachers) {
        const user = userMap.get(teacher.userId);
        const teacherLessons = lessons3.filter((l) => l.teacherId === teacher._id);
        const takenLessons = teacherLessons.filter((l) => l.isTaken);
        const gradesGiven = allGrades.filter((g) => g.teacherId === teacher._id).length;
        
        rows.push({
          teacherName: user ? buildUserName(user) : "Неизвестен учител",
          totalLessons: teacherLessons.length,
          takenLessons: takenLessons.length,
          gradesGiven,
        });
      }
      return { columns, rows };
    }

    default: {
      // Default: general student report with grades
      const columns = [
        { key: "className", label: "Паралелка", type: "text" as const },
        { key: "studentNumber", label: "№", type: "number" as const },
        { key: "studentName", label: "Ученик", type: "text" as const },
        { key: "averageGrade", label: "Успех", type: "text" as const },
        { key: "gradesCount", label: "Оценки", type: "number" as const },
      ];

      const rows: Array<Record<string, string | number>> = [];
      for (const cls of filteredClasses) {
        const classStudents = filteredStudents.filter((s) => s.classId === cls._id);
        let num = 1;
        for (const student of classStudents) {
          const user = userMap.get(student.userId);
          if (!user) continue;
          const studentGrades = allGrades.filter(
            (g) => g.studentId === student._id && typeof g.value === "number"
          );
          const numericGrades = studentGrades.map((g) => g.value as number);
          const avg = numericGrades.length > 0
            ? (numericGrades.reduce((sum, g) => sum + g, 0) / numericGrades.length).toFixed(2)
            : "--";
          
          rows.push({
            className: `${cls.grade}${cls.letter || ""}`,
            studentNumber: student.studentNumber || num,
            studentName: buildUserName(user),
            averageGrade: avg,
            gradesCount: numericGrades.length,
          });
          num++;
        }
      }
      return { columns, rows };
    }
  }
}

// Helper function to generate student-based report data (legacy)
async function generateStudentReportData(
  ctx: QueryCtx | MutationCtx,
  scopeSchool: string,
  scopeYear: string,
  scopeGrades: string
) {
  // Get current user for school context
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return { studentData: [], subjectSummary: [] };
  }

  const currentUser = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  if (!currentUser?.schoolId) {
    return { studentData: [], subjectSummary: [] };
  }

  // Get all students from students table
  const allStudentRecords = await ctx.db
    .query("students")
    .withIndex("by_school", (q) => q.eq("schoolId", currentUser.schoolId!))
    .collect();

  // OPTIMIZED: Get users by school instead of full table scan
  const schoolUsers = await ctx.db
    .query("users")
    .withIndex("by_school", (q) => q.eq("schoolId", currentUser.schoolId!))
    .collect();
  const userMap = new Map(schoolUsers.map((u) => [u._id, u]));

  // Get all classes
  const allClasses = await ctx.db
    .query("classes")
    .withIndex("by_school", (q) => q.eq("schoolId", currentUser.schoolId!))
    .collect();

  // Filter classes based on scope
  let filteredClasses = allClasses;
  if (scopeSchool !== "whole-school") {
    filteredClasses = allClasses.filter((c) => c._id === scopeSchool);
  }

  // OPTIMIZED: Get grades by class instead of full table scan
  const gradeArrays = await Promise.all(
    filteredClasses.map((cls) =>
      ctx.db.query("grades").withIndex("by_class", (q) => q.eq("classId", cls._id)).collect()
    )
  );
  const allGrades = gradeArrays.flat();

  // Get all subjects
  const subjects = await ctx.db
    .query("subjects")
    .withIndex("by_school", (q) => q.eq("schoolId", currentUser.schoolId!))
    .collect();

  // Build student data
  const studentData: Array<{
    classId: Id<"classes"> | undefined;
    className: string;
    studentNumber: number;
    studentId: Id<"users">;
    studentName: string;
    averageGrade: string;
    gradesCount: number;
  }> = [];

  // Group students by class and calculate their averages
  for (const cls of filteredClasses) {
    const classStudentRecords = allStudentRecords.filter((s) => s.classId === cls._id);
    
    // Sort students alphabetically by name for consistent numbering
    const sortedStudents = classStudentRecords.sort((a, b) => {
      const userA = userMap.get(a.userId);
      const userB = userMap.get(b.userId);
      const nameA = buildUserName(userA);
      const nameB = buildUserName(userB);
      return nameA.localeCompare(nameB, "bg");
    });

    let studentNumber = 1;
    for (const studentRecord of sortedStudents) {
      const user = userMap.get(studentRecord.userId);
      if (!user) continue;

      // Get student's grades (using student record _id)
      const studentGrades = allGrades.filter(
        (g) => g.studentId === studentRecord._id && typeof g.value === "number"
      );

      // Filter by grade type if specified
      const filteredGrades = studentGrades;

      const numericGrades = filteredGrades.map((g) => g.value as number);
      const averageGrade =
        numericGrades.length > 0
          ? (numericGrades.reduce((sum, g) => sum + g, 0) / numericGrades.length).toFixed(2)
          : "--";

      studentData.push({
        classId: cls._id,
        className: `${cls.grade}${cls.letter || ""}`,
        studentNumber,
        studentId: studentRecord.userId,
        studentName: buildUserName(user),
        averageGrade,
        gradesCount: numericGrades.length,
      });
      studentNumber++;
    }
  }

  // Build subject summary
  const subjectSummary: Array<{
    subjectId: Id<"subjects"> | undefined;
    subjectName: string;
    gradesCount: number;
  }> = [];

  // Total grades count
  const totalGradesCount = allGrades.filter((g) => typeof g.value === "number").length;
  subjectSummary.push({
    subjectId: undefined,
    subjectName: `Всички предмети (${subjects.length})`,
    gradesCount: totalGradesCount,
  });

  // Grades count per subject
  for (const subject of subjects) {
    const subjectGradesCount = allGrades.filter(
      (g) => g.subjectId === subject._id && typeof g.value === "number"
    ).length;
    
    subjectSummary.push({
      subjectId: subject._id,
      subjectName: `${subject.name} (${subjectGradesCount})`,
      gradesCount: subjectGradesCount,
    });
  }

  return { studentData, subjectSummary };
}

// Legacy function for old format
async function generateReportData(ctx: QueryCtx | MutationCtx) {
  // OPTIMIZED: Get current user's school context for scoped queries
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return [];
  
  const currentUser = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  // Get subjects by school (or all if no school)
  const subjects = currentUser?.schoolId
    ? await ctx.db.query("subjects").withIndex("by_school", (q) => q.eq("schoolId", currentUser.schoolId!)).collect()
    : await ctx.db.query("subjects").collect();

  // OPTIMIZED: Get grades by date (recent 1 year) instead of full table scan
  const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const allGrades = await ctx.db
    .query("grades")
    .withIndex("by_date", (q) => q.gte("date", oneYearAgo))
    .collect();

  const reportData = subjects.map((subject) => {
    const subjectGrades = allGrades.filter(
      (grade) =>
        grade.subjectId === subject._id && typeof grade.value === "number"
    );

    const numericGrades = subjectGrades.map((g) => g.value as number);
    const grade2Count = numericGrades.filter((g) => g === 2).length;
    const grade3Count = numericGrades.filter((g) => g === 3).length;
    const grade4Count = numericGrades.filter((g) => g === 4).length;
    const grade5Count = numericGrades.filter((g) => g === 5).length;
    const grade6Count = numericGrades.filter((g) => g === 6).length;
    const average =
      numericGrades.length > 0
        ? (numericGrades.reduce((sum, g) => sum + g, 0) / numericGrades.length).toFixed(2)
        : "0.00";

    return {
      subject: subject.name,
      testedStudents: numericGrades.length,
      grade2: grade2Count,
      grade3: grade3Count,
      grade4: grade4Count,
      grade5: grade5Count,
      grade6: grade6Count,
      averageGrade: average,
    };
  });

  return reportData;
}

// Helper to translate elements to Bulgarian
function translateElement(element: string): string {
  const translations: Record<string, string> = {
    "students": "Ученици",
    "classes": "Паралелки",
    "grades": "Класове",
    "school": "Училище",
  };
  return translations[element] || element;
}

// Helper to translate period to Bulgarian
function translatePeriod(period: string): string {
  const translations: Record<string, string> = {
    "whole-year": "Цялата година",
    "term-1": "Срок 1",
    "term-2": "Срок 2",
    "custom": "По избор",
  };
  return translations[period] || period;
}

export const getAllReports = query({
  args: {},
  handler: async (ctx): Promise<
    Array<{
      _id: Id<"reports">;
      name: string;
      elements: string;
      class: string | null;
      term: string | null;
      period: string;
      date: string;
    }>
  > => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not authenticated",
        code: "UNAUTHENTICATED",
      });
    }

    const reports = await ctx.db.query("reports").order("desc").collect();

    return reports.map((report) => ({
      _id: report._id,
      name: report.name,
      elements: report.elements.map(translateElement).join(", "),
      class: report.scopeSchool === "whole-school" ? null : report.scopeSchool,
      term: report.scopeYear === "whole-year" ? null : translatePeriod(report.scopeYear),
      period: translatePeriod(report.scopeYear),
      date: new Date(report._creationTime).toLocaleDateString("bg-BG", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));
  },
});

export const getReportById = query({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not authenticated",
        code: "UNAUTHENTICATED",
      });
    }

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new ConvexError({
        message: "Report not found",
        code: "NOT_FOUND",
      });
    }

    // Format scope values for display
    const scopeYearDisplay = report.scopeYear === "whole-year" 
      ? "За цялата година" 
      : report.scopeYear === "term-1"
      ? "Срок 1"
      : report.scopeYear === "term-2"
      ? "Срок 2"
      : report.scopeYear;

    const scopeGradesDisplay = report.scopeGrades === "all" || report.scopeGrades === "all-grades"
      ? "Всички текущи оценки"
      : report.scopeGrades;

    return {
      _id: report._id,
      name: report.name,
      type: report.type,
      elements: report.elements,
      scopeSchool: report.scopeSchool === "whole-school" ? "Цялото училище" : report.scopeSchool,
      scopeYear: scopeYearDisplay,
      scopeGrades: scopeGradesDisplay,
      createdAt: report._creationTime,
      data: report.data,
      studentData: report.studentData,
      subjectSummary: report.subjectSummary,
      // Dynamic report data
      dynamicColumns: report.dynamicColumns,
      dynamicRows: report.dynamicRows,
      dynamicSummary: report.dynamicSummary,
    };
  },
});

export const createReport = mutation({
  args: {
    name: v.string(),
    type: v.string(),
    elements: v.array(v.string()),
    scopeSchool: v.string(),
    scopeYear: v.string(),
    scopeGrades: v.string(),
    excludedGroups: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"reports">> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not authenticated",
        code: "UNAUTHENTICATED",
      });
    }

    // Generate dynamic report data based on report type
    const dynamicData = await generateDynamicReportData(
      ctx,
      args.type,
      args.elements[0] || "students",
      args.scopeSchool,
      args.scopeYear,
      args.scopeGrades
    );

    // Generate student-based report data (legacy)
    const { studentData, subjectSummary } = await generateStudentReportData(
      ctx,
      args.scopeSchool,
      args.scopeYear,
      args.scopeGrades
    );

    // Also generate old format data for backwards compatibility
    const reportData = await generateReportData(ctx);

    const reportId = await ctx.db.insert("reports", {
      name: args.name,
      type: args.type,
      elements: args.elements,
      scopeSchool: args.scopeSchool,
      scopeYear: args.scopeYear,
      scopeGrades: args.scopeGrades,
      excludedGroups: args.excludedGroups,
      data: reportData,
      studentData,
      subjectSummary,
      dynamicColumns: dynamicData.columns,
      dynamicRows: dynamicData.rows,
      dynamicSummary: dynamicData.summary,
    });

    return reportId;
  },
});

export const refreshReport = mutation({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not authenticated",
        code: "UNAUTHENTICATED",
      });
    }

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new ConvexError({
        message: "Report not found",
        code: "NOT_FOUND",
      });
    }

    // Generate fresh dynamic data
    const dynamicData = await generateDynamicReportData(
      ctx,
      report.type,
      report.elements[0] || "students",
      report.scopeSchool,
      report.scopeYear,
      report.scopeGrades
    );

    // Generate fresh data
    const { studentData, subjectSummary } = await generateStudentReportData(
      ctx,
      report.scopeSchool,
      report.scopeYear,
      report.scopeGrades
    );
    const reportData = await generateReportData(ctx);

    await ctx.db.patch(args.reportId, {
      data: reportData,
      studentData,
      subjectSummary,
      dynamicColumns: dynamicData.columns,
      dynamicRows: dynamicData.rows,
      dynamicSummary: dynamicData.summary,
    });
  },
});

export const deleteReport = mutation({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not authenticated",
        code: "UNAUTHENTICATED",
      });
    }

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new ConvexError({
        message: "Report not found",
        code: "NOT_FOUND",
      });
    }

    await ctx.db.delete(args.reportId);
  },
});

export const deleteMultipleReports = mutation({
  args: { reportIds: v.array(v.id("reports")) },
  handler: async (ctx, args): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not authenticated",
        code: "UNAUTHENTICATED",
      });
    }

    for (const reportId of args.reportIds) {
      const report = await ctx.db.get(reportId);
      if (report) {
        await ctx.db.delete(reportId);
      }
    }
  },
});
