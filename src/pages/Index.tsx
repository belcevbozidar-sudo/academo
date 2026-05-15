import Layout from "@/components/Layout.tsx";
import {
  Authenticated,
  Unauthenticated,
  AuthLoading,
} from "@/lib/convex-preview";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import {
  TrendingUpIcon,
  GraduationCapIcon,
  CalendarIcon,
  MessageSquareIcon,
  BookOpenIcon,
  UserIcon,
  LogOutIcon,
  XCircleIcon,
  ClockIcon,
  AlertCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  UsersIcon,
  FileTextIcon,
  BarChartIcon,
  InfoIcon,
} from "lucide-react";
import { useState, useEffect, useRef, type ComponentType } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible.tsx";
import { useAuth } from "@/hooks/use-auth.ts";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";

const periodLabels = {
  "1m": "1м",
  "3m": "3м",
  "6m": "6м",
  "1y": "1г",
} as const;

function AcademoMetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <Card className="academo-soft-shadow overflow-hidden rounded-[28px] border-0 bg-white p-0 transition-transform duration-300 hover:-translate-y-0.5">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-black text-[#686974]">{title}</p>
            <div className="mt-4 text-4xl font-black leading-none text-[#0e0e12] lg:text-5xl">
              {value}
            </div>
            <p className="mt-2 text-sm font-bold text-[#8a8b92]">{detail}</p>
          </div>
          <div
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-[0_16px_34px_rgba(20,20,35,0.12)] ${tone}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Counter animation hook with easing
function useCountUp(end: number, duration: number = 1000) {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (end === 0) {
      setCount(0);
      return;
    }

    // Easing function: fast at start, slow at end (last 20%)
    const easeOutCubic = (t: number): number => {
      // For the first 80%, progress linearly but faster
      if (t < 0.8) {
        return t / 0.8; // Map 0-0.8 to 0-1
      }
      // For the last 20%, slow down using ease-out cubic
      const lastPart = (t - 0.8) / 0.2; // Map 0.8-1 to 0-1
      return 1 - Math.pow(1 - lastPart, 3);
    };

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const linearProgress = Math.min(
        (timestamp - startTimeRef.current) / duration,
        1,
      );

      // Apply easing function
      const easedProgress = easeOutCubic(linearProgress);
      const currentCount = Math.floor(easedProgress * end);
      countRef.current = currentCount;
      setCount(currentCount);

      if (linearProgress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    startTimeRef.current = null;
    requestAnimationFrame(animate);
  }, [end, duration]);

  return count;
}

