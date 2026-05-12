import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
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
    teacherSubjects: v.optional(v.array(v.id("subjects"))),
    status: v.union(
      v.literal("new_inactive"),
      v.literal("inactive_entering_data"),
      v.literal("active_awaiting_parent_approval"),
      v.literal("active_unconfirmed_email"),
      v.literal("active")
    ),
    schoolId: v.optional(v.id("schools")),
    isActive: v.boolean(),
    username: v.optional(v.string()),
    firstName: v.optional(v.string()),
    middleName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("other"))),
    birthDate: v.optional(v.string()),
    birthPlace: v.optional(v.string()),
    parent1Name: v.optional(v.string()),
    parent2Name: v.optional(v.string()),
    scientificTitle: v.optional(v.string()),
    password: v.optional(v.string()),
    twoFactorEnabled: v.optional(v.boolean()),
    twoFactorCode: v.optional(v.string()),
    twoFactorCodeExpiry: v.optional(v.number()),
    avatarStorageId: v.optional(v.id("_storage")),
    isDeleted: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
    // Identifier fields
    identifier: v.optional(v.string()),
    identifierType: v.optional(v.union(v.literal("egn"), v.literal("lnch"), v.literal("other"))),
    citizenship: v.optional(v.string()),
    // Длъжност (за персонал)
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
    teachingSubjects: v.optional(v.array(v.string())),
    classId: v.optional(v.id("classes")),
    // Личен лекар (за ученици)
    personalDoctor: v.optional(v.string()),
    // Адрес
    address: v.optional(v.string()),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_school", ["schoolId"])
    .index("by_role", ["role"]),

  schools: defineTable({
    name: v.string(),
    shortName: v.optional(v.string()),
    schoolType: v.optional(v.string()), // Вид
    ownership: v.optional(v.string()), // Тип
    isCentral: v.optional(v.boolean()), // Средищно училище
    isProtected: v.optional(v.boolean()), // Защитено училище
    isInnovative: v.optional(v.boolean()), // Иновативно училище
    isStateFunded: v.optional(v.boolean()), // На държавно финансиране
    isNationalImportance: v.optional(v.boolean()), // От национално значение
    providesProfessionalTraining: v.optional(v.boolean()), // Осигурява професионална подготовка
    fundingSource: v.optional(v.string()), // Финансира се от
    isDelegatedBudget: v.optional(v.boolean()), // На делегиран бюджет
    approvedBudget: v.optional(v.string()), // Утвърден бюджет за текущата календарна година
    createdByInternationalAgreement: v.optional(v.boolean()), // Създадено по силата на международен договор
    city: v.optional(v.string()), // Населено място
    district: v.optional(v.string()), // Район
    address: v.optional(v.string()),
    postalCode: v.optional(v.string()), // Пощенски код
    phone: v.optional(v.string()),
    phone2: v.optional(v.string()), // Телефон №2
    fax: v.optional(v.string()),
    website: v.optional(v.string()), // Уеб сайт
    email: v.optional(v.string()),
    email2: v.optional(v.string()), // Ел. поща №2
    neispuoCode: v.optional(v.string()), // НЕИСПУО код
    iban: v.optional(v.string()), // Банкова сметка IBAN
    bank: v.optional(v.string()), // Банка
    bic: v.optional(v.string()), // BIC
    accountHolder: v.optional(v.string()), // Титуляр на сметката
    principalId: v.optional(v.id("users")),
    // Leadership positions (Ръководство)
    leadershipPositions: v.optional(v.array(v.object({
      positionTitle: v.string(), // "Директор", "Зам. директор # 1", etc.
      userId: v.optional(v.id("users")),
      isHidden: v.optional(v.boolean()),
    }))),
    // Custom data fields (Други данни)
    customData: v.optional(v.array(v.object({
      label: v.string(), // "Информация"
      value: v.string(), // "Отговор"
      isHidden: v.optional(v.boolean()),
    }))),
    // Visibility settings for standard fields
    hiddenFields: v.optional(v.array(v.string())), // Array of field names that are hidden
    settings: v.optional(
      v.object({
        allowGradeEditing: v.boolean(),
        allowAttendanceEditing: v.boolean(),
      })
    ),
  }),

  classes: defineTable({
    name: v.string(), // "8А"
    grade: v.number(), // 8
    letter: v.string(), // "А"
    schoolId: v.id("schools"),
    classTeacherId: v.optional(v.id("users")),
    diaryType: v.string(), // "V–XII клас (3-87)"
    shiftNumber: v.union(v.literal(1), v.literal(2)),
    academicYear: v.string(), // "2024/2025"
    organizationalForm: v.optional(v.string()), // "class", "group", "combined"
    admissionAfter: v.optional(v.string()), // "none", "kindergarten", "primary", "secondary"
    educationForm: v.optional(v.string()), // "daily", "evening", "distance"
    organizationOfDay: v.optional(v.string()), // "shift1", "shift2", "fullDay"
    financedBy: v.optional(v.string()), // "state", "municipal", "private", "mixed"
    isMerged: v.optional(v.boolean()), // Сляла паралелка
    isSpecial: v.optional(v.boolean()), // Специална паралелка/група (за деца със СОП)
    preparationType: v.optional(v.string()), // "unprofiled", "profiled", "specialized"
  })
    .index("by_school", ["schoolId"])
    .index("by_class_teacher", ["classTeacherId"])
    .index("by_academic_year", ["academicYear"]),

  subjects: defineTable({
    name: v.string(),
    shortName: v.string(),
    group: v.optional(v.string()),
    isPrimary: v.boolean(),
    schoolId: v.id("schools"),
  }).index("by_school", ["schoolId"]),

  teachers: defineTable({
    userId: v.id("users"),
    schoolId: v.id("schools"),
    specialization: v.optional(v.string()),
    hasLeft: v.boolean(), // НАПУСНАЛ
  })
    .index("by_user", ["userId"])
    .index("by_school", ["schoolId"]),

  students: defineTable({
    userId: v.id("users"),
    classId: v.id("classes"),
    schoolId: v.id("schools"),
    studentNumber: v.optional(v.number()),
    enrollmentDate: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_class", ["classId"])
    .index("by_school", ["schoolId"]),

  parents: defineTable({
    userId: v.id("users"),
    studentIds: v.array(v.id("students")),
    schoolId: v.optional(v.id("schools")),
  })
    .index("by_user", ["userId"])
    .index("by_school", ["schoolId"]),

  classSubjects: defineTable({
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    teacherId: v.id("teachers"),
    hoursPerWeek: v.number(),
    academicYear: v.string(),
    preparationType: v.optional(v.string()), // ЗП, ООП, ЗИП, ИУЧ, etc.
  })
    .index("by_class", ["classId"])
    .index("by_subject", ["subjectId"])
    .index("by_teacher", ["teacherId"]),

  schedules: defineTable({
    classId: v.id("classes"),
    dayOfWeek: v.number(), // 1-5
    period: v.number(), // час 1-7
    subjectId: v.id("subjects"),
    teacherId: v.id("teachers"),
    room: v.optional(v.string()),
    weekType: v.optional(v.union(v.literal("odd"), v.literal("even"))),
    termId: v.optional(v.id("terms")),
  })
    .index("by_class", ["classId"])
    .index("by_teacher", ["teacherId"])
    .index("by_day", ["dayOfWeek"]),

  terms: defineTable({
    name: v.string(), // "Първи срок"
    schoolId: v.id("schools"),
    startDate: v.number(),
    endDate: v.number(),
    academicYear: v.string(),
  })
    .index("by_school", ["schoolId"])
    .index("by_academic_year", ["academicYear"]),

  nonSchoolDays: defineTable({
    name: v.string(), // "Коледна ваканция"
    startDate: v.number(),
    endDate: v.number(),
    category: v.string(),
    schoolId: v.id("schools"),
    appliesToAllClasses: v.boolean(),
    classIds: v.optional(v.array(v.id("classes"))),
  })
    .index("by_school", ["schoolId"])
    .index("by_start_date", ["startDate"]),

  grades: defineTable({
    studentId: v.id("students"),
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    teacherId: v.id("teachers"),
    value: v.union(
      v.number(), // 2-6
      v.literal("absent")
    ),
    type: v.union(
      v.literal("current"),
      v.literal("term"),
      v.literal("final")
    ),
    date: v.number(),
    notes: v.optional(v.string()),
    termId: v.optional(v.id("terms")),
    gradeType: v.optional(v.string()), // Тип на оценката: "Тест", "Класна работа", "Устно изпитване", etc.
    lessonId: v.optional(v.id("lessons")),
    isFinalized: v.optional(v.boolean()), // Дали срочната оценка е финализирана
  })
    .index("by_student", ["studentId"])
    .index("by_class", ["classId"])
    .index("by_subject", ["subjectId"])
    .index("by_teacher", ["teacherId"])
    .index("by_date", ["date"])
    .index("by_lesson", ["lessonId"]),

  attendance: defineTable({
    studentId: v.id("students"),
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    teacherId: v.id("teachers"),
    date: v.number(),
    period: v.number(),
    status: v.union(
      v.literal("present"),
      v.literal("absent"),
      v.literal("late"),
      v.literal("excused")
    ),
    notes: v.optional(v.string()),
  })
    .index("by_student", ["studentId"])
    .index("by_class", ["classId"])
    .index("by_date", ["date"]),

  assignments: defineTable({
    classId: v.optional(v.id("classes")),
    subjectId: v.optional(v.id("subjects")),
    teacherId: v.id("teachers"),
    title: v.string(),
    type: v.string(), // "Домашно", "Контролна работа", "Проект", etc.
    description: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("not_completed")
    ),
    dueDate: v.optional(v.number()),
    assignedDate: v.number(),
    // Target type: "class" or "activity"
    targetType: v.optional(v.union(v.literal("class"), v.literal("activity"))),
    extracurricularActivityId: v.optional(v.id("extracurricularActivities")),
    // Extended mode fields
    isExtended: v.optional(v.boolean()),
    activeFrom: v.optional(v.number()),
    activeTo: v.optional(v.number()),
    isGroupTask: v.optional(v.boolean()),
    fileIds: v.optional(v.array(v.id("_storage"))),
    participantIds: v.optional(v.array(v.id("users"))),
  })
    .index("by_teacher", ["teacherId"])
    .index("by_due_date", ["dueDate"]),

  // Assignment participants with individual status tracking
  assignmentParticipants: defineTable({
    assignmentId: v.id("assignments"),
    userId: v.id("users"),
    status: v.union(
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("not_completed")
    ),
    seenAt: v.optional(v.number()),
  })
    .index("by_assignment", ["assignmentId"])
    .index("by_user", ["userId"]),

  remarks: defineTable({
    studentId: v.id("students"),
    teacherId: v.id("teachers"),
    classId: v.id("classes"),
    type: v.union(v.literal("praise"), v.literal("warning")),
    content: v.string(),
    date: v.number(),
    subjectId: v.optional(v.id("subjects")),
    badgeType: v.optional(v.string()), // Тип на значката: "general_remark", "bad_discipline", etc.
  })
    .index("by_student", ["studentId"])
    .index("by_teacher", ["teacherId"])
    .index("by_date", ["date"]),

  absences: defineTable({
    teacherId: v.id("teachers"),
    title: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    workingDays: v.number(), // Брой работни дни
    reason: v.string(),
    isApproved: v.boolean(),
    createdBy: v.optional(v.id("users")), // Кой потребител е създал отсъствието
    substitutionType: v.union(
      v.literal("none"),           // Без заместващ
      v.literal("single"),         // Един заместващ
      v.literal("multiple")        // Няколко заместващи
    ),
    substitutions: v.optional(v.array(v.object({
      subjectId: v.optional(v.id("subjects")), // За multiple - за кой предмет е заместването
      teacherId: v.optional(v.id("teachers")), // Кой учител замества (optional за свободни часове)
      classId: v.optional(v.id("classes")),    // За multiple - за кой клас е заместването
      dayOfWeek: v.optional(v.number()),       // За multiple - ден от седмицата (1=Mon, 5=Fri)
      periodIndex: v.optional(v.number()),     // За multiple - номер на часа
      date: v.optional(v.number()),            // За multiple - конкретна дата
      isCivicEducation: v.optional(v.boolean()), // Дали е Гражданско образование
      isFree: v.optional(v.boolean()),         // Дали е свободен час (без заместник)
    }))),
  })
    .index("by_teacher", ["teacherId"])
    .index("by_start_date", ["startDate"]),

  substitutions: defineTable({
    absenceId: v.id("absences"),
    absentTeacherId: v.id("teachers"),
    substituteTeacherId: v.id("teachers"),
    title: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    reason: v.string(),
    status: v.union(v.literal("pending"), v.literal("confirmed"), v.literal("completed")),
  })
    .index("by_absence", ["absenceId"])
    .index("by_substitute", ["substituteTeacherId"])
    .index("by_absent_teacher", ["absentTeacherId"])
    .index("by_start_date", ["startDate"]),

  extraHours: defineTable({
    teacherId: v.id("teachers"),
    title: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    workingDays: v.number(),
    isApproved: v.boolean(),
  })
    .index("by_teacher", ["teacherId"])
    .index("by_start_date", ["startDate"]),

  extracurricularActivities: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    teacherId: v.id("teachers"),
    schoolId: v.id("schools"),
    schedule: v.optional(v.string()),
    studentIds: v.array(v.id("students")),
    parentIds: v.optional(v.array(v.id("users"))), // Родители, свързани с дейността
    academicYear: v.string(),
    // New fields
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    category: v.optional(v.string()), // Бойни изкуства, ИТ, Култура, Музика, etc.
    paymentType: v.optional(v.union(v.literal("free"), v.literal("paid"))),
    pricePerWeek: v.optional(v.number()), // Цена в EUR (ако е платено)
    pricePeriod: v.optional(v.union(v.literal("weekly"), v.literal("monthly"))), // Период на цената
    capacity: v.optional(v.number()), // Капацитет
    durationMinutes: v.optional(v.number()), // Продължителност в минути
    participantRoles: v.optional(v.array(v.union(v.literal("teacher"), v.literal("student")))),
    classIds: v.optional(v.array(v.id("classes"))), // Множество класове
    // Schedule days and times
    scheduleDays: v.optional(v.array(v.number())), // Дни от седмицата (1=Понеделник, 5=Петък)
    scheduleStartTime: v.optional(v.string()), // Начален час "14:00"
    scheduleEndTime: v.optional(v.string()), // Краен час "16:00"
    isDeleted: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
    createdBy: v.optional(v.id("users")),
    createdAt: v.optional(v.number()),
    lastEditedBy: v.optional(v.id("users")),
    lastEditedAt: v.optional(v.number()),
  })
    .index("by_teacher", ["teacherId"])
    .index("by_school", ["schoolId"]),

  events: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.number(),
    location: v.optional(v.string()),
    organizerId: v.id("users"),
    schoolId: v.id("schools"),
    invitedUserIds: v.array(v.id("users")),
    classIds: v.optional(v.array(v.id("classes"))), // Паралелки
    category: v.string(),
    academicYear: v.optional(v.string()),
    isPaid: v.optional(v.boolean()),
    isSchoolCalendar: v.optional(v.boolean()),
    registrationDeadline: v.optional(v.number()),
    minRegistrants: v.optional(v.number()),
    maxRegistrants: v.optional(v.number()),
    fileIds: v.optional(v.array(v.id("_storage"))),
    locationAddress: v.optional(v.string()),
    locationCity: v.optional(v.string()),
    locationDescription: v.optional(v.string()),
  })
    .index("by_organizer", ["organizerId"])
    .index("by_school", ["schoolId"])
    .index("by_start_date", ["startDate"]),

  eventConfirmations: defineTable({
    eventId: v.id("events"),
    userId: v.id("users"),
    status: v.union(
      v.literal("seen"),
      v.literal("confirmed"),
      v.literal("declined")
    ),
    seenAt: v.optional(v.number()),
    respondedAt: v.optional(v.number()),
  })
    .index("by_event", ["eventId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  parentMeetings: defineTable({
    classId: v.id("classes"),
    title: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    createdById: v.id("users"),
    createdAt: v.number(),
    location: v.optional(v.string()),
    description: v.optional(v.string()),
  })
    .index("by_class", ["classId"])
    .index("by_start_date", ["startDate"]),

  competitions: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    date: v.number(),
    location: v.optional(v.string()),
    schoolId: v.id("schools"),
    subjectId: v.optional(v.id("subjects")),
    participantIds: v.array(v.id("students")),
  })
    .index("by_school", ["schoolId"])
    .index("by_date", ["date"]),

  competitionResults: defineTable({
    competitionId: v.id("competitions"),
    studentId: v.id("students"),
    place: v.number(),
    points: v.optional(v.number()),
    award: v.optional(v.string()),
  })
    .index("by_competition", ["competitionId"])
    .index("by_student", ["studentId"]),

  rooms: defineTable({
    name: v.string(),
    floor: v.number(),
    capacity: v.optional(v.number()),
    schoolId: v.id("schools"),
  }).index("by_school", ["schoolId"]),

  assets: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    roomId: v.optional(v.id("rooms")),
    quantity: v.number(),
    unit: v.string(),
    schoolId: v.id("schools"),
    supplierId: v.optional(v.id("suppliers")),
    accountNumber: v.optional(v.string()),
    purchaseDate: v.optional(v.number()),
    value: v.optional(v.number()),
  })
    .index("by_room", ["roomId"])
    .index("by_school", ["schoolId"]),

  suppliers: defineTable({
    name: v.string(),
    contact: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    schoolId: v.id("schools"),
  }).index("by_school", ["schoolId"]),

  fees: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    currency: v.union(v.literal("BGN"), v.literal("EUR"), v.literal("USD")),
    amount: v.number(),
    discountAmount: v.optional(v.number()),
    discountValidUntil: v.optional(v.number()),
    dueDate: v.number(),
    methods: v.object({
      cash: v.boolean(),
      online: v.boolean(),
      bank: v.boolean(),
    }),
    installmentsCount: v.number(),
    schoolId: v.id("schools"),
    createdBy: v.id("users"),
    createdDate: v.number(),
  })
    .index("by_school", ["schoolId"])
    .index("by_due_date", ["dueDate"]),

  feeInstallments: defineTable({
    feeId: v.id("fees"),
    index: v.number(), // Вноска № (1, 2, 3...)
    amount: v.number(),
    dueDate: v.number(),
  })
    .index("by_fee", ["feeId"])
    .index("by_due_date", ["dueDate"]),

  feeAssignments: defineTable({
    feeId: v.id("fees"),
    userId: v.id("users"),
    installmentsCount: v.number(),
    totalAmount: v.number(),
    paidAmount: v.number(), // Сума за плащане (за таблицата)
    status: v.union(
      v.literal("unread"),
      v.literal("read"),
      v.literal("paid")
    ),
    assignedDate: v.number(),
  })
    .index("by_fee", ["feeId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  payments: defineTable({
    feeId: v.id("fees"),
    userId: v.id("users"),
    amount: v.number(),
    paymentDate: v.number(),
    method: v.string(),
    status: v.union(v.literal("paid"), v.literal("pending"), v.literal("failed")),
    notes: v.optional(v.string()),
  })
    .index("by_fee", ["feeId"])
    .index("by_user", ["userId"])
    .index("by_date", ["paymentDate"]),

  bankAccounts: defineTable({
    name: v.string(),
    iban: v.string(),
    bank: v.string(),
    schoolId: v.id("schools"),
  }).index("by_school", ["schoolId"]),

  documents: defineTable({
    title: v.string(),
    type: v.union(
      v.literal("student_document"),
      v.literal("protocol"),
      v.literal("order"),
      v.literal("correspondence")
    ),
    studentId: v.optional(v.id("students")),
    schoolId: v.id("schools"),
    issuedBy: v.id("users"),
    issuedDate: v.number(),
    lastEditedBy: v.optional(v.id("users")),
    lastEditedDate: v.optional(v.number()),
    content: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
  })
    .index("by_student", ["studentId"])
    .index("by_school", ["schoolId"])
    .index("by_type", ["type"]),

  evaluationTemplates: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    schoolId: v.id("schools"),
    criteria: v.array(
      v.object({
        name: v.string(),
        weight: v.number(),
        description: v.optional(v.string()),
      })
    ),
  }).index("by_school", ["schoolId"]),

  evaluations: defineTable({
    templateId: v.id("evaluationTemplates"),
    evaluatedUserId: v.id("users"),
    evaluatorId: v.id("users"),
    schoolId: v.id("schools"),
    date: v.number(),
    scores: v.array(
      v.object({
        criteriaName: v.string(),
        score: v.number(),
      })
    ),
    notes: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("submitted"), v.literal("approved")),
  })
    .index("by_evaluated", ["evaluatedUserId"])
    .index("by_evaluator", ["evaluatorId"])
    .index("by_school", ["schoolId"]),

  curriculumPlans: defineTable({
    title: v.string(),
    grade: v.number(),
    schoolId: v.id("schools"),
    addedBy: v.id("users"),
    addedDate: v.number(),
    content: v.optional(v.string()),
    // New fields for thematic distributions
    subjectId: v.optional(v.id("subjects")),
    publisher: v.optional(v.string()), // Издателство
    visibility: v.optional(v.union(
      v.literal("public"), // Публично достъпно
      v.literal("school"), // Само за моето училище
      v.literal("private") // Само за мен
    )),
    topics: v.optional(v.array(v.object({
      number: v.number(), // №
      week: v.number(), // Седм.
      title: v.string(), // Тема
      type: v.string(), // Вид (НЗ - Нови знания, etc.)
      notes: v.optional(v.string()), // Бележки
    }))),
  })
    .index("by_school", ["schoolId"])
    .index("by_grade", ["grade"])
    .index("by_subject", ["subjectId"])
    .index("by_added_by", ["addedBy"]),

  messages: defineTable({
    fromUserId: v.id("users"),
    toUserIds: v.array(v.id("users")),
    subject: v.string(),
    content: v.string(),
    sentDate: v.number(),
    readBy: v.array(v.id("users")),
    schoolId: v.id("schools"),
  })
    .index("by_from", ["fromUserId"])
    .index("by_school", ["schoolId"])
    .index("by_sent_date", ["sentDate"]),

  subscriptions: defineTable({
    schoolId: v.id("schools"),
    planType: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    isActive: v.boolean(),
    features: v.array(v.string()),
  })
    .index("by_school", ["schoolId"])
    .index("by_active", ["isActive"]),

  dayRegimes: defineTable({
    name: v.string(),
    shift: v.union(v.literal(1), v.literal(2), v.literal("none")),
    startTime: v.string(), // "07:30"
    endTime: v.string(), // "13:20"
    periodCount: v.number(),
    schoolId: v.id("schools"),
    academicYear: v.string(),
    // Detailed periods with individual start/end times
    periods: v.optional(v.array(v.object({
      periodNumber: v.number(), // 1, 2, 3...
      startTime: v.string(), // "07:30"
      duration: v.number(), // minutes (e.g., 40)
      endTime: v.string(), // "08:10"
    }))),
    // Toggle for using different regimes per period
    hasDifferentRegimes: v.optional(v.boolean()),
  })
    .index("by_school", ["schoolId"])
    .index("by_academic_year", ["academicYear"]),

  dayRegimeAssignments: defineTable({
    dayRegimeId: v.id("dayRegimes"),
    classId: v.id("classes"),
    termId: v.optional(v.id("terms")),
    academicYear: v.string(),
  })
    .index("by_day_regime", ["dayRegimeId"])
    .index("by_class", ["classId"])
    .index("by_academic_year", ["academicYear"]),

  weeklySchedules: defineTable({
    classId: v.id("classes"),
    termId: v.optional(v.id("terms")),
    dayRegimeId: v.optional(v.id("dayRegimes")),
    weekCount: v.number(),
    academicYear: v.string(),
    schoolId: v.id("schools"),
    // Term period dates (legacy - for backward compatibility)
    startDate: v.optional(v.string()), // Start date of the period (ISO format)
    endDate: v.optional(v.string()), // End date of the period (ISO format)
    // Term 1 dates
    term1StartDate: v.optional(v.string()),
    term1EndDate: v.optional(v.string()),
    // Term 2 dates
    term2StartDate: v.optional(v.string()),
    term2EndDate: v.optional(v.string()),
    entries: v.array(
      v.object({
        dayOfWeek: v.number(), // 1-5 (Monday-Friday)
        periodIndex: v.number(), // 1-7+
        subjectId: v.id("subjects"),
        teacherId: v.id("teachers"),
        roomId: v.optional(v.id("rooms")),
        preparationType: v.optional(v.string()), // Вид подготовка: ЗП, ООП, ИУЧ, etc.
        weekNumbers: v.optional(v.array(v.number())), // Which weeks this entry applies to (empty/undefined = all weeks)
        groupId: v.optional(v.id("classGroups")), // Optional reference to a class group
      })
    ),
    // Tracking fields
    createdBy: v.optional(v.id("users")), // Кой е създал разписанието
    lastEditedAt: v.optional(v.number()), // Кога е редактирано последно
    lastEditedBy: v.optional(v.id("users")), // От кого е редактирано последно
  })
    .index("by_class", ["classId"])
    .index("by_school", ["schoolId"])
    .index("by_academic_year", ["academicYear"]),

  lessons: defineTable({
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    teacherId: v.id("teachers"),
    date: v.number(),
    periodIndex: v.number(),
    groupId: v.optional(v.id("classGroups")), // Група от разписанието (ако е назначена)
    topic: v.optional(v.string()),
    homework: v.optional(v.string()),
    hasUnsavedChanges: v.boolean(),
    confirmedNoAbsences: v.optional(v.boolean()),
    isTaken: v.boolean(), // Часът е взет
    markedAsTakenAt: v.optional(v.number()), // Кога е маркиран като взет (timestamp)
    markedAsTakenBy: v.optional(v.id("users")), // От кого е маркиран като взет
    isVerified: v.optional(v.boolean()), // Часът е проверен от админ/директор
    isNotConducted: v.optional(v.boolean()), // Часът не е проведен
    educationType: v.union(
      v.literal("inPerson"), // Присъствено обучение
      v.literal("online") // Онлайн обучение (ОРЕС)
    ),
    lessonType: v.optional(v.string()), // Вид урок
    // Tracking fields for creation and edits
    createdBy: v.optional(v.id("users")), // Кой е създал записа
    lastEditedAt: v.optional(v.number()), // Кога е редактиран последно
    lastEditedBy: v.optional(v.id("users")), // От кого е редактиран последно
  })
    .index("by_class", ["classId"])
    .index("by_teacher", ["teacherId"])
    .index("by_date", ["date"]),

  badges: defineTable({
    studentId: v.id("students"),
    teacherId: v.id("teachers"),
    lessonId: v.optional(v.id("lessons")),
    type: v.union(
      // Похвали (Praises) - 20 типа
      v.literal("general_praise"),           // Обща похвала
      v.literal("active_participation"),     // Активно участие
      v.literal("excellent_presentation"),   // Отлично представяне
      v.literal("completed_task"),           // Изпълнена задача
      v.literal("curiosity"),                // Любознателност
      v.literal("diligence"),                // Старание
      v.literal("progress"),                 // Напредък
      v.literal("communication"),            // Комуникативност
      v.literal("sharp_mind"),               // Остър ум
      v.literal("concentration"),            // Концентрация
      v.literal("creativity"),               // Креативност
      v.literal("teamwork"),                 // Екипна работа
      v.literal("leadership"),               // Лидерство
      v.literal("patriotism"),               // Патриотизъм
      v.literal("tolerance"),                // Толерантност
      v.literal("emotional_intelligence"),   // Емоционална интелигентност
      v.literal("presentation_skills"),      // Презентационни умения
      v.literal("digital_skills"),           // Дигитални умения
      v.literal("musical_culture"),          // Музикална култура
      v.literal("physical_culture"),         // Физическа култура
      // Забележки (Remarks) - 20 типа
      v.literal("general_remark"),           // Обща забележка
      v.literal("bad_discipline"),           // Лоша дисциплина
      v.literal("lack_of_attention"),        // Липса на внимание
      v.literal("official_remark"),          // Официална забележка
      v.literal("disrespect"),               // Неуважение
      v.literal("aggression"),               // Агресия
      v.literal("removed_from_class"),       // Отстранен от час
      v.literal("late"),                     // Закъснение
      v.literal("absence"),                  // Отсъствие
      v.literal("poor_performance"),         // Слабо представяне
      v.literal("unprepared"),               // Без подготовка
      v.literal("no_homework"),              // Без домашна работа
      v.literal("no_textbook"),              // Без учебно помагало
      v.literal("no_materials"),             // Без учебни пособия
      v.literal("no_equipment"),             // Без екип
      v.literal("no_uniform"),               // Без униформа
      v.literal("breakfast"),                // Закуска
      v.literal("lunch"),                    // Обяд
      v.literal("afternoon_sleep"),          // Следобеден сън
      v.literal("afternoon_snack")           // Следобедна закуска
    ),
    date: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_student", ["studentId"])
    .index("by_teacher", ["teacherId"])
    .index("by_lesson", ["lessonId"])
    .index("by_date", ["date"]),

  curriculumTopics: defineTable({
    subjectId: v.id("subjects"),
    classId: v.id("classes"),
    title: v.string(),
    description: v.optional(v.string()),
    topicNumber: v.number(), // № на темата
    weekNumber: v.number(), // Седмица
    topicType: v.string(), // Вид: ОС, НЗ, УУ, etc.
    isCovered: v.boolean(),
    coveredDate: v.optional(v.number()),
    coveredByLessonId: v.optional(v.id("lessons")),
    academicYear: v.string(),
    preparationType: v.optional(v.string()), // ЗП, ИУЧ, ФУЧ, etc. - separates topics by preparation type
  })
    .index("by_subject", ["subjectId"])
    .index("by_class", ["classId"])
    .index("by_covered", ["isCovered"])
    .index("by_class_and_subject", ["classId", "subjectId"]),

  classDiaryExports: defineTable({
    classId: v.id("classes"),
    generatedAt: v.number(),
    uploadedToNEISPUO: v.boolean(),
    locked: v.boolean(),
    schoolId: v.id("schools"),
    academicYear: v.string(),
    generatedBy: v.id("users"),
  })
    .index("by_class", ["classId"])
    .index("by_school", ["schoolId"])
    .index("by_academic_year", ["academicYear"]),

  studentDocuments: defineTable({
    type: v.string(), // "Свидетелство", "Удостоверение", etc.
    studentId: v.id("students"),
    classId: v.id("classes"),
    issuedBy: v.id("users"),
    issuedDate: v.number(),
    lastEditedBy: v.optional(v.id("users")),
    lastEditedDate: v.optional(v.number()),
    createdBy: v.id("users"),
    createdDate: v.number(),
    schoolId: v.id("schools"),
    academicYear: v.string(),
  })
    .index("by_student", ["studentId"])
    .index("by_class", ["classId"])
    .index("by_school", ["schoolId"])
    .index("by_academic_year", ["academicYear"]),

  loginHistory: defineTable({
    userId: v.id("users"),
    timestamp: v.number(),
    logoutTimestamp: v.optional(v.number()),
    sessionType: v.optional(v.union(
      v.literal("hercules_auth"),
      v.literal("preauth"),
      v.literal("logout")
    )),
    device: v.optional(v.string()),
    browser: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_timestamp", ["timestamp"]),

  chats: defineTable({
    type: v.union(v.literal("direct"), v.literal("group")),
    name: v.optional(v.string()), // За групови чатове
    imageStorageId: v.optional(v.id("_storage")), // Снимка на групата
    participantIds: v.array(v.id("users")),
    createdBy: v.id("users"),
    schoolId: v.optional(v.id("schools")),
    lastMessageAt: v.optional(v.number()),
  })
    .index("by_participant", ["participantIds"])
    .index("by_created_by", ["createdBy"])
    .index("by_school", ["schoolId"])
    .index("by_last_message", ["lastMessageAt"]),

  chatMessages: defineTable({
    chatId: v.id("chats"),
    senderId: v.id("users"),
    content: v.string(),
    readBy: v.array(v.id("users")),
    // File attachments
    attachments: v.optional(v.array(v.object({
      storageId: v.id("_storage"),
      fileName: v.string(),
      fileType: v.string(),
      fileSize: v.number(),
    }))),
  })
    .index("by_chat", ["chatId"])
    .index("by_sender", ["senderId"]),

  // AUDIT LOG - Записва всички критични операции
  auditLog: defineTable({
    userId: v.id("users"),
    action: v.string(), // "create_user", "delete_user", "update_grade", etc.
    targetType: v.optional(v.string()), // "user", "grade", "document", etc.
    targetId: v.optional(v.string()),
    details: v.optional(v.string()), // JSON string с допълнителни детайли
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    schoolId: v.optional(v.id("schools")),
  })
    .index("by_user", ["userId"])
    .index("by_action", ["action"])
    .index("by_school", ["schoolId"]),

  // RATE LIMITING - За всички критични операции
  rateLimits: defineTable({
    userId: v.id("users"),
    action: v.string(), // "create_grade", "delete_user", etc.
    timestamp: v.number(),
    count: v.number(),
  })
    .index("by_user_and_action", ["userId", "action"])
    .index("by_timestamp", ["timestamp"]),

  // FILE UPLOADS - Метаданни за качени файлове
  fileUploads: defineTable({
    storageId: v.id("_storage"),
    uploadedBy: v.id("users"),
    fileName: v.string(),
    fileSize: v.number(), // bytes
    mimeType: v.string(),
    category: v.string(), // "document", "avatar", "attachment"
    relatedTo: v.optional(v.string()), // "student_123", "document_456"
    schoolId: v.optional(v.id("schools")),
    isScanned: v.boolean(), // Дали е сканиран за вируси
    scanResult: v.optional(v.string()),
  })
    .index("by_uploaded_by", ["uploadedBy"])
    .index("by_storage_id", ["storageId"])
    .index("by_school", ["schoolId"]),

  reports: defineTable({
    name: v.string(),
    type: v.string(),
    elements: v.array(v.string()),
    scopeSchool: v.string(),
    scopeYear: v.string(),
    scopeGrades: v.string(),
    excludedGroups: v.array(v.string()),
    // Subject-based data (old format)
    data: v.optional(v.array(
      v.object({
        subject: v.string(),
        testedStudents: v.number(),
        grade2: v.number(),
        grade3: v.number(),
        grade4: v.number(),
        grade5: v.number(),
        grade6: v.number(),
        averageGrade: v.string(),
      })
    )),
    // Student-based data (new format)
    studentData: v.optional(v.array(
      v.object({
        classId: v.optional(v.id("classes")),
        className: v.string(),
        studentNumber: v.number(),
        studentId: v.id("users"),
        studentName: v.string(),
        averageGrade: v.string(),
        gradesCount: v.number(),
      })
    )),
    // Subject summary for sidebar
    subjectSummary: v.optional(v.array(
      v.object({
        subjectId: v.optional(v.id("subjects")),
        subjectName: v.string(),
        gradesCount: v.number(),
      })
    )),
    // Dynamic report data (newest format)
    dynamicColumns: v.optional(v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        type: v.union(v.literal("text"), v.literal("number"), v.literal("badge")),
      })
    )),
    dynamicRows: v.optional(v.array(v.any())),
    dynamicSummary: v.optional(v.any()),
  }),

  notifications: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("new_grade"),
      v.literal("new_absence"),
      v.literal("new_late"),
      v.literal("new_excused"),
      v.literal("new_praise"),
      v.literal("new_warning"),
      v.literal("teacher_absence_approved"),
      v.literal("teacher_substitution"),
      v.literal("new_event"),
      v.literal("new_assignment"),
      v.literal("new_message"),
      v.literal("new_homework"),
      v.literal("admin_alert"),
      v.literal("grade_delete_request"),
      v.literal("grade_delete_approved"),
      v.literal("grade_delete_rejected"),
      v.literal("new_student_support"),
      v.literal("new_parent_meeting")
    ),
    title: v.string(),
    message: v.string(),
    isRead: v.boolean(),
    relatedEntityType: v.optional(v.string()), // "grade", "attendance", "remark", etc.
    relatedEntityId: v.optional(v.string()),
    actionUrl: v.optional(v.string()), // URL to navigate to
    schoolId: v.optional(v.id("schools")),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_read", ["userId", "isRead"])
    .index("by_school", ["schoolId"]),

  // Конфигурации на учебни срокове по паралелки
  classTermConfigurations: defineTable({
    classId: v.id("classes"),
    termCount: v.number(), // Брой срокове (1-4)
    terms: v.array(v.object({
      termNumber: v.number(), // 1, 2, 3, 4
      startDate: v.string(), // ISO date string
      endDate: v.string(), // ISO date string
    })),
    academicYear: v.string(),
    schoolId: v.id("schools"),
  })
    .index("by_class", ["classId"])
    .index("by_school", ["schoolId"])
    .index("by_academic_year", ["academicYear"]),

  // Ученическа подкрепа (Student Support)
  studentSupport: defineTable({
    studentId: v.id("students"),
    classId: v.id("classes"),
    schoolId: v.id("schools"),
    reason: v.string(), // Основание: Затруднения в обучението, Рискови фактори, etc.
    activity: v.string(), // Дейност: (Обща подкрепа) Консултация, etc.
    date: v.number(), // Дата
    subjectId: v.optional(v.id("subjects")), // Предмет (optional)
    teacherId: v.id("teachers"), // Учител
    // Legacy fields (kept for backwards compatibility)
    supportType: v.optional(v.string()), // Deprecated - use activity
    description: v.optional(v.string()),
    startDate: v.optional(v.number()), // Deprecated - use date
    endDate: v.optional(v.number()),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    createdBy: v.id("users"),
    createdAt: v.number(),
    lastEditedBy: v.optional(v.id("users")),
    lastEditedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_student", ["studentId"])
    .index("by_class", ["classId"])
    .index("by_school", ["schoolId"])
    .index("by_status", ["status"]),

  // ВЧК (Втори час на класа) - часове за консултации
  internalCommission: defineTable({
    classId: v.id("classes"),
    schoolId: v.id("schools"),
    type: v.union(
      v.literal("student_consultation"),
      v.literal("parent_consultation"),
      v.literal("school_documentation")
    ),
    startDate: v.number(), // Начало
    endDate: v.number(), // Край
    roomId: v.optional(v.id("rooms")), // Стая
    teacherId: v.id("users"), // Учител
    description: v.optional(v.string()), // Описание
    createdBy: v.id("users"),
    createdAt: v.number(),
    lastEditedBy: v.optional(v.id("users")),
    lastEditedAt: v.optional(v.number()),
  })
    .index("by_class", ["classId"])
    .index("by_school", ["schoolId"])
    .index("by_teacher", ["teacherId"]),

  // Санкции (Sanctions) - ученически санкции
  sanctions: defineTable({
    studentId: v.id("students"),
    classId: v.id("classes"),
    schoolId: v.id("schools"),
    sanctionType: v.string(), // Тип на санкцията (чл. 199 ал. 1 т. 1 Забележка, etc.)
    orderNumber: v.string(), // Номер на заповед
    orderDate: v.number(), // Дата на заповед
    reason: v.string(), // Основание (до 15000 символа)
    startDate: v.number(), // Начало на санкцията
    endDate: v.optional(v.number()), // Край на санкцията
    fileIds: v.optional(v.array(v.id("_storage"))), // Прикачени файлове
    createdBy: v.id("users"),
    createdAt: v.number(),
    lastEditedBy: v.optional(v.id("users")),
    lastEditedAt: v.optional(v.number()),
  })
    .index("by_student", ["studentId"])
    .index("by_class", ["classId"])
    .index("by_school", ["schoolId"]),

  // Домашни работи (Homework) - за предмети в клас
  homework: defineTable({
    classId: v.id("classes"),
    subjectId: v.id("subjects"),
    schoolId: v.id("schools"),
    teacherId: v.id("teachers"),
    lessonId: v.optional(v.id("lessons")), // Свързан урок (optional)
    title: v.string(), // Описание на домашната работа
    assignedDate: v.number(), // Дата на задаване
    dueDate: v.number(), // Срок за предаване
    createdBy: v.id("users"),
    createdAt: v.number(),
    lastEditedBy: v.optional(v.id("users")),
    lastEditedAt: v.optional(v.number()),
  })
    .index("by_class", ["classId"])
    .index("by_subject", ["subjectId"])
    .index("by_class_and_subject", ["classId", "subjectId"])
    .index("by_school", ["schoolId"])
    .index("by_teacher", ["teacherId"])
    .index("by_lesson", ["lessonId"]),

  // Годишни резултати (Annual Results) - резултати за ученици
  annualResults: defineTable({
    studentId: v.id("students"),
    classId: v.id("classes"),
    schoolId: v.id("schools"),
    academicYear: v.string(), // Учебна година
    result: v.optional(v.union(
      v.literal("completes"), // Завършва
      v.literal("stays"), // Остава
      v.literal("takes_exam") // Полага изпит
    )),
    resultAfterExam: v.optional(v.union(
      v.literal("completes"), // Завършва
      v.literal("stays") // Остава
    )),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_student", ["studentId"])
    .index("by_class", ["classId"])
    .index("by_school", ["schoolId"])
    .index("by_academic_year", ["academicYear"]),

  // Поправителни изпити (Remedial Exams)
  remedialExams: defineTable({
    studentId: v.id("students"),
    classId: v.id("classes"),
    schoolId: v.id("schools"),
    subjectId: v.id("subjects"),
    academicYear: v.string(),
    // Сесии
    session1Required: v.optional(v.boolean()), // Дали ученикът има I сесия
    session1Grade: v.optional(v.union(
      v.number(), // 2-6
      v.literal("absent") // Неявил се
    )),
    session2Required: v.optional(v.boolean()), // Дали ученикът има II сесия
    session2Grade: v.optional(v.union(
      v.number(), // 2-6
      v.literal("absent") // Неявил се
    )),
    additionalRequired: v.optional(v.boolean()), // Дали ученикът има Доп. сесия
    additionalGrade: v.optional(v.union(
      v.number(), // 2-6
      v.literal("absent") // Неявил се
    )),
    // Tracking
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.optional(v.number()),
  })
    .index("by_student", ["studentId"])
    .index("by_class", ["classId"])
    .index("by_subject", ["subjectId"])
    .index("by_school", ["schoolId"])
    .index("by_academic_year", ["academicYear"]),

  // Platform Settings - Настройки на платформата за всяко училище
  platformSettings: defineTable({
    schoolId: v.id("schools"),
    
    // Модул "Дневник"
    eDiaryEnabled: v.optional(v.boolean()), // 100% е-дневник
    lessonTopicRequired: v.optional(v.boolean()), // [Моят час] Направи темата на часа задължително поле
    minutesBeforeLessonCanMarkTaken: v.optional(v.number()), // [Моят час] Колко минути преди занятие да може да се отбележи като взето
    minutesAfterLessonCanMarkTaken: v.optional(v.number()), // [Моят час] Колко минути след занятие да може да се отбележи като взето
    minutesAfterSaveToLock: v.optional(v.number()), // [Моят час] Колко минути след запис часът да се заключи за редакция (0 = без заключване)
    checkMissingAbsences: v.optional(v.boolean()), // [Моят час] Активирай проверка за липса на отсъстващи ученици
    lockDiaryPastMonths: v.optional(v.boolean()), // Заключвай дневника за отминали месеци
    lockDayOfMonth: v.optional(v.number()), // На кое число от всеки месец да се заключва въвеждането
    warnUntakenLessonsAfterDays: v.optional(v.number()), // Предупреждавай учители за невзети занятия след X дни
    // Автоматично уважаване на отсъствия
    autoExcuseWithMedicalNote: v.optional(v.boolean()), // Автоматично уважаване на отсъствия с дигитална медицинска бележка
    autoExcuseWithParentNote: v.optional(v.boolean()), // Автоматично уважаване на отсъствия с родителска бележка
    autoExcuseWithOtherNote: v.optional(v.boolean()), // Автоматично уважаване на отсъствия с бележка по други причини
    // Известяване на администратори
    notifyAdminsOnGradeDelete: v.optional(v.boolean()), // Известявай администраторите при изтриване на оценки
    notifyAdminsOnAbsenceDelete: v.optional(v.boolean()), // Известявай администраторите при изтриване на отсъствия
    notifyAdminsOnReviewDelete: v.optional(v.boolean()), // Известявай администраторите при изтриване на отзиви
    strictModeGradeDelete: v.optional(v.boolean()), // [СТРИКТЕН РЕЖИМ] Забрана при изтриване на оценки
    strictModeAbsenceDelete: v.optional(v.boolean()), // [СТРИКТЕН РЕЖИМ] Верификация при изтриване на отсъствия
    strictModeReviewDelete: v.optional(v.boolean()), // [СТРИКТЕН РЕЖИМ] Забрана при изтриване на отзиви
    includeWeekends: v.optional(v.boolean()), // Включи събота и неделя в седмичните разписания
    classTeachersCanEditDayRegime: v.optional(v.boolean()), // Класните ръководители могат да редактират дневния режим
    classTeachersCanEditSchedules: v.optional(v.boolean()), // Класните ръководители могат да редактират разписания
    classTeachersCanMoveStudents: v.optional(v.boolean()), // Класните ръководители могат да преместват ученици
    studentsParentsSeeTopics: v.optional(v.boolean()), // Учениците и родителите виждат темите на часа
    showSecondClassHour: v.optional(v.boolean()), // Покажи секция "Втори час на класа"
    schoolYearStartDay: v.optional(v.number()), // На коя дата през Септември започва новата учебна година
    
    // Модул "Учителски отсъствия"
    teachersCanEnterSubstitution: v.optional(v.boolean()), // Учителите могат да въвеждат заместване
    absentTeachersCanBeSubstitutes: v.optional(v.boolean()), // Отсъстващите учители могат да са заместници
    substitutesAccessDays: v.optional(v.number()), // Колко дни заместниците имат достъп до паралелките
    
    // Модул "Статистики и справки"
    includeGrades1to3InRankings: v.optional(v.boolean()), // Включвай учениците от 1-3 клас в класациите
    
    // Модул "Администрация"
    studentsSeeTeachersPhones: v.optional(v.boolean()), // Учениците виждат телефоните на своите учители
    studentsSeeTeachersEmails: v.optional(v.boolean()), // Учениците виждат имейлите на своите учители
    parentsSeeTeachersPhones: v.optional(v.boolean()), // Родителите виждат телефоните на учителите
    parentsSeeTeachersEmails: v.optional(v.boolean()), // Родителите виждат имейлите на учителите
    parentsSeeClassmatesParents: v.optional(v.boolean()), // Родителите виждат родителите на съучениците
    parentsAndStudentsSeeClassmates: v.optional(v.boolean()), // Родителите и учениците виждат съучениците
    parentsCannotSendMessages: v.optional(v.boolean()), // Родителите не могат да изпращат съобщения
    studentsCannotSendMessages: v.optional(v.boolean()), // Учениците не могат да изпращат съобщения
    enableLessonTimeWindow: v.optional(v.boolean()), // Активирай времеви прозорец за отбелязване на часове
    // Deprecated fields - kept for backward compatibility
    classTeachersCanApproveRegistrations: v.optional(v.boolean()), // DEPRECATED - няма система за одобрение
    sendDataToMON: v.optional(v.boolean()), // DEPRECATED - няма интеграция с МОН
    studentIdentifierRequired: v.optional(v.boolean()), // Идентификаторът за ученик е задължителен
    teacherIdentifierRequired: v.optional(v.boolean()), // Идентификаторът за учител е задължителен
    
    // Видимост на модули (Module Visibility)
    moduleHomeEnabled: v.optional(v.boolean()), // Начало
    moduleDiaryEnabled: v.optional(v.boolean()), // Дневник
    moduleTasksEnabled: v.optional(v.boolean()), // Задачи
    moduleStatisticsEnabled: v.optional(v.boolean()), // Статистики
    moduleExtracurricularEnabled: v.optional(v.boolean()), // Извънкласни дейности
    moduleEventsEnabled: v.optional(v.boolean()), // Събития
    moduleCompetitionsEnabled: v.optional(v.boolean()), // Състезания
    moduleAdminEnabled: v.optional(v.boolean()), // Администрация
    moduleLectureHoursEnabled: v.optional(v.boolean()), // Учебни часове
    moduleFeesEnabled: v.optional(v.boolean()), // Такси
    moduleReportsEnabled: v.optional(v.boolean()), // Справки
    moduleMessagesEnabled: v.optional(v.boolean()), // Съобщения
    
    // Tracking
    lastEditedBy: v.optional(v.id("users")),
    lastEditedAt: v.optional(v.number()),
  })
    .index("by_school", ["schoolId"]),

  // Групи в паралелки (Class Groups) - разделяне на ученици по групи за даден предмет
  classGroups: defineTable({
    classId: v.id("classes"),
    name: v.string(), // e.g. "Група 1", "Група 2"
    groupType: v.union(
      v.literal("full_class"),  // Обща за цялата паралелка
      v.literal("partial"),     // Частична
      v.literal("ifo")          // ИФО
    ),
    subjectId: v.id("subjects"),
    teacherId: v.optional(v.id("teachers")), // Учител, преподаващ на тази група
    preparationType: v.optional(v.string()), // ЗП, ИУЧ, ФУЧ, etc.
    studentIds: v.array(v.id("students")),
    normativ: v.number(), // Норматив (default 0)
    educationAddress: v.string(), // Адрес на обучение (e.g. "Основна")
    schoolId: v.id("schools"),
    createdBy: v.id("users"),
    createdAt: v.number(),
    lastEditedBy: v.optional(v.id("users")),
    lastEditedAt: v.optional(v.number()),
  })
    .index("by_class", ["classId"])
    .index("by_class_and_subject", ["classId", "subjectId"])
    .index("by_school", ["schoolId"]),

  // Проектни дейности (Project Activities)
  projectActivities: defineTable({
    name: v.string(), // Име
    startDate: v.number(), // Начална дата
    endDate: v.number(), // Крайна дата
    projectType: v.optional(v.union(
      v.literal("national_partnership"), // Национално партньорство
      v.literal("international_partnership"), // Международно партньорство
      v.literal("no_partner") // Няма партньор
    )),
    programType: v.optional(v.union(
      v.literal("mon_national"), // По национална програма на МОН
      v.literal("mon_esf"), // По програма на МОН/ЕСФ
      v.literal("other_national"), // Друга национална програма
      v.literal("npo_cooperation"), // В сътрудничество с НПО
      v.literal("eu_lifelong_learning"), // Програма на ЕС - Учене през целия живот
      v.literal("eu_erasmus"), // Програма на ЕС - Еразъм
      v.literal("eu_other"), // Програма на ЕС - друга
      v.literal("other_international") // Друга международна програма
    )),
    website: v.optional(v.string()), // Интернет страница
    shortDescription: v.optional(v.string()), // Кратко описание (до 500 символа)
    mainResults: v.optional(v.string()), // Основни резултати
    schoolId: v.id("schools"),
    createdBy: v.id("users"),
    createdAt: v.number(),
    lastEditedBy: v.optional(v.id("users")),
    lastEditedAt: v.optional(v.number()),
  })
    .index("by_school", ["schoolId"])
    .index("by_created_by", ["createdBy"]),

  // Grade deletion requests - teachers request deletion, admins approve/reject
  gradeDeleteRequests: defineTable({
    gradeId: v.id("grades"),
    requestedBy: v.id("users"),
    requestedAt: v.number(),
    reason: v.string(), // Required reason for deletion
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    ),
    // Grade snapshot (in case grade is deleted)
    gradeSnapshot: v.object({
      studentId: v.id("students"),
      studentName: v.string(),
      classId: v.id("classes"),
      className: v.string(),
      subjectId: v.id("subjects"),
      subjectName: v.string(),
      teacherId: v.id("teachers"),
      teacherName: v.string(),
      value: v.union(v.number(), v.literal("absent")),
      gradeType: v.optional(v.string()),
      date: v.number(),
    }),
    // Resolution fields
    resolvedBy: v.optional(v.id("users")),
    resolvedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
    schoolId: v.id("schools"),
  })
    .index("by_school", ["schoolId"])
    .index("by_status", ["status"])
    .index("by_grade", ["gradeId"])
    .index("by_requested_by", ["requestedBy"]),
});
