import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import { DiaryAccessGuard } from "@/components/DiaryAccessGuard.tsx";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { Calendar } from "@/components/ui/calendar.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import { Save, Shuffle, Award, Check, CalendarIcon, Dices, ThumbsUp, ThumbsDown, CalendarOff, Lock, Clock, Menu, X, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { bg } from "date-fns/locale";
import { cn } from "@/lib/utils.ts";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

type AttendanceStatus = "present" | "absent" | "late" | "excused";
type BadgeType = 
  // Похвали (Praises) - 20 типа
  | "general_praise"
  | "active_participation"
  | "excellent_presentation"
  | "completed_task"
  | "curiosity"
  | "diligence"
  | "progress"
  | "communication"
  | "sharp_mind"
  | "concentration"
  | "creativity"
  | "teamwork"
  | "leadership"
  | "patriotism"
  | "tolerance"
  | "emotional_intelligence"
  | "presentation_skills"
  | "digital_skills"
  | "musical_culture"
  | "physical_culture"
  // Забележки (Remarks) - 20 типа
  | "general_remark"
  | "bad_discipline"
  | "lack_of_attention"
  | "official_remark"
  | "disrespect"
  | "aggression"
  | "removed_from_class"
  | "late"
  | "absence"
  | "poor_performance"
  | "unprepared"
  | "no_homework"
  | "no_textbook"
  | "no_materials"
  | "no_equipment"
  | "no_uniform"
  | "breakfast"
  | "lunch"
  | "afternoon_sleep"
  | "afternoon_snack";

type StudentRowData = {
  studentId: Id<"students">;
  studentName: string;
  attendanceStatus: AttendanceStatus;
  gradeValue: string;
  gradeType: string;
  badges: BadgeType[];
};

