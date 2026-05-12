import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import { DiaryAccessGuard } from "@/components/DiaryAccessGuard.tsx";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import { AlertCircle, PlusIcon, UserIcon, FilterIcon, EditIcon, ChevronLeft, ChevronRight, InfoIcon, CalendarIcon, XIcon, BookOpenIcon, UsersIcon, ClockIcon, CheckCircleIcon, FileTextIcon, ArrowLeftIcon, CopyIcon, TrashIcon, AlertTriangleIcon } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { cn, formatUserName } from "@/lib/utils.ts";
import { useState, useMemo, useEffect, Component, type ReactNode } from "react";
import { UserNameLink } from "@/components/ui/user-name-link.tsx";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";

// Error boundary to catch invalid ID errors
interface ErrorBoundaryState {
  hasError: boolean;
}

class ScheduleErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// Helper to get Monday of the week containing a date
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  return new Date(d.setDate(diff));
}

// Term configuration type
type TermConfig = {
  terms?: Array<{
    termNumber: number;
    startDate: string;
    endDate: string;
  }>;
} | null | undefined;

// Helper to calculate ISO week number from the beginning of the year
function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday day 7
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

// Helper to calculate week number based on term configuration
function getWeekNumber(
  date: Date, 
  termConfig: TermConfig
): { 
  weekNumber: number; 
  weekStart: Date; 
  weekEnd: Date;
  isOutsideTerms: boolean;
  currentTermNumber: number | null;
} {
  // Get Monday of the given date
  const weekStart = getMonday(date);
  
  // Get Friday of current week
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 4);
  
  // Default to ISO week number
  let weekNumber = getISOWeekNumber(date);
  let isOutsideTerms = false;
  let currentTermNumber: number | null = null;
  
  // If no term config or no terms defined, use ISO week number
  if (!termConfig?.terms || termConfig.terms.length === 0) {
    return { weekNumber, weekStart, weekEnd, isOutsideTerms: false, currentTermNumber: null };
  }
  
  const terms = [...termConfig.terms].sort((a, b) => a.termNumber - b.termNumber);
  const dateTime = date.getTime();
  
  // Find which term the date falls into
  let foundTerm: typeof terms[0] | null = null;
  let previousTermsWeeks = 0;
  
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    const termStart = new Date(term.startDate);
    const termEnd = new Date(term.endDate);
    termEnd.setHours(23, 59, 59, 999); // Include the entire end day
    
    if (dateTime >= termStart.getTime() && dateTime <= termEnd.getTime()) {
      foundTerm = term;
      currentTermNumber = term.termNumber;
      break;
    }
    
    // Calculate weeks in previous terms for cumulative counting
    const termMonday = getMonday(termStart);
    const termEndMonday = getMonday(termEnd);
    const termWeeks = Math.floor((termEndMonday.getTime() - termMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
    previousTermsWeeks += termWeeks;
  }
  
  if (foundTerm) {
    // Use ISO week number instead of term-based calculation for consistency
    weekNumber = getISOWeekNumber(date);
  } else {
    // Date is outside all terms — check if it's between terms (school vacation)
    // or truly outside the school year
    const firstTermStart = new Date(terms[0].startDate).getTime();
    const lastTermEnd = new Date(terms[terms.length - 1].endDate);
    lastTermEnd.setHours(23, 59, 59, 999);
    
    if (dateTime >= firstTermStart && dateTime <= lastTermEnd.getTime()) {
      // Between terms (e.g. inter-term vacation) — still within school year
      isOutsideTerms = false;
    } else {
      // Truly outside the school year
      isOutsideTerms = true;
    }
    // Still use ISO week number
    weekNumber = getISOWeekNumber(date);
  }
  
  return {
    weekNumber,
    weekStart,
    weekEnd,
    isOutsideTerms,
    currentTermNumber,
  };
}