function DashboardInner() {
  const isPreviewMode = localStorage.getItem("academo.previewAuth") === "true";
  const [period, setPeriod] = useState<"1m" | "3m" | "6m" | "1y">("1m");
  const [isPraisesOpen, setIsPraisesOpen] = useState(false);
  const [isWarningsOpen, setIsWarningsOpen] = useState(false);
  const [isAbsentOpen, setIsAbsentOpen] = useState(false);
  const [isLateOpen, setIsLateOpen] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const backendCurrentUser = useQuery(
    api.users.getCurrentUser,
    isPreviewMode ? "skip" : {},
  );
  type PreviewRole =
    | "director"
    | "vice_director"
    | "system_admin"
    | "teacher"
    | "class_teacher"
    | "parent"
    | "student"
    | "secretary"
    | "pedagogical_counselor"
    | "housekeeper";
  const currentUser = isPreviewMode
    ? {
        _id: "preview-admin" as Id<"users">,
        role: "system_admin" as const,
        roles: ["system_admin", "director", "teacher"] as PreviewRole[],
        firstName: "Demo",
        lastName: "Admin",
      }
    : backendCurrentUser;

  // Check if current user is a PURE parent (not staff or admin)
  // Staff who are also parents should see school-wide metrics, not their child's data
  const isParent =
    currentUser?.role === "parent" ||
    (currentUser?.roles?.includes("parent") &&
      !currentUser?.roles?.includes("director") &&
      !currentUser?.roles?.includes("vice_director") &&
      !currentUser?.roles?.includes("system_admin") &&
      !currentUser?.roles?.includes("teacher") &&
      !currentUser?.roles?.includes("class_teacher") &&
      !currentUser?.roles?.includes("secretary") &&
      !currentUser?.roles?.includes("pedagogical_counselor") &&
      !currentUser?.roles?.includes("housekeeper"));

  const isStudent = currentUser?.role === "student";

  // Check if user is secretary or housekeeper (they see simplified dashboard)
  const isSecretaryOrHousekeeper =
    currentUser?.role === "secretary" ||
    currentUser?.role === "housekeeper" ||
    currentUser?.roles?.includes("secretary") ||
    currentUser?.roles?.includes("housekeeper");

  // OPTIMIZATION: Only fire admin-level queries when user is admin/teacher/director
  // This prevents students (~670), parents, and secretary/housekeeper from triggering
  // heavy school-wide queries (30,000+ document reads each)
  const userLoaded = currentUser !== undefined && currentUser !== null;
  const needsAdminQueries =
    userLoaded && !isParent && !isStudent && !isSecretaryOrHousekeeper;
  // Stats needed for students (personal) and admin (school-wide), not parents/secretary
  const needsStats = userLoaded && !isParent && !isSecretaryOrHousekeeper;

  // Get parent's children
  const parentChildren = useQuery(
    api.users.getParentChildren,
    !isPreviewMode && isParent && currentUser?._id
      ? { userId: currentUser._id }
      : "skip",
  );

  // Set default selected child when children load
  useEffect(() => {
    if (parentChildren && parentChildren.length > 0 && !selectedChildId) {
      setSelectedChildId(parentChildren[0].userId);
    }
  }, [parentChildren, selectedChildId]);

  // OPTIMIZED: Skip heavy queries based on user role
  // Before: ALL 9 queries fired for ALL users (30,786 docs × every user × every data change)
  // After: Only admin/teacher users fire school-wide analytics queries
  const backendStats = useQuery(
    api.dashboard.getDashboardStats,
    !isPreviewMode && needsStats ? { period } : "skip",
  );
  const backendGradesByWeek = useQuery(
    api.dashboard.getGradesByWeek,
    !isPreviewMode && needsAdminQueries ? { weeks: 12 } : "skip",
  );
  const backendAbsencesByWeek = useQuery(
    api.dashboard.getAbsencesByWeek,
    !isPreviewMode && needsAdminQueries ? { weeks: 12 } : "skip",
  );
  const backendClassesByAverage = useQuery(
    api.dashboard.getClassesByAverage,
    !isPreviewMode && needsAdminQueries ? {} : "skip",
  );
  const backendClassesByAbsences = useQuery(
    api.dashboard.getClassesByAbsences,
    !isPreviewMode && needsAdminQueries ? {} : "skip",
  );
  const backendStudentsByAverage = useQuery(
    api.dashboard.getStudentsByAverage,
    !isPreviewMode && needsAdminQueries ? {} : "skip",
  );
  const backendStudentsByAbsences = useQuery(
    api.dashboard.getStudentsByAbsences,
    !isPreviewMode && needsAdminQueries ? {} : "skip",
  );
  const backendActiveTeachers = useQuery(
    api.dashboard.getActiveTeachers,
    !isPreviewMode && needsAdminQueries ? {} : "skip",
  );
  const backendLessonsPercentage = useQuery(
    api.dashboard.getLessonsThisWeekPercentage,
    !isPreviewMode && needsStats ? {} : "skip",
  );
  const emptyStats = {
    averageGrade: 0,
    totalGrades: 0,
    attendanceRate: 0,
    totalAbsences: 0,
    upcomingEvents: 0,
    praiseCount: 0,
    warningCount: 0,
    totalRemarks: 0,
  };
  const stats = isPreviewMode
    ? {
        averageGrade: 5.42,
        totalGrades: 1284,
        attendanceRate: 94.8,
        totalAbsences: 86,
        upcomingEvents: 7,
        praiseCount: 42,
        warningCount: 13,
        totalRemarks: 55,
      }
    : (backendStats ?? emptyStats);
  const gradesByWeek = isPreviewMode
    ? [
        { week: "2026-02-09", count: 92, average: 5.18 },
        { week: "2026-02-16", count: 118, average: 5.31 },
        { week: "2026-02-23", count: 104, average: 5.46 },
        { week: "2026-03-02", count: 136, average: 5.28 },
        { week: "2026-03-09", count: 121, average: 5.55 },
        { week: "2026-03-16", count: 148, average: 5.42 },
      ]
    : backendGradesByWeek;
  const absencesByWeek = isPreviewMode
    ? [
        { week: "2026-02-09", count: 18 },
        { week: "2026-02-16", count: 11 },
        { week: "2026-02-23", count: 24 },
        { week: "2026-03-02", count: 15 },
        { week: "2026-03-09", count: 9 },
        { week: "2026-03-16", count: 13 },
      ]
    : backendAbsencesByWeek;
  const classesByAverage = isPreviewMode
    ? {
        top: [
          { classId: "preview-1", className: "7А", average: 5.76 },
          { classId: "preview-2", className: "6Б", average: 5.61 },
          { classId: "preview-3", className: "8А", average: 5.48 },
        ],
        bottom: [
          { classId: "preview-4", className: "9В", average: 4.82 },
          { classId: "preview-5", className: "10Б", average: 4.91 },
          { classId: "preview-6", className: "5А", average: 5.02 },
        ],
      }
    : backendClassesByAverage;
  const classesByAbsences = isPreviewMode
    ? {
        top: [
          { classId: "preview-1", className: "10Б", absences: 31 },
          { classId: "preview-2", className: "9В", absences: 27 },
          { classId: "preview-3", className: "8А", absences: 18 },
        ],
        bottom: [
          { classId: "preview-4", className: "5А", absences: 4 },
          { classId: "preview-5", className: "6Б", absences: 6 },
          { classId: "preview-6", className: "7А", absences: 8 },
        ],
      }
    : backendClassesByAbsences;
  const studentsByAverage = isPreviewMode
    ? {
        top: [
          {
            studentId: "preview-1",
            studentName: "Мария Иванова",
            className: "7А",
            average: 6.0,
          },
          {
            studentId: "preview-2",
            studentName: "Николай Петров",
            className: "6Б",
            average: 5.95,
          },
          {
            studentId: "preview-3",
            studentName: "Елена Георгиева",
            className: "8А",
            average: 5.88,
          },
        ],
        bottom: [
          {
            studentId: "preview-4",
            studentName: "Демо ученик 1",
            className: "9В",
            average: 4.32,
          },
          {
            studentId: "preview-5",
            studentName: "Демо ученик 2",
            className: "10Б",
            average: 4.56,
          },
          {
            studentId: "preview-6",
            studentName: "Демо ученик 3",
            className: "5А",
            average: 4.72,
          },
        ],
      }
    : backendStudentsByAverage;
  const studentsByAbsences = isPreviewMode
    ? {
        top: [
          {
            studentId: "preview-1",
            studentName: "Демо ученик 4",
            className: "10Б",
            absences: 14,
          },
          {
            studentId: "preview-2",
            studentName: "Демо ученик 5",
            className: "9В",
            absences: 11,
          },
          {
            studentId: "preview-3",
            studentName: "Демо ученик 6",
            className: "8А",
            absences: 9,
          },
        ],
        bottom: [
          {
            studentId: "preview-4",
            studentName: "Мария Иванова",
            className: "7А",
            absences: 0,
          },
          {
            studentId: "preview-5",
            studentName: "Николай Петров",
            className: "6Б",
            absences: 1,
          },
          {
            studentId: "preview-6",
            studentName: "Елена Георгиева",
            className: "8А",
            absences: 1,
          },
        ],
      }
    : backendStudentsByAbsences;
  const activeTeachers = isPreviewMode
    ? [
        {
          teacherId: "preview-1",
          teacherName: "Иван Димитров",
          activityCount: 42,
        },
        {
          teacherId: "preview-2",
          teacherName: "Петя Николова",
          activityCount: 37,
        },
        {
          teacherId: "preview-3",
          teacherName: "Георги Стоянов",
          activityCount: 29,
        },
      ]
    : backendActiveTeachers;
  const lessonsPercentage = isPreviewMode ? 82 : backendLessonsPercentage;

  // E-diary status
  const eDiaryStatus = useQuery(
    api.platformSettings.isEDiaryEnabled,
    isPreviewMode ? "skip" : {},
  );

  // Get student's class ID
  const studentClassId = useQuery(
    api.users.getStudentClass,
    !isPreviewMode && currentUser?.role === "student" && currentUser?._id
      ? { userId: currentUser._id }
      : "skip",
  );

  // Get attendance for students
  const attendance = useQuery(
    api.attendanceQueries.getStudentAttendanceByUserId,
    !isPreviewMode && currentUser?.role === "student" && currentUser?._id
      ? { userId: currentUser._id }
      : "skip",
  );

  // Get reviews for students
  const reviews = useQuery(
    api.reviews.getStudentReviewsByUserId,
    !isPreviewMode && currentUser?.role === "student" && currentUser?._id
      ? { userId: currentUser._id }
      : "skip",
  );

  // Get attendance for parent's selected child
  const childAttendance = useQuery(
    api.attendanceQueries.getStudentAttendanceByUserId,
    !isPreviewMode && isParent && selectedChildId
      ? { userId: selectedChildId as Id<"users"> }
      : "skip",
  );

  // Get reviews for parent's selected child
  const childReviews = useQuery(
    api.reviews.getStudentReviewsByUserId,
    !isPreviewMode && isParent && selectedChildId
      ? { userId: selectedChildId as Id<"users"> }
      : "skip",
  );

  // Get grades for parent's selected child
  const childGrades = useQuery(
    api.grades.getGradesByStudentUserId,
    !isPreviewMode && isParent && selectedChildId
      ? { userId: selectedChildId as Id<"users"> }
      : "skip",
  );

  // Calculate stats for parents based on selected child
  const parentChildStats = {
    averageGrade: childGrades?.stats?.averageGrade || 0,
    totalGrades: childGrades?.stats?.totalGrades || 0,
    totalAbsences: childAttendance?.stats?.totalAbsent || 0,
    totalRemarks:
      (childReviews?.warnings?.length || 0) +
      (childReviews?.praises?.length || 0),
  };

  // Animated counters (20% faster) - use child data for parents
  const animatedGrade = useCountUp(
    isParent ? parentChildStats.averageGrade : stats?.averageGrade || 0,
    1200,
  );
  const animatedTotalGrades = useCountUp(
    isParent ? parentChildStats.totalGrades : stats?.totalGrades || 0,
    1200,
  );
  const animatedAbsences = useCountUp(
    isParent ? parentChildStats.totalAbsences : stats?.totalAbsences || 0,
    1200,
  );
  const animatedRemarks = useCountUp(
    isParent ? parentChildStats.totalRemarks : stats?.totalRemarks || 0,
    1200,
  );
  const animatedEvents = useCountUp(stats?.upcomingEvents || 0, 1200);
  const animatedLessonsPercentage = useCountUp(lessonsPercentage || 0, 1200);

  // Get selected child's name for display
  const selectedChild = parentChildren?.find(
    (c) => c.userId === selectedChildId,
  );

  // Loading state: wait for user to load first, then role-specific data
  if (currentUser === undefined) {
    return (
      <div className="mx-auto w-full max-w-[1500px] space-y-6">
        <Skeleton className="h-72 w-full rounded-[32px]" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-36 rounded-[28px]" />
          <Skeleton className="h-36 rounded-[28px]" />
          <Skeleton className="h-36 rounded-[28px]" />
          <Skeleton className="h-36 rounded-[28px]" />
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 pb-6">
      {/* Child Selector for Parents */}
      {isParent && parentChildren && parentChildren.length > 1 && (
        <Card className="border-0 shadow-lg bg-gradient-to-r from-purple-500 to-indigo-600">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-white">
                <GraduationCapIcon className="h-5 w-5" />
                <span className="font-medium">Избери дете:</span>
              </div>
              <Select
                value={selectedChildId || ""}
                onValueChange={(value) => setSelectedChildId(value)}
              >
                <SelectTrigger className="w-64 bg-white/20 border-white/30 text-white">
                  <SelectValue placeholder="Избери дете" />
                </SelectTrigger>
                <SelectContent>
                  {parentChildren.map((child) => (
                    <SelectItem key={child._id} value={child.userId}>
                      {child.name} ({child.className})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Single child display for parents */}
      {isParent && parentChildren && parentChildren.length === 1 && (
        <Card className="border-0 shadow-lg bg-gradient-to-r from-purple-500 to-indigo-600">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-white">
              <GraduationCapIcon className="h-5 w-5" />
              <span className="font-medium">
                Данни за: {selectedChild?.name} ({selectedChild?.className})
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modern KPI Cards with Glassmorphism - Hidden for secretary/housekeeper */}
      {!isSecretaryOrHousekeeper && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AcademoMetricCard
            title="Успех"
            value={animatedGrade.toFixed(2)}
            detail={isStudent || isParent ? "лични данни" : "среден успех"}
            icon={TrendingUpIcon}
            tone="bg-[#6b4cff]"
          />
          <AcademoMetricCard
            title="Оценки"
            value={animatedTotalGrades}
            detail="въведени оценки"
            icon={GraduationCapIcon}
            tone="bg-[#1cb7e9]"
          />
          <AcademoMetricCard
            title="Отсъствия"
            value={animatedAbsences}
            detail="видими отсъствия"
            icon={XCircleIcon}
            tone="bg-[#ff2736]"
          />
          <AcademoMetricCard
            title="Отзиви"
            value={animatedRemarks}
            detail="похвали и забележки"
            icon={MessageSquareIcon}
            tone="bg-[#f15abe]"
          />
          <AcademoMetricCard
            title="Занятия"
            value={`${animatedLessonsPercentage}%`}
            detail="взети тази седмица"
            icon={BookOpenIcon}
            tone="bg-[#111]"
          />
          <AcademoMetricCard
            title="Събития"
            value={animatedEvents}
            detail="предстоящи"
            icon={CalendarIcon}
            tone="bg-[#ffd778] text-[#111]"
          />
        </div>
      )}

      {/* E-Diary Status Banner (shows when hybrid mode is enabled) */}
      {eDiaryStatus && !eDiaryStatus.enabled && (
        <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950/30">
          <InfoIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="ml-2">
            <div className="font-medium text-blue-800 dark:text-blue-200">
              {eDiaryStatus.message ||
                "Училището използва хибриден режим (електронен + хартиен дневник)"}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* For students: Show individual data */}
      {isStudent && (
        <>
          {/* Student Reviews */}
          {reviews &&
            (reviews.praises.length > 0 || reviews.warnings.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle>Моите отзиви</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Praises Collapsible */}
                    {reviews.praises.length > 0 && (
                      <Collapsible
                        open={isPraisesOpen}
                        onOpenChange={setIsPraisesOpen}
                      >
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center justify-between p-3 rounded-lg bg-green-100 dark:bg-green-950/40 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">
                            <div className="flex items-center gap-2">
                              <MessageSquareIcon className="h-5 w-5 text-green-700 dark:text-green-400" />
                              <span className="font-medium text-green-900 dark:text-green-100">
                                {reviews.praises.length}{" "}
                                {reviews.praises.length === 1
                                  ? "похвала"
                                  : "похвали"}
                              </span>
                            </div>
                            {isPraisesOpen ? (
                              <ChevronUpIcon className="h-5 w-5 text-green-700 dark:text-green-400" />
                            ) : (
                              <ChevronDownIcon className="h-5 w-5 text-green-700 dark:text-green-400" />
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto">
                            {reviews.praises.map((praise) => (
                              <div
                                key={praise._id}
                                className="p-3 rounded-lg border bg-white dark:bg-gray-950 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                              >
                                <div className="font-medium text-sm">
                                  {praise.content}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                                  <span>
                                    {new Date(praise.date).toLocaleDateString(
                                      "bg-BG",
                                      {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      },
                                    )}
                                  </span>
                                  <span>•</span>
                                  <span>{praise.teacherName}</span>
                                  {praise.subjectName && (
                                    <>
                                      <span>•</span>
                                      <span>{praise.subjectName}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {/* Warnings Collapsible */}
                    {reviews.warnings.length > 0 && (
                      <Collapsible
                        open={isWarningsOpen}
                        onOpenChange={setIsWarningsOpen}
                      >
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center justify-between p-3 rounded-lg bg-red-200 dark:bg-red-950/60 hover:bg-red-300 dark:hover:bg-red-900/70 transition-colors">
                            <div className="flex items-center gap-2">
                              <AlertCircleIcon className="h-5 w-5 text-red-700 dark:text-red-400" />
                              <span className="font-medium text-red-900 dark:text-red-100">
                                {reviews.warnings.length}{" "}
                                {reviews.warnings.length === 1
                                  ? "забележка"
                                  : "забележки"}
                              </span>
                            </div>
                            {isWarningsOpen ? (
                              <ChevronUpIcon className="h-5 w-5 text-red-700 dark:text-red-400" />
                            ) : (
                              <ChevronDownIcon className="h-5 w-5 text-red-700 dark:text-red-400" />
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto">
                            {reviews.warnings.map((warning) => (
                              <div
                                key={warning._id}
                                className="p-3 rounded-lg border bg-white dark:bg-gray-950 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <div className="font-medium text-sm">
                                  {warning.content}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                                  <span>
                                    {new Date(warning.date).toLocaleDateString(
                                      "bg-BG",
                                      {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      },
                                    )}
                                  </span>
                                  <span>•</span>
                                  <span>{warning.teacherName}</span>
                                  {warning.subjectName && (
                                    <>
                                      <span>•</span>
                                      <span>{warning.subjectName}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Student Absences Section */}
          {attendance && attendance.all.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Моите отсъствия</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-red-100 dark:bg-red-950/40">
                      <XCircleIcon className="h-8 w-8 text-red-700 dark:text-red-400" />
                      <div>
                        <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                          {attendance.stats.totalAbsent}
                        </div>
                        <div className="text-sm text-red-600/80 dark:text-red-400/80">
                          Неизвинени
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-100 dark:bg-orange-950/40">
                      <ClockIcon className="h-8 w-8 text-orange-700 dark:text-orange-400" />
                      <div>
                        <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                          {attendance.stats.totalLate}
                        </div>
                        <div className="text-sm text-orange-600/80 dark:text-orange-400/80">
                          Закъснения
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-100 dark:bg-blue-950/40">
                      <AlertCircleIcon className="h-8 w-8 text-blue-700 dark:text-blue-400" />
                      <div>
                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                          {attendance.stats.totalExcused}
                        </div>
                        <div className="text-sm text-blue-600/80 dark:text-blue-400/80">
                          Извинени
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Absent Collapsible */}
                  {attendance.all.filter((r) => r.status === "absent").length >
                    0 && (
                    <Collapsible
                      open={isAbsentOpen}
                      onOpenChange={setIsAbsentOpen}
                    >
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-red-100 dark:bg-red-950/40 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <XCircleIcon className="h-5 w-5 text-red-700 dark:text-red-400" />
                            <span className="font-medium text-red-900 dark:text-red-100">
                              Вижте всички неизвинени (
                              {
                                attendance.all.filter(
                                  (r) => r.status === "absent",
                                ).length
                              }
                              )
                            </span>
                          </div>
                          {isAbsentOpen ? (
                            <ChevronUpIcon className="h-5 w-5 text-red-700 dark:text-red-400" />
                          ) : (
                            <ChevronDownIcon className="h-5 w-5 text-red-700 dark:text-red-400" />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto">
                          {attendance.all
                            .filter((r) => r.status === "absent")
                            .map((record) => (
                              <div
                                key={record._id}
                                className="flex items-center justify-between p-3 rounded-lg border bg-white dark:bg-gray-950 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
                                  <div>
                                    <div className="font-medium">
                                      {record.subjectName}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {new Date(record.date).toLocaleDateString(
                                        "bg-BG",
                                        {
                                          day: "numeric",
                                          month: "short",
                                          year: "numeric",
                                        },
                                      )}{" "}
                                      - {record.period} час
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-medium">
                                    Неизвинено
                                  </div>
                                  {record.notes && (
                                    <div className="text-xs text-muted-foreground">
                                      {record.notes}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* Late Collapsible */}
                  {attendance.all.filter((r) => r.status === "late").length >
                    0 && (
                    <Collapsible open={isLateOpen} onOpenChange={setIsLateOpen}>
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-orange-100 dark:bg-orange-950/40 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <ClockIcon className="h-5 w-5 text-orange-700 dark:text-orange-400" />
                            <span className="font-medium text-orange-900 dark:text-orange-100">
                              Вижте всички закъснения (
                              {
                                attendance.all.filter(
                                  (r) => r.status === "late",
                                ).length
                              }
                              )
                            </span>
                          </div>
                          {isLateOpen ? (
                            <ChevronUpIcon className="h-5 w-5 text-orange-700 dark:text-orange-400" />
                          ) : (
                            <ChevronDownIcon className="h-5 w-5 text-orange-700 dark:text-orange-400" />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto">
                          {attendance.all
                            .filter((r) => r.status === "late")
                            .map((record) => (
                              <div
                                key={record._id}
                                className="flex items-center justify-between p-3 rounded-lg border bg-white dark:bg-gray-950 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <ClockIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                                  <div>
                                    <div className="font-medium">
                                      {record.subjectName}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {new Date(record.date).toLocaleDateString(
                                        "bg-BG",
                                        {
                                          day: "numeric",
                                          month: "short",
                                          year: "numeric",
                                        },
                                      )}{" "}
                                      - {record.period} час
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-medium">
                                    Закъснение
                                  </div>
                                  {record.notes && (
                                    <div className="text-xs text-muted-foreground">
                                      {record.notes}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* For parents: Show selected child's data */}
      {isParent && selectedChildId && (
        <>
          {/* Child's Reviews */}
          {childReviews &&
            (childReviews.praises.length > 0 ||
              childReviews.warnings.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle>Отзиви за {selectedChild?.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Praises Collapsible */}
                    {childReviews.praises.length > 0 && (
                      <Collapsible
                        open={isPraisesOpen}
                        onOpenChange={setIsPraisesOpen}
                      >
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center justify-between p-3 rounded-lg bg-green-100 dark:bg-green-950/40 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">
                            <div className="flex items-center gap-2">
                              <MessageSquareIcon className="h-5 w-5 text-green-700 dark:text-green-400" />
                              <span className="font-medium text-green-900 dark:text-green-100">
                                {childReviews.praises.length}{" "}
                                {childReviews.praises.length === 1
                                  ? "похвала"
                                  : "похвали"}
                              </span>
                            </div>
                            {isPraisesOpen ? (
                              <ChevronUpIcon className="h-5 w-5 text-green-700 dark:text-green-400" />
                            ) : (
                              <ChevronDownIcon className="h-5 w-5 text-green-700 dark:text-green-400" />
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto">
                            {childReviews.praises.map((praise) => (
                              <div
                                key={praise._id}
                                className="p-3 rounded-lg border bg-white dark:bg-gray-950 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                              >
                                <div className="font-medium text-sm">
                                  {praise.content}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                                  <span>
                                    {new Date(praise.date).toLocaleDateString(
                                      "bg-BG",
                                      {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      },
                                    )}
                                  </span>
                                  <span>•</span>
                                  <span>{praise.teacherName}</span>
                                  {praise.subjectName && (
                                    <>
                                      <span>•</span>
                                      <span>{praise.subjectName}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {/* Warnings Collapsible */}
                    {childReviews.warnings.length > 0 && (
                      <Collapsible
                        open={isWarningsOpen}
                        onOpenChange={setIsWarningsOpen}
                      >
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center justify-between p-3 rounded-lg bg-red-200 dark:bg-red-950/60 hover:bg-red-300 dark:hover:bg-red-900/70 transition-colors">
                            <div className="flex items-center gap-2">
                              <AlertCircleIcon className="h-5 w-5 text-red-700 dark:text-red-400" />
                              <span className="font-medium text-red-900 dark:text-red-100">
                                {childReviews.warnings.length}{" "}
                                {childReviews.warnings.length === 1
                                  ? "забележка"
                                  : "забележки"}
                              </span>
                            </div>
                            {isWarningsOpen ? (
                              <ChevronUpIcon className="h-5 w-5 text-red-700 dark:text-red-400" />
                            ) : (
                              <ChevronDownIcon className="h-5 w-5 text-red-700 dark:text-red-400" />
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto">
                            {childReviews.warnings.map((warning) => (
                              <div
                                key={warning._id}
                                className="p-3 rounded-lg border bg-white dark:bg-gray-950 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <div className="font-medium text-sm">
                                  {warning.content}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                                  <span>
                                    {new Date(warning.date).toLocaleDateString(
                                      "bg-BG",
                                      {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      },
                                    )}
                                  </span>
                                  <span>•</span>
                                  <span>{warning.teacherName}</span>
                                  {warning.subjectName && (
                                    <>
                                      <span>•</span>
                                      <span>{warning.subjectName}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Child's Absences Section */}
          {childAttendance && childAttendance.all.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Отсъствия на {selectedChild?.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-red-100 dark:bg-red-950/40">
                      <XCircleIcon className="h-8 w-8 text-red-700 dark:text-red-400" />
                      <div>
                        <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                          {childAttendance.stats.totalAbsent}
                        </div>
                        <div className="text-sm text-red-600/80 dark:text-red-400/80">
                          Неизвинени
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-100 dark:bg-orange-950/40">
                      <ClockIcon className="h-8 w-8 text-orange-700 dark:text-orange-400" />
                      <div>
                        <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                          {childAttendance.stats.totalLate}
                        </div>
                        <div className="text-sm text-orange-600/80 dark:text-orange-400/80">
                          Закъснения
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-100 dark:bg-blue-950/40">
                      <AlertCircleIcon className="h-8 w-8 text-blue-700 dark:text-blue-400" />
                      <div>
                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                          {childAttendance.stats.totalExcused}
                        </div>
                        <div className="text-sm text-blue-600/80 dark:text-blue-400/80">
                          Извинени
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Absent Collapsible */}
                  {childAttendance.all.filter((r) => r.status === "absent")
                    .length > 0 && (
                    <Collapsible
                      open={isAbsentOpen}
                      onOpenChange={setIsAbsentOpen}
                    >
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-red-100 dark:bg-red-950/40 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <XCircleIcon className="h-5 w-5 text-red-700 dark:text-red-400" />
                            <span className="font-medium text-red-900 dark:text-red-100">
                              Вижте всички неизвинени (
                              {
                                childAttendance.all.filter(
                                  (r) => r.status === "absent",
                                ).length
                              }
                              )
                            </span>
                          </div>
                          {isAbsentOpen ? (
                            <ChevronUpIcon className="h-5 w-5 text-red-700 dark:text-red-400" />
                          ) : (
                            <ChevronDownIcon className="h-5 w-5 text-red-700 dark:text-red-400" />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto">
                          {childAttendance.all
                            .filter((r) => r.status === "absent")
                            .map((record) => (
                              <div
                                key={record._id}
                                className="flex items-center justify-between p-3 rounded-lg border bg-white dark:bg-gray-950 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
                                  <div>
                                    <div className="font-medium">
                                      {record.subjectName}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {new Date(record.date).toLocaleDateString(
                                        "bg-BG",
                                        {
                                          day: "numeric",
                                          month: "short",
                                          year: "numeric",
                                        },
                                      )}{" "}
                                      - {record.period} час
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-medium">
                                    Неизвинено
                                  </div>
                                  {record.notes && (
                                    <div className="text-xs text-muted-foreground">
                                      {record.notes}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* Late Collapsible */}
                  {childAttendance.all.filter((r) => r.status === "late")
                    .length > 0 && (
                    <Collapsible open={isLateOpen} onOpenChange={setIsLateOpen}>
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-orange-100 dark:bg-orange-950/40 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <ClockIcon className="h-5 w-5 text-orange-700 dark:text-orange-400" />
                            <span className="font-medium text-orange-900 dark:text-orange-100">
                              Вижте всички закъснения (
                              {
                                childAttendance.all.filter(
                                  (r) => r.status === "late",
                                ).length
                              }
                              )
                            </span>
                          </div>
                          {isLateOpen ? (
                            <ChevronUpIcon className="h-5 w-5 text-orange-700 dark:text-orange-400" />
                          ) : (
                            <ChevronDownIcon className="h-5 w-5 text-orange-700 dark:text-orange-400" />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto">
                          {childAttendance.all
                            .filter((r) => r.status === "late")
                            .map((record) => (
                              <div
                                key={record._id}
                                className="flex items-center justify-between p-3 rounded-lg border bg-white dark:bg-gray-950 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <ClockIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                                  <div>
                                    <div className="font-medium">
                                      {record.subjectName}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {new Date(record.date).toLocaleDateString(
                                        "bg-BG",
                                        {
                                          day: "numeric",
                                          month: "short",
                                          year: "numeric",
                                        },
                                      )}{" "}
                                      - {record.period} час
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-medium">
                                    Закъснение
                                  </div>
                                  {record.notes && (
                                    <div className="text-xs text-muted-foreground">
                                      {record.notes}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* For secretary/housekeeper: Show simple welcome message */}
      {isSecretaryOrHousekeeper && (
        <Card className="border-0 shadow-lg bg-gradient-to-r from-sky-500 to-indigo-600">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 text-white">
              <div className="p-3 rounded-xl bg-white/20 backdrop-blur-md">
                <UserIcon className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">
                  Добре дошли, {currentUser?.firstName} {currentUser?.lastName}!
                </h2>
                <p className="text-white/80 mt-1">
                  Използвайте менюто отляво за достъп до наличните модули.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* For non-students, non-parents, and non-secretary/housekeeper: Show school-wide analytics */}
      {!isStudent && !isParent && !isSecretaryOrHousekeeper && (
        <>
          {/* Modern Charts */}
          <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
            {/* Average Grade Chart */}
            <Card className="border-0 shadow-lg bg-white dark:bg-gray-900 overflow-hidden">
              <CardHeader className="border-b border-gray-100 dark:border-gray-800 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                      <TrendingUpIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-gray-900 dark:text-gray-100">
                        Среден успех
                      </CardTitle>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Училище
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(["1m", "3m", "6m", "1y"] as const).map((p) => (
                      <Button
                        key={p}
                        variant={period === p ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setPeriod(p)}
                        className={`h-8 px-3 text-xs font-medium ${
                          period === p
                            ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
                            : "hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                      >
                        {p === "1m" && "1m"}
                        {p === "3m" && "3m"}
                        {p === "6m" && "6m"}
                        {p === "1y" && "1y"}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {gradesByWeek && gradesByWeek.length > 0 ? (
                  <div className="space-y-3">
                    {gradesByWeek.map(
                      (week: {
                        week: string;
                        count: number;
                        average: number;
                      }) => (
                        <div key={week.week} className="group">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                              {new Date(week.week).toLocaleDateString("bg-BG", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                              {week.average.toFixed(2)}
                            </span>
                          </div>
                          <div className="relative h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <div
                              className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-500 group-hover:from-orange-500 group-hover:to-orange-700"
                              style={{ width: `${(week.average / 6) * 100}%` }}
                            />
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <TrendingUpIcon className="h-12 w-12 text-gray-300 dark:text-gray-700 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Няма данни за избрания период
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Absences Chart */}
            <Card className="border-0 shadow-lg bg-white dark:bg-gray-900 overflow-hidden">
              <CardHeader className="border-b border-gray-100 dark:border-gray-800 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
                      <XCircleIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-gray-900 dark:text-gray-100">
                        Отсъствия
                      </CardTitle>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        По седмици
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(["1m", "3m", "6m", "1y"] as const).map((p) => (
                      <Button
                        key={p}
                        variant={period === p ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setPeriod(p)}
                        className={`h-8 px-3 text-xs font-medium ${
                          period === p
                            ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                            : "hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                      >
                        {p === "1m" && "1m"}
                        {p === "3m" && "3m"}
                        {p === "6m" && "6m"}
                        {p === "1y" && "1y"}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {absencesByWeek && absencesByWeek.length > 0 ? (
                  <div className="space-y-3">
                    {absencesByWeek.map((week) => (
                      <div key={week.week} className="group">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                            {new Date(week.week).toLocaleDateString("bg-BG", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                            {week.count}
                          </span>
                        </div>
                        <div className="relative h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                          <div
                            className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-600 rounded-full transition-all duration-500 group-hover:from-green-500 group-hover:to-emerald-700"
                            style={{
                              width: `${Math.min((week.count / 2000) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <XCircleIcon className="h-12 w-12 text-gray-300 dark:text-gray-700 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Няма данни
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Classes - Modern Design */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 overflow-hidden">
            <CardHeader className="border-b border-blue-100 dark:border-gray-700 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                  <UsersIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-gray-900 dark:text-gray-100">
                    Най-добри паралелки
                  </CardTitle>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Топ и дъно 3
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Best by average */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-1 w-1 rounded-full bg-blue-500"></div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      Среден успех
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {classesByAverage?.top.map((cls, idx) => (
                      <div
                        key={cls.classId}
                        className="group flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-cyan-400/20 to-blue-400/20 hover:from-cyan-400/30 hover:to-blue-400/30 transition-all duration-300"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500 text-white text-xs font-bold">
                            {idx + 1}
                          </div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {cls.className}
                          </span>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-bold shadow-lg">
                          {cls.average.toFixed(2)}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-center py-2">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                      </div>
                    </div>
                    {classesByAverage?.bottom.map((cls, idx) => (
                      <div
                        key={cls.classId}
                        className="group flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-orange-400/20 to-amber-400/20 hover:from-orange-400/30 hover:to-amber-400/30 transition-all duration-300"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold">
                            {classesByAverage.top.length +
                              classesByAverage.bottom.length -
                              idx}
                          </div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {cls.className}
                          </span>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-600 text-white text-sm font-bold shadow-lg">
                          {cls.average.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Best by absences */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-1 w-1 rounded-full bg-green-500"></div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      Отсъствия
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {classesByAbsences?.top.map((cls, idx) => (
                      <div
                        key={cls.classId}
                        className="group flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-emerald-400/20 to-teal-400/20 hover:from-emerald-400/30 hover:to-teal-400/30 transition-all duration-300"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold">
                            {idx + 1}
                          </div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {cls.className}
                          </span>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-bold shadow-lg">
                          {cls.absences.toFixed(2)}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-center py-2">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                      </div>
                    </div>
                    {classesByAbsences?.bottom.map((cls, idx) => (
                      <div
                        key={cls.classId}
                        className="group flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-red-400/20 to-rose-400/20 hover:from-red-400/30 hover:to-rose-400/30 transition-all duration-300"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold">
                            {classesByAbsences.top.length +
                              classesByAbsences.bottom.length -
                              idx}
                          </div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {cls.className}
                          </span>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-gradient-to-r from-red-500 to-rose-600 text-white text-sm font-bold shadow-lg">
                          {cls.absences.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Students - Modern Design */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-violet-50 dark:from-gray-900 dark:to-gray-800 overflow-hidden">
            <CardHeader className="border-b border-purple-100 dark:border-gray-700 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600">
                  <GraduationCapIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-gray-900 dark:text-gray-100">
                    Най-добри ученици
                  </CardTitle>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Топ и дъно 3
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Best by average */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-1 w-1 rounded-full bg-purple-500"></div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      Среден успех
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {studentsByAverage?.top.map((student, idx) => (
                      <div
                        key={student.studentId}
                        className="group flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-purple-400/20 to-violet-400/20 hover:from-purple-400/30 hover:to-violet-400/30 transition-all duration-300"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500 text-white text-xs font-bold flex-shrink-0">
                            {idx + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {student.studentName}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {student.className}
                            </div>
                          </div>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-gradient-to-r from-purple-500 to-violet-600 text-white text-sm font-bold shadow-lg flex-shrink-0 ml-2">
                          {student.average.toFixed(2)}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-center py-2">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                      </div>
                    </div>
                    {studentsByAverage?.bottom.map((student, idx) => (
                      <div
                        key={student.studentId}
                        className="group flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-orange-400/20 to-amber-400/20 hover:from-orange-400/30 hover:to-amber-400/30 transition-all duration-300"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex-shrink-0">
                            {studentsByAverage.top.length +
                              studentsByAverage.bottom.length -
                              idx}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {student.studentName}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {student.className}
                            </div>
                          </div>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-600 text-white text-sm font-bold shadow-lg flex-shrink-0 ml-2">
                          {student.average.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Best by absences */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-1 w-1 rounded-full bg-pink-500"></div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      Натрупани отсъствия
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {studentsByAbsences?.top.map((student, idx) => (
                      <div
                        key={student.studentId}
                        className="group flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-emerald-400/20 to-teal-400/20 hover:from-emerald-400/30 hover:to-teal-400/30 transition-all duration-300"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold flex-shrink-0">
                            {idx + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {student.studentName}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {student.className}
                            </div>
                          </div>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-bold shadow-lg flex-shrink-0 ml-2">
                          {student.absences.toFixed(2)}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-center py-2">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                      </div>
                    </div>
                    {studentsByAbsences?.bottom.map((student, idx) => (
                      <div
                        key={student.studentId}
                        className="group flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-red-400/20 to-rose-400/20 hover:from-red-400/30 hover:to-rose-400/30 transition-all duration-300"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex-shrink-0">
                            {studentsByAbsences.top.length +
                              studentsByAbsences.bottom.length -
                              idx}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {student.studentName}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {student.className}
                            </div>
                          </div>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-gradient-to-r from-red-500 to-rose-600 text-white text-sm font-bold shadow-lg flex-shrink-0 ml-2">
                          {student.absences.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Teachers - Modern Design */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-gray-900 dark:to-gray-800 overflow-hidden">
            <CardHeader className="border-b border-teal-100 dark:border-gray-700 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600">
                  <FileTextIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-gray-900 dark:text-gray-100">
                    Най-активни учители
                  </CardTitle>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Оценки, отсъствия, отзиви, съобщения
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {activeTeachers && activeTeachers.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {activeTeachers.map((teacher, idx) => (
                    <div
                      key={teacher.teacherId}
                      className="group flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-teal-400/20 to-cyan-400/20 hover:from-teal-400/30 hover:to-cyan-400/30 transition-all duration-300"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-teal-500 text-white text-xs font-bold flex-shrink-0">
                          {idx + 1}
                        </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {teacher.teacherName}
                        </span>
                      </div>
                      <div className="px-3 py-1 rounded-full bg-gradient-to-r from-teal-500 to-cyan-600 text-white text-sm font-bold shadow-lg flex-shrink-0">
                        {teacher.activityCount}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <FileTextIcon className="h-12 w-12 text-gray-300 dark:text-gray-700 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Няма данни за учители
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function PreAuthLogin() {
  const { signInWithPassword, bootstrapFirstAdmin, isLoading } = useAuth();
  const authSetup = useQuery(api.users.getAuthSetupStatus, {});
  const [loginForm, setLoginForm] = useState({
    username: "",
    password: "",
  });
  const [setupForm, setSetupForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const hasUsers = authSetup?.hasUsers ?? true;

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await signInWithPassword(loginForm);
      window.location.reload();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Неуспешен вход в системата.";
      toast.error(message);
    }
  };

  const handleSetup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (setupForm.password.length < 6) {
      toast.error("Паролата трябва да е поне 6 символа.");
      return;
    }

    if (setupForm.password !== setupForm.confirmPassword) {
      toast.error("Паролите не съвпадат.");
      return;
    }

    try {
      await bootstrapFirstAdmin({
        firstName: setupForm.firstName.trim(),
        lastName: setupForm.lastName.trim(),
        email: setupForm.email.trim(),
        username: setupForm.username.trim(),
        password: setupForm.password,
      });
      window.location.reload();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Неуспешно създаване на първия администратор.";
      toast.error(message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_50%_58%,rgba(107,76,255,0.22),transparent_36%),linear-gradient(180deg,#ffffff_0%,#f8f6ff_35%,#ded8ff_100%)] px-4 py-10">
      <div className="relative z-10 w-full max-w-3xl text-center">
        <img
          src="/academo-logo.png"
          alt="Академо"
          className="mx-auto h-12 w-auto"
        />
        <div className="mx-auto mt-7 inline-flex items-center gap-3 rounded-full border border-[#e8e8f1] bg-white p-1 pr-5 font-black text-[#33343a] shadow-[0_10px_26px_rgba(40,35,90,0.08)]">
          <span className="rounded-full bg-[#111] px-4 py-2 text-white">
            Достъп
          </span>
          Собствена дигитална среда
        </div>
        <h1 className="mt-7 text-4xl font-black leading-none text-[#0e0e12] md:text-5xl">
          Вход в Академо
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base font-bold leading-7 text-[#62636d]">
          {hasUsers ? "Влезте в платформата" : "Създайте първия администратор"}
        </p>
        <Card className="academo-soft-shadow mt-8 rounded-[34px] border border-white/80 bg-white/86 text-left backdrop-blur-xl">
          <CardContent className="space-y-5 p-6 md:p-8">
            {hasUsers ? (
              <form className="space-y-4" onSubmit={handleLogin}>
                <div className="space-y-2">
                  <Label
                    htmlFor="login-username"
                    className="font-black text-[#62636d]"
                  >
                    Потребителско име или имейл
                  </Label>
                  <Input
                    id="login-username"
                    value={loginForm.username}
                    onChange={(event) =>
                      setLoginForm((current) => ({
                        ...current,
                        username: event.target.value,
                      }))
                    }
                    autoComplete="username"
                    placeholder="Например director@school.bg"
                    className="h-14 rounded-2xl border-[#e3e3ec] bg-white text-base font-bold shadow-none focus-visible:ring-[#6b4cff]/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="login-password"
                    className="font-black text-[#62636d]"
                  >
                    Парола
                  </Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginForm.password}
                    onChange={(event) =>
                      setLoginForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    autoComplete="current-password"
                    className="h-14 rounded-2xl border-[#e3e3ec] bg-white text-base font-bold shadow-none focus-visible:ring-[#6b4cff]/20"
                  />
                </div>
                <Button
                  type="submit"
                  className="h-14 w-full rounded-full bg-[#111] text-lg font-black text-white shadow-[0_16px_38px_rgba(0,0,0,0.22)] hover:bg-[#222]"
                  disabled={isLoading}
                >
                  {isLoading ? "Влизане..." : "Вход"}
                </Button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleSetup}>
                <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40">
                  <InfoIcon className="h-4 w-4" />
                  <AlertDescription>
                    Това е първоначалната настройка на новата инсталация. След
                    този профил ще можеш да създаваш останалите потребители,
                    класове и разписания.
                  </AlertDescription>
                </Alert>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="setup-firstName">Име</Label>
                    <Input
                      id="setup-firstName"
                      value={setupForm.firstName}
                      onChange={(event) =>
                        setSetupForm((current) => ({
                          ...current,
                          firstName: event.target.value,
                        }))
                      }
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="setup-lastName">Фамилия</Label>
                    <Input
                      id="setup-lastName"
                      value={setupForm.lastName}
                      onChange={(event) =>
                        setSetupForm((current) => ({
                          ...current,
                          lastName: event.target.value,
                        }))
                      }
                      autoComplete="family-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-email">Имейл</Label>
                  <Input
                    id="setup-email"
                    type="email"
                    value={setupForm.email}
                    onChange={(event) =>
                      setSetupForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-username">Потребителско име</Label>
                  <Input
                    id="setup-username"
                    value={setupForm.username}
                    onChange={(event) =>
                      setSetupForm((current) => ({
                        ...current,
                        username: event.target.value,
                      }))
                    }
                    autoComplete="username"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="setup-password">Парола</Label>
                    <Input
                      id="setup-password"
                      type="password"
                      value={setupForm.password}
                      onChange={(event) =>
                        setSetupForm((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="setup-confirmPassword">
                      Потвърди паролата
                    </Label>
                    <Input
                      id="setup-confirmPassword"
                      type="password"
                      value={setupForm.confirmPassword}
                      onChange={(event) =>
                        setSetupForm((current) => ({
                          ...current,
                          confirmPassword: event.target.value,
                        }))
                      }
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="h-14 w-full rounded-full bg-[#111] text-lg font-black text-white shadow-[0_16px_38px_rgba(0,0,0,0.22)] hover:bg-[#222]"
                  disabled={isLoading}
                >
                  {isLoading ? "Създаване..." : "Създай първия администратор"}
                </Button>
              </form>
            )}

            <div className="border-t pt-4">
              <Button
                type="button"
                variant="secondary"
                className="h-12 w-full rounded-full bg-[#f1f2f7] font-black text-[#6b4cff] hover:bg-[#e9e7ff]"
                onClick={() => {
                  localStorage.setItem("academo.previewAuth", "true");
                  window.location.reload();
                }}
              >
                Влез с demo акаунт
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Component that shows loading state with timeout - shows retry button if auth takes too long
function AuthLoadingWithTimeout() {
  const [showRetry, setShowRetry] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    // After 10 seconds of loading, show the retry button
    const timeoutId = setTimeout(() => {
      setShowRetry(true);
    }, 10000);

    return () => clearTimeout(timeoutId);
  }, []);

  const handleClearAndRetry = async () => {
    setIsClearing(true);
    try {
      // Clear all stored auth data
      sessionStorage.clear();
      localStorage.clear();

      // Clear all cookies
      document.cookie.split(";").forEach(function (c) {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });

      // Force reload to restart auth flow
      window.location.href = "/";
    } catch (error) {
      console.error("Error clearing session:", error);
      window.location.reload();
    }
  };

  if (showRetry) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md mx-4 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircleIcon className="w-8 h-8 text-amber-600" />
            </div>
            <CardTitle className="text-xl">Проблем със зареждането</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Зареждането отнема твърде дълго. Това може да се дължи на:
            </p>
            <ul className="text-sm text-left text-muted-foreground space-y-2 px-4">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <span>Блокирани бисквитки в браузъра</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <span>Стара сесия от предишен вход</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <span>Проблем с интернет връзката</span>
              </li>
            </ul>
            <div className="pt-4 space-y-3">
              <Button
                onClick={handleClearAndRetry}
                disabled={isClearing}
                className="w-full"
              >
                {isClearing ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Изчистване...
                  </span>
                ) : (
                  "Изчисти сесията и опитай отново"
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Ако проблемът продължава, опитайте с друг браузър или изчистете
                данните на браузъра за този сайт.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <Skeleton className="h-96 w-96 rounded-xl" />
      <p className="text-sm text-muted-foreground animate-pulse">
        Зареждане...
      </p>
    </div>
  );
}

function WrongEmailScreen() {
  const { user, removeUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleTryAgain = async () => {
    setIsLoading(true);
    try {
      // Clear all stored session data so Hercules Auth doesn't auto-login
      sessionStorage.clear();
      localStorage.clear();

      // Clear cookies
      document.cookie.split(";").forEach(function (c) {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });

      // Remove user from OIDC client (signs out locally)
      await removeUser();

      // Redirect to home which will show the login screen
      window.location.href = "/";
    } catch {
      window.location.href = "/";
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)",
      }}
    >
      <div className="absolute top-0 left-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>

      <Card className="w-full max-w-md mx-4 relative z-10 shadow-2xl border-white/20 dark:border-gray-700 backdrop-blur-sm bg-white/95 dark:bg-gray-900/95">
        <CardHeader className="space-y-4 text-center pb-4 pt-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center">
            <AlertCircleIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Имейлът не е регистриран
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-center space-y-6 pb-8">
          <div className="space-y-2">
            <p className="text-muted-foreground">
              Имейл адресът{" "}
              <span className="font-semibold text-foreground">
                {user?.profile?.email}
              </span>{" "}
              не е регистриран в системата.
            </p>
            <p className="text-sm text-muted-foreground">
              Моля, опитайте отново с имейла, с който сте регистрирани в
              училището.
            </p>
          </div>

          <Button
            onClick={handleTryAgain}
            disabled={isLoading}
            className="w-full h-12 text-base font-semibold"
            style={{
              background: "linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)",
            }}
          >
            {isLoading ? "Изчакайте..." : "Опитай с друг имейл"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

const previewModules = [
  {
    title: "Администрация",
    description: "Потребители, класове, предмети, учебни срокове и настройки.",
    icon: UsersIcon,
    color: "from-blue-500 to-cyan-500",
  },
  {
    title: "Електронен дневник",
    description: "Оценки, отсъствия, теми, домашни, контролни и ученици.",
    icon: BookOpenIcon,
    color: "from-emerald-500 to-teal-500",
  },
  {
    title: "Графици",
    description: "Седмични разписания, дневни режими и учебни занятия.",
    icon: CalendarIcon,
    color: "from-violet-500 to-indigo-500",
  },
  {
    title: "Комуникация",
    description: "Съобщения, известия, събития и покани.",
    icon: MessageSquareIcon,
    color: "from-amber-500 to-orange-500",
  },
  {
    title: "Отчети и статистики",
    description: "Справки за успех, отсъствия, дейности и училищни данни.",
    icon: BarChartIcon,
    color: "from-rose-500 to-red-500",
  },
  {
    title: "Такси и документи",
    description: "Такси, банкови сметки, ученически документи и експорти.",
    icon: FileTextIcon,
    color: "from-slate-600 to-zinc-700",
  },
];

function PreviewDashboard({ onSignOut }: { onSignOut: () => void }) {
  return (
    <Layout>
      <div className="space-y-6 pb-6">
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40">
          <InfoIcon className="h-5 w-5 text-blue-600 dark:text-blue-300" />
          <AlertDescription>
            Това е реалният layout на платформата в локален preview режим, без
            login. Менютата са отключени като demo админ, но страниците, които
            четат реални данни, ще станат пълни едва след връзка с Convex база.
          </AlertDescription>
        </Alert>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onSignOut}>
            <LogOutIcon className="h-4 w-4" />
            Изход от preview
          </Button>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <div className="text-3xl font-bold">6</div>
              <div className="text-sm text-muted-foreground">
                Основни модула
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="text-3xl font-bold">119</div>
              <div className="text-sm text-muted-foreground">
                Страници в проекта
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="text-3xl font-bold">55</div>
              <div className="text-sm text-muted-foreground">
                Backend модула
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="text-3xl font-bold">Admin</div>
              <div className="text-sm text-muted-foreground">Demo роля</div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {previewModules.map((module) => {
            const Icon = module.icon;
            return (
              <Card key={module.title} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className={`h-2 bg-gradient-to-r ${module.color}`} />
                  <div className="space-y-4 p-5">
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-lg bg-gradient-to-br ${module.color} p-3 text-white`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <h2 className="text-lg font-semibold">{module.title}</h2>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {module.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Какво виждаш тук</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              Вече не гледаш отделен пресъздаден login екран, а истинската рамка
              на приложението: sidebar, header, модулите и навигацията от кода.
            </p>
            <p>
              Това не доказва още, че всяка функция записва данни, защото за
              това трябва работеща база. Но показва как е организирана самата
              платформа и позволява да се обхождат реалните страници.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default function Index() {
  const [isPreviewSignedIn, setIsPreviewSignedIn] = useState(
    () => localStorage.getItem("academo.previewAuth") === "true",
  );
  const { user } = useAuth();
  const currentUser = useQuery(api.users.getCurrentUser, user ? {} : "skip");

  if (isPreviewSignedIn) {
    return (
      <Layout>
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
          <span>
            Preview режим без login. Това е реалното начално dashboard с
            примерни данни, докато няма свързана Convex база.
          </span>
          <Button
            variant="outline"
            onClick={() => {
              localStorage.removeItem("academo.previewAuth");
              setIsPreviewSignedIn(false);
            }}
          >
            Изход
          </Button>
        </div>
        <DashboardInner />
      </Layout>
    );
  }

  return (
    <>
      <Unauthenticated>
        <PreAuthLogin />
      </Unauthenticated>

      <AuthLoading>
        <AuthLoadingWithTimeout />
      </AuthLoading>

      <Authenticated>
        {/* User authenticated but not found in system - wrong email */}
        {currentUser === null ? (
          <WrongEmailScreen />
        ) : (
          <Layout>
            <DashboardInner />
          </Layout>
        )}
      </Authenticated>
    </>
  );
}