function MyLessonInner() {
  // Get current user to find teacher ID
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const teachers = useQuery(api.admin.listTeachers, {});
  
  // Check if user has teacher role in roles array or in teachers table
  const hasTeacherRole = currentUser?.roles?.includes("teacher") ?? false;
  const teacherId = currentUser && teachers 
    ? teachers.find(t => t.userId === currentUser._id)?._id
    : undefined;

  // Date selection - Initialize to start of today (ALWAYS USE CURRENT REAL-WORLD DATE)
  const [selectedDate, setSelectedDate] = useState(() => {
    // Create UTC timestamp for midnight UTC of today's calendar date
    const today = new Date();
    const utcMidnight = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    return utcMidnight;
  });
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date());

  // Check if selected date is a non-school day
  const nonSchoolDayCheck = useQuery(
    api.nonSchoolDays.checkDateIsNonSchoolDay,
    { date: selectedDate }
  );

  // Load lessons from schedule
  const lessonsFromSchedule = useQuery(
    api.lessons.getLessonsBySchedule,
    teacherId ? { teacherId, date: selectedDate } : "skip"
  );

  // Selected lesson state
  const [selectedLessonIndex, setSelectedLessonIndex] = useState<number>(0);
  const [currentLessonId, setCurrentLessonId] = useState<Id<"lessons"> | null>(null);
  const [isLessonPanelOpen, setIsLessonPanelOpen] = useState(false);

  const selectedLesson = lessonsFromSchedule?.[selectedLessonIndex];

  // Lesson details
  const lessonDetails = useQuery(
    api.lessons.getLessonDetails,
    currentLessonId ? { lessonId: currentLessonId } : "skip"
  );

  // Lock status for current lesson
  const lockStatus = useQuery(
    api.lessons.getLessonLockStatus,
    currentLessonId ? { lessonId: currentLessonId } : "skip"
  );

  // Fetch students by class for new lessons (when no lessonId exists yet)
  const studentsFromClass = useQuery(
    api.admin.getStudentsByClass,
    selectedLesson?.class?._id && !currentLessonId ? { classId: selectedLesson.class._id } : "skip"
  );
  
  // Fetch group data for filtering students when schedule entry has a groupId
  const scheduleGroupId = (selectedLesson?.scheduleEntry as { groupId?: Id<"classGroups"> } | undefined)?.groupId;
  const groupData = useQuery(
    api.classGroups.getByClassAndSubject,
    selectedLesson?.class?._id && selectedLesson?.subject?._id && scheduleGroupId
      ? { classId: selectedLesson.class._id, subjectId: selectedLesson.subject._id }
      : "skip"
  );
  
  // Fetch existing attendance for the class and date (for new lessons without lessonId)
  const existingAttendanceForDate = useQuery(
    api.attendance.getAttendanceForClassDate,
    selectedLesson?.class?._id && !currentLessonId ? { 
      classId: selectedLesson.class._id, 
      date: selectedDate 
    } : "skip"
  );

  // Form state
  const [isTaken, setIsTaken] = useState(false);
  const [originalIsTaken, setOriginalIsTaken] = useState(false); // Track original value from DB
  const [topic, setTopic] = useState("");
  const [lessonType, setLessonType] = useState("");
  const [educationType, setEducationType] = useState<"inPerson" | "online">("inPerson");
  const [homeworkText, setHomeworkText] = useState("");
  const [homeworkDeadline, setHomeworkDeadline] = useState<Date | undefined>(undefined);
  const [isTopicFocused, setIsTopicFocused] = useState(false);
  const [showPastTopics, setShowPastTopics] = useState(false);
  const [studentRows, setStudentRows] = useState<StudentRowData[]>([]);
  const [selectedCurriculumTopicIds, setSelectedCurriculumTopicIds] = useState<Id<"curriculumTopics">[]>([]);

  // Lesson type options
  const LESSON_TYPES = [
    { value: "НЗ", label: "НЗ - Нови знания" },
    { value: "ОС", label: "ОС - Обобщаване и систематизиране" },
    { value: "УПР", label: "УПР - Упражнение" },
    { value: "ПК", label: "ПК - Проверка и контрол" },
    { value: "К", label: "К - Комбиниран урок" },
    { value: "Д", label: "Д - Друго" },
  ];

  // Education type options
  const EDUCATION_TYPES = [
    { value: "inPerson", label: "Присъствено" },
    { value: "online", label: "Онлайн (ОРЕС)" },
  ];

  // Query for past topics
  const pastTopics = useQuery(
    api.lessons.getPastTopics,
    selectedLesson?.class?._id && selectedLesson?.subject?._id
      ? { classId: selectedLesson.class._id, subjectId: selectedLesson.subject._id }
      : "skip"
  );

  // Badge modal state
  const [badgeModalOpen, setBadgeModalOpen] = useState(false);
  const [selectedStudentIndex, setSelectedStudentIndex] = useState<number | null>(null);
  const [tempBadges, setTempBadges] = useState<BadgeType[]>([]);
  const [badgeTab, setBadgeTab] = useState<"praise" | "remark">("praise"); // Default to praises

  // Random student modal
  const [randomStudentModalOpen, setRandomStudentModalOpen] = useState(false);
  const [randomStudent, setRandomStudent] = useState<{
    name: string;
    number: number;
  } | null>(null);

  // Mutations
  const createOrGetLesson = useMutation(api.lessons.createOrGetLesson);
  const saveFullLessonData = useMutation(api.lessons.saveFullLessonData);
  const createHomework = useMutation(api.homework.createHomework);

  // Reset selected lesson when date changes
  useEffect(() => {
    setSelectedLessonIndex(0);
    setCurrentLessonId(null);
    setIsLessonPanelOpen(false);
    setSelectedCurriculumTopicIds([]);
    setIsTopicFocused(false);
    setShowPastTopics(false);
    setOriginalIsTaken(false); // Reset original state
  }, [selectedDate]);

  // Helper function to calculate period start and end times
  const calculatePeriodTimes = (
    periodIndex: number,
    startTime: string,
    periodCount: number,
    periods?: Array<{ periodNumber: number; startTime: string; duration: number; endTime: string }>
  ): { start: string; end: string } => {
    // Use specific period times from day regime if available
    if (periods && periods.length > 0) {
      const period = periods.find(p => p.periodNumber === periodIndex);
      if (period) {
        return { start: period.startTime, end: period.endTime };
      }
    }

    // Fallback: Parse start time (format: "HH:MM")
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMinute;

    // Assume 40-minute periods with 10-minute breaks
    const periodDuration = 40;
    const breakDuration = 10;
    const totalPeriodTime = periodDuration + breakDuration;

    // Calculate period start (periodIndex starts from 1 in schedule)
    const periodStartMinutes = startMinutes + (periodIndex - 1) * totalPeriodTime;
    const periodEndMinutes = periodStartMinutes + periodDuration;

    // Convert back to HH:MM format
    const formatTime = (totalMinutes: number) => {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    };

    return {
      start: formatTime(periodStartMinutes),
      end: formatTime(periodEndMinutes),
    };
  };

  // Handler for calendar date change
  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    setCalendarDate(date);
    // Create UTC timestamp for midnight UTC on the selected calendar date
    const utcTimestamp = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    setSelectedDate(utcTimestamp);
  };

  // Get grade color based on value
  const getGradeColor = (value: string) => {
    const numValue = parseFloat(value);
    if (numValue === 2) return "bg-red-500 text-white";
    if (numValue === 3) return "bg-orange-500 text-white";
    if (numValue === 4) return "bg-yellow-500 text-white";
    if (numValue === 5) return "bg-blue-500 text-white";
    if (numValue === 6) return "bg-green-600 text-white";
    return "bg-gray-200 text-gray-800";
  };

  // Get class grade level (1-12) from class name (e.g., "1а" -> 1, "10б" -> 10)
  const getClassGradeLevel = (className: string): number => {
    const match = className.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  // Check if class is lower grades (1-3)
  const isLowerGrades = selectedLesson ? getClassGradeLevel(selectedLesson.class.name) <= 3 : false;

  // Get grade display (emoji for grades 1-3, number for 4-12)
  const getGradeDisplay = (value: string, useLowerGrades: boolean): string => {
    const numValue = parseInt(value, 10);
    if (useLowerGrades) {
      switch (numValue) {
        case 2: return "😢"; // Frowning face
        case 3: return "😐"; // Neutral face
        case 4: return "🙂"; // Slightly happy
        case 5: return "💙"; // Blue heart
        case 6: return "⭐"; // Star
        default: return value;
      }
    }
    return value;
  };

  // Get grade button style based on value
  const getGradeButtonStyle = (value: string, isSelected: boolean) => {
    const numValue = parseInt(value, 10);
    const baseClasses = "w-10 h-10 rounded-lg font-bold text-lg transition-all flex items-center justify-center";
    
    if (!isSelected) {
      return `${baseClasses} bg-gray-100 dark:bg-gray-800 hover:opacity-80 border-2 border-gray-300 dark:border-gray-600`;
    }
    
    switch (numValue) {
      case 2: return `${baseClasses} bg-red-500 text-white border-2 border-red-600 ring-2 ring-red-300`;
      case 3: return `${baseClasses} bg-orange-500 text-white border-2 border-orange-600 ring-2 ring-orange-300`;
      case 4: return `${baseClasses} bg-yellow-500 text-white border-2 border-yellow-600 ring-2 ring-yellow-300`;
      case 5: return `${baseClasses} bg-blue-500 text-white border-2 border-blue-600 ring-2 ring-blue-300`;
      case 6: return `${baseClasses} bg-green-500 text-white border-2 border-green-600 ring-2 ring-green-300`;
      default: return baseClasses;
    }
  };

  // Load lesson when selected from schedule
  useEffect(() => {
    if (!lessonsFromSchedule || lessonsFromSchedule.length === 0) return;
    
    const selected = lessonsFromSchedule[selectedLessonIndex];
    if (!selected) return;

    if (selected.lesson) {
      setCurrentLessonId(selected.lesson._id);
    } else {
      // Reset current lesson if no existing lesson
      setCurrentLessonId(null);
    }
  }, [selectedLessonIndex, lessonsFromSchedule]);

  // Populate form when lesson details load OR when lesson doesn't exist
  useEffect(() => {
    if (!lessonsFromSchedule || lessonsFromSchedule.length === 0) return;
    
    const selected = lessonsFromSchedule[selectedLessonIndex];
    if (!selected) return;

    if (lessonDetails && currentLessonId) {
      // Load existing lesson data
      setIsTaken(lessonDetails.lesson.isTaken);
      setOriginalIsTaken(lessonDetails.lesson.isTaken); // Track original value
      setTopic(lessonDetails.lesson.topic ?? "");
      setLessonType((lessonDetails.lesson as { lessonType?: string }).lessonType ?? "");
      setEducationType(lessonDetails.lesson.educationType || "inPerson");

      // Pre-select curriculum topics that are already linked to this lesson
      const linkedTopicIds = lessonDetails.curriculumTopics
        .filter((t) => (t as { coveredByLessonId?: string }).coveredByLessonId === currentLessonId)
        .map((t) => t._id);
      setSelectedCurriculumTopicIds(linkedTopicIds);

      // Initialize student rows
      const rows: StudentRowData[] = lessonDetails.students.map((s) => ({
        studentId: s.student._id,
        studentName: s.user.name ?? "Няма име",
        attendanceStatus: s.attendance?.status ?? "present",
        gradeValue: s.grades.length > 0 && typeof s.grades[0].value === "number" 
          ? s.grades[0].value.toString() 
          : "",
        gradeType: s.grades.length > 0 ? (s.grades[0].gradeType ?? "") : "",
        badges: s.badges.map((b) => b.type),
      }));

      setStudentRows(rows);
      
      // Reset homework fields when switching lessons
      setHomeworkText("");
      setHomeworkDeadline(undefined);
    } else if (!currentLessonId && selected.class && studentsFromClass) {
      // Initialize empty form for new lesson with students from class
      setIsTaken(false);
      setOriginalIsTaken(false); // New lesson has no original taken state
      setTopic("");
      setLessonType("");
      setEducationType("inPerson");
      setHomeworkText("");
      setHomeworkDeadline(undefined);
      
      // Get the current period index for filtering attendance
      const currentPeriodIndex = selected.scheduleEntry.periodIndex;
      
      // Filter students by group if a group is assigned to this schedule entry
      const entryGroupId = (selected.scheduleEntry as { groupId?: Id<"classGroups"> }).groupId;
      let studentsToShow = studentsFromClass;
      if (entryGroupId && groupData) {
        const matchingGroup = groupData.find(g => g._id === entryGroupId);
        if (matchingGroup) {
          const groupStudentIds = new Set(matchingGroup.studentIds);
          studentsToShow = studentsFromClass.filter(s => groupStudentIds.has(s._id));
        }
      }
      
      // Initialize student rows with students from the class (or group)
      // Check for existing attendance from the Absences module
      const rows: StudentRowData[] = studentsToShow.map((s) => {
        // Find existing attendance for this student and period
        const existingAttendance = existingAttendanceForDate?.find(
          a => a.studentId === s._id && a.period === currentPeriodIndex
        );
        
        // Map attendance status
        let attendanceStatus: AttendanceStatus = "present";
        if (existingAttendance) {
          if (existingAttendance.status === "absent") {
            attendanceStatus = "absent";
          } else if (existingAttendance.status === "late") {
            attendanceStatus = "late";
          } else if (existingAttendance.status === "excused") {
            attendanceStatus = "excused";
          }
        }
        
        return {
          studentId: s._id,
          studentName: s.name ?? "Няма име",
          attendanceStatus,
          gradeValue: "",
          gradeType: "",
          badges: [],
        };
      });
      
      setStudentRows(rows);
    }
  }, [currentLessonId, lessonDetails, lessonsFromSchedule, selectedLessonIndex, studentsFromClass, existingAttendanceForDate, groupData]);

  if (!currentUser || !teachers) {
    return (
      <Layout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  if (!hasTeacherRole && !teacherId) {
    return (
      <Layout>
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Не сте учител</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Тази страница е достъпна само за учители.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // Check if teacher has no assigned classes/subjects
  if (hasTeacherRole && !teacherId) {
    return (
      <Layout>
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Няма назначени класове</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Нямате назначени класове и предмети. Моля, свържете се с администратор за да ви бъдат назначени класове.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (!lessonsFromSchedule) {
    return (
      <Layout>
        <div className="p-6 space-y-4">
          <p>Зареждане на часове...</p>
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  const handleAttendanceClick = (index: number) => {
    setStudentRows((prev) => {
      const updated = [...prev];
      const current = updated[index].attendanceStatus;
      // Cycle through: present -> absent -> late -> present (3-state cycle)
      const cycle: AttendanceStatus[] = ["present", "absent", "late"];
      const currentIndex = cycle.indexOf(current);
      updated[index].attendanceStatus = cycle[(currentIndex + 1) % cycle.length];
      return updated;
    });
  };

  const handleOpenBadgeModal = (index: number) => {
    setSelectedStudentIndex(index);
    setTempBadges(studentRows[index].badges);
    setBadgeTab("praise"); // Reset to praises tab when opening
    setBadgeModalOpen(true);
  };

  const handleSaveBadges = () => {
    if (selectedStudentIndex === null) return;
    setStudentRows((prev) => {
      const updated = [...prev];
      updated[selectedStudentIndex].badges = tempBadges;
      return updated;
    });
    setBadgeModalOpen(false);
    setSelectedStudentIndex(null);
  };

  const toggleBadge = (badge: BadgeType) => {
    setTempBadges((prev) =>
      prev.includes(badge) ? prev.filter((b) => b !== badge) : [...prev, badge]
    );
  };

  const handleRandomStudent = () => {
    // Pick from current studentRows instead of backend query
    if (studentRows.length > 0) {
      const randomIndex = Math.floor(Math.random() * studentRows.length);
      const student = studentRows[randomIndex];
      setRandomStudent({
        name: student.studentName,
        number: randomIndex + 1, // 1-based student number
      });
      setRandomStudentModalOpen(true);
    } else {
      toast.error("Няма ученици за избор");
    }
  };

  const handleSaveAll = async () => {
    if (!selectedLesson || !teacherId) {
      toast.error("Няма избран час");
      return;
    }

    // Validation
    for (const row of studentRows) {
      if (row.gradeValue && !row.gradeType) {
        toast.error("Моля, изберете тип на оценката за всички оценки");
        return;
      }
    }

    // Validate homework - if text is entered, deadline must be set
    if (homeworkText && !homeworkDeadline) {
      toast.error("Моля, изберете срок за домашната работа");
      return;
    }

    try {
      // Create or get lesson ID if not exists
      let lessonIdToSave = currentLessonId;
      
      if (!lessonIdToSave) {
        lessonIdToSave = await createOrGetLesson({
          classId: selectedLesson.class._id,
          subjectId: selectedLesson.subject._id,
          teacherId: teacherId,
          date: selectedDate,
          periodIndex: selectedLesson.scheduleEntry.periodIndex,
          groupId: (selectedLesson.scheduleEntry as { groupId?: Id<"classGroups"> }).groupId,
        });
        setCurrentLessonId(lessonIdToSave);
      }

      const studentData = studentRows.map((row) => ({
        studentId: row.studentId,
        attendanceStatus: row.attendanceStatus,
        grade: row.gradeValue && row.gradeType 
          ? {
              value: parseFloat(row.gradeValue),
              gradeType: row.gradeType,
            }
          : undefined,
        badges: row.badges,
      }));

      await saveFullLessonData({
        lessonId: lessonIdToSave,
        isTaken,
        topic,
        lessonType: lessonType || undefined,
        educationType,
        curriculumTopicIds: selectedCurriculumTopicIds.length > 0 ? selectedCurriculumTopicIds : undefined,
        studentData,
      });

      // Save homework if entered
      if (homeworkText && homeworkDeadline) {
        const deadlineUtc = Date.UTC(
          homeworkDeadline.getFullYear(),
          homeworkDeadline.getMonth(),
          homeworkDeadline.getDate(),
          0, 0, 0, 0
        );
        
        await createHomework({
          classId: selectedLesson.class._id,
          subjectId: selectedLesson.subject._id,
          title: homeworkText,
          assignedDate: selectedDate,
          dueDate: deadlineUtc,
          lessonId: lessonIdToSave,
        });
        
        // Reset homework fields after save
        setHomeworkText("");
        setHomeworkDeadline(undefined);
      }

      toast.success("Промените са запазени успешно!");
      
      // Reset curriculum topic selection after save
      setSelectedCurriculumTopicIds([]);
    } catch (error) {
      // Extract error message from ConvexError
      if (error && typeof error === "object" && "data" in error) {
        const errorData = error.data as { message?: string; code?: string };
        if (errorData.message) {
          toast.error(errorData.message);
        } else {
          toast.error("Грешка при запазване на промените");
        }
      } else if (error instanceof Error) {
        toast.error(error.message || "Грешка при запазване на промените");
      } else {
        toast.error("Грешка при запазване на промените");
      }
      console.error(error);
    }
  };

  const getAttendanceLabel = (status: AttendanceStatus) => {
    switch (status) {
      case "present": return "Присъс";
      case "absent": return "Неуваж";
      case "late": return "Закъс";
      case "excused": return "Уважително";
    }
  };

  const getAttendanceColor = (status: AttendanceStatus) => {
    switch (status) {
      case "present": return "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
      case "absent": return "bg-red-500 text-white dark:bg-red-600 dark:text-white";
      case "late": return "bg-orange-500 text-white dark:bg-orange-600 dark:text-white";
      case "excused": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    }
  };

  const badgeLabels: Record<BadgeType, { label: string; category: "praise" | "remark" }> = {
    // Похвали (Praises) - 20 типа
    general_praise: { label: "Обща похвала", category: "praise" },
    active_participation: { label: "Активно участие", category: "praise" },
    excellent_presentation: { label: "Отлично представяне", category: "praise" },
    completed_task: { label: "Изпълнена задача", category: "praise" },
    curiosity: { label: "Любознателност", category: "praise" },
    diligence: { label: "Старание", category: "praise" },
    progress: { label: "Напредък", category: "praise" },
    communication: { label: "Комуникативност", category: "praise" },
    sharp_mind: { label: "Остър ум", category: "praise" },
    concentration: { label: "Концентрация", category: "praise" },
    creativity: { label: "Креативност", category: "praise" },
    teamwork: { label: "Екипна работа", category: "praise" },
    leadership: { label: "Лидерство", category: "praise" },
    patriotism: { label: "Патриотизъм", category: "praise" },
    tolerance: { label: "Толерантност", category: "praise" },
    emotional_intelligence: { label: "Емоционална интелигентност", category: "praise" },
    presentation_skills: { label: "Презентационни умения", category: "praise" },
    digital_skills: { label: "Дигитални умения", category: "praise" },
    musical_culture: { label: "Музикална култура", category: "praise" },
    physical_culture: { label: "Физическа култура", category: "praise" },
    
    // Забележки (Remarks) - 20 типа
    general_remark: { label: "Обща забележка", category: "remark" },
    bad_discipline: { label: "Лоша дисциплина", category: "remark" },
    lack_of_attention: { label: "Липса на внимание", category: "remark" },
    official_remark: { label: "Официална забележка", category: "remark" },
    disrespect: { label: "Неуважение", category: "remark" },
    aggression: { label: "Агресия", category: "remark" },
    removed_from_class: { label: "Отстранен от час", category: "remark" },
    late: { label: "Закъснение", category: "remark" },
    absence: { label: "Отсъствие", category: "remark" },
    poor_performance: { label: "Слабо представяне", category: "remark" },
    unprepared: { label: "Без подготовка", category: "remark" },
    no_homework: { label: "Без домашна работа", category: "remark" },
    no_textbook: { label: "Без учебно помагало", category: "remark" },
    no_materials: { label: "Без учебни пособия", category: "remark" },
    no_equipment: { label: "Без екип", category: "remark" },
    no_uniform: { label: "Без униформа", category: "remark" },
    breakfast: { label: "Закуска", category: "remark" },
    lunch: { label: "Обяд", category: "remark" },
    afternoon_sleep: { label: "Следобеден сън", category: "remark" },
    afternoon_snack: { label: "Следобедна закуска", category: "remark" },
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {nonSchoolDayCheck?.isNonSchoolDay ? (
          <>
            {/* Date Selector */}
            <Card className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950 dark:to-cyan-950 border-2 border-teal-200 dark:border-teal-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <Label className="text-lg font-bold text-teal-900 dark:text-teal-100 mb-2 block">
                      📅 Изберете дата за часове
                    </Label>
                    <p className="text-sm text-teal-700 dark:text-teal-300">
                      Изберете дата от календара
                    </p>
                    <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">
                      {(() => {
                        const date = new Date(selectedDate);
                        const dayNames = ["Неделя", "Понеделник", "Вторник", "Сряда", "Четвъртък", "Петък", "Събота"];
                        return `${dayNames[date.getUTCDay()]}, ${date.getUTCDate()}.${date.getUTCMonth() + 1}.${date.getUTCFullYear()}`;
                      })()}
                    </p>
                  </div>
                  <div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "px-6 py-4 border-3 border-teal-400 dark:border-teal-600 rounded-xl text-2xl font-bold bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all",
                            !calendarDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-6 w-6" />
                          {calendarDate ? format(calendarDate, "dd.MM.yyyy", { locale: bg }) : <span>Изберете дата</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={calendarDate}
                          onSelect={handleCalendarSelect}
                          initialFocus
                          locale={bg}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Non-school day message */}
            <Card className="border-2 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30">
              <CardContent className="p-8 text-center">
                <CalendarOff className="h-16 w-16 mx-auto text-orange-500 mb-4" />
                <h2 className="text-2xl font-bold text-orange-800 dark:text-orange-200 mb-2">
                  Неучебен ден
                </h2>
                <p className="text-lg text-orange-700 dark:text-orange-300 mb-2">
                  {nonSchoolDayCheck.nonSchoolDay?.name}
                </p>
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  {nonSchoolDayCheck.nonSchoolDay?.category}
                </p>
                <p className="text-muted-foreground mt-4">
                  За тази дата няма учебни занятия. Изберете друга дата от календара.
                </p>
              </CardContent>
            </Card>
          </>
        ) : lessonsFromSchedule.length === 0 ? (
          <>
            {/* Date Selector */}
            <Card className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950 dark:to-cyan-950 border-2 border-teal-200 dark:border-teal-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <Label className="text-lg font-bold text-teal-900 dark:text-teal-100 mb-2 block">
                      📅 Изберете дата за часове
                    </Label>
                    <p className="text-sm text-teal-700 dark:text-teal-300">
                      Изберете дата от календара
                    </p>
                    <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">
                      {(() => {
                        const date = new Date(selectedDate);
                        const dayNames = ["Неделя", "Понеделник", "Вторник", "Сряда", "Четвъртък", "Петък", "Събота"];
                        return `${dayNames[date.getUTCDay()]}, ${date.getUTCDate()}.${date.getUTCMonth() + 1}.${date.getUTCFullYear()}`;
                      })()}
                    </p>
                  </div>
                  <div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "px-6 py-4 border-3 border-teal-400 dark:border-teal-600 rounded-xl text-2xl font-bold bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all",
                            !calendarDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-6 w-6" />
                          {calendarDate ? format(calendarDate, "dd.MM.yyyy", { locale: bg }) : <span>Изберете дата</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={calendarDate}
                          onSelect={handleCalendarSelect}
                          initialFocus
                          locale={bg}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Липсват занятия</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Няма планирани занятия за избраната дата. Изберете друга дата от полето по-горе.
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            {/* Date Selector - Always show */}
            <Card className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950 dark:to-cyan-950 border-2 border-teal-200 dark:border-teal-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <Label className="text-lg font-bold text-teal-900 dark:text-teal-100 mb-2 block">
                      📅 Изберете дата за часове
                    </Label>
                    <p className="text-sm text-teal-700 dark:text-teal-300">
                      Изберете дата от календара
                    </p>
                    <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">
                      {(() => {
                        const date = new Date(selectedDate);
                        const dayNames = ["Неделя", "Понеделник", "Вторник", "Сряда", "Четвъртък", "Петък", "Събота"];
                        return `${dayNames[date.getUTCDay()]}, ${date.getUTCDate()}.${date.getUTCMonth() + 1}.${date.getUTCFullYear()}`;
                      })()}
                    </p>
                  </div>
                  <div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "px-6 py-4 border-3 border-teal-400 dark:border-teal-600 rounded-xl text-2xl font-bold bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all",
                            !calendarDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-6 w-6" />
                          {calendarDate ? format(calendarDate, "dd.MM.yyyy", { locale: bg }) : <span>Изберете дата</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={calendarDate}
                          onSelect={handleCalendarSelect}
                          initialFocus
                          locale={bg}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lesson Selector Dropdown - Always show */}
            <Card>
              <CardHeader>
                <CardTitle>Изберете час за редакция</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={isLessonPanelOpen ? selectedLessonIndex.toString() : ""}
                  onValueChange={(value) => {
                    setSelectedLessonIndex(parseInt(value, 10));
                    setIsLessonPanelOpen(true);
                  }}
                >
                  <SelectTrigger className="w-full text-lg py-6">
                    <SelectValue placeholder="Изберете час" />
                  </SelectTrigger>
                  <SelectContent>
                    {lessonsFromSchedule.map((lesson, index) => {
                      let timeRange = "";
                      if (lesson.dayRegime) {
                        const times = calculatePeriodTimes(
                          lesson.scheduleEntry.periodIndex,
                          lesson.dayRegime.startTime,
                          lesson.dayRegime.periodCount,
                          lesson.dayRegime.periods
                        );
                        timeRange = ` ${times.start} - ${times.end}`;
                      }
                      
                      // Check if this is a substitution lesson
                      const isSubstitution = (lesson as { isSubstitution?: boolean }).isSubstitution;
                      const originalTeacherName = (lesson as { originalTeacherName?: string }).originalTeacherName;
                      // Check if lesson is taken
                      const lessonIsTaken = lesson.lesson?.isTaken ?? false;
                      
                      return (
                        <SelectItem 
                          key={index} 
                          value={index.toString()}
                          className={cn(
                            lessonIsTaken && "bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 font-semibold"
                          )}
                        >
                          {lessonIsTaken && "✅ "}
                          {isSubstitution ? "🔄 " : ""}
                          Час {lesson.scheduleEntry.periodIndex} / {timeRange} - {lesson.subject.name} в {lesson.class.name}
                          {(lesson as { groupName?: string }).groupName ? ` [${(lesson as { groupName?: string }).groupName}]` : ""}
                          {isSubstitution && originalTeacherName ? ` (Замества: ${originalTeacherName})` : ""}
                          {lessonIsTaken && " (Взет)"}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Lesson Details Panel - Show when lesson is selected */}
            {isLessonPanelOpen && selectedLesson && (
              <Card className={cn(
                "border-2",
                (selectedLesson as { isSubstitution?: boolean }).isSubstitution && "border-green-500 bg-green-50 dark:bg-green-950/30"
              )}>
                <CardHeader className="bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">
                        {(selectedLesson as { isSubstitution?: boolean }).isSubstitution && (
                          <span className="text-green-600 dark:text-green-400 mr-2">🔄</span>
                        )}
                        Час {selectedLesson.scheduleEntry.periodIndex} / {(() => {
                          if (selectedLesson.dayRegime) {
                            const times = calculatePeriodTimes(
                              selectedLesson.scheduleEntry.periodIndex,
                              selectedLesson.dayRegime.startTime,
                              selectedLesson.dayRegime.periodCount,
                              selectedLesson.dayRegime.periods
                            );
                            return `${times.start} - ${times.end}`;
                          }
                          return "";
                        })()} - {selectedLesson.subject.name} в {selectedLesson.class.name}
                      </CardTitle>
                      {(selectedLesson as { groupName?: string }).groupName && (
                        <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                          {(selectedLesson as { groupName?: string }).groupName}
                        </span>
                      )}
                      {(selectedLesson as { isSubstitution?: boolean; originalTeacherName?: string }).isSubstitution && (
                        <p className="text-sm text-green-600 dark:text-green-400 font-semibold mt-1">
                          Замества: {(selectedLesson as { originalTeacherName?: string }).originalTeacherName}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  {/* Lock Status Banner */}
                  {lockStatus && lockStatus.isLocked && (
                    <Alert className="border-red-500 bg-red-50 dark:bg-red-950/30">
                      <Lock className="h-5 w-5 text-red-600 dark:text-red-400" />
                      <AlertDescription className="ml-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-red-800 dark:text-red-200">
                              Часът е заключен за редакция
                            </span>
                            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                              {lockStatus.canEdit 
                                ? "Като администратор все още можете да редактирате този час."
                                : "Само администратор може да редактира заключени часове."
                              }
                            </p>
                          </div>
                          {!lockStatus.canEdit && (
                            <Lock className="h-8 w-8 text-red-500" />
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Lock Warning Banner - Show remaining time */}
                  {lockStatus && !lockStatus.isLocked && lockStatus.lockTimeRemaining !== null && lockStatus.lockTimeRemaining > 0 && (
                    <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
                      <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      <AlertDescription className="ml-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-amber-800 dark:text-amber-200">
                              Часът ще се заключи след {lockStatus.lockTimeRemaining} {lockStatus.lockTimeRemaining === 1 ? "минута" : "минути"}
                            </span>
                            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                              След изтичане на времето, само администратор ще може да редактира часа.
                            </p>
                          </div>
                          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                            {lockStatus.lockTimeRemaining} мин
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Lesson Taken Toggle */}
                  <div className="flex items-center justify-between p-4 border-2 rounded-lg bg-background">
                    <Label className="text-base font-semibold">Маркирай часа като взет</Label>
                    <div className="flex items-center gap-3">
                      <Button
                        size="lg"
                        variant={!isTaken ? "destructive" : "ghost"}
                        onClick={() => setIsTaken(false)}
                        className="min-w-[60px] font-bold"
                        disabled={lockStatus?.isLocked && !lockStatus.canEdit}
                      >
                        НЕ
                      </Button>
                      <Button
                        size="lg"
                        variant={isTaken ? "default" : "ghost"}
                        onClick={() => setIsTaken(true)}
                        className="min-w-[60px] font-bold bg-green-600 hover:bg-green-700"
                        disabled={lockStatus?.isLocked && !lockStatus.canEdit}
                      >
                        ДА
                      </Button>
                      <div className="w-px h-8 bg-border mx-2" />
                      <Button
                        size="lg"
                        variant="secondary"
                        onClick={handleRandomStudent}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
                        title="Избери случаен ученик"
                      >
                        <Dices className="h-5 w-5 mr-2" />
                        Случаен ученик
                      </Button>
                    </div>
                  </div>

                  {/* Save Button - Always visible when lesson panel is open */}
                  {/* Show warning only when transitioning from taken to not taken */}
                  {!isTaken && originalIsTaken && (
                    <div className="p-4 bg-orange-50 dark:bg-orange-950/30 border-2 border-orange-300 dark:border-orange-700 rounded-lg">
                      <p className="text-sm text-orange-700 dark:text-orange-300 mb-3">
                        Часът ще бъде маркиран като <strong>невзет</strong>. Всички въведени оценки и отзиви ще бъдат запазени.
                      </p>
                      <Button 
                        onClick={handleSaveAll} 
                        size="lg" 
                        className="bg-orange-600 hover:bg-orange-700 min-w-[200px]"
                        disabled={lockStatus?.isLocked && !lockStatus.canEdit}
                      >
                        <Save className="h-5 w-5 mr-2" />
                        Запази като невзет
                      </Button>
                    </div>
                  )}

                  {/* Education Type - show when lesson is taken */}
                  {isTaken && (
                    <div className="flex items-center justify-between p-4 border-2 rounded-lg bg-background">
                      <Label className="text-base font-semibold">Вид обучение</Label>
                      <div className="flex items-center gap-2">
                        {EDUCATION_TYPES.map((type) => (
                          <Button
                            key={type.value}
                            size="lg"
                            variant={educationType === type.value ? "default" : "ghost"}
                            onClick={() => setEducationType(type.value as "inPerson" | "online")}
                            disabled={lockStatus?.isLocked && !lockStatus.canEdit}
                            className={cn(
                              "min-w-[120px] font-bold",
                              educationType === type.value && type.value === "inPerson" && "bg-blue-600 hover:bg-blue-700",
                              educationType === type.value && type.value === "online" && "bg-purple-600 hover:bg-purple-700"
                            )}
                          >
                            {type.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Show content only if lesson is taken */}
                {isTaken && (
                  <>
                    {/* Topic Input with Type Dropdown */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Тема на часа</Label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            className="w-full px-4 py-3 border-2 rounded-lg text-base bg-background disabled:opacity-50 disabled:cursor-not-allowed"
                            value={topic}
                            disabled={lockStatus?.isLocked && !lockStatus.canEdit}
                            onChange={(e) => {
                              setTopic(e.target.value);
                              if (selectedCurriculumTopicIds.length > 0) {
                                setSelectedCurriculumTopicIds([]);
                              }
                            }}
                            onFocus={() => setIsTopicFocused(true)}
                            placeholder="📝 Въведете тема на часа"
                          />
                        </div>
                        <Select value={lessonType} onValueChange={setLessonType}>
                          <SelectTrigger className="w-[200px] py-6">
                            <SelectValue placeholder="Тип урок" />
                          </SelectTrigger>
                          <SelectContent>
                            {LESSON_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Past taken topics - show on focus or when manually shown */}
                      {(isTopicFocused || showPastTopics) && (
                        <div className="border-2 border-green-300 dark:border-green-700 rounded-lg p-3 bg-green-50 dark:bg-green-950/30 max-h-48 overflow-y-auto space-y-1">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-green-700 dark:text-green-300">Минали взети теми:</p>
                            <button
                              type="button"
                              onClick={() => {
                                setShowPastTopics(false);
                                setIsTopicFocused(false);
                              }}
                              className="text-xs text-green-600 dark:text-green-400 hover:underline"
                            >
                              Скрий
                            </button>
                          </div>
                          {pastTopics && pastTopics.length > 0 ? (
                            pastTopics.map((pt) => {
                              const date = new Date(pt.date);
                              const formattedDate = `${date.getUTCDate().toString().padStart(2, '0')}.${(date.getUTCMonth() + 1).toString().padStart(2, '0')}.${date.getUTCFullYear()}`;
                              return (
                                <button
                                  key={pt._id}
                                  type="button"
                                  onClick={() => {
                                    setTopic(pt.topic);
                                    if (pt.lessonType) setLessonType(pt.lessonType);
                                    setShowPastTopics(false);
                                    setIsTopicFocused(false);
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-md bg-green-100 dark:bg-green-900/50 hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors"
                                >
                                  <span className="text-xs text-green-600 dark:text-green-400 mr-2">{formattedDate}</span>
                                  {pt.lessonType && (
                                    <span className="text-xs font-semibold text-green-700 dark:text-green-300 mr-2">[{pt.lessonType}]</span>
                                  )}
                                  <span className="text-sm text-green-800 dark:text-green-200">{pt.topic}</span>
                                </button>
                              );
                            })
                          ) : (
                            <p className="text-sm text-green-600 dark:text-green-400 italic">
                              Няма записани минали теми за този предмет и клас.
                            </p>
                          )}
                        </div>
                      )}
                      
                      {/* Show past topics toggle if hidden and not focused */}
                      {!isTopicFocused && !showPastTopics && (
                        <button
                          type="button"
                          onClick={() => setShowPastTopics(true)}
                          className="text-xs text-green-600 dark:text-green-400 hover:underline"
                        >
                          Покажи минали взети теми {pastTopics && pastTopics.length > 0 ? `(${pastTopics.length})` : ""}
                        </button>
                      )}

                      {/* Curriculum topics - if available */}
                      {lessonDetails?.curriculumTopics && lessonDetails.curriculumTopics.length > 0 && (
                        <div className="border-2 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2 bg-background">
                          <p className="text-xs text-muted-foreground mb-2">Или изберете от тематичното разпределение:</p>
                          {lessonDetails.curriculumTopics.map((t) => {
                            const isLinkedToThisLesson = (t as { coveredByLessonId?: string }).coveredByLessonId === currentLessonId;
                            return (
                            <label
                              key={t._id}
                              className={cn(
                                "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors",
                                selectedCurriculumTopicIds.includes(t._id)
                                  ? "bg-primary/10 border border-primary"
                                  : "hover:bg-muted",
                                isLinkedToThisLesson && "bg-green-50 dark:bg-green-950/30 border border-green-300 dark:border-green-700"
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={selectedCurriculumTopicIds.includes(t._id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCurriculumTopicIds(prev => [...prev, t._id]);
                                    setTopic(prev => {
                                      const titles = prev ? prev.split(" | ") : [];
                                      if (!titles.includes(t.title)) {
                                        titles.push(t.title);
                                      }
                                      return titles.join(" | ");
                                    });
                                  } else {
                                    setSelectedCurriculumTopicIds(prev => prev.filter(id => id !== t._id));
                                    setTopic(prev => {
                                      const titles = prev.split(" | ").filter(title => title !== t.title);
                                      return titles.join(" | ");
                                    });
                                  }
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                              />
                              <span className="text-sm flex-1">
                                №{t.topicNumber} - {t.title}
                              </span>
                              {isLinkedToThisLesson && (
                                <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                  ✓ вече взета
                                </span>
                              )}
                            </label>
                          );
                          })}
                        </div>
                      )}
                      
                      {/* Selected topics display */}
                      {selectedCurriculumTopicIds.length > 0 && (
                        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-2">
                          <p className="text-xs font-medium text-green-700 dark:text-green-300">
                            Избрани теми от разпределението: {selectedCurriculumTopicIds.length}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Homework Input Section */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">📚 Домашна работа</Label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <input
                            type="text"
                            className="w-full px-4 py-3 border-2 rounded-lg text-base bg-background"
                            value={homeworkText}
                            onChange={(e) => setHomeworkText(e.target.value)}
                            placeholder="Въведете домашна работа (по желание)"
                          />
                        </div>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-[180px] justify-start text-left font-normal py-6",
                                !homeworkDeadline && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {homeworkDeadline ? format(homeworkDeadline, "dd.MM.yyyy", { locale: bg }) : "Срок"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={homeworkDeadline}
                              onSelect={setHomeworkDeadline}
                              initialFocus
                              locale={bg}
                              disabled={(date) => date < new Date()}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      {homeworkText && !homeworkDeadline && (
                        <p className="text-xs text-orange-600 dark:text-orange-400">
                          Моля, изберете срок за домашната работа
                        </p>
                      )}
                    </div>

                    {/* Students Table */}
                    {studentRows.length === 0 ? (
                      <div className="py-8 text-center text-muted-foreground">
                        <p>Зареждане на ученици...</p>
                      </div>
                    ) : (
                      <div className="border-2 rounded-lg overflow-hidden">
                        {/* Bulk apply row */}
                        <div className="bg-primary/5 border-b-2 border-primary/20 p-3">
                          <p className="text-xs font-medium text-primary mb-2">⚡ Приложи за всички ученици:</p>
                          <div className="flex flex-wrap gap-4 items-center">
                            {/* Bulk Grade */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Оценка:</span>
                              <div className="flex gap-1">
                                {["2", "3", "4", "5", "6"].map((grade) => (
                                  <button
                                    key={grade}
                                    type="button"
                                    onClick={() => {
                                      setStudentRows((prev) => 
                                        prev.map(row => ({ ...row, gradeValue: grade }))
                                      );
                                      toast.success(`Оценка ${grade} е приложена за всички`);
                                    }}
                                    className={cn(
                                      "w-8 h-8 rounded text-sm font-bold transition-all",
                                      getGradeButtonStyle(grade, false)
                                    )}
                                    title={`Приложи ${grade} за всички`}
                                  >
                                    {getGradeDisplay(grade, isLowerGrades)}
                                  </button>
                                ))}
                              </div>
                            </div>
                            
                            {/* Bulk Grade Type */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Тип:</span>
                              <select
                                className="px-2 py-1.5 border rounded text-xs bg-background min-w-[140px]"
                                onChange={(e) => {
                                  if (!e.target.value) return;
                                  setStudentRows((prev) => 
                                    prev.map(row => ({ ...row, gradeType: e.target.value }))
                                  );
                                  toast.success("Типът е приложен за всички");
                                  e.target.value = "";
                                }}
                                defaultValue=""
                              >
                                <option value="">Избери за всички</option>
                                <option value="Устно изпитване">Устно изпитване</option>
                                <option value="Писмено изпитване">Писмено изпитване</option>
                                <option value="Практическо изпитване">Практическо изпитване</option>
                                <option value="Тест">Тест</option>
                                <option value="Активно участие">Активно участие</option>
                                <option value="Проект">Проект</option>
                                <option value="Самостоятелна работа">Самостоятелна работа</option>
                                <option value="Домашна работа">Домашна работа</option>
                                <option value="Контролна работа">Контролна работа</option>
                                <option value="Класна работа">Класна работа</option>
                                <option value="Входно равнище">Входно равнище</option>
                                <option value="Междинно равнище">Междинно равнище</option>
                                <option value="Изходно равнище">Изходно равнище</option>
                              </select>
                            </div>
                            
                            {/* Clear All Grades */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                              onClick={() => {
                                setStudentRows((prev) => 
                                  prev.map(row => ({ ...row, gradeValue: "", gradeType: "" }))
                                );
                                toast.success("Всички оценки са изчистени");
                              }}
                            >
                              ✕ Изчисти оценки
                            </Button>
                          </div>
                        </div>
                        
                        <table className="w-full">
                          <thead className="bg-muted">
                            <tr>
                              <th className="text-left py-3 px-4 font-semibold">Ученик</th>
                              <th className="text-left py-3 px-4 font-semibold">Присъствие</th>
                              <th className="text-left py-3 px-4 font-semibold">Текуща оценка</th>
                              <th className="text-left py-3 px-4 font-semibold w-[200px]">Тип</th>
                              <th className="text-left py-3 px-4 font-semibold">Отзив</th>
                            </tr>
                          </thead>
                          <tbody>
                            {studentRows.map((row, index) => (
                              <tr key={row.studentId} className="border-t hover:bg-muted/30">
                                <td className="py-3 px-4 font-medium">{row.studentName}</td>
                                <td className="py-3 px-4">
                                  <button
                                    className={`px-4 py-2 rounded-md text-sm font-bold min-w-[90px] transition-colors ${getAttendanceColor(row.attendanceStatus)}`}
                                    onClick={() => handleAttendanceClick(index)}
                                  >
                                    {getAttendanceLabel(row.attendanceStatus)}
                                  </button>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-1">
                                    {["2", "3", "4", "5", "6"].map((grade) => (
                                      <button
                                        key={grade}
                                        type="button"
                                        onClick={() => {
                                          setStudentRows((prev) => {
                                            const updated = [...prev];
                                            // Toggle: if same grade is clicked, deselect
                                            if (updated[index].gradeValue === grade) {
                                              updated[index].gradeValue = "";
                                              updated[index].gradeType = "";
                                            } else {
                                              updated[index].gradeValue = grade;
                                            }
                                            return updated;
                                          });
                                        }}
                                        className={getGradeButtonStyle(grade, row.gradeValue === grade)}
                                        title={`Оценка ${grade}`}
                                      >
                                        {getGradeDisplay(grade, isLowerGrades)}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <select
                                    className="w-full px-3 py-1.5 border-2 rounded-md text-sm"
                                    value={row.gradeType}
                                    onChange={(e) => {
                                      setStudentRows((prev) => {
                                        const updated = [...prev];
                                        updated[index].gradeType = e.target.value;
                                        return updated;
                                      });
                                    }}
                                  >
                                    <option value="">Изберете</option>
                                    <option value="Устно изпитване">Устно изпитване</option>
                                    <option value="Писмено изпитване">Писмено изпитване</option>
                                    <option value="Практическо изпитване">Практическо изпитване</option>
                                    <option value="Тест">Тест</option>
                                    <option value="Активно участие">Активно участие</option>
                                    <option value="Проект">Проект</option>
                                    <option value="Самостоятелна работа">Самостоятелна работа</option>
                                    <option value="Домашна работа">Домашна работа</option>
                                    <option value="Контролна работа">Контролна работа</option>
                                    <option value="Класна работа">Класна работа</option>
                                    <option value="Входно равнище">Входно равнище</option>
                                    <option value="Междинно равнище">Междинно равнище</option>
                                    <option value="Изходно равнище">Изходно равнище</option>
                                  </select>
                                </td>
                                <td className="py-3 px-4">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenBadgeModal(index)}
                                  >
                                    <Award className="h-4 w-4 mr-1" />
                                    {row.badges.length > 0 ? `(${row.badges.length})` : ""}
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Save Button */}
                    <div className="flex justify-end pt-4">
                      <Button 
                        onClick={handleSaveAll} 
                        size="lg" 
                        className="bg-teal-600 hover:bg-teal-700 min-w-[200px]"
                      >
                        <Save className="h-5 w-5 mr-2" />
                        Запази промените
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            )}
          </>
        )}
      </div>

      {/* Badge Modal */}
      <Dialog open={badgeModalOpen} onOpenChange={setBadgeModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Отзиви и значки</DialogTitle>
            <DialogDescription>
              Изберете похвали или забележки за ученика
            </DialogDescription>
          </DialogHeader>
          
          {/* Tab Buttons */}
          <div className="flex gap-2 border-b pb-4">
            <Button
              size="lg"
              variant={badgeTab === "praise" ? "default" : "ghost"}
              onClick={() => setBadgeTab("praise")}
              className={cn(
                "flex-1 font-bold",
                badgeTab === "praise" && "bg-green-600 hover:bg-green-700"
              )}
            >
              <ThumbsUp className="h-5 w-5 mr-2" />
              Похвали
              {tempBadges.filter(b => badgeLabels[b]?.category === "praise").length > 0 && (
                <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-sm">
                  {tempBadges.filter(b => badgeLabels[b]?.category === "praise").length}
                </span>
              )}
            </Button>
            <Button
              size="lg"
              variant={badgeTab === "remark" ? "default" : "ghost"}
              onClick={() => setBadgeTab("remark")}
              className={cn(
                "flex-1 font-bold",
                badgeTab === "remark" && "bg-red-600 hover:bg-red-700"
              )}
            >
              <ThumbsDown className="h-5 w-5 mr-2" />
              Забележки
              {tempBadges.filter(b => badgeLabels[b]?.category === "remark").length > 0 && (
                <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-sm">
                  {tempBadges.filter(b => badgeLabels[b]?.category === "remark").length}
                </span>
              )}
            </Button>
          </div>

          <div className="py-4">
            {/* Praises Tab */}
            {badgeTab === "praise" && (
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(badgeLabels)
                  .filter(([, data]) => data.category === "praise")
                  .map(([badge, data]) => (
                    <button
                      key={badge}
                      onClick={() => toggleBadge(badge as BadgeType)}
                      className={`p-3 border rounded-md text-left text-sm transition-colors ${
                        tempBadges.includes(badge as BadgeType)
                          ? "bg-green-100 border-green-500 dark:bg-green-900 dark:border-green-600"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {tempBadges.includes(badge as BadgeType) && (
                          <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                        )}
                        <span className="text-xs leading-tight">{data.label}</span>
                      </div>
                    </button>
                  ))}
              </div>
            )}

            {/* Remarks Tab */}
            {badgeTab === "remark" && (
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(badgeLabels)
                  .filter(([, data]) => data.category === "remark")
                  .map(([badge, data]) => (
                    <button
                      key={badge}
                      onClick={() => toggleBadge(badge as BadgeType)}
                      className={`p-3 border rounded-md text-left text-sm transition-colors ${
                        tempBadges.includes(badge as BadgeType)
                          ? "bg-red-100 border-red-500 dark:bg-red-900 dark:border-red-600"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {tempBadges.includes(badge as BadgeType) && (
                          <Check className="h-4 w-4 text-red-600 flex-shrink-0" />
                        )}
                        <span className="text-xs leading-tight">{data.label}</span>
                      </div>
                    </button>
                  ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBadgeModalOpen(false)}>
              Откажи
            </Button>
            <Button onClick={handleSaveBadges} className="bg-teal-600 hover:bg-teal-700">Запази</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Random Student Modal - Prominent Display */}
      <Dialog open={randomStudentModalOpen} onOpenChange={setRandomStudentModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <div className="py-12 text-center">
            <div className="mb-6">
              <Dices className="h-16 w-16 mx-auto text-purple-500 animate-bounce" />
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-2xl p-8 mx-4 shadow-xl">
              <div className="text-8xl font-black mb-4">
                №{randomStudent?.number}
              </div>
              <div className="text-3xl font-bold tracking-wide">
                {randomStudent?.name}
              </div>
            </div>
            <p className="mt-6 text-muted-foreground text-sm">
              Случайно избран ученик от класа
            </p>
          </div>
          <DialogFooter className="sm:justify-center gap-2">
            <Button 
              onClick={handleRandomStudent}
              variant="secondary"
              className="bg-purple-100 hover:bg-purple-200 text-purple-700"
            >
              <Shuffle className="h-4 w-4 mr-2" />
              Ново теглене
            </Button>
            <Button onClick={() => setRandomStudentModalOpen(false)}>
              Затвори
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

export default function MyLesson() {
  return (
    <>
      <Unauthenticated>
        <Layout>
          <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-4">
            <p className="text-muted-foreground">
              Моля, влезте в акаунта си.
            </p>
            <SignInButton />
          </div>
        </Layout>
      </Unauthenticated>
      <AuthLoading>
        <Layout>
          <div className="p-6">
            <Skeleton className="h-96 w-full" />
          </div>
        </Layout>
      </AuthLoading>
      <Authenticated>
        <DiaryAccessGuard>
          <MyLessonInner />
        </DiaryAccessGuard>
      </Authenticated>
    </>
  );
}