function ClassScheduleInner() {
  const { classId } = useParams<{ classId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Build return URL for profile links
  const returnUrl = location.pathname + location.search;
  
  // Get term configuration for the class
  const termConfig = useQuery(
    api.terms.getTermConfigByClass,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  // Week navigation state - initialize with simple dates, will update when termConfig loads
  const [selectedWeek, setSelectedWeek] = useState<{
    weekNumber: number;
    weekStart: Date;
    weekEnd: Date;
    isOutsideTerms: boolean;
    currentTermNumber: number | null;
  }>(() => {
    const now = new Date();
    const weekStart = getMonday(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 4);
    return { weekNumber: 1, weekStart, weekEnd, isOutsideTerms: false, currentTermNumber: null };
  });
  
  // Track if we've already initialized with the term config
  const [initialized, setInitialized] = useState(false);
  
  // Reset initialization when classId changes
  useEffect(() => {
    setInitialized(false);
  }, [classId]);
  
  // Update selected week when term config loads (only once per class)
  useEffect(() => {
    if (termConfig !== undefined && !initialized) {
      const now = new Date();
      setSelectedWeek(getWeekNumber(now, termConfig));
      setInitialized(true);
    }
  }, [termConfig, initialized]);

  // Lesson details full-screen state
  const [showLessonDetails, setShowLessonDetails] = useState(false);
  const [selectedLessonEntry, setSelectedLessonEntry] = useState<{
    subjectId: Id<"subjects">;
    subjectName: string;
    dayOfWeek: number;
    periodIndex: number;
    teacherUserId?: string;
    groupId?: string;
  } | null>(null);
  
  // Delete and duplicate state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [selectedTargetClassId, setSelectedTargetClassId] = useState<string>("");
  
  // Mutations
  const duplicateSchedule = useMutation(api.weeklySchedules.duplicate);
  const duplicateToClass = useMutation(api.weeklySchedules.duplicateToClass);
  const deleteSchedule = useMutation(api.weeklySchedules.remove);
  
  // Get current user for admin check
  const currentUser = useQuery(api.users.getCurrentUser, {});
  
  // Check if user is admin (only admins can edit schedules)
  const isAdmin = currentUser?.roles?.includes("director") || 
                  currentUser?.roles?.includes("vice_director") ||
                  currentUser?.roles?.includes("system_admin");

  // Check if the selected week falls within summer vacation (July 20 - September 15)
  // Only during this period should the schedule be hidden
  const checkSummerVacation = (week: typeof selectedWeek): boolean => {
    if (!week.isOutsideTerms) return false;
    const midWeek = new Date(week.weekStart);
    midWeek.setDate(midWeek.getDate() + 2);
    const month = midWeek.getMonth();
    const day = midWeek.getDate();
    if (month === 6 && day >= 20) return true;
    if (month === 7) return true;
    if (month === 8 && day <= 15) return true;
    return false;
  };
  const isSummerVacation = checkSummerVacation(selectedWeek);
  
  // Get all classes for duplicate selector
  const allClasses = useQuery(api.admin.listClasses, {});
  
  const classData = useQuery(
    api.admin.getClassById,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  const scheduleData = useQuery(
    api.weeklySchedules.getByClass,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  // Get platform settings to check if weekends should be included
  const platformSettings = useQuery(api.platformSettings.getAllSettings, {});
  
  // Get absences for current week - use UTC midnight for consistent date handling
  const weekAbsences = useQuery(
    api.teacherAbsences.getAbsencesForWeek,
    classId ? {
      startDate: Date.UTC(
        selectedWeek.weekStart.getFullYear(),
        selectedWeek.weekStart.getMonth(),
        selectedWeek.weekStart.getDate()
      ),
      endDate: Date.UTC(
        selectedWeek.weekEnd.getFullYear(),
        selectedWeek.weekEnd.getMonth(),
        selectedWeek.weekEnd.getDate(),
        23, 59, 59, 999
      ),
      classId: classId as Id<"classes">,
    } : "skip"
  );
  
  // Get taken lessons for current week - use UTC midnight for consistent date handling
  const takenLessons = useQuery(
    api.teacherAbsences.getTakenLessonsForWeek,
    classId ? {
      startDate: Date.UTC(
        selectedWeek.weekStart.getFullYear(),
        selectedWeek.weekStart.getMonth(),
        selectedWeek.weekStart.getDate()
      ),
      endDate: Date.UTC(
        selectedWeek.weekEnd.getFullYear(),
        selectedWeek.weekEnd.getMonth(),
        selectedWeek.weekEnd.getDate(),
        23, 59, 59, 999
      ),
      classId: classId as Id<"classes">,
    } : "skip"
  );
  
  // Get non-school days for current week - use UTC midnight for consistent date handling
  const nonSchoolDays = useQuery(
    api.nonSchoolDays.getNonSchoolDaysForWeek,
    classId ? {
      startDate: Date.UTC(
        selectedWeek.weekStart.getFullYear(),
        selectedWeek.weekStart.getMonth(),
        selectedWeek.weekStart.getDate()
      ),
      endDate: Date.UTC(
        selectedWeek.weekEnd.getFullYear(),
        selectedWeek.weekEnd.getMonth(),
        selectedWeek.weekEnd.getDate(),
        23, 59, 59, 999
      ),
      classId: classId as Id<"classes">,
    } : "skip"
  );

  // Calculate date for the selected lesson entry
  const selectedEntryDate = useMemo(() => {
    if (!selectedLessonEntry) return null;
    const weekStart = new Date(selectedWeek.weekStart);
    const targetDate = new Date(weekStart);
    targetDate.setDate(targetDate.getDate() + (selectedLessonEntry.dayOfWeek - 1));
    return targetDate.getTime();
  }, [selectedLessonEntry, selectedWeek.weekStart]);

  // Get lesson details for modal
  const lessonDetails = useQuery(
    api.lessons.getScheduleEntryDetails,
    classId && selectedLessonEntry && selectedEntryDate
      ? {
          classId: classId as Id<"classes">,
          subjectId: selectedLessonEntry.subjectId,
          dayOfWeek: selectedLessonEntry.dayOfWeek,
          periodIndex: selectedLessonEntry.periodIndex,
          date: selectedEntryDate,
          teacherUserId: selectedLessonEntry.teacherUserId,
          groupId: selectedLessonEntry.groupId ? selectedLessonEntry.groupId as Id<"classGroups"> : undefined,
        }
      : "skip"
  );
  
  // Build a map of day -> non-school day info
  const nonSchoolDayMap = useMemo(() => {
    const map: Record<number, { name: string; category: string }> = {};
    if (nonSchoolDays) {
      for (const nsd of nonSchoolDays) {
        for (const day of nsd.affectedDays) {
          map[day] = { name: nsd.name, category: nsd.category };
        }
      }
    }
    return map;
  }, [nonSchoolDays]);
  
  // Build absence map: dayOfWeek -> periodIndex -> substitute teacher info
  const absenceMap = useMemo(() => {
    const map: Record<number, Record<number, { 
      substituteTeacherName: string | null; 
      substituteTeacherUserId?: string;
      substituteTeacherFirstName?: string;
      substituteTeacherMiddleName?: string;
      substituteTeacherLastName?: string;
      originalTeacher: string;
      originalTeacherUserId?: string;
      isCivicEducation?: boolean; 
      isFree?: boolean 
    }>> = {};
    
    if (weekAbsences) {
      for (const absence of weekAbsences) {
        for (const entry of absence.affectedEntries) {
          if (!map[entry.dayOfWeek]) {
            map[entry.dayOfWeek] = {};
          }
          // Use entry.periodIndex directly (it's already 0-based from backend)
          map[entry.dayOfWeek][entry.periodIndex] = {
            substituteTeacherName: entry.substituteTeacherName,
            substituteTeacherUserId: entry.substituteTeacherUserId,
            substituteTeacherFirstName: entry.substituteTeacherFirstName,
            substituteTeacherMiddleName: entry.substituteTeacherMiddleName,
            substituteTeacherLastName: entry.substituteTeacherLastName,
            originalTeacher: absence.teacherName,
            originalTeacherUserId: absence.teacherUserId,
            isCivicEducation: entry.isCivicEducation,
            isFree: entry.isFree,
          };
        }
      }
    }
    
    return map;
  }, [weekAbsences]);
  
  // Get current day of week to highlight (1 = Monday, 7 = Sunday)
  const today = new Date();
  const currentDayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
  
  // Check if selected week is the current week (compare dates only, ignore time)
  const currentWeekInfo = useMemo(() => getWeekNumber(new Date(), termConfig), [termConfig]);
  const isCurrentWeek = useMemo(() => {
    const selected = selectedWeek.weekStart;
    const current = currentWeekInfo.weekStart;
    return selected.getFullYear() === current.getFullYear() &&
           selected.getMonth() === current.getMonth() &&
           selected.getDate() === current.getDate();
  }, [selectedWeek.weekStart, currentWeekInfo.weekStart]);
  
  const handlePreviousWeek = () => {
    const newDate = new Date(selectedWeek.weekStart);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedWeek(getWeekNumber(newDate, termConfig));
  };
  
  const handleNextWeek = () => {
    const newDate = new Date(selectedWeek.weekStart);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedWeek(getWeekNumber(newDate, termConfig));
  };
  
  const handleCurrentWeek = () => {
    setSelectedWeek(getWeekNumber(new Date(), termConfig));
  };
  
  const stats = [
    { label: "Оц.", link: `/bg/diary/class/${classId}/grades` },
    { label: "Отс.", link: `/bg/diary/class/${classId}/absences` },
    { label: "Отз.", link: `/bg/diary/class/${classId}/reviews` },
    { label: "Раз.", link: `/bg/diary/class/${classId}/schedule` },
    { label: "Тем.", link: `/bg/diary/class/${classId}/topics` },
    { label: "Кон.", link: `/bg/diary/class/${classId}/tests` },
    { label: "Дом.", link: `/bg/diary/class/${classId}/homework` },
    { label: "ВЧК", link: `/bg/diary/class/${classId}/internal-commission` },
    { label: "Род.", link: `/bg/diary/class/${classId}/parent-meetings` },
    { label: "Поп.", link: `/bg/diary/class/${classId}/remedial-exams` },
    { label: "Под.", link: `/bg/diary/class/${classId}/student-support` },
    { label: "Сан.", link: `/bg/diary/class/${classId}/sanctions` },
    { label: "Год.", link: `/bg/diary/class/${classId}/annual-results` },
    { label: "Уч.", link: `/bg/diary/class/${classId}/students` },
  ];
  
  // Determine which term today falls in (active term) - must be before early returns
  const activeTermNumber = useMemo(() => {
    if (!termConfig?.terms || termConfig.terms.length === 0) return null;
    const now = Date.now();
    const sorted = [...termConfig.terms].sort((a, b) => a.termNumber - b.termNumber);
    for (const term of sorted) {
      const start = new Date(term.startDate).getTime();
      const end = new Date(term.endDate);
      end.setHours(23, 59, 59, 999);
      if (now >= start && now <= end.getTime()) return term.termNumber;
    }
    // If between terms, return the next upcoming term
    for (const term of sorted) {
      if (now < new Date(term.startDate).getTime()) return term.termNumber;
    }
    // Past all terms — return the last one
    return sorted[sorted.length - 1]?.termNumber ?? null;
  }, [termConfig]);

  // Check if viewing a past term that has no dedicated schedule - must be before early returns
  const isViewingPastTermWithoutSchedule = useMemo(() => {
    if (activeTermNumber === null || selectedWeek.currentTermNumber === null) return false;
    const scheduleTermId = scheduleData?.schedule?.termId;
    // Viewing a term earlier than the active one, and schedule has no term assignment
    return selectedWeek.currentTermNumber < activeTermNumber && !scheduleTermId;
  }, [activeTermNumber, selectedWeek.currentTermNumber, scheduleData]);

  if (!classId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Грешка</CardTitle>
          <CardDescription>
            Не е намерен клас.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!classData || scheduleData === undefined) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const classTeacher = classData.classTeacher;

  if (!scheduleData.schedule) {
    return (
      <div className="flex h-screen flex-col bg-background">
        {/* Header */}
        <div className="border-b bg-background">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-lg font-semibold">
                {isAdmin ? (
                  <Link 
                    to={`/bg/admin/classes/${classId}`}
                    className="text-primary hover:underline"
                  >
                    {classData.name}
                  </Link>
                ) : (
                  classData.name
                )} -{" "}
                {classTeacher ? (
                  <Link 
                    to={`/bg/admin/user/${classTeacher._id}`}
                    state={{ returnUrl }}
                    className="text-primary hover:underline"
                  >
                    {classTeacher.firstName} {classTeacher.lastName} (класен)
                  </Link>
                ) : (
                  "Без класен ръководител"
                )}
              </h1>
            </div>
            <Button variant="outline" size="sm">
              <FilterIcon className="h-4 w-4 mr-2" />
              Филтри
            </Button>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-2 px-6 py-2 border-t overflow-x-auto">
            {stats.map((stat, index) => {
              const isActive = location.pathname === stat.link;
              return (
                <Link
                  key={index}
                  to={stat.link}
                  className={cn(
                    "px-4 py-2 text-sm font-medium whitespace-nowrap rounded transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  )}
                >
                  {stat.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 items-center justify-center">
          <Card className="w-full max-w-md mx-6">
            <CardHeader>
              <CardTitle className="text-center">Липсват данни за разписанието на класа</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Link to={`/bg/diary/class/${classId}/schedule/add`}>
                <Button className="gap-2">
                  <PlusIcon className="h-4 w-4" />
                  Добави
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { schedule, enrichedEntries, dayRegime } = scheduleData;

  const daysOfWeek = [
    { num: 1, name: "Понеделник" },
    { num: 2, name: "Вторник" },
    { num: 3, name: "Сряда" },
    { num: 4, name: "Четвъртък" },
    { num: 5, name: "Петък" },
    // Conditionally include weekends based on platform settings
    ...(platformSettings?.includeWeekends ? [
      { num: 6, name: "Събота" },
      { num: 7, name: "Неделя" },
    ] : []),
  ];

  // Calculate number of columns based on days
  const columnCount = platformSettings?.includeWeekends ? 7 : 5;

  const periodCount = dayRegime?.periodCount ?? 7;

  // Single entry type
  type ScheduleEntry = {
    subjectId: Id<"subjects">;
    subjectName: string;
    teacherName: string;
    teacherUserId?: string;
    teacherFirstName?: string;
    teacherMiddleName?: string;
    teacherLastName?: string;
    roomName: string | null;
    preparationType?: string;
    weekNumbers?: number[];
    groupId?: string;
    groupName?: string;
  };

  // Filter enriched entries by the currently viewed week number
  // Entries without weekNumbers (legacy) apply to all weeks
  const currentWeekNumber = selectedWeek.weekNumber;
  const weekFilteredEntries = enrichedEntries.filter((e) => {
    if (!e.weekNumbers || e.weekNumbers.length === 0) return true; // Legacy: show for all weeks
    return e.weekNumbers.includes(currentWeekNumber);
  });
  // Fallback: if filtering by week results in no entries but entries exist,
  // show all entries (weekNumbers range may not cover the full school year)
  const filteredEntries = weekFilteredEntries.length > 0 ? weekFilteredEntries : enrichedEntries;

  // Build a grid: period x day - now supports MULTIPLE entries per cell (co-teaching)
  const grid: Array<Array<ScheduleEntry[]>> = [];

  for (let period = 1; period <= periodCount; period++) {
    const row: ScheduleEntry[][] = [];
    for (let day = 1; day <= columnCount; day++) {
      // Get ALL entries for this day/period (not just the first one)
      const entries = filteredEntries.filter(
        (e) => e.dayOfWeek === day && e.periodIndex === period
      );
      row.push(entries);
    }
    grid.push(row);
  }

  const handleSubjectClick = (cell: {
    subjectId: Id<"subjects">;
    subjectName: string;
    teacherUserId?: string;
    groupId?: string;
  }, dayOfWeek: number, periodIndex: number) => {
    setSelectedLessonEntry({
      subjectId: cell.subjectId,
      subjectName: cell.subjectName,
      dayOfWeek,
      periodIndex,
      teacherUserId: cell.teacherUserId,
      groupId: cell.groupId,
    });
    setShowLessonDetails(true);
  };

  // Full-screen lesson details view
  if (showLessonDetails) {
    return (
      <div className="flex h-screen flex-col bg-background">
        {/* Header */}
        <div className="border-b bg-background">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLessonDetails(false)}
              >
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Назад
              </Button>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <FileTextIcon className="h-5 w-5" />
                Занятие {lessonDetails?.lessonId ? `#${lessonDetails.lessonId.slice(-14)}` : ""}
              </h1>
            </div>

          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <Card className="max-w-3xl mx-auto">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileTextIcon className="h-4 w-4" />
                Основни данни
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {lessonDetails ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Паралелка:</span>
                    <span className="text-sm flex items-center gap-2">
                      <UsersIcon className="h-4 w-4 text-muted-foreground" />
                      {lessonDetails.className}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Предмет:</span>
                    <span className="text-sm flex items-center gap-2">
                      <BookOpenIcon className="h-4 w-4 text-muted-foreground" />
                      {lessonDetails.subjectName}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Водещ на часа:</span>
                    <span className="text-sm flex items-center gap-2">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                      {lessonDetails.isFreeLesson ? (
                        <span className="text-blue-600 dark:text-blue-400 font-medium">Свободен час</span>
                      ) : lessonDetails.isSubstitute ? (
                        <span className="text-orange-600 dark:text-orange-400">
                          {lessonDetails.actualTeacherName}
                          {lessonDetails.isCivicEducation && " ГО (...)"}
                          {" "}<span className="font-semibold">(ЗАМ.)</span>
                        </span>
                      ) : (
                        (lessonDetails.teacherNames && lessonDetails.teacherNames.length > 0 
                          ? lessonDetails.teacherNames.join(" | ") 
                          : lessonDetails.actualTeacherName || lessonDetails.teacherName || "—")
                      )}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Група:</span>
                    <span className="text-sm flex items-center gap-2">
                      <UsersIcon className="h-4 w-4 text-muted-foreground" />
                      {lessonDetails.groupInfo}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Дата и час на провеждане:</span>
                    <span className="text-sm flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      {lessonDetails.dateTime}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Вид обучение:</span>
                    <span className="text-sm">{lessonDetails.educationType}</span>
                  </div>
                  
                  <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Маркиран като взет:</span>
                    <span className="text-sm flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      {lessonDetails.markedAsTaken 
                        ? `${lessonDetails.markedAsTaken}${lessonDetails.markedAsTakenByName ? ` - ${lessonDetails.markedAsTakenByName}` : ""}`
                        : "—"}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Последна редакция:</span>
                    <span className="text-sm flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      {lessonDetails.lastEdited 
                        ? `${lessonDetails.lastEdited}${lessonDetails.lastEditedByName ? ` - ${lessonDetails.lastEditedByName}` : ""}`
                        : "—"}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Създаден на:</span>
                    <span className="text-sm flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      {lessonDetails.createdAt 
                        ? `${lessonDetails.createdAt}${lessonDetails.createdByName ? ` - ${lessonDetails.createdByName}` : ""}`
                        : "—"}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-[200px_1fr] gap-2 items-start">
                    <span className="text-sm font-medium text-muted-foreground">Взети теми:</span>
                    <div className="text-sm">
                      {lessonDetails.takenTopics.length > 0 ? (
                        <table className="w-full border-collapse border">
                          <thead>
                            <tr className="bg-muted">
                              <th className="border p-2 text-left text-xs font-medium w-12">№</th>
                              <th className="border p-2 text-left text-xs font-medium w-16">Седмица</th>
                              <th className="border p-2 text-left text-xs font-medium w-12">Вид</th>
                              <th className="border p-2 text-left text-xs font-medium">Тема</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lessonDetails.takenTopics.map((topic, idx) => (
                              <tr key={idx}>
                                <td className="border p-2 text-xs">{topic.topicNumber}</td>
                                <td className="border p-2 text-xs">{topic.weekNumber}</td>
                                <td className="border p-2 text-xs">
                                  <span className="px-1.5 py-0.5 bg-primary text-primary-foreground rounded text-[10px] font-medium">
                                    {topic.topicType}
                                  </span>
                                </td>
                                <td className="border p-2 text-xs">{topic.title}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <span className="text-muted-foreground">Няма взети теми</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Skeleton className="h-40 w-full" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">
              {isAdmin ? (
                <Link 
                  to={`/bg/admin/classes/${classId}`}
                  className="text-primary hover:underline"
                >
                  {classData.name}
                </Link>
              ) : (
                classData.name
              )} -{" "}
              {classTeacher ? (
                <Link 
                  to={`/bg/admin/user/${classTeacher._id}`}
                  state={{ returnUrl }}
                  className="text-primary hover:underline"
                >
                  {classTeacher.firstName} {classTeacher.lastName} (класен)
                </Link>
              ) : (
                "Без класен ръководител"
              )}
            </h1>
          </div>
          <Button variant="outline" size="sm">
            <FilterIcon className="h-4 w-4 mr-2" />
            Филтри
          </Button>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-2 px-6 py-2 border-t overflow-x-auto">
          {stats.map((stat, index) => {
            const isActive = location.pathname === stat.link;
            return (
              <Link
                key={index}
                to={stat.link}
                className={cn(
                  "px-4 py-2 text-sm font-medium whitespace-nowrap rounded transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                )}
              >
                {stat.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          {schedule.isPastYear && (
            <Alert
              variant="default"
              className="border-amber-200 bg-amber-50 dark:bg-amber-950/20"
            >
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-800 dark:text-amber-300">
                <strong>Внимание:</strong> Не може да добавяте и редактирате
                седмично разписание от предходни години. Този изглед е само за
                четене.
              </AlertDescription>
            </Alert>
          )}

          {/* Week Selector */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-2 border-blue-200 dark:border-blue-800">
            <CardContent className="p-6">
              {selectedWeek.isOutsideTerms && (
                <Alert className="mb-4 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertDescription className="text-amber-800 dark:text-amber-300">
                    <strong>Внимание:</strong> Избраната дата е извън учебната година. 
                    {termConfig?.terms && termConfig.terms.length > 0 && (
                      <span>
                        {" "}Учебната година е от {new Date(termConfig.terms[0].startDate).toLocaleDateString('bg-BG')} до {new Date(termConfig.terms[termConfig.terms.length - 1].endDate).toLocaleDateString('bg-BG')}.
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex items-center justify-between gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePreviousWeek}
                  className="shrink-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <div className="flex-1 text-center">
                  <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
                    {selectedWeek.isOutsideTerms ? (
                      "Извън учебната година"
                    ) : (
                      <>Седмица {selectedWeek.weekNumber}{selectedWeek.currentTermNumber && ` (Срок ${selectedWeek.currentTermNumber})`}</>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCurrentWeek}
                    className="text-xs"
                  >
                    Днес
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNextWeek}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Week Absences Info */}
          {!isSummerVacation && !isViewingPastTermWithoutSchedule && weekAbsences && weekAbsences.length > 0 && (
            <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
              <InfoIcon className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <AlertDescription className="text-orange-800 dark:text-orange-300">
                <strong>Отсъствия през тази седмица:</strong>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  {weekAbsences.map((absence) => (
                    <li key={absence._id}>
                      {absence.teacherName}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons - Only for admins */}
          {!isSummerVacation && !isViewingPastTermWithoutSchedule && !schedule.isPastYear && isAdmin && (
            <div className="flex justify-end gap-2 mb-4">
              <Link to={`/bg/diary/class/${classId}/schedule/edit/${schedule._id}`}>
                <Button className="gap-2">
                  <EditIcon className="h-4 w-4" />
                  Редактирай
                </Button>
              </Link>
              <Button 
                variant="secondary" 
                className="gap-2"
                onClick={() => setShowDuplicateDialog(true)}
              >
                <CopyIcon className="h-4 w-4" />
                Дублирай
              </Button>
              
              {/* Duplicate Dialog */}
              <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Дублиране на разписание</DialogTitle>
                    <DialogDescription>
                      Изберете паралелка, към която да копирате разписанието. Ако паралелката вече има разписание, то ще бъде заменено.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Изберете паралелка</Label>
                      <Select 
                        value={selectedTargetClassId} 
                        onValueChange={setSelectedTargetClassId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Изберете паралелка..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allClasses
                            ?.filter(c => c._id !== classId)
                            .map(c => (
                              <SelectItem key={c._id} value={c._id}>
                                {c.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowDuplicateDialog(false)}>
                      Отказ
                    </Button>
                    <Button 
                      disabled={!selectedTargetClassId}
                      onClick={async () => {
                        if (!selectedTargetClassId) return;
                        try {
                          await duplicateToClass({ 
                            id: schedule._id, 
                            targetClassId: selectedTargetClassId as Id<"classes"> 
                          });
                          const targetClassName = allClasses?.find(c => c._id === selectedTargetClassId)?.name || "";
                          toast.success(`Разписанието е копирано успешно към ${targetClassName}!`);
                          setShowDuplicateDialog(false);
                          setSelectedTargetClassId("");
                        } catch (error) {
                          toast.error("Грешка при дублиране на разписанието");
                        }
                      }}
                    >
                      Дублирай
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <TrashIcon className="h-4 w-4" />
                    Изтрий
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Изтриване на разписание</AlertDialogTitle>
                    <AlertDialogDescription>
                      Сигурни ли сте, че искате да изтриете това разписание? Тази операция е необратима.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отказ</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={async () => {
                        try {
                          await deleteSchedule({ id: schedule._id });
                          toast.success("Разписанието е изтрито успешно!");
                          navigate(`/bg/diary/class/${classId}`);
                        } catch (error) {
                          toast.error("Грешка при изтриване на разписанието");
                        }
                      }}
                    >
                      Изтрий
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {isViewingPastTermWithoutSchedule ? (
            <div className="text-center py-12">
              <CalendarIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground/60" />
              <p className="text-lg font-medium text-muted-foreground">
                Няма въведено разписание за Срок {selectedWeek.currentTermNumber}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                За този учебен срок не е било въведено разписание в системата.
              </p>
            </div>
          ) : isSummerVacation ? (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">
                Няма учебни занятия за показване по време на лятната ваканция.
              </p>
            </div>
          ) : (
          <>
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <div className="inline-block min-w-full align-middle">
              <table className="min-w-full border-collapse border border-border">
                <thead>
                  <tr className="bg-muted">
                    <th className="border border-border p-1 sm:p-2 text-xs sm:text-sm font-semibold sticky left-0 bg-muted z-10">
                      Час
                    </th>
                    {daysOfWeek.map((day) => {
                      const nonSchoolDay = nonSchoolDayMap[day.num];
                      // Calculate the date for this day based on selected week
                      const dayDate = new Date(selectedWeek.weekStart);
                      dayDate.setDate(dayDate.getDate() + (day.num - 1));
                      const formattedDate = dayDate.toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit' });
                      const isTodayColumn = isCurrentWeek && currentDayOfWeek === day.num && !nonSchoolDay;
                      
                      return (
                        <th
                          key={day.num}
                          className={cn(
                            "border border-border p-1 sm:p-2 text-xs sm:text-sm font-semibold min-w-[120px] sm:min-w-[150px]",
                            isTodayColumn && "bg-teal-100 dark:bg-teal-900 text-teal-900 dark:text-teal-100",
                            nonSchoolDay && "bg-blue-100 dark:bg-blue-900"
                          )}
                        >
                          <div className="flex flex-col items-center">
                            <span className="hidden sm:inline">{day.name}</span>
                            <span className="sm:hidden">{day.name.substring(0, 2)}</span>
                            <span className="text-[10px] sm:text-xs font-normal text-muted-foreground mt-0.5">{formattedDate}</span>
                          </div>
                          {isTodayColumn && (
                            <span className="text-xs font-normal block mt-0.5">(Днес)</span>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                  {/* Non-school days row */}
                  {Object.keys(nonSchoolDayMap).length > 0 && (
                    <tr>
                      <td className="border border-border p-1 sm:p-2 text-center text-xs sm:text-sm font-semibold bg-muted/50 sticky left-0 z-10">
                        &nbsp;
                      </td>
                      {daysOfWeek.map((day) => {
                        const nonSchoolDay = nonSchoolDayMap[day.num];
                        return (
                          <td
                            key={day.num}
                            className={cn(
                              "border border-border p-1 sm:p-2 text-center text-xs sm:text-sm",
                              nonSchoolDay && "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                            )}
                          >
                            {nonSchoolDay && (
                              <div className="flex items-center justify-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                  <line x1="16" y1="2" x2="16" y2="6"></line>
                                  <line x1="8" y1="2" x2="8" y2="6"></line>
                                  <line x1="3" y1="10" x2="21" y2="10"></line>
                                </svg>
                                <span className="font-medium">{nonSchoolDay.name}</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {grid.map((row, periodIdx) => {
                    return (
                    <tr key={periodIdx}>
                      <td className="border border-border p-1 sm:p-2 text-center text-xs sm:text-sm font-semibold bg-muted/50 sticky left-0 z-10">
                        {periodIdx + 1}
                      </td>
                      {row.map((cellEntries, dayIdx) => {
                        const isTodayColumn = isCurrentWeek && currentDayOfWeek === (dayIdx + 1);
                        const dayOfWeek = dayIdx + 1;
                        // Use periodIdx directly (0-based) to match absenceMap
                        const absence = absenceMap[dayOfWeek]?.[periodIdx];
                        const isTaken = takenLessons?.[`${dayOfWeek}_${periodIdx + 1}`] || false;
                        const nonSchoolDay = nonSchoolDayMap[dayOfWeek];
                        
                        // If it's a non-school day, show empty colored cell (the name is shown in the header row)
                        if (nonSchoolDay) {
                          return (
                            <td
                              key={dayIdx}
                              className="border border-border p-1 sm:p-2 align-middle text-center bg-blue-50 dark:bg-blue-950/30 min-w-[120px] sm:min-w-[150px] h-[80px] sm:h-[100px]"
                            >
                              {/* Empty cell - non-school day info is in header */}
                            </td>
                          );
                        }
                        
                        // Get the first entry for display (subject name) - all entries should have same subject
                        const cell = cellEntries.length > 0 ? cellEntries[0] : null;
                        // Get period time from dayRegime if available
                        const periodTimeForCell = dayRegime?.periods?.find(p => p.periodNumber === periodIdx + 1);
                        
                        return (
                          <td
                            key={dayIdx}
                            className={cn(
                              "border border-border p-1.5 sm:p-2 align-top min-w-[120px] sm:min-w-[160px]",
                              isTodayColumn && !isTaken && "bg-teal-50 dark:bg-teal-950/30",
                              isTaken && "bg-green-100 dark:bg-green-950/30"
                            )}
                          >
                            {cell ? (
                              <div className="space-y-1.5">
                                {/* Show each teacher in a separate visual block */}
                                {cellEntries.map((entry, entryIdx) => {
                                  // Check if THIS specific entry belongs to the absent teacher
                                  // Use teacherUserId comparison when available, fall back to entryIdx === 0
                                  const isAbsentTeacher = absence && (
                                    absence.originalTeacherUserId
                                      ? entry.teacherUserId === absence.originalTeacherUserId
                                      : entryIdx === 0
                                  );
                                  
                                  return (
                                  <div key={entry.teacherUserId || entryIdx} className={cn(
                                    "space-y-0.5",
                                    entryIdx > 0 && "pt-1 border-t border-border/50"
                                  )}>
                                    {/* Period number and subject */}
                                    <button
                                      onClick={() => handleSubjectClick(entry, dayOfWeek, periodIdx + 1)}
                                      className="font-bold text-xs sm:text-sm text-foreground hover:text-primary hover:underline cursor-pointer text-left w-full"
                                    >
                                      <span className="text-muted-foreground font-medium">{periodIdx + 1}.</span>{" "}
                                      {isAbsentTeacher ? (
                                        absence!.isFree ? (
                                          absence!.isCivicEducation ? "ГО" : entry.subjectName
                                        ) : (
                                          absence!.isCivicEducation 
                                            ? "ГО (...) (ЗАМ.)" 
                                            : `${entry.subjectName} (ЗАМ.)`
                                        )
                                      ) : (
                                        entry.preparationType && entry.preparationType !== "ООП" && entry.preparationType !== "ЗП"
                                          ? `${entry.subjectName} (${entry.preparationType})`
                                          : entry.subjectName
                                      )}
                                    </button>
                                    
                                    {/* Teacher with book icon */}
                                    <div className="flex items-start gap-1 text-[10px] sm:text-xs text-muted-foreground">
                                      <BookOpenIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0 mt-0.5" />
                                      <span className="break-words">
                                        {isAbsentTeacher ? (
                                          <>
                                            {absence!.isFree ? (
                                              <span className="text-blue-600 dark:text-blue-400 font-bold">Свободен час</span>
                                            ) : absence!.substituteTeacherUserId ? (
                                              <UserNameLink 
                                                userId={absence!.substituteTeacherUserId}
                                                firstName={absence!.substituteTeacherFirstName}
                                                middleName={absence!.substituteTeacherMiddleName}
                                                lastName={absence!.substituteTeacherLastName}
                                              />
                                            ) : absence!.substituteTeacherName ? (
                                              <span>{absence!.substituteTeacherName}</span>
                                            ) : (
                                              <span className="text-blue-600 dark:text-blue-400 font-bold">Свободен час</span>
                                            )}
                                          </>
                                        ) : (
                                          entry.teacherUserId ? (
                                            <UserNameLink 
                                              userId={entry.teacherUserId}
                                              firstName={entry.teacherFirstName}
                                              middleName={entry.teacherMiddleName}
                                              lastName={entry.teacherLastName}
                                            />
                                          ) : (
                                            <span>{entry.teacherName}</span>
                                          )
                                        )}
                                      </span>
                                    </div>
                                    
                                    {/* Group name badge */}
                                    {entry.groupName && (
                                      <div className="flex items-center gap-1 text-[10px] sm:text-xs">
                                        <UsersIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0 text-indigo-500" />
                                        <span className="text-indigo-600 dark:text-indigo-400 font-medium">{entry.groupName}</span>
                                      </div>
                                    )}
                                    
                                    {/* Time display - show for all entries */}
                                    {periodTimeForCell && (
                                      <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
                                        <ClockIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                                        <span>{periodTimeForCell.startTime} - {periodTimeForCell.endTime}</span>
                                      </div>
                                    )}
                                    
                                    {entry.roomName && (
                                      <div className="text-[10px] sm:text-xs text-muted-foreground">
                                        Каб. {entry.roomName}
                                      </div>
                                    )}
                                  </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground text-center py-4">—</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {dayRegime && (
            <Card>
              <CardHeader>
                <CardTitle>Дневен режим: {dayRegime.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-semibold">Начало:</span>{" "}
                    {dayRegime.startTime}
                  </div>
                  <div>
                    <span className="font-semibold">Край:</span>{" "}
                    {dayRegime.endTime}
                  </div>
                  <div>
                    <span className="font-semibold">Брой часове:</span>{" "}
                    {dayRegime.periodCount}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}

function InvalidClassFallback() {
  const navigate = useNavigate();
  
  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <Card className="p-8 max-w-md w-full">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertTriangleIcon />
            </EmptyMedia>
            <EmptyTitle>Невалиден клас</EmptyTitle>
            <EmptyDescription>
              Класът не е намерен или идентификаторът е невалиден. Моля, изберете клас от списъка.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => navigate("/bg")}>
              Към началната страница
            </Button>
          </EmptyContent>
        </Empty>
      </Card>
    </div>
  );
}

export default function ClassSchedule() {
  return (
    <Layout>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <p className="text-muted-foreground">Моля, влезте в профила си</p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="flex items-center justify-center min-h-screen">
          <Skeleton className="h-96 w-full max-w-md" />
        </div>
      </AuthLoading>
      <Authenticated>
        <ScheduleErrorBoundary fallback={<InvalidClassFallback />}>
          <DiaryAccessGuard>
            <ClassScheduleInner />
          </DiaryAccessGuard>
        </ScheduleErrorBoundary>
      </Authenticated>
    </Layout>
  );
}
