import { useParams, Link } from "react-router-dom";
import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { InfoIcon, ChevronLeft, ChevronRight, ClockIcon, BookOpenIcon } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { cn, formatUserName, formatFullName } from "@/lib/utils.ts";
import { useState } from "react";
import { UserNameLink } from "@/components/ui/user-name-link.tsx";

// Helper to get Monday of the week containing a date
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

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

// Helper to calculate week number
function getWeekNumber(date: Date): { weekNumber: number; weekStart: Date; weekEnd: Date } {
  const weekStart = getMonday(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 4);
  
  // Calculate ISO week number
  const weekNumber = getISOWeekNumber(date);
  
  return {
    weekNumber,
    weekStart,
    weekEnd,
  };
}

function UserScheduleInner() {
  const { userId } = useParams<{ userId: string }>();
  
  // Week navigation state
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const now = new Date();
    return getWeekNumber(now);
  });
  
  const userData = useQuery(
    api.users.getUserById,
    userId ? { userId: userId as Id<"users"> } : "skip"
  );
  
  // Get teacher record
  const teachers = useQuery(api.admin.listTeachers, {});
  const teacherRecord = teachers?.find(t => t.userId === userId);
  
  // Get user's schedule with substitutions
  const userAbsences = useQuery(
    api.teacherAbsences.getAbsencesForUserSchedule,
    userId ? {
      userId: userId as Id<"users">,
      startDate: selectedWeek.weekStart.getTime(),
      endDate: selectedWeek.weekEnd.getTime(),
    } : "skip"
  );
  
  // Get user's weekly schedule
  const weeklyScheduleData = useQuery(
    api.weeklySchedules.getByTeacher,
    teacherRecord ? { teacherId: teacherRecord._id as Id<"teachers"> } : "skip"
  );
  
  // Extract schedules and dayRegimePeriods from the new return format
  const weeklySchedule = weeklyScheduleData?.schedules;
  const dayRegimePeriods = weeklyScheduleData?.dayRegimePeriods;
  
  const handlePreviousWeek = () => {
    const newDate = new Date(selectedWeek.weekStart);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedWeek(getWeekNumber(newDate));
  };
  
  const handleNextWeek = () => {
    const newDate = new Date(selectedWeek.weekStart);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedWeek(getWeekNumber(newDate));
  };
  
  const handleCurrentWeek = () => {
    setSelectedWeek(getWeekNumber(new Date()));
  };
  
  if (!userId || !userData || weeklyScheduleData === undefined || userAbsences === undefined) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }
  
  // Check if user is a teacher
  if (!teacherRecord) {
    return (
      <Layout>
        <Card>
          <CardHeader>
            <CardTitle>Няма разписание</CardTitle>
            <CardDescription>
              Този потребител не е учител и няма разписание.
            </CardDescription>
          </CardHeader>
        </Card>
      </Layout>
    );
  }
  
  // Check if there's any content to show (either schedule or substitutions)
  const hasAnyContent = (weeklySchedule && weeklySchedule.length > 0) || (userAbsences && userAbsences.length > 0);
  
  if (!hasAnyContent) {
    return (
      <Layout>
        <div className="p-6 space-y-6">
          {/* Week Selector */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-2 border-blue-200 dark:border-blue-800">
            <CardContent className="p-6">
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
                    Седмица {selectedWeek.weekNumber}
                  </div>
                  <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    {selectedWeek.weekStart.toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {selectedWeek.weekEnd.toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' })}
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
          
          <Card>
            <CardHeader>
              <CardTitle>Няма налично разписание за този потребител</CardTitle>
              <CardDescription>
                Няма разписание или заместващи часове за избраната седмица.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    );
  }
  
  // Get current day of week to highlight (1 = Monday, 7 = Sunday)
  const today = new Date();
  const currentDayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
  
  // Check if selected week is the current week
  const currentWeekInfo = getWeekNumber(new Date());
  const isCurrentWeek = selectedWeek.weekStart.getFullYear() === currentWeekInfo.weekStart.getFullYear() &&
                        selectedWeek.weekStart.getMonth() === currentWeekInfo.weekStart.getMonth() &&
                        selectedWeek.weekStart.getDate() === currentWeekInfo.weekStart.getDate();
  
  const daysOfWeek = [
    { num: 1, name: "Понеделник" },
    { num: 2, name: "Вторник" },
    { num: 3, name: "Сряда" },
    { num: 4, name: "Четвъртък" },
    { num: 5, name: "Петък" },
  ];
  
  // Find max period count
  let maxPeriod = 0;
  if (weeklySchedule && weeklySchedule.length > 0) {
    for (const schedule of weeklySchedule) {
      for (const entry of schedule.entries) {
        if (entry.periodIndex > maxPeriod) {
          maxPeriod = entry.periodIndex;
        }
      }
    }
  }
  
  // Also check absences for max period
  if (userAbsences && userAbsences.length > 0) {
    for (const absence of userAbsences) {
      for (const entry of absence.affectedEntries) {
        if (entry.periodIndex + 1 > maxPeriod) {
          maxPeriod = entry.periodIndex + 1;
        }
      }
    }
  }
  
  const periodCount = maxPeriod || 7;
  
  // Build a grid: period x day
  const grid: Array<
    Array<{
      subjectName: string;
      subjectNames?: string[]; // Multiple subjects for different classes
      subjectIds?: string[]; // Subject IDs for linking
      className: string;
      classNames?: string[]; // Multiple classes for same period
      classIds?: string[]; // Class IDs for linking
      isSubstitute?: boolean;
      originalTeacher?: string;
      originalTeacherUserId?: string;
      originalTeacherFirstName?: string;
      originalTeacherMiddleName?: string;
      originalTeacherLastName?: string;
      isCivicEducation?: boolean;
      isFree?: boolean;
      substituteSubjectId?: string; // Subject ID for substitute link
      substituteClassId?: string; // Class ID for substitute link
      groupName?: string;
    } | null>
  > = [];
  
  // Helper to sort class names (smaller class first: 8а before 8б)
  const sortClassNames = (a: string, b: string): number => {
    // Extract number and letter from class name (e.g., "8а" -> 8, "а")
    const matchA = a.match(/^(\d+)([а-яА-Яa-zA-Z]?)$/);
    const matchB = b.match(/^(\d+)([а-яА-Яa-zA-Z]?)$/);
    
    if (matchA && matchB) {
      const numA = parseInt(matchA[1]);
      const numB = parseInt(matchB[1]);
      if (numA !== numB) return numA - numB;
      // Same number, compare letters
      return (matchA[2] || "").localeCompare(matchB[2] || "", "bg");
    }
    return a.localeCompare(b, "bg");
  };
  
  for (let period = 1; period <= periodCount; period++) {
    const row: Array<{
      subjectName: string;
      subjectNames?: string[];
      subjectIds?: string[];
      className: string;
      classNames?: string[];
      classIds?: string[];
      isSubstitute?: boolean;
      originalTeacher?: string;
      originalTeacherUserId?: string;
      originalTeacherFirstName?: string;
      originalTeacherMiddleName?: string;
      originalTeacherLastName?: string;
      isCivicEducation?: boolean;
      isFree?: boolean;
      substituteSubjectId?: string;
      substituteClassId?: string;
      groupName?: string;
    } | null> = [];
    
    for (let day = 1; day <= 5; day++) {
      // First, check if this is a regular scheduled class
      let cell: {
        subjectName: string;
        subjectNames?: string[];
        subjectIds?: string[];
        className: string;
        classNames?: string[];
        classIds?: string[];
        isSubstitute?: boolean;
        originalTeacher?: string;
        originalTeacherUserId?: string;
        originalTeacherFirstName?: string;
        originalTeacherMiddleName?: string;
        originalTeacherLastName?: string;
        isCivicEducation?: boolean;
        isFree?: boolean;
        substituteSubjectId?: string;
        substituteClassId?: string;
        groupName?: string;
      } | null = null;
      
      // Collect ALL classes and subjects for this period
      if (weeklySchedule && weeklySchedule.length > 0) {
        const entriesForPeriod: { className: string; classId: string; subjectName: string; subjectId: string; groupName?: string }[] = [];
        
        for (const schedule of weeklySchedule) {
          const entry = schedule.entries.find(
            (e) => e.dayOfWeek === day && e.periodIndex === period
          );
          
          if (entry) {
            entriesForPeriod.push({
              className: schedule.className,
              classId: schedule.classId,
              subjectName: entry.subjectName,
              subjectId: entry.subjectId,
              groupName: entry.groupName,
            });
          }
        }
        
        if (entriesForPeriod.length > 0) {
          // Sort entries by class name (smaller class first)
          entriesForPeriod.sort((a, b) => sortClassNames(a.className, b.className));
          
          // Extract sorted subjects and class names
          const sortedSubjects = entriesForPeriod.map(e => e.subjectName);
          const sortedSubjectIds = entriesForPeriod.map(e => e.subjectId);
          const sortedClasses = entriesForPeriod.map(e => e.className);
          const sortedClassIds = entriesForPeriod.map(e => e.classId);
          
          // For display: classes in reverse order (larger first)
          const displayClasses = [...sortedClasses].reverse();
          
          // For display subject name: join all unique subjects with " / "
          const uniqueSubjects = [...new Set(sortedSubjects)];
          const displaySubjectName = uniqueSubjects.length === 1 
            ? uniqueSubjects[0] 
            : sortedSubjects.join(" / ");
          
          cell = {
            subjectName: displaySubjectName, // Combined subjects for fallback display
            subjectNames: sortedSubjects, // All subjects in order for split view
            subjectIds: sortedSubjectIds, // Subject IDs for linking
            className: displayClasses.join(", "), // Classes: larger first
            classNames: sortedClasses, // Original sorted order for split view
            classIds: sortedClassIds, // Class IDs for linking
            groupName: entriesForPeriod.find(e => e.groupName)?.groupName,
          };
        }
      }
      
      // Then, check if there are any absences/substitutions for this slot
      // First pass: collect substitutions (higher priority)
      // Second pass: collect own absences (lower priority, don't overwrite substitutions)
      let hasSubstitution = false;
      
      if (userAbsences && userAbsences.length > 0) {
        // First pass: check for substitutions (where teacher is substituting for someone)
        for (const absence of userAbsences) {
          for (const entry of absence.affectedEntries) {
            if (entry.dayOfWeek === day && entry.periodIndex === period - 1) {
              if (entry.isSubstitute) {
                // This is a substitution - teacher is substituting for someone
                // Use the class name from the entry if available
                cell = {
                  subjectName: entry.subjectName,
                  className: entry.className || "Моят час",
                  isSubstitute: true,
                  originalTeacher: absence.teacherName,
                  originalTeacherUserId: absence.teacherUserId,
                  originalTeacherFirstName: absence.teacherFirstName,
                  originalTeacherMiddleName: absence.teacherMiddleName,
                  originalTeacherLastName: absence.teacherLastName,
                  isCivicEducation: entry.isCivicEducation,
                  substituteClassId: entry.classId,
                  substituteSubjectId: entry.subjectId,
                };
                hasSubstitution = true;
              }
            }
          }
        }
        
        // Second pass: check for own absences (only if no substitution was found for this slot)
        // When teacher is absent, completely hide the cell from their personal schedule
        if (!hasSubstitution) {
          for (const absence of userAbsences) {
            for (const entry of absence.affectedEntries) {
              if (entry.dayOfWeek === day && entry.periodIndex === period - 1) {
                if (!entry.isSubstitute) {
                  // This is teacher's own absence - hide the cell completely
                  cell = null;
                }
              }
            }
          }
        }
      }
      
      row.push(cell);
    }
    grid.push(row);
  }
  
  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            Разписание на {userData.name}
          </h1>
        </div>
        
        {/* Week Selector */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-2 border-blue-200 dark:border-blue-800">
          <CardContent className="p-6">
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
                  Седмица {selectedWeek.weekNumber}
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  {selectedWeek.weekStart.toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {selectedWeek.weekEnd.toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </div>
                {selectedWeek.weekNumber === getWeekNumber(new Date()).weekNumber && (
                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-semibold">
                    (Текуща седмица)
                  </div>
                )}
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
        
        <div className="overflow-hidden -mx-2 sm:mx-0">
            <table className="w-full table-fixed border-collapse border border-border">
              <thead>
                <tr className="bg-muted">
                  <th className="border border-border p-1 sm:p-2 text-xs sm:text-sm font-semibold w-10 sm:w-12">
                    Час
                  </th>
                  {daysOfWeek.map((day) => {
                    const dayDate = new Date(selectedWeek.weekStart);
                    dayDate.setDate(dayDate.getDate() + (day.num - 1));
                    const formattedDate = dayDate.toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit' });
                    const isTodayColumn = isCurrentWeek && currentDayOfWeek === day.num;
                    
                    return (
                      <th
                        key={day.num}
                        className={cn(
                          "border border-border p-1 sm:p-2 text-xs sm:text-sm font-semibold",
                          isTodayColumn && "bg-teal-100 dark:bg-teal-900 text-teal-900 dark:text-teal-100"
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
              </thead>
              <tbody>
                {grid.map((row, periodIdx) => {
                  // Get period time from dayRegimePeriods if available
                  const periodTime = dayRegimePeriods?.find(p => p.periodNumber === periodIdx + 1);
                  
                  return (
                  <tr key={periodIdx}>
                    <td className="border border-border p-1 sm:p-2 text-center text-xs sm:text-sm font-semibold bg-muted/50 w-10 sm:w-12">
                      {periodIdx + 1}
                    </td>
                    {row.map((cell, dayIdx) => {
                      const isToday = isCurrentWeek && currentDayOfWeek === (dayIdx + 1);
                      
                      return (
                        <td
                          key={dayIdx}
                          className={cn(
                            "border border-border p-1 sm:p-1.5 align-top",
                            isToday && "bg-teal-50 dark:bg-teal-950/30",
                            cell?.isSubstitute && "bg-green-100 dark:bg-green-900/30"
                          )}
                        >
                          {cell ? (
                            <div className="space-y-0.5 sm:space-y-1">
                              {/* Check if we have multiple classes - show split view vertically (one on top, one below) */}
                              {cell.classNames && cell.classNames.length > 1 ? (
                                <div className="flex flex-col border-2 border-gray-500 dark:border-gray-400 rounded-lg overflow-hidden shadow-sm">
                                  {cell.classNames.map((clsName, idx) => {
                                    const classId = cell.classIds?.[idx];
                                    const subjectId = cell.subjectIds?.[idx];
                                    const linkTo = classId && subjectId 
                                      ? `/bg/diary/class/${classId}/grades?subject=${subjectId}` 
                                      : undefined;
                                    
                                    const content = (
                                      <>
                                        <div className={cn(
                                          "font-bold text-xs sm:text-sm",
                                          idx === 0 
                                            ? "text-blue-800 dark:text-blue-200" 
                                            : "text-amber-800 dark:text-amber-200"
                                        )}>
                                          <span className="text-gray-500 dark:text-gray-400 font-medium">{periodIdx + 1}.</span>{" "}
                                          {cell.subjectNames?.[idx] || cell.subjectName}
                                        </div>
                                        <div className={cn(
                                          "text-[10px] sm:text-xs font-semibold mt-0.5",
                                          idx === 0 
                                            ? "text-blue-700 dark:text-blue-300" 
                                            : "text-amber-700 dark:text-amber-300"
                                        )}>
                                          {clsName}
                                        </div>
                                        {cell.groupName && idx === 0 && (
                                          <div className="text-[10px] sm:text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                                            {cell.groupName}
                                          </div>
                                        )}
                                        {periodTime && idx === 0 && (
                                          <div className="flex items-center justify-center gap-1 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            <ClockIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                            <span>{periodTime.startTime} - {periodTime.endTime}</span>
                                          </div>
                                        )}
                                      </>
                                    );
                                    
                                    return linkTo ? (
                                      <Link 
                                        key={`${clsName}-${subjectId}`}
                                        to={linkTo}
                                        className={cn(
                                          "block p-1.5 sm:p-2 text-center relative cursor-pointer",
                                          "hover:brightness-95 active:brightness-90 transition-all",
                                          idx === 0 
                                            ? "bg-blue-100 dark:bg-blue-900/60 hover:bg-blue-200 dark:hover:bg-blue-800/60" 
                                            : "bg-amber-100 dark:bg-amber-900/60 hover:bg-amber-200 dark:hover:bg-amber-800/60",
                                          idx > 0 && "border-t-4 border-gray-600 dark:border-gray-300"
                                        )}
                                      >
                                        {content}
                                      </Link>
                                    ) : (
                                      <div 
                                        key={`${clsName}-${idx}`} 
                                        className={cn(
                                          "p-1.5 sm:p-2 text-center relative",
                                          idx === 0 
                                            ? "bg-blue-100 dark:bg-blue-900/60" 
                                            : "bg-amber-100 dark:bg-amber-900/60",
                                          idx > 0 && "border-t-4 border-gray-600 dark:border-gray-300"
                                        )}
                                      >
                                        {content}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : cell.isSubstitute && cell.substituteClassId && cell.substituteSubjectId ? (
                                // Substitute entry - make it clickable with green styling
                                <Link 
                                  to={`/bg/diary/class/${cell.substituteClassId}/grades?subject=${cell.substituteSubjectId}`}
                                  className="block hover:brightness-95 active:brightness-90 transition-all cursor-pointer bg-green-100 dark:bg-green-900/50 rounded-lg p-2 border-2 border-green-400 dark:border-green-600"
                                >
                                  <div className="font-bold text-xs sm:text-sm text-green-800 dark:text-green-200">
                                    <span className="text-green-600 dark:text-green-400 font-medium">{periodIdx + 1}.</span>{" "}
                                    {cell.isCivicEducation 
                                      ? "ГО (...) (ЗАМ.)" 
                                      : cell.subjectName}
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px] sm:text-xs text-green-700 dark:text-green-300 font-medium">
                                    <BookOpenIcon className="h-3 w-3 flex-shrink-0" />
                                    <span>{cell.className}</span>
                                  </div>
                                  {periodTime && (
                                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-green-600 dark:text-green-400 mt-0.5">
                                      <ClockIcon className="h-3 w-3 flex-shrink-0" />
                                      <span>{periodTime.startTime} - {periodTime.endTime}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1 text-[10px] sm:text-xs text-green-600 dark:text-green-400 mt-1">
                                    <InfoIcon className="h-2 w-2 sm:h-3 sm:w-3" />
                                    <span className="break-words font-semibold">
                                      Замества:{" "}
                                      {cell.originalTeacherUserId ? (
                                        <UserNameLink 
                                          userId={cell.originalTeacherUserId}
                                          firstName={cell.originalTeacherFirstName}
                                          middleName={cell.originalTeacherMiddleName}
                                          lastName={cell.originalTeacherLastName}
                                        />
                                      ) : cell.originalTeacher}
                                    </span>
                                  </div>
                                </Link>
                              ) : cell.classIds && cell.classIds.length === 1 && cell.subjectIds && cell.subjectIds.length === 1 ? (
                                <Link 
                                  to={`/bg/diary/class/${cell.classIds[0]}/grades?subject=${cell.subjectIds[0]}`}
                                  className="block hover:opacity-80 transition-opacity cursor-pointer"
                                >
                                  <div className={cn(
                                    "font-bold text-xs sm:text-sm",
                                    cell.isSubstitute ? "text-green-700 dark:text-green-300" : "text-foreground"
                                  )}>
                                    <span className="text-muted-foreground font-medium">{periodIdx + 1}.</span>{" "}
                                    {cell.isSubstitute && cell.isCivicEducation 
                                      ? "ГО (...) (ЗАМ.)" 
                                      : cell.subjectName}
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
                                    <BookOpenIcon className="h-3 w-3 flex-shrink-0" />
                                    <span>{cell.className}</span>
                                  </div>
                                  {cell.groupName && (
                                    <div className="text-[10px] sm:text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                                      {cell.groupName}
                                    </div>
                                  )}
                                  {periodTime && (
                                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                                      <ClockIcon className="h-3 w-3 flex-shrink-0" />
                                      <span>{periodTime.startTime} - {periodTime.endTime}</span>
                                    </div>
                                  )}
                                </Link>
                              ) : (
                                <>
                                  <div className={cn(
                                    "font-bold text-xs sm:text-sm",
                                    cell.isSubstitute ? "text-green-700 dark:text-green-300" : "text-foreground"
                                  )}>
                                    <span className="text-muted-foreground font-medium">{periodIdx + 1}.</span>{" "}
                                    {cell.isSubstitute && cell.isCivicEducation 
                                      ? "ГО (...) (ЗАМ.)" 
                                      : cell.subjectName}
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
                                    <BookOpenIcon className="h-3 w-3 flex-shrink-0" />
                                    <span>{cell.className}</span>
                                  </div>
                                  {cell.groupName && (
                                    <div className="text-[10px] sm:text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                                      {cell.groupName}
                                    </div>
                                  )}
                                  {periodTime && (
                                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                                      <ClockIcon className="h-3 w-3 flex-shrink-0" />
                                      <span>{periodTime.startTime} - {periodTime.endTime}</span>
                                    </div>
                                  )}
                                </>
                              )}
                              {cell.isSubstitute && !cell.substituteClassId && (
                                <div className="flex items-center gap-1 text-[10px] sm:text-xs text-green-600 dark:text-green-400">
                                  <InfoIcon className="h-2 w-2 sm:h-3 sm:w-3" />
                                  <span className="break-words font-semibold">
                                    Замества:{" "}
                                    {cell.originalTeacherUserId ? (
                                      <UserNameLink 
                                        userId={cell.originalTeacherUserId}
                                        firstName={cell.originalTeacherFirstName}
                                        middleName={cell.originalTeacherMiddleName}
                                        lastName={cell.originalTeacherLastName}
                                      />
                                    ) : cell.originalTeacher}
                                  </span>
                                </div>
                              )}
                              {cell.isFree && (
                                <div className="flex items-center gap-1 text-[10px] sm:text-xs text-blue-600 dark:text-blue-400">
                                  <InfoIcon className="h-2 w-2 sm:h-3 sm:w-3" />
                                  <span className="break-words font-bold">Свободен час</span>
                                </div>
                              )}
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
    </Layout>
  );
}

export default function UserSchedule() {
  return (
    <>
      <Unauthenticated>
        <Layout>
          <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <p className="text-muted-foreground">Моля, влезте в профила си</p>
            <SignInButton />
          </div>
        </Layout>
      </Unauthenticated>
      <AuthLoading>
        <Layout>
          <div className="flex items-center justify-center min-h-screen">
            <Skeleton className="h-96 w-full max-w-md" />
          </div>
        </Layout>
      </AuthLoading>
      <Authenticated>
        <UserScheduleInner />
      </Authenticated>
    </>
  );
}
