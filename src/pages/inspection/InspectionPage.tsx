import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.tsx";
import { ArrowLeft, X, CheckCircle2, Info, BookOpen, Trash2, XCircle, AlertTriangle } from "lucide-react";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth.ts";
import { useNavigate, Link } from "react-router-dom";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { formatFullName } from "@/lib/utils.ts";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";

type ViewLevel = "months" | "days" | "details" | "lesson";

const MONTH_NAMES_BG = [
  "Януари", "Февруари", "Март", "Април", "Май", "Юни",
  "Юли", "Август", "Септември", "Октомври", "Ноември", "Декември"
];

// Component to show when user has no school assigned
function NoSchoolMessage() {
  const assignSchool = useMutation(api.admin.assignSchoolToCurrentUser);
  const [isAssigning, setIsAssigning] = useState(false);

  const handleAssignSchool = async () => {
    setIsAssigning(true);
    try {
      const result = await assignSchool({});
      if (result.success) {
        toast.success("Успешно свързахте профила си с училището");
      }
    } catch {
      toast.error("Грешка при свързване с училище");
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Card className="bg-card">
      <CardContent className="p-12 text-center">
        <p className="text-muted-foreground text-lg">
          Профилът ви не е свързан с училище.
        </p>
        <p className="text-muted-foreground text-sm mt-2 mb-4">
          Натиснете бутона по-долу, за да се свържете с училището в системата.
        </p>
        <Button onClick={handleAssignSchool} disabled={isAssigning}>
          {isAssigning ? "Свързване..." : "Свържи ме с училището"}
        </Button>
      </CardContent>
    </Card>
  );
}

// Helper to get dark mode compatible card color classes
function getCardColorClasses(percentage: number): string {
  if (percentage === 0) return "bg-rose-500 dark:bg-rose-600 text-white";
  if (percentage < 100) return "bg-amber-500 dark:bg-amber-600 text-white";
  return "bg-emerald-500 dark:bg-emerald-600 text-white";
}

export default function InspectionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentYear] = useState(new Date().getFullYear());
  const [viewLevel, setViewLevel] = useState<ViewLevel>("months");
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<Id<"teachers"> | undefined>(undefined);
  const [selectedClassId, setSelectedClassId] = useState<Id<"classes"> | undefined>(undefined);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [lessonToClear, setLessonToClear] = useState<Id<"lessons"> | null>(null);

  // Mutations for inspection actions
  const markAsTaken = useMutation(api.inspections.markLessonAsTaken);
  const markAsNotConducted = useMutation(api.inspections.markLessonAsNotConducted);
  const clearLessonData = useMutation(api.inspections.clearLessonData);

  // Get current user and school
  const currentUser = useQuery(
    api.users.getCurrentUser,
    user ? {} : "skip"
  );

  const schoolId = currentUser?.schoolId;
  
  // Check if user is admin/director/deputy director
  const isAdminOrDirector = useMemo(() => {
    if (!currentUser) return false;
    const role = currentUser.role;
    const roles = currentUser.roles;
    return role === "system_admin" || role === "director" || role === "vice_director" ||
           roles?.includes("system_admin") || roles?.includes("director") || roles?.includes("vice_director");
  }, [currentUser]);

  // Get current user's teacher record if they are a teacher
  const teacherRecord = useQuery(
    api.admin.getTeacherByUserId,
    currentUser?._id && !isAdminOrDirector ? { userId: currentUser._id } : "skip"
  );

  // Get current user's teacher ID if they are a teacher
  const currentTeacherId = useMemo(() => {
    if (!currentUser || isAdminOrDirector) return undefined;
    return teacherRecord?._id;
  }, [currentUser, isAdminOrDirector, teacherRecord]);

  // Get teachers and classes for filters (only for admin/director)
  const allTeachers = useQuery(
    api.admin.listTeachersWithSubjects,
    schoolId && isAdminOrDirector ? { schoolId } : "skip"
  );

  const allClasses = useQuery(
    api.admin.listClasses,
    schoolId ? { schoolId } : "skip"
  );

  // Determine which teacher ID to use for queries
  const effectiveTeacherId = useMemo(() => {
    if (isAdminOrDirector) {
      return selectedTeacherId; // Admin can filter by any teacher
    }
    return currentTeacherId; // Teachers can only see their own data
  }, [isAdminOrDirector, selectedTeacherId, currentTeacherId]);

  // Month statistics
  const monthStats = useQuery(
    api.inspections.getMonthStatistics,
    schoolId ? {
      year: currentYear,
      schoolId,
      teacherId: effectiveTeacherId,
    } : "skip"
  );

  // Check if we have any lessons at all
  const hasAnyLessons = monthStats && monthStats.some(m => m.totalLessons > 0);

  // Day statistics (when month is selected)
  const dayStats = useQuery(
    api.inspections.getDayStatistics,
    schoolId && selectedMonth ? {
      year: currentYear,
      month: selectedMonth,
      schoolId,
      teacherId: effectiveTeacherId,
    } : "skip"
  );

  // Day details (when day is selected)
  const dayDetails = useQuery(
    api.inspections.getDayDetails,
    schoolId && selectedDate ? {
      date: selectedDate,
      schoolId,
      teacherId: effectiveTeacherId,
    } : "skip"
  );

  const handleMonthClick = (month: number) => {
    setSelectedMonth(month);
    setViewLevel("days");
  };

  const handleDayClick = (date: number) => {
    setSelectedDate(date);
    setViewLevel("details");
  };

  const handlePeriodClick = (period: number) => {
    setSelectedPeriod(period);
    setViewLevel("lesson");
  };

  const handleClosePeriodDetails = () => {
    setSelectedPeriod(null);
    setViewLevel("details");
  };

  const handleBack = () => {
    if (viewLevel === "lesson") {
      setViewLevel("details");
      setSelectedPeriod(null);
    } else if (viewLevel === "details") {
      setViewLevel("days");
      setSelectedDate(null);
    } else if (viewLevel === "days") {
      setViewLevel("months");
      setSelectedMonth(null);
    } else {
      navigate("/bg");
    }
  };

  // Handler for marking lesson as taken
  const handleMarkAsTaken = async (lessonId: Id<"lessons">) => {
    try {
      await markAsTaken({ lessonId });
      toast.success("Часът е маркиран като взет и проверен");
    } catch (error) {
      toast.error("Грешка при маркиране на часа");
    }
  };

  // Handler for marking lesson as not conducted
  const handleMarkAsNotConducted = async (lessonId: Id<"lessons">) => {
    try {
      await markAsNotConducted({ lessonId });
      toast.success("Часът е маркиран като непроведен");
    } catch (error) {
      toast.error("Грешка при маркиране на часа");
    }
  };

  // Handler for opening clear confirmation dialog
  const handleOpenClearDialog = (lessonId: Id<"lessons">) => {
    setLessonToClear(lessonId);
    setClearDialogOpen(true);
  };

  // Handler for confirming clear
  const handleConfirmClear = async () => {
    if (!lessonToClear) return;
    try {
      const result = await clearLessonData({ lessonId: lessonToClear });
      toast.success(`Изчистени: ${result.deletedAttendance} отсъствия, ${result.deletedGrades} оценки, ${result.deletedBadges} отзива`);
    } catch (error) {
      toast.error("Грешка при изчистване на данните");
    } finally {
      setClearDialogOpen(false);
      setLessonToClear(null);
    }
  };

  // Filter lessons by class if selected - must be before any returns
  const filteredLessons = useMemo(() => {
    if (!dayDetails?.lessons) return [];
    return dayDetails.lessons.filter(l => 
      !selectedClassId || l.className.includes(allClasses?.find(c => c._id === selectedClassId)?.name ?? "")
    );
  }, [dayDetails?.lessons, selectedClassId, allClasses]);

  // Group lessons by period - must be before any returns
  const lessonsByPeriod = useMemo(() => {
    const grouped: Record<number, typeof filteredLessons> = {};
    for (const lesson of filteredLessons) {
      if (!grouped[lesson.periodIndex]) {
        grouped[lesson.periodIndex] = [];
      }
      grouped[lesson.periodIndex].push(lesson);
    }
    return grouped;
  }, [filteredLessons]);

  // Get lessons for the selected period - must be before any returns
  const selectedPeriodLessons = useMemo(() => {
    if (selectedPeriod === null) return [];
    return lessonsByPeriod[selectedPeriod] ?? [];
  }, [selectedPeriod, lessonsByPeriod]);
  
  // Calculate stats for the selected period - must be before any returns
  const selectedPeriodStats = useMemo(() => {
    if (selectedPeriod === null || selectedPeriodLessons.length === 0) return null;
    const totalLessons = selectedPeriodLessons.length;
    const takenLessons = selectedPeriodLessons.filter(l => l.isTaken).length;
    const totalAbsences = selectedPeriodLessons.reduce((sum, l) => sum + l.absencesCount, 0);
    const totalGrades = selectedPeriodLessons.reduce((sum, l) => sum + l.gradesCount, 0);
    const totalRemarks = selectedPeriodLessons.reduce((sum, l) => sum + l.remarksCount, 0);
    const percentageTaken = totalLessons > 0 ? Math.round((takenLessons / totalLessons) * 100) : 0;
    const firstLesson = selectedPeriodLessons[0];
    return {
      periodIndex: selectedPeriod,
      startTime: firstLesson?.startTime ?? "00:00",
      endTime: firstLesson?.endTime ?? "00:00",
      percentageTaken,
      totalAbsences,
      totalGrades,
      totalRemarks,
    };
  }, [selectedPeriod, selectedPeriodLessons]);

  // Compute taken percentage for summary cards
  const takenPercentage = useMemo(() => {
    if (!dayDetails) return 0;
    return dayDetails.summary.totalLessons > 0 
      ? Math.round((dayDetails.summary.takenLessons / dayDetails.summary.totalLessons) * 100) 
      : 0;
  }, [dayDetails]);

  // Compute period color classes for header bar
  const periodColorClasses = useMemo(() => {
    if (!selectedPeriodStats) return "";
    if (selectedPeriodStats.percentageTaken === 100) {
      return "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-800";
    }
    if (selectedPeriodStats.percentageTaken === 0) {
      return "bg-rose-100 dark:bg-rose-900/40 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-800";
    }
    return "bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800";
  }, [selectedPeriodStats]);

  // Early returns for loading states - AFTER all hooks
  if (!user || !currentUser) {
    return (
      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  // Access control - only admin, director, and vice_director can access this page
  const hasAccess = currentUser.role === "system_admin" || 
                    currentUser.role === "director" || 
                    currentUser.role === "vice_director" ||
                    currentUser.roles?.includes("system_admin") ||
                    currentUser.roles?.includes("director") ||
                    currentUser.roles?.includes("vice_director");
  
  if (!hasAccess) {
    return (
      <div className="container mx-auto p-6">
        <Card className="bg-card">
          <CardContent className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-foreground text-lg font-semibold mb-2">
              Достъпът е ограничен
            </p>
            <p className="text-muted-foreground text-sm">
              Тази страница е достъпна само за администратори, директори и заместник-директори.
            </p>
            <Button onClick={() => navigate("/bg")} className="mt-4">
              Към началната страница
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!schoolId) {
    return (
      <div className="container mx-auto p-6">
        <NoSchoolMessage />
      </div>
    );
  }

  if (viewLevel === "months" && !monthStats) {
    return (
      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (viewLevel === "days" && !dayStats) {
    return (
      <div className="container mx-auto p-6">
        <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад
        </Button>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 30 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if ((viewLevel === "details" || viewLevel === "lesson") && !dayDetails) {
    return (
      <div className="container mx-auto p-6">
        <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад
        </Button>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground">
            Проверка и контрол
          </h1>
          {!isAdminOrDirector && (
            <span className="text-sm text-muted-foreground">(Само вашите часове)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Назад
          </Button>
          {(viewLevel === "details" || viewLevel === "lesson") && selectedDate && (
            <div className="bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-200 px-3 py-1 rounded text-sm font-medium">
              {new Date(selectedDate).toLocaleDateString("bg-BG")}
            </div>
          )}
        </div>
      </div>

      {/* Filters - Only for admin/director */}
      {isAdminOrDirector && (
        <div className="flex items-center gap-4 flex-wrap">
          <Select 
            value={selectedTeacherId ?? "all"} 
            onValueChange={(v) => setSelectedTeacherId(v === "all" ? undefined : v as Id<"teachers">)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Изберете (учител)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всички учители</SelectItem>
              {allTeachers?.map((t) => (
                <SelectItem key={t._id} value={t._id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={selectedClassId ?? "all"} 
            onValueChange={(v) => setSelectedClassId(v === "all" ? undefined : v as Id<"classes">)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Изберете (паралелка)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всички паралелки</SelectItem>
              {allClasses?.map((c) => (
                <SelectItem key={c._id} value={c._id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Summary Cards (show on details and lesson views) */}
      {(viewLevel === "details" || viewLevel === "lesson") && dayDetails && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className={`${getCardColorClasses(takenPercentage)} border-0`}>
            <CardContent className="p-4 text-center text-white">
              <p className="text-3xl font-bold">{dayDetails.summary.takenLessons} / {dayDetails.summary.totalLessons}</p>
              <p className="text-sm mt-1 opacity-90">Взети занятия</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-500 dark:bg-amber-600 border-0">
            <CardContent className="p-4 text-center text-white">
              <p className="text-3xl font-bold">{dayDetails.summary.totalAbsences}</p>
              <p className="text-sm mt-1 opacity-90">Отсъствия</p>
            </CardContent>
          </Card>
          <Card className="bg-lime-500 dark:bg-lime-600 border-0">
            <CardContent className="p-4 text-center text-white">
              <p className="text-3xl font-bold">{dayDetails.summary.totalGrades}</p>
              <p className="text-sm mt-1 opacity-90">Оценки</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-500 dark:bg-purple-600 border-0">
            <CardContent className="p-4 text-center text-white">
              <p className="text-3xl font-bold">{dayDetails.summary.totalRemarks}</p>
              <p className="text-sm mt-1 opacity-90">Отзива</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Selected Period Header Bar */}
      {viewLevel === "lesson" && selectedPeriodStats && (
        <div className={`${periodColorClasses.split(" hover:")[0]} border rounded-lg p-3 flex items-center justify-between`}>
          <div className={`flex items-center gap-2 ${periodColorClasses.split(" ").find(c => c.startsWith("text-"))}`}>
            <button onClick={handleClosePeriodDetails} className={`${periodColorClasses.split(" ").filter(c => c.startsWith("hover:")).join(" ")} rounded p-1 transition-colors`}>
              <X className="h-4 w-4" />
            </button>
            <span className="font-medium">
              Час #{selectedPeriodStats.periodIndex} ({selectedPeriodStats.startTime}-{selectedPeriodStats.endTime}) - {selectedPeriodStats.percentageTaken}% взет, {selectedPeriodStats.totalAbsences} отсъствия, {selectedPeriodStats.totalGrades} оценки, {selectedPeriodStats.totalRemarks} отзива
            </span>
          </div>
        </div>
      )}

      {/* Months view */}
      {viewLevel === "months" && monthStats && (
        <>
          {!hasAnyLessons ? (
            <Card className="bg-card">
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground text-lg">
                  Няма данни за часове за {currentYear} година.
                </p>
                <p className="text-muted-foreground text-sm mt-2">
                  Данните ще се появят след като бъдат въведени часове в дневника.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {monthStats.map((stat) => (
                <button
                  key={stat.month}
                  onClick={() => handleMonthClick(stat.month)}
                  className="text-left"
                >
                  <Card className={`${getCardColorClasses(stat.percentageTaken)} border-0 hover:opacity-90 transition-opacity`}>
                    <CardContent className="p-6">
                      <h3 className="text-xl font-bold mb-2">{MONTH_NAMES_BG[stat.month - 1]}</h3>
                      <p className="text-lg font-semibold">{stat.percentageTaken}% взет</p>
                      <p className="text-sm opacity-80">{stat.takenLessons}/{stat.totalLessons} часа</p>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Days view */}
      {viewLevel === "days" && dayStats && (
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-3">
          {dayStats.map((stat) => (
            <button
              key={stat.date}
              onClick={() => handleDayClick(stat.date)}
              className="text-left"
              disabled={stat.totalLessons === 0}
            >
              <Card className={`${stat.totalLessons === 0 ? "bg-muted text-muted-foreground" : getCardColorClasses(stat.percentageTaken)} border-0 hover:opacity-90 transition-opacity`}>
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold">{stat.day}</p>
                  {stat.totalLessons > 0 && (
                    <p className="text-xs">{stat.percentageTaken}%</p>
                  )}
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      {/* Details view - Lessons by period */}
      {viewLevel === "details" && dayDetails && (
        <div className="space-y-2">
          {Object.entries(lessonsByPeriod)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([period, lessons]) => {
              const periodNum = Number(period);
              const totalLessons = lessons.length;
              const takenLessons = lessons.filter(l => l.isTaken).length;
              const totalAbsences = lessons.reduce((sum, l) => sum + l.absencesCount, 0);
              const totalGrades = lessons.reduce((sum, l) => sum + l.gradesCount, 0);
              const totalRemarks = lessons.reduce((sum, l) => sum + l.remarksCount, 0);
              const percentageTaken = totalLessons > 0 ? Math.round((takenLessons / totalLessons) * 100) : 0;
              const firstLesson = lessons[0];

              // Determine color based on percentage
              const periodCardClasses = percentageTaken === 100
                ? "bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800"
                : percentageTaken === 0
                ? "bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 border-rose-200 dark:border-rose-800"
                : "bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 border-amber-200 dark:border-amber-800";
              const periodTextClasses = percentageTaken === 100
                ? "text-emerald-700 dark:text-emerald-300"
                : percentageTaken === 0
                ? "text-rose-700 dark:text-rose-300"
                : "text-amber-700 dark:text-amber-300";

              return (
                <button
                  key={period}
                  onClick={() => handlePeriodClick(periodNum)}
                  className="w-full text-left"
                >
                  <Card className={`${periodCardClasses} transition-colors`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className={`text-sm font-semibold ${periodTextClasses}`}>
                            Час #{periodNum} ({firstLesson?.startTime}-{firstLesson?.endTime}) - {percentageTaken}% взет, {totalAbsences} отсъствия, {totalGrades} оценки, {totalRemarks} отзива
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {lessons.length} занятия
                          </p>
                        </div>
                        {takenLessons === totalLessons && totalLessons > 0 && (
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            })}

          {Object.keys(lessonsByPeriod).length === 0 && (
            <Card className="bg-card">
              <CardContent className="p-6 text-center text-muted-foreground">
                Няма часове за този ден
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Lesson detail view - Table matching screenshot */}
      {viewLevel === "lesson" && selectedPeriod !== null && (
        <div className="space-y-4">
          <Card className="bg-card">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold text-foreground">Занятие</TableHead>
                      <TableHead className="font-semibold text-foreground">Учител</TableHead>
                      <TableHead className="font-semibold text-foreground">Теми</TableHead>
                      <TableHead className="font-semibold text-foreground text-center">Ученици</TableHead>
                      <TableHead className="font-semibold text-foreground text-center">Отсъствия</TableHead>
                      <TableHead className="font-semibold text-foreground text-center">Закъснения</TableHead>
                      <TableHead className="font-semibold text-foreground text-center">Оценки</TableHead>
                      <TableHead className="font-semibold text-foreground text-center">Отзива</TableHead>
                      <TableHead className="font-semibold text-foreground text-center">
                        <div className="flex items-center justify-center gap-1">
                          Взет и проверен
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3.5 w-3.5 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>Часът е взет и проверен</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-foreground text-center">
                        <div className="flex items-center justify-center gap-1">
                          Непроведен
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3.5 w-3.5 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>Часът не е проведен</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-foreground text-center">
                        <div className="flex items-center justify-center gap-1">
                          Изчисти
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3.5 w-3.5 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>Изчисти данните за този час</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPeriodLessons.map((lesson) => {
                      // Format teacher names as "б/д Име П. Фамилия"
                      const formattedTeacherNames = (lesson.teacherNames ?? [lesson.teacherName])
                        .filter(n => n && n !== "Unknown")
                        .map(n => `б/д ${formatFullName(n)}`);
                      const teacherDisplay = formattedTeacherNames.length > 0 
                        ? formattedTeacherNames.join(", ")
                        : "б/д (няма данни)";
                      
                      return (
                        <TableRow key={lesson.lessonId} className="hover:bg-muted/30">
                          <TableCell>
                            <Link 
                              to={`/bg/diary/lesson/${lesson.lessonId}`}
                              className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <BookOpen className="h-4 w-4" />
                              <span>{lesson.className} {lesson.subjectName}</span>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <span className="text-blue-600 dark:text-blue-400">
                              {teacherDisplay}
                            </span>
                          </TableCell>
                          <TableCell className="text-cyan-600 dark:text-cyan-400 max-w-[200px] truncate">
                            {/* Topic would come from lesson details */}
                            -
                          </TableCell>
                          <TableCell className="text-center text-foreground">
                            {/* Student count - would need to be added to backend */}
                            -
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={lesson.absencesCount > 0 ? "text-red-600 dark:text-red-400 font-medium" : "text-foreground"}>
                              {lesson.absencesCount}
                            </span>
                          </TableCell>
                          <TableCell className="text-center text-foreground">
                            {/* Late arrivals - would need to be added */}
                            0
                          </TableCell>
                          <TableCell className="text-center text-foreground">
                            {lesson.gradesCount}
                          </TableCell>
                          <TableCell className="text-center text-foreground">
                            {lesson.remarksCount}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              {lesson.isTaken ? (
                                <div className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2.5 py-1 rounded text-xs font-medium">
                                  ДА
                                </div>
                              ) : isAdminOrDirector ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 hover:bg-green-100 dark:hover:bg-green-900/50 hover:text-green-700 dark:hover:text-green-300"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkAsTaken(lesson.lessonId);
                                  }}
                                >
                                  НЕ → ДА
                                </Button>
                              ) : (
                                <div className="bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 px-2.5 py-1 rounded text-xs font-medium">
                                  НЕ
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              {isAdminOrDirector ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 hover:text-amber-700 dark:hover:text-amber-300"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkAsNotConducted(lesson.lessonId);
                                  }}
                                >
                                  Непроведен
                                </Button>
                              ) : (
                                <div className="bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 px-2.5 py-1 rounded text-xs font-medium">
                                  НЕ
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {isAdminOrDirector && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenClearDialog(lesson.lessonId);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {selectedPeriodLessons.length === 0 && (
            <Card className="bg-card">
              <CardContent className="p-6 text-center text-muted-foreground">
                Няма часове за този период
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {viewLevel === "lesson" && selectedPeriod === null && (
        <div className="space-y-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-64" />
        </div>
      )}

      {/* Confirmation Dialog for Clear */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" />
              Изчистване на данни
            </AlertDialogTitle>
            <AlertDialogDescription>
              <span className="text-foreground font-medium">Внимание!</span> Това действие ще изтрие всички данни за този час:
              <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                <li>Всички отсъствия</li>
                <li>Всички оценки</li>
                <li>Всички отзиви и забележки</li>
                <li>Темата на часа</li>
              </ul>
              <p className="mt-3 text-rose-600 dark:text-rose-400 font-medium">
                Това действие не може да бъде отменено!
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отказ</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClear}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Изчисти данните
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
