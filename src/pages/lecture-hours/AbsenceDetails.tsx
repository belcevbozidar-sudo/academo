import { useState } from "react";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel";
import { useIsMobile } from "@/hooks/use-mobile.ts";
import { ChevronLeft, ChevronRight, Edit, ArrowLeft, CalendarIcon, Lock, Unlock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { Calendar } from "@/components/ui/calendar.tsx";
import { format } from "date-fns";
import { bg } from "date-fns/locale";

type SubstitutionData = {
  subjectId?: Id<"subjects">;
  teacherId?: Id<"teachers">;
  dayOfWeek?: number;
  periodIndex?: number;
  date?: number;
  isCivicEducation?: boolean; // Flag to indicate if this is civic education
  isFree?: boolean; // Flag to indicate if this is a free period
};

type PeriodSlot = {
  periodIndex: number;
  time: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  hasSubstitute: boolean;
  substituteTeacherId?: string;
  substituteTeacherName?: string;
} | null;

function AbsenceDetailsInner() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { absenceId } = useParams<{ absenceId: string }>();
  
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<{
    dayOfWeek: number;
    periodIndex: number;
    date: number;
    subjectId: string;
    subjectName: string;
    className: string;
  } | null>(null);
  const [showSubstituteDialog, setShowSubstituteDialog] = useState(false);
  const [localSubstitutions, setLocalSubstitutions] = useState<SubstitutionData[]>([]);
  const [substituteOption, setSubstituteOption] = useState<"same" | "civic" | "free">("same");
  const [teacherFilter, setTeacherFilter] = useState<"all" | "free">("free");
  
  // Edit state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editStartDate, setEditStartDate] = useState<Date | undefined>(undefined);
  const [editEndDate, setEditEndDate] = useState<Date | undefined>(undefined);
  const [editReason, setEditReason] = useState("");
  const [isScheduleEditMode, setIsScheduleEditMode] = useState(false);

  const absence = useQuery(
    api.teacherAbsences.getAbsenceById,
    absenceId ? { absenceId: absenceId as Id<"absences"> } : "skip"
  );

  const updateAbsence = useMutation(api.teacherAbsences.updateAbsence);
  const updateSubstitutions = useMutation(api.teacherAbsences.updateAbsenceSubstitutions);

  // Load existing substitutions from absence
  const substitutions = absence?.substitutions || localSubstitutions;

  const teacherSchedule = useQuery(
    api.teacherAbsences.getTeacherScheduleForPeriod,
    absence
      ? {
          teacherId: absence.teacherId as Id<"teachers">,
          startDate: absence.startDate,
          endDate: absence.endDate,
        }
      : "skip"
  );

  const teachers = useQuery(api.teacherAbsences.getAllTeachers, {});
  const subjects = useQuery(api.admin.listSubjects, {});
  
  // Find civic education subject (Гражданско образование / ГО)
  const civicEducationSubject = subjects?.find(
    (s) => s.name === "Гражданско образование" || s.shortName === "ГО"
  );

  // Helper to check if a string looks like a valid Convex ID (non-empty, no spaces)
  const isValidId = (id: string | undefined): boolean => {
    return typeof id === "string" && id.length > 5 && !id.includes(" ");
  };

  const availableTeachers = useQuery(
    api.teacherAbsences.getAvailableTeachersForSlot,
    selectedSlot && absence
      ? {
          dayOfWeek: selectedSlot.dayOfWeek,
          periodIndex: selectedSlot.periodIndex,
          excludeTeacherId: absence.teacherId as Id<"teachers">,
          showAll: teacherFilter === "all",
          subjectId: substituteOption === "same" && selectedSlot.subjectId && isValidId(selectedSlot.subjectId)
            ? (selectedSlot.subjectId as Id<"subjects">) 
            : substituteOption === "civic" && civicEducationSubject 
              ? (civicEducationSubject._id as Id<"subjects">) 
              : undefined,
          date: selectedSlot.date, // Pass date to filter out absent teachers
        }
      : "skip"
  );

  const handleSlotClick = (
    dayOfWeek: number,
    periodIndex: number,
    date: number,
    period: PeriodSlot
  ) => {
    if (!period || !isScheduleEditMode) return;
    
    setSelectedSlot({
      dayOfWeek,
      periodIndex,
      date,
      subjectId: period.subjectId,
      subjectName: period.subjectName,
      className: period.className,
    });
    setSubstituteOption("same"); // Reset to "same" when dialog opens
    setTeacherFilter("free"); // Reset to "free" when dialog opens
    setShowSubstituteDialog(true);
  };

  const handleSelectSubstitute = async (teacherId: Id<"teachers"> | null, teacherName: string) => {
    if (!selectedSlot || !absenceId) return;

    if (substituteOption === "free" && teacherId === null) {
      // Handle "free" option - mark as free period
      const newSubstitution: SubstitutionData = {
        dayOfWeek: selectedSlot.dayOfWeek,
        periodIndex: selectedSlot.periodIndex,
        date: selectedSlot.date,
        isFree: true,
        isCivicEducation: false,
      };

      // Remove existing substitution for this slot if any
      const filteredSubs = substitutions.filter(
        (s) =>
          !(
            s.dayOfWeek === selectedSlot.dayOfWeek &&
            s.periodIndex === selectedSlot.periodIndex &&
            s.date === selectedSlot.date
          )
      );

      const updatedSubs = [...filteredSubs, newSubstitution];

      try {
        // Save to database
        await updateSubstitutions({
          absenceId: absenceId as Id<"absences">,
          substitutions: updatedSubs,
        });

        setLocalSubstitutions(updatedSubs);
        setShowSubstituteDialog(false);
        setSelectedSlot(null);
        toast.success("Часът е отбелязан като свободен");
      } catch (error) {
        console.error(error);
        toast.error("Грешка при маркиране на час");
      }
      return;
    }

    if (!teacherId) return;

    // Update substitutions array
    const newSubstitution: SubstitutionData = {
      teacherId,
      dayOfWeek: selectedSlot.dayOfWeek,
      periodIndex: selectedSlot.periodIndex,
      date: selectedSlot.date,
      isCivicEducation: substituteOption === "civic",
    };

    // Remove existing substitution for this slot if any
    const filteredSubs = substitutions.filter(
      (s) =>
        !(
          s.dayOfWeek === selectedSlot.dayOfWeek &&
          s.periodIndex === selectedSlot.periodIndex &&
          s.date === selectedSlot.date
        )
    );

    const updatedSubs = [...filteredSubs, newSubstitution];

    try {
      // Save to database
      await updateSubstitutions({
        absenceId: absenceId as Id<"absences">,
        substitutions: updatedSubs,
      });

      setLocalSubstitutions(updatedSubs);
      setShowSubstituteDialog(false);
      setSelectedSlot(null);
      const subjectName = substituteOption === "civic" ? "Гражданско образование" : selectedSlot.subjectName;
      toast.success(`Заместник добавен за ${subjectName}`);
    } catch (error) {
      console.error(error);
      toast.error("Грешка при добавяне на заместник");
    }
  };

  const getSubstituteForSlot = (
    dayOfWeek: number,
    periodIndex: number,
    date: number
  ): SubstitutionData | undefined => {
    return substitutions.find(
      (s) =>
        s.dayOfWeek === dayOfWeek &&
        s.periodIndex === periodIndex &&
        s.date === date
    );
  };
  
  const handleOpenEditDialog = () => {
    if (!absence) return;
    setEditStartDate(new Date(absence.startDate));
    setEditEndDate(new Date(absence.endDate));
    setEditReason(absence.reason);
    setShowEditDialog(true);
  };
  
  const handleSaveEdit = async () => {
    if (!absenceId || !editStartDate || !editEndDate) {
      toast.error("Моля попълнете всички полета");
      return;
    }
    
    try {
      await updateAbsence({
        absenceId: absenceId as Id<"absences">,
        startDate: new Date(editStartDate).setHours(0, 0, 0, 0),
        endDate: new Date(editEndDate).setHours(23, 59, 59, 999),
        reason: editReason,
      });
      
      toast.success("Отсъствието е обновено успешно");
      setShowEditDialog(false);
    } catch (error) {
      console.error(error);
      toast.error("Грешка при обновяване на отсъствието");
    }
  };

  if (absence === undefined || teacherSchedule === undefined) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <Skeleton className="h-96 w-full max-w-4xl" />
        </div>
      </Layout>
    );
  }

  if (absence === null) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <p className="text-muted-foreground">Отсъствието не е намерено</p>
          <Button onClick={() => navigate("/bg/lecture-hours/all-absences-new")}>
            Назад
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={cn("space-y-4", isMobile ? "p-3" : "p-6")}>
        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size={isMobile ? "sm" : "default"}
              onClick={() => navigate("/bg/lecture-hours/all-absences-new")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад
            </Button>
            <h1 className={cn("font-bold", isMobile ? "text-lg" : "text-2xl")}>
              {absence.title}
            </h1>
          </div>
          <Button
            className="bg-blue-500 hover:bg-blue-600"
            size={isMobile ? "sm" : "default"}
            onClick={handleOpenEditDialog}
          >
            <Edit className="h-4 w-4 mr-2" />
            Редактирай
          </Button>
        </div>

        {/* Info Card */}
        <Card>
          <CardHeader className={cn(isMobile && "p-3")}>
            <CardTitle className={cn(isMobile && "text-base")}>Информация</CardTitle>
          </CardHeader>
          <CardContent className={cn(isMobile && "p-3")}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Отсъстващ учител</p>
                <button
                  onClick={() => navigate(`/bg/admin/user/${absence.teacherUserId}`)}
                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                >
                  {absence.absentTeacher}
                </button>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Период</p>
                <p className="font-medium">{absence.period}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground">Причина</p>
                <p className="font-medium">{absence.reason}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Създадено на</p>
                <p className="font-medium">{absence.createdAt}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Създадено от</p>
                <p className="font-medium">{absence.createdBy}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schedule Card */}
        <Card>
          <CardHeader className={cn(isMobile && "p-3")}>
            <div className="flex items-center justify-between">
              <CardTitle className={cn(isMobile && "text-base")}>График на занятия</CardTitle>
              <Button
                size={isMobile ? "sm" : "default"}
                variant={isScheduleEditMode ? "default" : "secondary"}
                className={cn(
                  isScheduleEditMode && "bg-blue-500 hover:bg-blue-600"
                )}
                onClick={() => setIsScheduleEditMode(!isScheduleEditMode)}
              >
                {isScheduleEditMode ? (
                  <>
                    <Unlock className="h-4 w-4 mr-2" />
                    Редактиране активно
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Редактирай графика
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className={cn(isMobile && "p-3")}>
            {teacherSchedule && teacherSchedule.weeks.length > 0 ? (
              <>
                {/* Week navigation */}
                <div className="flex items-center justify-between mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentWeekIndex(Math.max(0, currentWeekIndex - 1))}
                    disabled={currentWeekIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Предишна
                  </Button>
                  <span className={cn("font-medium", isMobile ? "text-sm" : "text-base")}>
                    Седмица {currentWeekIndex + 1} от {teacherSchedule.weeks.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentWeekIndex(
                        Math.min(teacherSchedule.weeks.length - 1, currentWeekIndex + 1)
                      )
                    }
                    disabled={currentWeekIndex === teacherSchedule.weeks.length - 1}
                  >
                    Следваща
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>

                {/* Schedule table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-border">
                    <thead>
                      <tr>
                        <th className={cn(
                          "border border-border bg-muted p-3 font-medium text-left",
                          isMobile ? "text-xs" : "text-sm"
                        )}>
                          Час
                        </th>
                        {teacherSchedule.weeks[currentWeekIndex]?.days.map((day) => (
                          <th
                            key={day.date}
                            className={cn(
                              "border border-border bg-muted p-3 font-medium text-center",
                              isMobile ? "text-xs" : "text-sm"
                            )}
                          >
                            {new Date(day.date).toLocaleDateString("bg-BG", {
                              weekday: "short",
                              day: "numeric",
                              month: "numeric",
                            })}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Find max periods */}
                      {Array.from({
                        length: Math.max(
                          ...teacherSchedule.weeks[currentWeekIndex].days.map(
                            (d) => d.periods.length
                          ),
                          1
                        ),
                      }).map((_, periodIdx) => (
                        <tr key={periodIdx}>
                          <td className={cn(
                            "border border-border bg-muted p-3 font-medium text-center",
                            isMobile ? "text-xs" : "text-sm"
                          )}>
                            Час #{periodIdx + 1}
                          </td>
                          {teacherSchedule.weeks[currentWeekIndex].days.map((day) => {
                            const period = day.periods[periodIdx];
                            const substitute = getSubstituteForSlot(
                              day.dayOfWeek,
                              periodIdx,
                              day.date
                            );
                            const isFree = substitute?.isFree === true;
                            const isCivic = substitute?.isCivicEducation === true;
                            
                            return (
                              <td
                                key={day.date}
                                className={cn(
                                  "border border-border p-2 transition-colors",
                                  isMobile ? "text-xs" : "text-sm",
                                  isScheduleEditMode && period && "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800",
                                  !isScheduleEditMode && "cursor-default",
                                  substitute && !isFree && "bg-green-100 dark:bg-green-900/30",
                                  substitute && !isFree && isScheduleEditMode && "hover:bg-green-200 dark:hover:bg-green-900/50",
                                  isFree && "bg-orange-100 dark:bg-orange-900/30",
                                  isFree && isScheduleEditMode && "hover:bg-orange-200 dark:hover:bg-orange-900/50"
                                )}
                                onClick={() =>
                                  period &&
                                  handleSlotClick(day.dayOfWeek, periodIdx, day.date, period)
                                }
                              >
                                {period ? (
                                  <div className="space-y-1">
                                    <div className="font-medium">
                                      {isCivic ? "Гражданско образование" : period.subjectName}
                                    </div>
                                    <div className="text-muted-foreground">
                                      {period.className}
                                    </div>
                                    {isFree ? (
                                      <div className="text-orange-700 dark:text-orange-400 font-medium mt-1">
                                        ✓ Свободен час
                                      </div>
                                    ) : substitute?.teacherId ? (
                                      <div className="text-green-700 dark:text-green-400 font-medium mt-1">
                                        ✓ {teachers?.find(t => t._id === substitute.teacherId)?.firstName}{" "}
                                        {teachers?.find(t => t._id === substitute.teacherId)?.lastName}
                                        {isCivic && <div className="text-[10px]">(Гражданско образование)</div>}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : (
                                  <div className="text-center text-muted-foreground">—</div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={cn(
                  "text-muted-foreground mt-4 space-y-1",
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  {isScheduleEditMode ? (
                    <>
                      <p>• Кликнете върху час, за да изберете или промените заместник</p>
                      <p>• Часовете в зелено имат избран заместник</p>
                      <p>• Часовете в оранжево са маркирани като свободни</p>
                      <p>• Немаркираните часове означават че учителят ще води часа нормално</p>
                    </>
                  ) : (
                    <p>• Натиснете бутона &quot;Редактирай графика&quot; за да промените заместниците</p>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground">
                  Няма намерени часове за този учител в избрания период.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Substitute Selection Dialog */}
        <Dialog open={showSubstituteDialog} onOpenChange={setShowSubstituteDialog}>
          <DialogContent className={cn(
            "max-h-[85vh] overflow-y-auto",
            isMobile ? "max-w-[95vw]" : "max-w-7xl w-[90vw]"
          )}>
            <DialogHeader>
              <DialogTitle className="text-lg md:text-xl">
                Изберете заместник за{" "}
                {selectedSlot && (
                  <>
                    {selectedSlot.subjectName} - {selectedSlot.className}
                  </>
                )}
              </DialogTitle>
            </DialogHeader>

            {/* Option selection */}
            <div className="space-y-4 border-b pb-4">
              <Label className="font-medium">Тип на заместването</Label>
              <div className={cn(
                "grid gap-2",
                isMobile ? "grid-cols-1" : "grid-cols-3"
              )}>
                <Button
                  type="button"
                  variant={substituteOption === "same" ? "default" : "outline"}
                  onClick={() => setSubstituteOption("same")}
                  className={cn(
                    "h-auto py-3",
                    substituteOption === "same" && "bg-blue-500 hover:bg-blue-600",
                    isMobile && "w-full"
                  )}
                >
                  <div className="text-left w-full">
                    <div className={cn("font-semibold", isMobile ? "text-xs" : "text-sm")}>
                      {selectedSlot?.subjectName}
                    </div>
                  </div>
                </Button>
                <Button
                  type="button"
                  variant={substituteOption === "civic" ? "default" : "outline"}
                  onClick={() => setSubstituteOption("civic")}
                  className={cn(
                    "h-auto py-3",
                    substituteOption === "civic" && "bg-blue-500 hover:bg-blue-600",
                    isMobile && "w-full"
                  )}
                >
                  <div className="text-left w-full">
                    <div className={cn("font-semibold whitespace-normal", isMobile ? "text-xs" : "text-sm leading-tight")}>
                      Гражданско образование
                    </div>
                  </div>
                </Button>
                <Button
                  type="button"
                  variant={substituteOption === "free" ? "default" : "outline"}
                  onClick={() => {
                    setSubstituteOption("free");
                    // Auto-select free option
                    handleSelectSubstitute(null, "");
                  }}
                  className={cn(
                    "h-auto py-3",
                    substituteOption === "free" && "bg-orange-500 hover:bg-orange-600",
                    isMobile && "w-full"
                  )}
                >
                  <div className="text-left w-full">
                    <div className={cn("font-semibold", isMobile ? "text-xs" : "text-sm")}>
                      Без заместник
                    </div>
                    <div className={cn("opacity-90 mt-1", isMobile ? "text-[10px]" : "text-xs")}>
                      (Свободен час)
                    </div>
                  </div>
                </Button>
              </div>
            </div>

            {/* Teacher filter - only show for same/civic options */}
            {(substituteOption === "same" || substituteOption === "civic") && (
              <div className="space-y-2 border-b pb-4">
                <Label className={cn("font-medium", isMobile && "text-sm")}>Филтър на учители</Label>
                <div className={cn("flex gap-2", isMobile && "flex-col")}>
                  <Button
                    type="button"
                    variant={teacherFilter === "free" ? "default" : "outline"}
                    onClick={() => setTeacherFilter("free")}
                    className={cn(
                      "flex-1",
                      teacherFilter === "free" && "bg-teal-500 hover:bg-teal-600",
                      isMobile && "w-full text-sm"
                    )}
                    size="sm"
                  >
                    Свободни
                  </Button>
                  <Button
                    type="button"
                    variant={teacherFilter === "all" ? "default" : "outline"}
                    onClick={() => setTeacherFilter("all")}
                    className={cn(
                      "flex-1",
                      teacherFilter === "all" && "bg-teal-500 hover:bg-teal-600",
                      isMobile && "w-full text-sm"
                    )}
                    size="sm"
                  >
                    Всички
                  </Button>
                </div>
              </div>
            )}

            {substituteOption !== "free" && (
              <div className="space-y-4">
                {availableTeachers === undefined ? (
                  <div className="text-center py-6">
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : availableTeachers && availableTeachers.length > 0 ? (
                  <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}>
                    {availableTeachers
                      .map((teacher) => {
                        const isBusy = teacher.isBusy === true;
                        const teachesSubject = teacher.teachesSubject === true;
                        
                        // Determine card styling
                        let cardBgClass = "";
                        let cardBorderClass = "";
                        let avatarBgClass = "bg-gray-200";
                        let avatarTextClass = "text-gray-600";
                        let nameClass = "";
                        
                        if (isBusy && teacherFilter === "all") {
                          // Busy teacher - red
                          cardBgClass = "bg-red-50";
                          cardBorderClass = "border-red-500";
                          avatarBgClass = "bg-red-200";
                          avatarTextClass = "text-red-700";
                          nameClass = "text-red-700";
                        } else if (teachesSubject && substituteOption === "same") {
                          // Teaches subject - green
                          cardBgClass = "bg-green-50";
                          cardBorderClass = "border-green-500";
                          avatarBgClass = "bg-green-200";
                          avatarTextClass = "text-green-700";
                          nameClass = "text-green-700";
                        }
                        
                        return (
                          <Card
                            key={teacher._id}
                            className={cn(
                              "cursor-pointer hover:shadow-lg transition-shadow hover:border-blue-500",
                              cardBgClass,
                              cardBorderClass
                            )}
                            onClick={() =>
                              handleSelectSubstitute(
                                teacher._id as Id<"teachers">,
                                `${teacher.firstName} ${teacher.lastName}`
                              )
                            }
                          >
                            <CardContent className={cn(isMobile ? "p-2" : "p-4")}>
                              <div className="flex items-start gap-3">
                                <div className={cn(
                                  "rounded-full flex items-center justify-center shrink-0",
                                  isMobile ? "w-10 h-10" : "w-12 h-12",
                                  avatarBgClass
                                )}>
                                  <span className={cn(
                                    "font-bold",
                                    isMobile ? "text-base" : "text-xl",
                                    avatarTextClass
                                  )}>
                                    {teacher.firstName.charAt(0)}
                                    {teacher.lastName.charAt(0)}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className={cn(
                                    "font-bold truncate",
                                    isMobile && "text-sm",
                                    nameClass
                                  )}>
                                    {teacher.firstName} {teacher.lastName}
                                    {isBusy && teacherFilter === "all" && " (Зает)"}
                                  </div>
                                  <div className={cn(
                                    "text-muted-foreground truncate",
                                    isMobile ? "text-[10px]" : "text-xs"
                                  )}>
                                    {teacher.subjectNames && teacher.subjectNames.length > 0
                                      ? teacher.subjectNames.join(", ")
                                      : teacher.specialization || "Няма специализация"}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    {availableTeachers.length === 0 && (
                      <div className={cn("text-center py-6", !isMobile && "col-span-2")}>
                        <p className={cn("text-muted-foreground", isMobile && "text-sm")}>
                          Няма налични учители.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground">
                      {teacherFilter === "free" 
                        ? "Няма свободни учители за този час."
                        : "Няма налични учители."}
                    </p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSubstituteDialog(false)}>
                Затвори
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className={cn(
            "max-h-[80vh] overflow-y-auto",
            isMobile ? "max-w-[95vw]" : "max-w-lg"
          )}>
            <DialogHeader>
              <DialogTitle>Редактиране на отсъствие</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className={cn(isMobile && "text-sm")}>Начална дата *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editStartDate && "text-muted-foreground",
                        isMobile && "text-sm"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editStartDate ? format(editStartDate, "dd MMMM yyyy", { locale: bg }) : "Изберете дата"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editStartDate}
                      onSelect={(date) => {
                        setEditStartDate(date);
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                      }}
                      defaultMonth={editStartDate || new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className={cn(isMobile && "text-sm")}>Крайна дата *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editEndDate && "text-muted-foreground",
                        isMobile && "text-sm"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editEndDate ? format(editEndDate, "dd MMMM yyyy", { locale: bg }) : "Изберете дата"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editEndDate}
                      onSelect={(date) => {
                        setEditEndDate(date);
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                      }}
                      defaultMonth={editEndDate || editStartDate || new Date()}
                      disabled={(date) => editStartDate ? date < editStartDate : false}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-reason" className={cn(isMobile && "text-sm")}>Причина за отсъствието *</Label>
                <Textarea
                  id="edit-reason"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Въведете причина..."
                  rows={isMobile ? 3 : 4}
                  className={cn(isMobile && "text-sm")}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Отказ
              </Button>
              <Button onClick={handleSaveEdit} className="bg-blue-500 hover:bg-blue-600">
                Запази
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

export default function AbsenceDetails() {
  return (
    <>
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
        <AbsenceDetailsInner />
      </Authenticated>
    </>
  );
}
