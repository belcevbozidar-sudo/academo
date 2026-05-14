import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel.d.ts";

const DEMO_CONFIRMATION = "SEED_ACADEMO_DEMO";
const DEMO_PASSWORD_HASH =
  "$2b$10$7vXOcbUPQ9cpfX/jLZVzf.8jqSmtG2WmkMUhhKG6i3FIchFE1nmaq";

const academicYear = "2025/2026";

const date = (isoDate: string) => new Date(`${isoDate}T09:00:00+02:00`).getTime();

export const seedDemoData = mutation({
  args: {
    confirm: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.confirm !== DEMO_CONFIRMATION) {
      throw new ConvexError("Invalid demo seed confirmation");
    }

    const now = Date.now();
    const allSchools = await ctx.db.query("schools").collect();
    let school = allSchools.find((item) => item.neispuoCode === "DEMO-VECTOR-001");

    let schoolId: Id<"schools">;
    if (school) {
      schoolId = school._id;
    } else {
      schoolId = await ctx.db.insert("schools", {
        name: "Академия Вектор",
        shortName: "Вектор",
        schoolType: "Частна образователна академия",
        ownership: "Частна",
        isCentral: false,
        isProtected: false,
        isInnovative: true,
        isStateFunded: false,
        isNationalImportance: false,
        providesProfessionalTraining: true,
        fundingSource: "Такси за обучение и партньорски програми",
        isDelegatedBudget: false,
        approvedBudget: "Демо бюджет: 280 000 лв.",
        createdByInternationalAgreement: false,
        city: "София",
        district: "Лозенец",
        address: "бул. Черни връх 42, ет. 3",
        postalCode: "1407",
        phone: "+359 2 404 20 26",
        phone2: "+359 888 120 260",
        email: "office@vector-academy.demo",
        email2: "admissions@vector-academy.demo",
        website: "https://vector-academy.demo",
        neispuoCode: "DEMO-VECTOR-001",
        iban: "BG80DEMO00000000000001",
        bank: "Demo Bank",
        bic: "DEMOBGSF",
        accountHolder: "Академия Вектор ООД",
        hiddenFields: ["iban", "bank", "bic", "accountHolder"],
        customData: [
          {
            label: "Фокус",
            value: "STEM, езици, предприемачество и подготовка за международни изпити",
          },
          {
            label: "Формат",
            value: "Присъствено, онлайн и хибридно обучение",
          },
        ],
      });
      school = (await ctx.db.get(schoolId)) ?? undefined;
    }

    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      const isAdmin =
        user.role === "system_admin" ||
        user.role === "director" ||
        user.roles?.includes("system_admin") ||
        user.roles?.includes("director");

      if (isAdmin && !user.schoolId) {
        await ctx.db.patch(user._id, { schoolId });
      }
    }

    const createUser = async (input: {
      username: string;
      email: string;
      firstName: string;
      middleName?: string;
      lastName: string;
      role:
        | "director"
        | "vice_director"
        | "teacher"
        | "class_teacher"
        | "parent"
        | "student"
        | "secretary"
        | "pedagogical_counselor";
      roles?: Array<
        | "director"
        | "vice_director"
        | "teacher"
        | "class_teacher"
        | "parent"
        | "student"
        | "secretary"
        | "pedagogical_counselor"
      >;
      phone: string;
      gender: "male" | "female" | "other";
      birthDate?: string;
      positionName?: string;
      teachingSubjects?: string[];
    }) => {
      const existing = (await ctx.db.query("users").collect()).find(
        (user) => user.username === input.username || user.email === input.email,
      );
      if (existing) {
        if (!existing.schoolId) {
          await ctx.db.patch(existing._id, { schoolId });
        }
        return existing._id;
      }

      return await ctx.db.insert("users", {
        tokenIdentifier: `demo_${input.username}`,
        name: [input.firstName, input.middleName, input.lastName].filter(Boolean).join(" "),
        email: input.email,
        role: input.role,
        roles: input.roles ?? [input.role],
        status: "active",
        schoolId,
        isActive: true,
        username: input.username,
        firstName: input.firstName,
        middleName: input.middleName,
        lastName: input.lastName,
        phone: input.phone,
        gender: input.gender,
        birthDate: input.birthDate,
        password: DEMO_PASSWORD_HASH,
        isDeleted: false,
        positionName: input.positionName,
        teachingSubjects: input.teachingSubjects,
      });
    };

    const directorId = await createUser({
      username: "demo.director",
      email: "director@vector-academy.demo",
      firstName: "Мая",
      lastName: "Петрова",
      role: "director",
      roles: ["director", "teacher"],
      phone: "+359 888 100 101",
      gender: "female",
      positionName: "Директор",
    });

    const viceDirectorId = await createUser({
      username: "demo.vice",
      email: "vice@vector-academy.demo",
      firstName: "Георги",
      lastName: "Николов",
      role: "vice_director",
      roles: ["vice_director", "teacher"],
      phone: "+359 888 100 102",
      gender: "male",
      positionName: "Заместник-директор учебна дейност",
    });

    const secretaryId = await createUser({
      username: "demo.secretary",
      email: "secretary@vector-academy.demo",
      firstName: "Елица",
      lastName: "Стоянова",
      role: "secretary",
      phone: "+359 888 100 103",
      gender: "female",
      positionName: "Административен секретар",
    });

    const counselorId = await createUser({
      username: "demo.counselor",
      email: "counselor@vector-academy.demo",
      firstName: "Радина",
      lastName: "Иванова",
      role: "pedagogical_counselor",
      phone: "+359 888 100 104",
      gender: "female",
      positionName: "Образователен консултант",
    });

    const teacherUsers = [
      await createUser({
        username: "demo.math",
        email: "math@vector-academy.demo",
        firstName: "Александър",
        lastName: "Георгиев",
        role: "class_teacher",
        roles: ["teacher", "class_teacher"],
        phone: "+359 888 200 101",
        gender: "male",
        teachingSubjects: ["Математика", "Физика"],
        positionName: "Старши преподавател по математика",
      }),
      await createUser({
        username: "demo.english",
        email: "english@vector-academy.demo",
        firstName: "Нора",
        lastName: "Димитрова",
        role: "teacher",
        roles: ["teacher"],
        phone: "+359 888 200 102",
        gender: "female",
        teachingSubjects: ["Английски език"],
        positionName: "Преподавател по английски език",
      }),
      await createUser({
        username: "demo.code",
        email: "code@vector-academy.demo",
        firstName: "Симеон",
        lastName: "Маринов",
        role: "teacher",
        roles: ["teacher"],
        phone: "+359 888 200 103",
        gender: "male",
        teachingSubjects: ["Програмиране", "Роботика"],
        positionName: "Преподавател по програмиране",
      }),
      await createUser({
        username: "demo.design",
        email: "design@vector-academy.demo",
        firstName: "Виктория",
        lastName: "Ангелова",
        role: "teacher",
        roles: ["teacher"],
        phone: "+359 888 200 104",
        gender: "female",
        teachingSubjects: ["Дизайн мислене", "Предприемачество"],
        positionName: "Преподавател по творчески проекти",
      }),
      await createUser({
        username: "demo.science",
        email: "science@vector-academy.demo",
        firstName: "Калин",
        lastName: "Тодоров",
        role: "teacher",
        roles: ["teacher"],
        phone: "+359 888 200 105",
        gender: "male",
        teachingSubjects: ["Природни науки"],
        positionName: "Преподавател по природни науки",
      }),
    ];

    const allTeachers = [...teacherUsers, directorId, viceDirectorId];
    const teachers: Record<string, Id<"teachers">> = {};
    for (const userId of allTeachers) {
      let teacher = await ctx.db
        .query("teachers")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      if (!teacher) {
        const teacherId = await ctx.db.insert("teachers", {
          userId,
          schoolId,
          hasLeft: false,
        });
        teacher = await ctx.db.get(teacherId);
      }
      if (teacher) {
        teachers[userId] = teacher._id;
      }
    }

    const allSubjects = await ctx.db
      .query("subjects")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();
    const subjectIds: Record<string, Id<"subjects">> = {};
    for (const subject of [
      ["Математика", "Мат", "STEM", true],
      ["Английски език", "АЕ", "Езици", true],
      ["Програмиране", "Code", "STEM", true],
      ["Роботика", "Robo", "STEM", false],
      ["Дизайн мислене", "Design", "Проекти", false],
      ["Предприемачество", "Biz", "Проекти", false],
      ["Природни науки", "Science", "STEM", true],
      ["Презентационни умения", "Present", "Умения", false],
    ] as const) {
      const existing = allSubjects.find((item) => item.name === subject[0]);
      subjectIds[subject[0]] =
        existing?._id ??
        (await ctx.db.insert("subjects", {
          name: subject[0],
          shortName: subject[1],
          group: subject[2],
          isPrimary: subject[3],
          schoolId,
        }));
    }

    await ctx.db.patch(schoolId, {
      principalId: directorId,
      leadershipPositions: [
        { positionTitle: "Директор", userId: directorId },
        { positionTitle: "Заместник-директор", userId: viceDirectorId },
        { positionTitle: "Администрация", userId: secretaryId },
        { positionTitle: "Образователен консултант", userId: counselorId },
      ],
    });

    const allClasses = await ctx.db
      .query("classes")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();
    const createClass = async (name: string, grade: number, letter: string, classTeacherId: Id<"users">) => {
      const existing = allClasses.find((item) => item.name === name && item.academicYear === academicYear);
      return (
        existing?._id ??
        (await ctx.db.insert("classes", {
          name,
          grade,
          letter,
          schoolId,
          classTeacherId,
          diaryType: "Академична група",
          shiftNumber: 1,
          academicYear,
          organizationalForm: "group",
          educationForm: "hybrid",
          organizationOfDay: "shift1",
          financedBy: "private",
          isMerged: false,
          isSpecial: false,
          preparationType: "profiled",
        }))
      );
    };

    const juniorClassId = await createClass("Junior STEM A", 5, "A", teacherUsers[0]);
    const teenClassId = await createClass("Teen Innovators B", 8, "B", teacherUsers[2]);
    const examClassId = await createClass("Exam Prep C1", 10, "C1", teacherUsers[1]);
    const classIds = [juniorClassId, teenClassId, examClassId];

    const studentsSeed = [
      ["demo.st01", "Лора", "Асенова", "female", juniorClassId, 1],
      ["demo.st02", "Мартин", "Борисов", "male", juniorClassId, 2],
      ["demo.st03", "Ема", "Вълчева", "female", juniorClassId, 3],
      ["demo.st04", "Никола", "Ганев", "male", juniorClassId, 4],
      ["demo.st05", "Ая", "Димова", "female", teenClassId, 1],
      ["demo.st06", "Виктор", "Енев", "male", teenClassId, 2],
      ["demo.st07", "София", "Желева", "female", teenClassId, 3],
      ["demo.st08", "Боян", "Илиев", "male", teenClassId, 4],
      ["demo.st09", "Калина", "Кирилова", "female", examClassId, 1],
      ["demo.st10", "Даниел", "Лазаров", "male", examClassId, 2],
      ["demo.st11", "Мила", "Михайлова", "female", examClassId, 3],
      ["demo.st12", "Петър", "Недев", "male", examClassId, 4],
    ] as const;

    const studentRecords: Array<{ userId: Id<"users">; studentId: Id<"students">; classId: Id<"classes"> }> = [];
    for (const item of studentsSeed) {
      const userId = await createUser({
        username: item[0],
        email: `${item[0]}@vector-academy.demo`,
        firstName: item[1],
        lastName: item[2],
        role: "student",
        phone: "+359 888 300 000",
        gender: item[3],
        birthDate: "2011-05-12",
      });
      await ctx.db.patch(userId, { classId: item[4], personalDoctor: "Д-р Демо Иванов" });
      let student = await ctx.db
        .query("students")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      if (!student) {
        const studentId = await ctx.db.insert("students", {
          userId,
          classId: item[4],
          schoolId,
          studentNumber: item[5],
          enrollmentDate: date("2025-09-15"),
        });
        student = await ctx.db.get(studentId);
      }
      if (student) {
        studentRecords.push({ userId, studentId: student._id, classId: item[4] });
      }
    }

    for (let index = 0; index < studentRecords.length; index += 2) {
      const first = studentRecords[index];
      const second = studentRecords[index + 1];
      const parentId = await createUser({
        username: `demo.parent${Math.floor(index / 2) + 1}`,
        email: `parent${Math.floor(index / 2) + 1}@vector-academy.demo`,
        firstName: ["Ива", "Пламен", "Теодора", "Стефан", "Анна", "Росен"][Math.floor(index / 2)],
        lastName: "Родител",
        role: "parent",
        phone: `+359 888 400 10${Math.floor(index / 2) + 1}`,
        gender: Math.floor(index / 2) % 2 === 0 ? "female" : "male",
      });

      const existingParent = await ctx.db
        .query("parents")
        .withIndex("by_user", (q) => q.eq("userId", parentId))
        .first();
      const linkedStudents = [first?.studentId, second?.studentId].filter(Boolean) as Id<"students">[];
      if (existingParent) {
        await ctx.db.patch(existingParent._id, { studentIds: linkedStudents, schoolId });
      } else {
        await ctx.db.insert("parents", {
          userId: parentId,
          studentIds: linkedStudents,
          schoolId,
        });
      }
    }

    const existingTerms = await ctx.db
      .query("terms")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();
    const firstTermId =
      existingTerms.find((term) => term.name === "Първи срок" && term.academicYear === academicYear)?._id ??
      (await ctx.db.insert("terms", {
        name: "Първи срок",
        schoolId,
        startDate: date("2025-09-15"),
        endDate: date("2026-01-30"),
        academicYear,
      }));
    const secondTermId =
      existingTerms.find((term) => term.name === "Втори срок" && term.academicYear === academicYear)?._id ??
      (await ctx.db.insert("terms", {
        name: "Втори срок",
        schoolId,
        startDate: date("2026-02-02"),
        endDate: date("2026-06-30"),
        academicYear,
      }));

    const existingRegimes = await ctx.db
      .query("dayRegimes")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();
    const dayRegimeId =
      existingRegimes.find((regime) => regime.name === "Следобеден академичен режим")?._id ??
      (await ctx.db.insert("dayRegimes", {
        name: "Следобеден академичен режим",
        shift: 1,
        startTime: "14:00",
        endTime: "18:10",
        periodCount: 5,
        schoolId,
        academicYear,
        hasDifferentRegimes: false,
        periods: [
          { periodNumber: 1, startTime: "14:00", duration: 45, endTime: "14:45" },
          { periodNumber: 2, startTime: "14:55", duration: 45, endTime: "15:40" },
          { periodNumber: 3, startTime: "15:50", duration: 45, endTime: "16:35" },
          { periodNumber: 4, startTime: "16:45", duration: 45, endTime: "17:30" },
          { periodNumber: 5, startTime: "17:35", duration: 35, endTime: "18:10" },
        ],
      }));

    for (const classId of classIds) {
      const existingAssignment = (await ctx.db
        .query("dayRegimeAssignments")
        .withIndex("by_class", (q) => q.eq("classId", classId))
        .collect()).find((assignment) => assignment.academicYear === academicYear);
      if (!existingAssignment) {
        await ctx.db.insert("dayRegimeAssignments", {
          dayRegimeId,
          classId,
          termId: firstTermId,
          academicYear,
        });
      }
    }

    const mathTeacherId = teachers[teacherUsers[0]];
    const englishTeacherId = teachers[teacherUsers[1]];
    const codeTeacherId = teachers[teacherUsers[2]];
    const designTeacherId = teachers[teacherUsers[3]];
    const scienceTeacherId = teachers[teacherUsers[4]];

    const classSubjectPairs = [
      [juniorClassId, subjectIds["Математика"], mathTeacherId, 4],
      [juniorClassId, subjectIds["Английски език"], englishTeacherId, 3],
      [juniorClassId, subjectIds["Роботика"], codeTeacherId, 2],
      [teenClassId, subjectIds["Програмиране"], codeTeacherId, 4],
      [teenClassId, subjectIds["Дизайн мислене"], designTeacherId, 2],
      [teenClassId, subjectIds["Природни науки"], scienceTeacherId, 3],
      [examClassId, subjectIds["Английски език"], englishTeacherId, 5],
      [examClassId, subjectIds["Презентационни умения"], designTeacherId, 2],
      [examClassId, subjectIds["Предприемачество"], designTeacherId, 2],
    ] as const;

    for (const [classId, subjectId, teacherId, hoursPerWeek] of classSubjectPairs) {
      const exists = (await ctx.db
        .query("classSubjects")
        .withIndex("by_class", (q) => q.eq("classId", classId))
        .collect()).some((item) => item.subjectId === subjectId && item.teacherId === teacherId);
      if (!exists) {
        await ctx.db.insert("classSubjects", {
          classId,
          subjectId,
          teacherId,
          hoursPerWeek,
          academicYear,
          preparationType: "Профилирана подготовка",
        });
      }
    }

    const scheduleTemplates = [
      [juniorClassId, mathTeacherId, [subjectIds["Математика"], subjectIds["Английски език"], subjectIds["Роботика"]]],
      [teenClassId, codeTeacherId, [subjectIds["Програмиране"], subjectIds["Дизайн мислене"], subjectIds["Природни науки"]]],
      [examClassId, englishTeacherId, [subjectIds["Английски език"], subjectIds["Презентационни умения"], subjectIds["Предприемачество"]]],
    ] as const;

    for (const [classId, fallbackTeacherId, subjectList] of scheduleTemplates) {
      const existingWeekly = (await ctx.db
        .query("weeklySchedules")
        .withIndex("by_class", (q) => q.eq("classId", classId))
        .collect()).find((schedule) => schedule.academicYear === academicYear);

      const entries = [1, 2, 3, 4, 5].flatMap((dayOfWeek) =>
        [1, 2, 3].map((periodIndex) => {
          const subjectId = subjectList[(dayOfWeek + periodIndex) % subjectList.length];
          const pair = classSubjectPairs.find((item) => item[0] === classId && item[1] === subjectId);
          return {
            dayOfWeek,
            periodIndex,
            subjectId,
            teacherId: pair?.[2] ?? fallbackTeacherId,
            preparationType: "ПП",
          };
        }),
      );

      if (!existingWeekly) {
        await ctx.db.insert("weeklySchedules", {
          classId,
          termId: firstTermId,
          dayRegimeId,
          weekCount: 18,
          academicYear,
          schoolId,
          term1StartDate: "2025-09-15",
          term1EndDate: "2026-01-30",
          term2StartDate: "2026-02-02",
          term2EndDate: "2026-06-30",
          entries,
          createdBy: directorId,
          lastEditedAt: now,
          lastEditedBy: directorId,
        });
      }

      const existingSchedules = await ctx.db
        .query("schedules")
        .withIndex("by_class", (q) => q.eq("classId", classId))
        .collect();
      if (existingSchedules.length === 0) {
        for (const entry of entries.slice(0, 15)) {
          await ctx.db.insert("schedules", {
            classId,
            dayOfWeek: entry.dayOfWeek,
            period: entry.periodIndex,
            subjectId: entry.subjectId,
            teacherId: entry.teacherId,
            room: `Зала ${entry.dayOfWeek}${entry.periodIndex}`,
            termId: firstTermId,
          });
        }
      }
    }

    const sampleStudents = studentRecords.slice(0, 8);
    for (const student of sampleStudents) {
      const classSubject = classSubjectPairs.find((pair) => pair[0] === student.classId);
      if (!classSubject) continue;
      const existingGrade = (await ctx.db
        .query("grades")
        .withIndex("by_student", (q) => q.eq("studentId", student.studentId))
        .collect()).find((grade) => grade.subjectId === classSubject[1]);
      if (!existingGrade) {
        await ctx.db.insert("grades", {
          studentId: student.studentId,
          classId: student.classId,
          subjectId: classSubject[1],
          teacherId: classSubject[2],
          value: student.studentId.length % 2 === 0 ? 6 : 5,
          type: "current",
          date: date("2026-05-06"),
          notes: "Демо оценка за активно участие",
          termId: secondTermId,
          gradeType: "Проект",
        });
        await ctx.db.insert("attendance", {
          studentId: student.studentId,
          classId: student.classId,
          subjectId: classSubject[1],
          teacherId: classSubject[2],
          date: date("2026-05-07"),
          period: 2,
          status: "present",
          notes: "Демо присъствие",
        });
      }
    }

    const existingActivities = await ctx.db
      .query("extracurricularActivities")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();
    if (!existingActivities.some((activity) => activity.name === "Robotics Lab")) {
      await ctx.db.insert("extracurricularActivities", {
        name: "Robotics Lab",
        description: "Клуб по роботика с практически проекти и мини състезания.",
        teacherId: codeTeacherId,
        schoolId,
        schedule: "Вторник и четвъртък, 17:00-18:30",
        studentIds: studentRecords.slice(0, 6).map((student) => student.studentId),
        parentIds: [],
        academicYear,
        startDate: date("2025-10-01"),
        endDate: date("2026-06-15"),
        category: "STEM",
        paymentType: "paid",
        pricePerWeek: 35,
        pricePeriod: "weekly",
        capacity: 14,
        durationMinutes: 90,
        participantRoles: ["teacher", "student"],
        classIds: [juniorClassId, teenClassId],
        scheduleDays: [2, 4],
        scheduleStartTime: "17:00",
        scheduleEndTime: "18:30",
        createdBy: directorId,
        createdAt: now,
      });
    }

    const existingEvents = await ctx.db
      .query("events")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();
    if (!existingEvents.some((event) => event.title === "Демо отворен урок: AI и бъдещето на ученето")) {
      await ctx.db.insert("events", {
        title: "Демо отворен урок: AI и бъдещето на ученето",
        description: "Събитие за родители и бъдещи курсисти с демонстрация на учебен процес.",
        startDate: date("2026-05-22"),
        endDate: date("2026-05-22") + 2 * 60 * 60 * 1000,
        location: "Зала 3, Академия Вектор",
        organizerId: directorId,
        schoolId,
        invitedUserIds: users.filter((user) => user.schoolId === schoolId).map((user) => user._id),
        classIds,
        category: "Отворен урок",
        academicYear,
        isPaid: false,
        isSchoolCalendar: true,
        registrationDeadline: date("2026-05-20"),
        minRegistrants: 5,
        maxRegistrants: 60,
        locationAddress: "бул. Черни връх 42",
        locationCity: "София",
        locationDescription: "Демо кампус на Академия Вектор",
      });
    }

    const existingFees = await ctx.db
      .query("fees")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();
    if (!existingFees.some((fee) => fee.title === "Месечна такса - STEM програма")) {
      const feeId = await ctx.db.insert("fees", {
        title: "Месечна такса - STEM програма",
        description: "Демо такса за обучение, използвана само за презентация.",
        currency: "BGN",
        amount: 320,
        discountAmount: 30,
        discountValidUntil: date("2026-05-25"),
        dueDate: date("2026-06-05"),
        methods: { cash: true, online: true, bank: true },
        installmentsCount: 1,
        schoolId,
        createdBy: secretaryId,
        createdDate: now,
      });
      await ctx.db.insert("feeInstallments", {
        feeId,
        index: 1,
        amount: 320,
        dueDate: date("2026-06-05"),
      });
      const parentUsers = await ctx.db
        .query("parents")
        .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
        .collect();
      for (const parent of parentUsers.slice(0, 6)) {
        await ctx.db.insert("feeAssignments", {
          feeId,
          userId: parent.userId,
          installmentsCount: 1,
          totalAmount: 320,
          paidAmount: parentUsers.indexOf(parent) % 3 === 0 ? 320 : 0,
          status: parentUsers.indexOf(parent) % 3 === 0 ? "paid" : "read",
          assignedDate: now,
        });
      }
    }

    const existingAccounts = await ctx.db
      .query("bankAccounts")
      .withIndex("by_school", (q) => q.eq("schoolId", schoolId))
      .collect();
    if (!existingAccounts.some((account) => account.name === "Основна демо сметка")) {
      await ctx.db.insert("bankAccounts", {
        name: "Основна демо сметка",
        iban: "BG80DEMO00000000000001",
        bank: "Demo Bank",
        schoolId,
      });
    }

    const existingReports = await ctx.db
      .query("reports")
      .collect();
    if (!existingReports.some((report) => report.name === "Демо справка за активност")) {
      await ctx.db.insert("reports", {
        name: "Демо справка за активност",
        type: "general",
        elements: ["Оценки", "Присъствия", "Такси", "Извънкласни дейности"],
        scopeSchool: "Академия Вектор",
        scopeYear: academicYear,
        scopeGrades: "Всички групи",
        excludedGroups: [],
      });
    }

    return {
      schoolId,
      schoolName: school?.name ?? "Академия Вектор",
      demoPassword: "demo1234",
      demoAccounts: [
        "demo.director",
        "demo.vice",
        "demo.secretary",
        "demo.math",
        "demo.english",
        "demo.code",
        "demo.parent1",
        "demo.st01",
      ],
    };
  },
});
