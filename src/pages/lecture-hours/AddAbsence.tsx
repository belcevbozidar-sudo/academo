import { useState } from "react";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader } from "@/components/ui/card.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { AlertTriangle, FilterIcon, XIcon, ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile.ts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { Calendar } from "@/components/ui/calendar.tsx";
import { format } from "date-fns";
import { bg } from "date-fns/locale";

const BULGARIAN_ALPHABET = [
  "А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "Й", "К", "Л", "М",
  "Н", "О", "П", "Р", "С", "Т", "У", "Ф", "Х", "Ц", "Ч", "Ш", "Щ", "Ъ", "Ю", "Я"
];

type Teacher = {
  _id: Id<"teachers">;
  userId: Id<"users">;
  firstName: string;
  lastName: string;
  specialization: string;
  subjectNames: string[];
};

type SubstitutionData = {
  subjectId?: Id<"subjects">;
  teacherId?: Id<"teachers">;
  classId?: Id<"classes">;
  dayOfWeek?: number;
  periodIndex?: number;
  date?: number;
  isCivicEducation?: boolean; // Flag to indicate if this is civic education
  isFree?: boolean; // Flag to indicate if this is a free period
  originalAbsenceId?: string; // If set, this is a reassignment of a substitution from another absence
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
  isSubstitute?: boolean;
  originalAbsenceId?: string;
} | null;

