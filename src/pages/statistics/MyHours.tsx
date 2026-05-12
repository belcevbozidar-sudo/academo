import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.tsx";
import { ArrowLeft, X, CheckCircle2, Info, BookOpen, AlertTriangle } from "lucide-react";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth.ts";
import { useNavigate, Link } from "react-router-dom";
import { formatFullName } from "@/lib/utils.ts";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import Layout from "@/components/Layout.tsx";
import { Authenticated, AuthLoading } from "@/lib/convex-preview";

type ViewLevel = "months" | "days" | "details" | "lesson";

const MONTH_NAMES_BG = [
  "Януари", "Февруари", "Март", "Април", "Май", "Юни",
  "Юли", "Август", "Септември", "Октомври", "Ноември", "Декември"
];

// Helper to get dark mode compatible card color classes
function getCardColorClasses(percentage: number): string {
  if (percentage === 0) return "bg-rose-500 dark:bg-rose-600 text-white";
  if (percentage < 100) return "bg-amber-500 dark:bg-amber-600 text-white";
  return "bg-emerald-500 dark:bg-emerald-600 text-white";
}

function MyHoursInner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentYear] = useState(new Date().getFullYear());
  const [viewLevel, setViewLevel] = useState<ViewLevel>("months");
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);

  // Get current user and school
  const currentUser = useQuery(
    api.users.getCurrentUser,
    user ? {} : "skip"
  );

  const schoolId = currentUser?.schoolId;
  
  // Get current user's teacher record
  const teacherRecord = useQuery(
    api.admin.getTeacherByUserId,
    currentUser?._id ? { userId: currentUser._id } : "skip"
  );

  // Get current user's teacher ID
  const currentTeacherId = useMemo(() => {
    return teacherRecord?._id;
  }, [teacherRecord]);

  // Month statistics - only for this teacher
  const monthStats = useQuery(
    api.inspections.getMonthStatistics,
    schoolId && currentTeacherId ? {
      year: currentYear,
      schoolId,
      teacherId: currentTeacherId,
    } : "skip"
  );

  // Check if we have any lessons at all
  const hasAnyLessons = monthStats && monthStats.some(m => m.totalLessons > 0);

  // Day statistics (when month is selected)
  const dayStats = useQuery(
    api.inspections.getDayStatistics,
    schoolId && selectedMonth && currentTeacherId ? {
      year: currentYear,
      month: selectedMonth,
      schoolId,
      teacherId: currentTeacherId,
    } : "skip"
  );

  // Day details (when day is selected)
  const dayDetails = useQuery(
    api.inspections.getDayDetails,
    schoolId && selectedDate && currentTeacherId ? {
      date: selectedDate,
      schoolId,
      teacherId: currentTeacherId,
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

  // Filter lessons - must be before any returns
  const filteredLessons = useMemo(() => {
    if (!dayDetails?.lessons) return [];
    return dayDetails.lessons;
  }, [dayDetails?.lessons]);

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

  // Check if user is a teacher
  const isTeacher = currentUser.role === "teacher" || 
                    currentUser.role === "class_teacher" ||
                    currentUser.roles?.includes("teacher") ||
                    currentUser.roles?.includes("class_teacher");
  
  if (!isTeacher) {
    return (
      <div className="container mx-auto p-6">
        <Card className="bg-card">
          <CardContent className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-foreground text-lg font-semibold mb-2">
              Достъпът е ограничен
            </p>
            <p className="text-muted-foreground text-sm">
              Тази страница е достъпна само за учители.
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
        <Card className="bg-card">
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground text-lg">
              Профилът ви не е свързан с училище.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentTeacherId) {
    return (
      <div className="container mx-auto p-6">
        <Card className="bg-card">
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground text-lg">
              Не сте регистриран като учител в системата.
            </p>
          </CardContent>
        </Card>
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
            Мои часове
          </h1>
          <span className="text-sm text-muted-foreground">
            ({currentUser.firstName} {currentUser.lastName})
          </span>
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

      {/* Summary Cards (show on details and lesson views) */}
      {(viewLevel === "details" || viewLevel === "lesson") && dayDetails && (() => {
        const takenPercentage = dayDetails.summary.totalLessons > 0 
          ? Math.round((dayDetails.summary.takenLessons / dayDetails.summary.totalLessons) * 100) 
          : 0;
        return (
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
        );
      })()}

      {/* Selected Period Header Bar */}
      {viewLevel === "lesson" && selectedPeriodStats && (() => {
        const periodColorClasses = selectedPeriodStats.percentageTaken === 100 
          ? "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-800"
          : selectedPeriodStats.percentageTaken === 0
          ? "bg-rose-100 dark:bg-rose-900/40 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-800"
          : "bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800";
        return (
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
        );
      })()}

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

      {/* Lesson detail view - Table */}
      {viewLevel === "lesson" && selectedPeriod !== null && (
        <div className="space-y-4">
          <Card className="bg-card">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold text-foreground">Занятие</TableHead>
                      <TableHead className="font-semibold text-foreground">Теми</TableHead>
                      <TableHead className="font-semibold text-foreground text-center">Ученици</TableHead>
                      <TableHead className="font-semibold text-foreground text-center">Отсъствия</TableHead>
                      <TableHead className="font-semibold text-foreground text-center">Закъснения</TableHead>
                      <TableHead className="font-semibold text-foreground text-center">Оценки</TableHead>
                      <TableHead className="font-semibold text-foreground text-center">Отзива</TableHead>
                      <TableHead className="font-semibold text-foreground text-center">
                        <div className="flex items-center justify-center gap-1">
                          Взет
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3.5 w-3.5 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>Часът е взет</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPeriodLessons.map((lesson) => (
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
                        <TableCell className="text-cyan-600 dark:text-cyan-400 max-w-[200px] truncate">
                          -
                        </TableCell>
                        <TableCell className="text-center text-foreground">
                          -
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={lesson.absencesCount > 0 ? "text-red-600 dark:text-red-400 font-medium" : "text-foreground"}>
                            {lesson.absencesCount}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-foreground">
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
                            ) : (
                              <div className="bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 px-2.5 py-1 rounded text-xs font-medium">
                                НЕ
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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
    </div>
  );
}

export default function MyHours() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
      </AuthLoading>

      <Authenticated>
        <Layout>
          <MyHoursInner />
        </Layout>
      </Authenticated>
    </>
  );
}