function AddAbsenceInner() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const teachers = useQuery(api.teacherAbsences.getAllTeachers, {});
  const subjects = useQuery(api.admin.listSubjects, {});
  const createAbsence = useMutation(api.teacherAbsences.createAbsence);
  const reassignSubstitute = useMutation(api.teacherAbsences.reassignSubstitute);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedFilter, setSelectedFilter] = useState<string>("Всички");
  const [showAlphabet, setShowAlphabet] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [reason, setReason] = useState("");
  const [substitutions, setSubstitutions] = useState<SubstitutionData[]>([]);
  const [showAddAllDialog, setShowAddAllDialog] = useState(false);
  const [selectedTeacherForAll, setSelectedTeacherForAll] = useState<Id<"teachers"> | null>(null);

  // Get existing absences for selected teacher
  const existingAbsences = useQuery(
    api.teacherAbsences.getTeacherAbsences,
    selectedTeacher ? { teacherId: selectedTeacher._id } : "skip"
  );

  // Get absent teacher IDs for the selected period (used to filter "Add for all" dialog)
  const absentTeacherIds = useQuery(
    api.teacherAbsences.getAbsentTeacherIdsForPeriod,
    selectedTeacher && startDate && endDate
      ? {
          startDate: Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()),
          endDate: Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999),
          excludeTeacherId: selectedTeacher._id,
        }
      : "skip"
  );

  // Multiple substitutes state
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<{
    dayOfWeek: number;
    periodIndex: number;
    date: number;
    subjectId: string;
    subjectName: string;
    classId: string;
    className: string;
    isSubstitute?: boolean;
    originalAbsenceId?: string;
  } | null>(null);
  const [showSubstituteDialog, setShowSubstituteDialog] = useState(false);
  const [substituteOption, setSubstituteOption] = useState<"same" | "civic" | "free">("same");
  const [teacherFilter, setTeacherFilter] = useState<"all" | "free">("free");

  // Fetch teacher schedule when in step 3
  const teacherSchedule = useQuery(
    api.teacherAbsences.getTeacherScheduleForPeriod,
    selectedTeacher && startDate && endDate && step === 3
      ? {
          teacherId: selectedTeacher._id,
          // Send UTC midnight for the calendar date to ensure consistent date handling
          startDate: Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()),
          endDate: Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999),
        }
      : "skip"
  );

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
    selectedSlot && selectedTeacher
      ? {
          dayOfWeek: selectedSlot.dayOfWeek,
          periodIndex: selectedSlot.periodIndex,
          excludeTeacherId: selectedTeacher._id,
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

  const filteredTeachers = teachers?.filter(teacher => {
    if (selectedFilter === "Всички") return true;
    return teacher.firstName.toUpperCase().startsWith(selectedFilter);
  });

  // Function to check if a date is disabled (already has absence)
  const isDateDisabled = (date: Date): boolean => {
    if (!existingAbsences) return false;
    
    const checkTimestamp = date.getTime();
    
    return existingAbsences.some((absence) => {
      return checkTimestamp >= absence.startDate && checkTimestamp <= absence.endDate;
    });
  };

  const handleTeacherSelect = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setStep(2);
  };

  const handleStep2Continue = () => {
    if (!startDate || !endDate || !reason.trim()) {
      toast.error("Моля попълнете всички полета");
      return;
    }

    const start = new Date(startDate).setHours(0, 0, 0, 0);
    const end = new Date(endDate).setHours(23, 59, 59, 999);

    if (end < start) {
      toast.error("Крайната дата не може да бъде преди началната");
      return;
    }

    // Check if date range is too large (max 12 weeks / ~3 months)
    const weekInMs = 7 * 24 * 60 * 60 * 1000;
    const dateRangeMs = end - start;
    const weekCount = dateRangeMs / weekInMs;
    
    if (weekCount > 12) {
      toast.error("Периодът не може да надвишава 12 седмици (около 3 месеца)");
      return;
    }

    setStep(3);
  };

  const handleSlotClick = (
    dayOfWeek: number,
    periodIndex: number,
    date: number,
    period: PeriodSlot
  ) => {
    if (!period) return;
    
    try {
      // Clean subject name - remove "(замества)" suffix for display in dialog
      const rawSubjectName = period.subjectName || "—";
      const cleanSubjectName = rawSubjectName.replace(" (замества)", "");
      
      setSelectedSlot({
        dayOfWeek,
        periodIndex,
        date,
        subjectId: period.subjectId || "",
        subjectName: cleanSubjectName,
        classId: period.classId || "",
        className: period.className || "—",
        isSubstitute: period.isSubstitute === true,
        originalAbsenceId: period.originalAbsenceId || undefined,
      });
      setSubstituteOption("same"); // Reset to "same" when dialog opens
      setTeacherFilter("free"); // Reset to "free" when dialog opens
      setShowSubstituteDialog(true);
    } catch (error) {
      console.error("Error opening slot dialog:", error);
      toast.error("Грешка при отваряне на диалога за избор на заместник");
    }
  };

  const handleSelectSubstitute = (teacherId: Id<"teachers"> | null, teacherName: string) => {
    if (!selectedSlot) return;

    if (substituteOption === "free" && teacherId === null) {
      // Handle "free" option - mark as free period
      const newSubstitution: SubstitutionData = {
        classId: selectedSlot.classId && isValidId(selectedSlot.classId) ? selectedSlot.classId as Id<"classes"> : undefined,
        dayOfWeek: selectedSlot.dayOfWeek,
        periodIndex: selectedSlot.periodIndex,
        date: selectedSlot.date,
        isFree: true,
        isCivicEducation: false,
        originalAbsenceId: selectedSlot.isSubstitute ? selectedSlot.originalAbsenceId : undefined,
      };

      // Remove existing substitution for this slot if any
      const filteredSubs = substitutions.filter(
        (s) =>
          !(
            s.dayOfWeek === selectedSlot.dayOfWeek &&
            s.periodIndex === selectedSlot.periodIndex &&
            s.date === selectedSlot.date &&
            s.classId === (selectedSlot.classId ? selectedSlot.classId as Id<"classes"> : undefined)
          )
      );

      setSubstitutions([...filteredSubs, newSubstitution]);
      setShowSubstituteDialog(false);
      setSelectedSlot(null);
      toast.success(`Часът е отбелязан като свободен`);
      return;
    }

    if (!teacherId) return;

    // Update substitutions array
    const newSubstitution: SubstitutionData = {
      teacherId,
      classId: selectedSlot.classId && isValidId(selectedSlot.classId) ? selectedSlot.classId as Id<"classes"> : undefined,
      dayOfWeek: selectedSlot.dayOfWeek,
      periodIndex: selectedSlot.periodIndex,
      date: selectedSlot.date,
      isCivicEducation: substituteOption === "civic",
      originalAbsenceId: selectedSlot.isSubstitute ? selectedSlot.originalAbsenceId : undefined,
    };

    // Remove existing substitution for this slot if any
    const filteredSubs = substitutions.filter(
      (s) =>
        !(
          s.dayOfWeek === selectedSlot.dayOfWeek &&
          s.periodIndex === selectedSlot.periodIndex &&
          s.date === selectedSlot.date &&
          s.classId === (selectedSlot.classId ? selectedSlot.classId as Id<"classes"> : undefined)
        )
    );

    setSubstitutions([...filteredSubs, newSubstitution]);
    setShowSubstituteDialog(false);
    setSelectedSlot(null);
    const subjectName = substituteOption === "civic" ? "Гражданско образование" : selectedSlot.subjectName;
    toast.success(`Заместник добавен за ${subjectName}`);
  };

  const getSubstituteForSlot = (
    dayOfWeek: number,
    periodIndex: number,
    date: number,
    classId: string
  ): SubstitutionData | undefined => {
    return substitutions.find(
      (s) =>
        s.dayOfWeek === dayOfWeek &&
        s.periodIndex === periodIndex &&
        s.date === date &&
        // Match classId: require match only when both are set.
        // For substitution slots, classId may be empty/undefined
        (!s.classId || !classId || s.classId === classId)
    );
  };

  const isSlotMarkedAsFree = (dayOfWeek: number, periodIndex: number, date: number, classId: string): boolean => {
    const sub = getSubstituteForSlot(dayOfWeek, periodIndex, date, classId);
    return sub !== undefined && sub.isFree === true;
  };

  const handleAddSubstituteForAll = () => {
    if (!selectedTeacherForAll || !teacherSchedule) return;

    const allSlots: SubstitutionData[] = [];
    
    teacherSchedule.weeks.forEach((week) => {
      week.days.forEach((day) => {
        day.periods.forEach((period, idx) => {
          if (period) {
            const typedPeriod = period as PeriodSlot;
            allSlots.push({
              teacherId: selectedTeacherForAll,
              classId: typedPeriod?.classId ? typedPeriod.classId as Id<"classes"> : undefined,
              dayOfWeek: day.dayOfWeek,
              periodIndex: idx,
              date: day.date,
              originalAbsenceId: typedPeriod?.isSubstitute ? typedPeriod.originalAbsenceId : undefined,
            });
          }
        });
      });
    });

    setSubstitutions(allSlots);
    setShowAddAllDialog(false);
    setSelectedTeacherForAll(null);
    toast.success("Заместник добавен за всички часове");
  };

  const handleFinish = async () => {
    if (!selectedTeacher || !startDate || !endDate) return;

    try {
      // Use UTC midnight for the calendar dates to ensure consistent date handling
      const start = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const end = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);

      // Separate regular substitutions from reassignments (substitution hours from other absences)
      const regularSubstitutions = substitutions.filter(s => !s.originalAbsenceId);
      const reassignments = substitutions.filter(s => s.originalAbsenceId);

      // Strip originalAbsenceId before sending to backend (not in the schema)
      const cleanedSubstitutions = regularSubstitutions.map(s => {
        const { originalAbsenceId: _oaId, ...rest } = s;
        return rest;
      });

      // Send regular substitutions to backend for the new absence
      const finalSubstitutions = cleanedSubstitutions.length > 0 ? cleanedSubstitutions : undefined;
      const substitutionType = cleanedSubstitutions.length === 0 ? "none" : "multiple";

      await createAbsence({
        teacherId: selectedTeacher._id,
        startDate: start,
        endDate: end,
        reason,
        substitutionType,
        substitutions: finalSubstitutions,
      });

      // Update original absences for reassigned substitution hours
      for (const reassignment of reassignments) {
        if (reassignment.originalAbsenceId && reassignment.dayOfWeek !== undefined && reassignment.periodIndex !== undefined && reassignment.date !== undefined) {
          try {
            await reassignSubstitute({
              absenceId: reassignment.originalAbsenceId as Id<"absences">,
              dayOfWeek: reassignment.dayOfWeek,
              periodIndex: reassignment.periodIndex,
              date: reassignment.date,
              newTeacherId: reassignment.teacherId,
              isCivicEducation: reassignment.isCivicEducation,
              isFree: reassignment.isFree,
            });
          } catch (e) {
            console.error("Failed to reassign substitution:", e);
          }
        }
      }

      toast.success("Отсъствието е създадено успешно");
      navigate("/bg/lecture-hours/all-absences-new");
    } catch (error) {
      console.error(error);
      toast.error("Грешка при създаване на отсъствието");
    }
  };

  return (
    <Layout>
      <div className={cn("space-y-4", isMobile ? "p-3" : "p-6")}>
        {/* Header with buttons */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h1 className={cn("font-bold", isMobile ? "text-lg" : "text-2xl")}>
            Учителско отсъствие
          </h1>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size={isMobile ? "sm" : "default"}
              onClick={() => {
                if (step === 1) {
                  navigate("/bg/lecture-hours/all-absences-new");
                } else if (step === 2) {
                  setStep(1);
                } else if (step === 3) {
                  setStep(2);
                }
              }}
            >
              Назад
            </Button>
            {step === 3 && (
              <Button 
                className="bg-teal-500 hover:bg-teal-600" 
                size={isMobile ? "sm" : "default"}
                onClick={handleFinish}
              >
                Запази
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader className={cn(isMobile && "p-3")}>
            {/* Steps indicator - Mobile optimized */}
            {isMobile ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                    step === 1 ? "bg-teal-500 text-white" : "bg-gray-200 text-gray-600"
                  )}
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white text-teal-500 font-bold text-sm">
                    1
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-bold text-xs">ОТСЪСТВАЩ</div>
                    {selectedTeacher && <div className="text-xs">{selectedTeacher.firstName} {selectedTeacher.lastName}</div>}
                  </div>
                </button>
                
                <button
                  type="button"
                  onClick={() => selectedTeacher && setStep(2)}
                  disabled={!selectedTeacher}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                    step === 2 ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600",
                    !selectedTeacher && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white text-blue-500 font-bold text-sm">
                    2
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-bold text-xs">ДЕТАЙЛИ</div>
                    {startDate && endDate && <div className="text-xs">{format(startDate, "dd.MM.yyyy")} - {format(endDate, "dd.MM.yyyy")}</div>}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => startDate && endDate && setStep(3)}
                  disabled={!startDate || !endDate}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                    step === 3 ? "bg-teal-500 text-white" : "bg-gray-200 text-gray-600",
                    (!startDate || !endDate) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white text-teal-500 font-bold text-sm">
                    3
                  </div>
                  <div className="font-bold text-xs">ЗАМЕСТВАЩИ</div>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className={cn(
                    "flex items-center gap-3 px-6 py-3 rounded-lg flex-1 transition-colors",
                    step === 1 ? "bg-teal-500 text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300 cursor-pointer"
                  )}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-teal-500 font-bold">
                    1
                  </div>
                  <div>
                    <div className="font-bold">ОТСЪСТВАЩ</div>
                    {selectedTeacher && <div className="text-sm">{selectedTeacher.firstName} {selectedTeacher.lastName}</div>}
                  </div>
                </button>
                
                <button
                  type="button"
                  onClick={() => selectedTeacher && setStep(2)}
                  disabled={!selectedTeacher}
                  className={cn(
                    "flex items-center gap-3 px-6 py-3 rounded-lg flex-1 transition-colors",
                    step === 2 ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600",
                    selectedTeacher && step !== 2 && "hover:bg-gray-300 cursor-pointer",
                    !selectedTeacher && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-blue-500 font-bold">
                    2
                  </div>
                  <div>
                    <div className="font-bold">ДЕТАЙЛИ</div>
                    {startDate && endDate && <div className="text-sm">{format(startDate, "dd.MM.yyyy")} - {format(endDate, "dd.MM.yyyy")}</div>}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => startDate && endDate && setStep(3)}
                  disabled={!startDate || !endDate}
                  className={cn(
                    "flex items-center gap-3 px-6 py-3 rounded-lg flex-1 transition-colors",
                    step === 3 ? "bg-teal-500 text-white" : "bg-gray-200 text-gray-600",
                    startDate && endDate && step !== 3 && "hover:bg-gray-300 cursor-pointer",
                    (!startDate || !endDate) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-teal-500 font-bold">
                    3
                  </div>
                  <div className="font-bold">ЗАМЕСТВАЩИ</div>
                </button>
              </div>
            )}
          </CardHeader>

          <CardContent className={cn(isMobile && "p-3")}>
            {/* Step 1: Teacher selection */}
            {step === 1 && (
              <div className="space-y-3">
                {/* Alphabet filter - Mobile optimized */}
                {isMobile ? (
                  <div className="space-y-2">
                    <Button
                      onClick={() => setShowAlphabet(!showAlphabet)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      {showAlphabet ? (
                        <>
                          <XIcon className="mr-2 h-4 w-4" />
                          Скрий филтър
                        </>
                      ) : (
                        <>
                          <FilterIcon className="mr-2 h-4 w-4" />
                          Филтрирай по буква
                        </>
                      )}
                    </Button>
                    
                    {showAlphabet && (
                      <div className="flex flex-wrap gap-1">
                        <Button
                          variant={selectedFilter === "Всички" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedFilter("Всички")}
                          className={cn(selectedFilter === "Всички" && "bg-blue-500 hover:bg-blue-600")}
                        >
                          Всички
                        </Button>
                        {BULGARIAN_ALPHABET.map(letter => (
                          <Button
                            key={letter}
                            variant={selectedFilter === letter ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedFilter(letter)}
                            className={cn(
                              "min-w-[32px] px-2",
                              selectedFilter === letter && "bg-blue-500 hover:bg-blue-600"
                            )}
                          >
                            {letter}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedFilter === "Всички" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedFilter("Всички")}
                      className="bg-blue-500 hover:bg-blue-600"
                    >
                      Всички
                    </Button>
                    {BULGARIAN_ALPHABET.map(letter => (
                      <Button
                        key={letter}
                        variant={selectedFilter === letter ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedFilter(letter)}
                        className={selectedFilter === letter ? "bg-blue-500 hover:bg-blue-600" : ""}
                      >
                        {letter}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Teacher cards grid */}
                <div className={cn(
                  "grid gap-3 mt-4",
                  isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
                )}>
                  {filteredTeachers?.map(teacher => (
                    <Card
                      key={teacher._id}
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => handleTeacherSelect(teacher)}
                    >
                      <CardContent className={cn(isMobile ? "p-3" : "p-4")}>
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "rounded-full bg-gray-200 flex items-center justify-center shrink-0",
                            isMobile ? "w-10 h-10" : "w-12 h-12"
                          )}>
                            <span className={cn(
                              "font-bold text-gray-600",
                              isMobile ? "text-base" : "text-xl"
                            )}>
                              {teacher.firstName.charAt(0)}{teacher.lastName.charAt(0)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={cn(
                              "font-bold truncate",
                              isMobile && "text-sm"
                            )}>
                              {teacher.firstName} {teacher.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {teacher.subjectNames && teacher.subjectNames.length > 0
                                ? teacher.subjectNames.join(", ")
                                : teacher.specialization || "Няма предмети"}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Details */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className={cn(isMobile && "text-sm")}>Начална дата *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground",
                          isMobile && "text-sm"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "dd MMMM yyyy", { locale: bg }) : "Изберете дата"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => {
                          if (date && isDateDisabled(date)) {
                            toast.error("Учителят вече има отсъствие в този период. Моля, изберете друга дата.");
                            return;
                          }
                          setStartDate(date);
                          // Close popover after selection
                          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                        }}
                        disabled={(date) => isDateDisabled(date)}
                        defaultMonth={startDate || new Date()}
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
                          !endDate && "text-muted-foreground",
                          isMobile && "text-sm"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "dd MMMM yyyy", { locale: bg }) : "Изберете дата"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => {
                          if (date && isDateDisabled(date)) {
                            toast.error("Учителят вече има отсъствие в този период. Моля, изберете друга дата.");
                            return;
                          }
                          setEndDate(date);
                          // Close popover after selection
                          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                        }}
                        defaultMonth={endDate || startDate || new Date()}
                        disabled={(date) => {
                          // Disable dates before start date AND dates that already have absences
                          const beforeStart = startDate ? date < startDate : false;
                          return beforeStart || isDateDisabled(date);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className={cn(
                  "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg flex items-start gap-2",
                  isMobile ? "p-3" : "p-4"
                )}>
                  <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    <strong>Забележка:</strong> Максималният период за отсъствие е 12 седмици (около 3 месеца).
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason" className={cn(isMobile && "text-sm")}>Причина за отсъствието *</Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Въведете причина..."
                    rows={isMobile ? 3 : 4}
                    className={cn(isMobile && "text-sm")}
                  />
                </div>

                <Button
                  onClick={handleStep2Continue}
                  className="w-full bg-teal-500 hover:bg-teal-600"
                  size={isMobile ? "sm" : "default"}
                >
                  Напред
                </Button>
              </div>
            )}

            {/* Step 3: Substitutes */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-4">
                    {/* Teacher Schedule Grid */}
                  {teacherSchedule === undefined ? (
                    <div className="text-center py-6">
                      <Skeleton className="h-96 w-full" />
                    </div>
                  ) : teacherSchedule && teacherSchedule.weeks.length > 0 ? (
                    <>
                      {/* Add substitute for all button */}
                      <div className="flex justify-center mb-4">
                        <Button
                          onClick={() => setShowAddAllDialog(true)}
                          className="bg-blue-500 hover:bg-blue-600"
                          size={isMobile ? "sm" : "default"}
                        >
                          Добави един заместващ за всички часове
                        </Button>
                      </div>

                      {/* Week navigation */}
                      <div className={cn(
                        "flex items-center justify-between mb-4",
                        isMobile && "flex-col gap-2"
                      )}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentWeekIndex(Math.max(0, currentWeekIndex - 1))}
                          disabled={currentWeekIndex === 0}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          {!isMobile && "Предишна седмица"}
                        </Button>
                        <span className={cn("font-medium", isMobile ? "text-xs" : "text-sm")}>
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
                          {!isMobile && "Следваща седмица"}
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>

                      {/* Schedule table */}
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-border text-xs">
                          <thead>
                            <tr>
                              <th className={cn(
                                "border border-border bg-muted font-medium text-left",
                                isMobile ? "p-1 text-xs" : "p-3 text-sm"
                              )}>
                                Час
                              </th>
                              {teacherSchedule.weeks[currentWeekIndex]?.days.map((day) => (
                                <th
                                  key={day.date}
                                  className={cn(
                                    "border border-border bg-muted font-medium text-center",
                                    isMobile ? "p-1 text-xs" : "p-3 text-sm"
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
                                  "border border-border bg-muted font-medium text-center",
                                  isMobile ? "p-1 text-xs" : "p-3 text-sm"
                                )}>
                                  #{periodIdx + 1}
                                </td>
                                {teacherSchedule.weeks[currentWeekIndex].days.map((day) => {
                                  const period = day.periods[periodIdx];
                                  const substitute = period ? getSubstituteForSlot(
                                    day.dayOfWeek,
                                    periodIdx,
                                    day.date,
                                    period.classId
                                  ) : undefined;
                                  const isFree = period ? isSlotMarkedAsFree(day.dayOfWeek, periodIdx, day.date, period.classId) : false;
                                  
                                  return (
                                    <td
                                      key={day.date}
                                      className={cn(
                                        "border border-border cursor-pointer hover:bg-gray-50 transition-colors",
                                        isMobile ? "p-1" : "p-2",
                                        substitute && !isFree && "bg-green-100 hover:bg-green-200",
                                        isFree && "bg-orange-100 hover:bg-orange-200"
                                      )}
                                      onClick={() =>
                                        period &&
                                        handleSlotClick(day.dayOfWeek, periodIdx, day.date, period)
                                      }
                                    >
                                      {period ? (
                                        <div className="space-y-1">
                                          <div className={cn("font-medium", isMobile && "text-[10px]")}>
                                            {substitute?.isCivicEducation ? "Гражданско образование" : period.subjectName}
                                          </div>
                                          <div className={cn("text-muted-foreground", isMobile && "text-[9px]")}>
                                            {period.className}
                                          </div>
                                          {isFree ? (
                                            <div className={cn(
                                              "text-orange-700 font-medium mt-1",
                                              isMobile && "text-[9px]"
                                            )}>
                                              ✓ Свободен час
                                            </div>
                                          ) : substitute ? (
                                            <div className={cn(
                                              "text-green-700 font-medium mt-1",
                                              isMobile && "text-[9px]"
                                            )}>
                                              ✓ {teachers?.find(t => t._id === substitute.teacherId)?.firstName}{" "}
                                              {teachers?.find(t => t._id === substitute.teacherId)?.lastName}
                                              {substitute.isCivicEducation && (
                                                <div className="text-green-600 text-[9px]">(Гражданско образование)</div>
                                              )}
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

                      <div className={cn("text-muted-foreground mt-4", isMobile ? "text-xs" : "text-sm")}>
                        <p>• Кликнете върху час за избор на заместник</p>
                        <p>• Часовете в зелено имат избран заместник</p>
                        <p>• Часовете в оранжево са свободни</p>
                        <p>• Немаркираните часове означават че учителят ще води часа нормално</p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground">
                        Няма намерени часове за този учител в избрания период.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add All Substitute Dialog */}
        <Dialog open={showAddAllDialog} onOpenChange={setShowAddAllDialog}>
          <DialogContent className={cn(
            "max-h-[80vh] overflow-y-auto",
            isMobile ? "max-w-[95vw]" : "max-w-2xl"
          )}>
            <DialogHeader>
              <DialogTitle>Изберете заместник за всички часове</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <Select
                value={selectedTeacherForAll || "none"}
                onValueChange={(val) => setSelectedTeacherForAll(val as Id<"teachers">)}
              >
                <SelectTrigger className={cn(isMobile && "text-sm")}>
                  <SelectValue placeholder="Изберете заместващ учител" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Изберете заместващ</SelectItem>
                  {teachers?.filter(t => t._id !== selectedTeacher?._id && !absentTeacherIds?.includes(t._id)).map(teacher => (
                    <SelectItem key={teacher._id} value={teacher._id} className="text-sm">
                      {teacher.firstName} {teacher.lastName} - {teacher.specialization}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddAllDialog(false);
                  setSelectedTeacherForAll(null);
                }}
              >
                Отказ
              </Button>
              <Button
                onClick={handleAddSubstituteForAll}
                disabled={!selectedTeacherForAll}
                className="bg-blue-500 hover:bg-blue-600"
              >
                Добави за всички
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
      </div>
    </Layout>
  );
}

export default function AddAbsence() {
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
        <AddAbsenceInner />
      </Authenticated>
    </>
  );
}
