import { useParams, Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { FilterIcon, ArrowLeftIcon, UserIcon, Plus, Edit, X, CalendarIcon, Trash2, Save, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { toast } from "sonner";
import { UserNameLink } from "@/components/ui/user-name-link.tsx";
import { DiaryAccessGuard } from "@/components/DiaryAccessGuard.tsx";
import { Calendar } from "@/components/ui/calendar.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { format } from "date-fns";
import { bg } from "date-fns/locale";

// Helper function to get Bulgarian ordinal suffix (1-ви, 2-ри, 3-ти, etc.)
function getOrdinalSuffix(num: number): string {
  switch (num) {
    case 1: return "1-ви";
    case 2: return "2-ри";
    case 7: return "7-ми";
    case 8: return "8-ми";
    default: return `${num}-ти`;
  }
}

// Type for attendance status in the grid (null = present by default, shows "Присъства")
type AttendanceStatus = "absent" | "late" | null;

// Type for tracking changes in the grid
type AttendanceChange = {
  studentId: string;
  subjectId: string;
  teacherId: string;
  status: AttendanceStatus;
};

function ClassAbsencesInner() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [expandedStudent, setExpandedStudent] = useState<Id<"students"> | null>(null);
  
  // Get studentId from URL params (for staff viewing their child's diary)
  const studentIdFromUrl = searchParams.get("studentId");
  
  // Full-screen add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [absenceDate, setAbsenceDate] = useState<Date>(() => {
    const now = new Date();
    now.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
    return now;
  });
  const [absenceDatePickerOpen, setAbsenceDatePickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Grid-based attendance state: Map of "studentId-classSubjectId" -> status (using classSubject._id for uniqueness)
  const [attendanceGrid, setAttendanceGrid] = useState<Map<string, AttendanceStatus>>(new Map());
  
  // Individual notes per attendance entry: Map of "studentId-classSubjectId" -> note
  const [attendanceNotes, setAttendanceNotes] = useState<Map<string, string>>(new Map());
  
  // Currently editing note for which cell
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  
  // Global note for all marked entries
  const [globalNote, setGlobalNote] = useState("");
  const [useGlobalNote, setUseGlobalNote] = useState(false);
  
  // Track existing attendance records (Map of "studentId-uniqueKey" -> attendanceId)
  const [existingAttendanceIds, setExistingAttendanceIds] = useState<Map<string, Id<"attendance">>>(new Map());
  
  // Edit dialog state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<Id<"attendance"> | null>(null);
  const [editStatus, setEditStatus] = useState<"late" | "absent" | "excused" | "present">("absent");
  const [editNotes, setEditNotes] = useState("");
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAbsenceId, setDeletingAbsenceId] = useState<Id<"attendance"> | null>(null);

  const classData = useQuery(
    api.admin.getClassById,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  const currentUser = useQuery(api.users.getCurrentUser, {});
  
  // Check if current user is a PURE parent (not staff or admin)
  const isCurrentUserParent = currentUser?.roles?.includes("parent") && 
    !currentUser?.roles?.includes("director") && 
    !currentUser?.roles?.includes("vice_director") && 
    !currentUser?.roles?.includes("system_admin") &&
    !currentUser?.roles?.includes("teacher") &&
    !currentUser?.roles?.includes("class_teacher") &&
    !currentUser?.roles?.includes("secretary");
  
  // Get parent's children if user is a parent
  const parentChildren = useQuery(
    api.users.getParentChildren,
    isCurrentUserParent && currentUser ? { userId: currentUser._id } : "skip"
  );
  
  // Get staff parent info - for staff who are also parents viewing their child
  const staffParentInfo = useQuery(api.users.getStaffParentInfo, {});
  
  // Get the specific child being viewed (for staff viewing child)
  const viewedChild = staffParentInfo?.children?.find(c => c.userId === studentIdFromUrl);
  
  // Check if this is a staff member viewing their child's diary
  const isStaffViewingChild = Boolean(
    studentIdFromUrl && 
    viewedChild &&
    viewedChild.classId === classId
  );
  
  // Get class subjects with teachers
  const classSubjectsWithTeachers = useQuery(
    api.admin.getClassSubjectsTeachers,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  // Get subjects scheduled for the selected date (for filtering in add form)
  const subjectsForDate = useQuery(
    api.weeklySchedules.getSubjectsForDate,
    classId && showAddForm ? { classId: classId as Id<"classes">, date: absenceDate.getTime() } : "skip"
  );
  
  // Get existing attendance records for the selected date (to pre-populate and prevent duplicates)
  const existingAttendanceForDate = useQuery(
    api.attendance.getAttendanceForClassDate,
    classId && showAddForm ? { classId: classId as Id<"classes">, date: absenceDate.getTime() } : "skip"
  );
  
  const allStudents = useQuery(
    api.admin.getStudentsByClass,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  const currentUserTeacher = useQuery(
    api.admin.getTeacherByUserId,
    currentUser ? { userId: currentUser._id } : "skip"
  );
  
  const createAttendance = useMutation(api.attendance.createAttendance);
  const updateAttendance = useMutation(api.attendance.updateAttendance);
  const deleteAttendance = useMutation(api.attendance.deleteAttendance);

  const allAbsencesSummary = useQuery(
    api.attendance.getClassAbsencesSummary,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  // Check if current user is a student
  const isCurrentUserStudent = currentUser?.roles?.includes("student");
  
  // Check if current user is admin (can see class details link)
  const isAdmin = currentUser?.roles?.includes("director") || 
                  currentUser?.roles?.includes("vice_director") ||
                  currentUser?.roles?.includes("system_admin");
  
  // Check if user is PURE pedagogical counselor (can only add student support, not grades/reviews/absences)
  // If they also have teacher role, they can add grades/reviews/absences for subjects they teach
  const isPurePedagogicalCounselor = currentUser?.roles?.includes("pedagogical_counselor") &&
    !currentUser?.roles?.includes("teacher") &&
    !currentUser?.roles?.includes("class_teacher") &&
    !isAdmin;
  
  // Filter subjects based on user role AND date when adding absences
  // When in add form, use the lessons directly from subjectsForDate (sorted by periodIndex)
  const filteredSubjects = useMemo(() => {
    // When adding absences, use the lessons directly from the schedule
    if (showAddForm && subjectsForDate) {
      // Map the subjects to include a unique key per period
      let lessons = subjectsForDate.subjects.map(s => ({
        _id: s.classSubjectId, // classSubject ID for saving
        uniqueKey: `${s.periodIndex}-${s.classSubjectId}`, // unique key per period
        periodIndex: s.periodIndex,
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        preparationType: s.preparationType,
        teacherId: s.teacherId,
        teacherName: s.teacherName || "Неизвестен",
      }));
      
      // Filter by user role - teachers only see their own subjects
      if (!isAdmin && currentUserTeacher) {
        lessons = lessons.filter(s => s.teacherId === currentUserTeacher._id);
      }
      
      return lessons;
    }
    
    // Normal view (not in add form) - use classSubjectsWithTeachers
    if (!classSubjectsWithTeachers) return [];
    
    // Admins see all subjects, teachers see only their subjects
    const baseSubjects = isAdmin 
      ? classSubjectsWithTeachers 
      : currentUserTeacher 
        ? classSubjectsWithTeachers.filter(s => s.teacherId === currentUserTeacher._id)
        : [];
    
    // Map to common structure (without periodIndex for normal view)
    return baseSubjects.map(s => ({
      _id: s._id,
      uniqueKey: s._id,
      periodIndex: undefined as number | undefined,
      subjectId: s.subjectId,
      subjectName: s.subjectName,
      preparationType: s.preparationType,
      teacherId: s.teacherId,
      teacherName: s.teacherName,
    }));
  }, [classSubjectsWithTeachers, isAdmin, currentUserTeacher, showAddForm, subjectsForDate]);
  
  // Pre-populate the grid with existing attendance records when data loads
  useEffect(() => {
    if (!showAddForm || !existingAttendanceForDate || !filteredSubjects.length) {
      return;
    }
    
    const newGrid = new Map<string, AttendanceStatus>();
    const newNotes = new Map<string, string>();
    const newExistingIds = new Map<string, Id<"attendance">>();
    
    for (const record of existingAttendanceForDate) {
      // Find the matching subject in filteredSubjects by period and subjectId
      const matchingSubject = filteredSubjects.find(s => 
        s.periodIndex === record.period && s.subjectId === record.subjectId
      );
      
      if (matchingSubject) {
        const key = `${record.studentId}-${matchingSubject.uniqueKey}`;
        
        // Only show absent and late statuses (excused shows as absent)
        if (record.status === "absent" || record.status === "late" || record.status === "excused") {
          newGrid.set(key, record.status === "excused" ? "absent" : record.status as AttendanceStatus);
          if (record.notes) {
            newNotes.set(key, record.notes);
          }
          newExistingIds.set(key, record._id);
        }
      }
    }
    
    setAttendanceGrid(newGrid);
    setAttendanceNotes(newNotes);
    setExistingAttendanceIds(newExistingIds);
  }, [existingAttendanceForDate, filteredSubjects, showAddForm]);
  
  // Shorten subject name for column header (e.g., "Математика" -> "Мат")
  const shortenSubjectName = (name: string): string => {
    // Common abbreviations
    const abbreviations: Record<string, string> = {
      "Математика": "Мат",
      "Български език и литература": "БЕЛ",
      "Български език": "БЕЛ",
      "Английски език": "Англ",
      "Немски език": "Нем",
      "Френски език": "Фр",
      "Руски език": "Рус",
      "История и цивилизации": "Ист",
      "История": "Ист",
      "География и икономика": "Гео",
      "География": "Гео",
      "Биология и здравно образование": "Био",
      "Биология": "Био",
      "Физика и астрономия": "Физ",
      "Физика": "Физ",
      "Химия и опазване на околната среда": "Хим",
      "Химия": "Хим",
      "Информационни технологии": "ИТ",
      "Информатика": "Инф",
      "Музика": "Муз",
      "Изобразително изкуство": "ИИ",
      "Физическо възпитание и спорт": "ФВС",
      "Технологии и предприемачество": "Техн",
      "Човекът и природата": "ЧП",
      "Човекът и обществото": "ЧО",
      "Родинознание": "Род",
      "Околен свят": "ОС",
      "Философия": "Фил",
      "Етика": "Етика",
      "Религия": "Рел",
      "Гражданско образование": "ГО",
      "Хигиена": "Хиг",
      "УП Хигиена": "УП Хиг",
    };
    
    if (abbreviations[name]) {
      return abbreviations[name];
    }
    
    // If not in the list, take first 4-5 characters
    return name.length > 5 ? name.slice(0, 4) : name;
  };
  
  // Get display name for column header - period number + subject + prep type + teacher
  const getColumnDisplayName = (subject: {
    subjectName: string;
    preparationType?: string | null;
    teacherName?: string;
    periodIndex?: number;
  }): { period: string; subjectWithPrep: string; teacherShort: string } => {
    const subjectShort = shortenSubjectName(subject.subjectName);
    
    // Period number (periodIndex is already 1-based from schedule)
    const period = subject.periodIndex !== undefined ? `${subject.periodIndex}` : "";
    
    // Subject with prep type suffix (only for non-ЗП and non-ООП)
    let subjectWithPrep = subjectShort;
    if (subject.preparationType && subject.preparationType !== "ЗП" && subject.preparationType !== "ООП") {
      // Simplify prep type
      let prepSuffix = subject.preparationType;
      if (prepSuffix.includes("ИУЧ")) {
        prepSuffix = "ИУЧ";
      } else if (prepSuffix.includes("РП")) {
        prepSuffix = "РП";
      } else if (prepSuffix.includes("УП")) {
        prepSuffix = "УП";
      }
      subjectWithPrep = `${subjectShort} ${prepSuffix}`;
    }
    
    const teacherShort = getShortTeacherName(subject.teacherName || "");
    
    return { period, subjectWithPrep, teacherShort };
  };
  
  // Get short teacher name (first letter of first name + last name, e.g., "И. Иванов")
  const getShortTeacherName = (fullName: string): string => {
    const parts = fullName.split(" ");
    if (parts.length >= 2) {
      const firstInitial = parts[0].charAt(0);
      const lastName = parts[parts.length - 1];
      return `${firstInitial}. ${lastName}`;
    }
    return fullName;
  };
  
  // Check if user can edit a specific attendance cell
  // Admins/directors/vice-directors can edit all
  // Teachers can only edit cells for lessons they taught (by checking teacherId)
  const canEditCell = (subjectTeacherId: Id<"teachers"> | undefined, existingRecordTeacherId?: Id<"teachers">): boolean => {
    // Admins can always edit
    if (isAdmin) return true;
    
    // If no current teacher record, can't edit
    if (!currentUserTeacher) return false;
    
    // For existing records, check if the record's teacher matches current user
    if (existingRecordTeacherId) {
      return existingRecordTeacherId === currentUserTeacher._id;
    }
    
    // For new records, check if current teacher teaches this subject
    return subjectTeacherId === currentUserTeacher._id;
  };
  
  // Get the teacher ID for an existing attendance record (if any)
  const getExistingRecordTeacherId = (key: string): Id<"teachers"> | undefined => {
    const existingId = existingAttendanceIds.get(key);
    if (!existingId || !existingAttendanceForDate) return undefined;
    
    const record = existingAttendanceForDate.find(r => r._id === existingId);
    return record?.teacherId;
  };
  
  // Handle click on attendance cell - cycle through statuses
  // Use uniqueKey (periodIndex-classSubjectId) for uniqueness to handle same subject at multiple periods
  // Cycle: null -> absent -> late -> null (skip "present" since students are present by default)
  const handleCellClick = (studentId: string, uniqueKey: string, subjectTeacherId: Id<"teachers"> | undefined) => {
    const key = `${studentId}-${uniqueKey}`;
    
    // Check permissions - get existing record's teacherId if any
    const existingRecordTeacherId = getExistingRecordTeacherId(key);
    if (!canEditCell(subjectTeacherId, existingRecordTeacherId)) {
      toast.error("Нямате права да редактирате този час. Само учителят, който е водил часа може да прави промени.");
      return;
    }
    
    const currentStatus = attendanceGrid.get(key) || null;
    
    // Cycle: null -> absent -> late -> null
    let newStatus: AttendanceStatus;
    switch (currentStatus) {
      case null:
        newStatus = "absent";
        break;
      case "absent":
        newStatus = "late";
        break;
      case "late":
        newStatus = null;
        break;
      default:
        newStatus = null;
    }
    
    setAttendanceGrid(prev => {
      const newMap = new Map(prev);
      if (newStatus === null) {
        newMap.delete(key);
      } else {
        newMap.set(key, newStatus);
      }
      return newMap;
    });
  };
  
  // Get display text for status
  const getStatusText = (status: AttendanceStatus): string => {
    switch (status) {
      case "absent": return "Отсъства";
      case "late": return "Закъсн.";
      default: return "Присъства"; // Default shows "Присъства" (present)
    }
  };
  
  // Get status color class
  const getStatusClass = (status: AttendanceStatus): string => {
    switch (status) {
      case "absent": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      case "late": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
      default: return "text-muted-foreground"; // Default: neutral color for "Присъства"
    }
  };
  
  // Save all attendance entries
  const handleSaveAttendance = async () => {
    if (!currentUserTeacher && !isAdmin) {
      toast.error("Нямате права да добавяте отсъствия");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const dateTimestamp = new Date(absenceDate);
      dateTimestamp.setHours(12, 0, 0, 0);
      
      const createPromises: Promise<Id<"attendance">>[] = [];
      const updatePromises: Promise<null>[] = [];
      const deletePromises: Promise<null>[] = [];
      
      // Process all students and subjects to find changes
      for (const student of allStudents || []) {
        for (const subject of filteredSubjects) {
          const key = `${student._id}-${subject.uniqueKey}`;
          const existingId = existingAttendanceIds.get(key);
          const currentStatus = attendanceGrid.get(key) || null;
          
          // Get note for this cell - use global note if enabled, otherwise individual note
          const noteForCell = useGlobalNote && globalNote.trim() 
            ? globalNote.trim() 
            : attendanceNotes.get(key)?.trim() || undefined;
          
          if (existingId) {
            // Existing record - check if it needs to be updated or deleted
            const existingRecord = existingAttendanceForDate?.find(r => r._id === existingId);
            
            if (currentStatus === null) {
              // Status set to present (null) - delete the existing record
              deletePromises.push(deleteAttendance({ id: existingId }));
            } else if (existingRecord && (existingRecord.status !== currentStatus || existingRecord.notes !== noteForCell)) {
              // Status or note changed - update the record
              updatePromises.push(updateAttendance({
                id: existingId,
                status: currentStatus as "absent" | "late",
                notes: noteForCell,
              }));
            }
          } else if (currentStatus) {
            // New record - create it
            const teacherId = subject.teacherId || currentUserTeacher?._id;
            
            if (teacherId) {
              const period = subject.periodIndex !== undefined ? subject.periodIndex : 1;
              
              createPromises.push(
                createAttendance({
                  studentId: student._id as Id<"students">,
                  classId: classId as Id<"classes">,
                  subjectId: subject.subjectId as Id<"subjects">,
                  teacherId: teacherId as Id<"teachers">,
                  date: dateTimestamp.getTime(),
                  period,
                  status: currentStatus as "absent" | "late",
                  notes: noteForCell,
                })
              );
            }
          }
        }
      }
      
      const totalChanges = createPromises.length + updatePromises.length + deletePromises.length;
      
      if (totalChanges === 0) {
        toast.info("Няма промени за запазване");
        setShowAddForm(false);
        setAttendanceGrid(new Map());
        setAttendanceNotes(new Map());
        setExistingAttendanceIds(new Map());
        setGlobalNote("");
        setUseGlobalNote(false);
        return;
      }
      
      // Execute all operations
      await Promise.all([...createPromises, ...updatePromises, ...deletePromises]);
      
      const messages = [];
      if (createPromises.length > 0) messages.push(`${createPromises.length} добавени`);
      if (updatePromises.length > 0) messages.push(`${updatePromises.length} актуализирани`);
      if (deletePromises.length > 0) messages.push(`${deletePromises.length} изтрити`);
      
      toast.success(`Успешно: ${messages.join(", ")}!`);
      setShowAddForm(false);
      setAttendanceGrid(new Map());
      setAttendanceNotes(new Map());
      setExistingAttendanceIds(new Map());
      setGlobalNote("");
      setUseGlobalNote(false);
    } catch (error) {
      toast.error("Грешка при запазване на отсъствията");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Reset form when opening
  const handleOpenAddForm = () => {
    setAttendanceGrid(new Map());
    // Set date to today at noon to avoid timezone issues
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    setAbsenceDate(today);
    setAttendanceNotes(new Map());
    setExistingAttendanceIds(new Map());
    setEditingNoteKey(null);
    setGlobalNote("");
    setUseGlobalNote(false);
    setShowAddForm(true);
  };
  
  const handleEditAbsence = async () => {
    if (!editingAbsence) return;
    
    setIsSubmitting(true);
    try {
      if (editStatus === "present") {
        await deleteAttendance({ id: editingAbsence });
        toast.success("Отсъствието е изтрито успешно!");
      } else {
        await updateAttendance({
          id: editingAbsence,
          status: editStatus,
          notes: editNotes.trim() || undefined,
        });
        toast.success("Отсъствието е редактирано успешно!");
      }
      
      setShowEditDialog(false);
      setEditingAbsence(null);
      setEditStatus("absent");
      setEditNotes("");
    } catch (error) {
      toast.error("Грешка при редактиране на отсъствие");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const openEditDialog = (absence: { 
    _id: Id<"attendance">;
    status: "late" | "absent" | "present" | "excused";
    notes?: string;
  }) => {
    setEditingAbsence(absence._id);
    setEditStatus(absence.status);
    setEditNotes(absence.notes || "");
    setShowEditDialog(true);
  };
  
  const handleDeleteClick = (absenceId: Id<"attendance">) => {
    setDeletingAbsenceId(absenceId);
    setShowDeleteConfirm(true);
  };
  
  const handleConfirmDelete = async () => {
    if (!deletingAbsenceId) return;
    
    try {
      await deleteAttendance({ id: deletingAbsenceId });
      toast.success("Записът е изтрит успешно!");
    } catch (error) {
      toast.error("Грешка при изтриване на записа");
      console.error(error);
    } finally {
      setShowDeleteConfirm(false);
      setDeletingAbsenceId(null);
    }
  };
  
  const handleExcuseAbsence = async (absenceId: Id<"attendance">) => {
    try {
      await updateAttendance({
        id: absenceId,
        status: "excused",
      });
      toast.success("Отсъствието е извинено!");
    } catch (error) {
      toast.error("Грешка при извиняване на отсъствие");
      console.error(error);
    }
  };
  
  // Get IDs of parent's children in this class
  const parentChildrenInClass = parentChildren?.filter(c => c.classId === classId);
  const parentChildStudentIds = parentChildrenInClass?.map(c => c._id) || [];
  
  // Check if we should show single-student view
  const isSingleStudentView = isCurrentUserStudent || isCurrentUserParent || isStaffViewingChild;
  
  // Filter absences summary
  const absencesSummary = isCurrentUserStudent
    ? allAbsencesSummary?.filter(s => s.studentUserId === currentUser?._id)
    : isStaffViewingChild && viewedChild
    ? allAbsencesSummary?.filter(s => s.studentUserId === viewedChild.userId)
    : isCurrentUserParent && parentChildStudentIds.length > 0
    ? allAbsencesSummary?.filter(s => parentChildStudentIds.includes(s.studentId))
    : allAbsencesSummary;
    
  const expandedStudentAbsences = useQuery(
    api.attendance.listAttendance,
    expandedStudent ? { studentId: expandedStudent } : "skip"
  );

  if (!classData || !absencesSummary) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const studentQueryStr = studentIdFromUrl ? `?studentId=${studentIdFromUrl}` : '';

  const stats = [
    { label: "Оц.", link: `/bg/diary/class/${classId}/grades${studentQueryStr}` },
    { label: "Отс.", link: `/bg/diary/class/${classId}/absences${studentQueryStr}` },
    { label: "Отз.", link: `/bg/diary/class/${classId}/reviews${studentQueryStr}` },
    { label: "Раз.", link: `/bg/diary/class/${classId}/schedule${studentQueryStr}` },
    { label: "Тем.", link: `/bg/diary/class/${classId}/topics${studentQueryStr}` },
    { label: "Кон.", link: `/bg/diary/class/${classId}/tests${studentQueryStr}` },
    { label: "Дом.", link: `/bg/diary/class/${classId}/homework${studentQueryStr}` },
    { label: "ВЧК", link: `/bg/diary/class/${classId}/internal-commission${studentQueryStr}` },
    { label: "Род.", link: `/bg/diary/class/${classId}/parent-meetings${studentQueryStr}` },
    { label: "Поп.", link: `/bg/diary/class/${classId}/remedial-exams${studentQueryStr}` },
    { label: "Под.", link: `/bg/diary/class/${classId}/student-support${studentQueryStr}` },
    { label: "Сан.", link: `/bg/diary/class/${classId}/sanctions${studentQueryStr}` },
    { label: "Год.", link: `/bg/diary/class/${classId}/annual-results${studentQueryStr}` },
    { label: "Уч.", link: `/bg/diary/class/${classId}/students${studentQueryStr}` },
  ];

  const totals = {
    lateCount: absencesSummary.reduce((sum, s) => sum + s.lateCount, 0),
    unexcusedCount: absencesSummary.reduce((sum, s) => sum + s.unexcusedCount, 0),
    totalUnexcused: absencesSummary.reduce((sum, s) => sum + s.totalUnexcused, 0),
    totalExcused: absencesSummary.reduce((sum, s) => sum + s.totalExcused, 0),
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Full-screen Grid Add Form */}
      {showAddForm ? (
        <div className="flex-1 flex flex-col">
          {/* Header - responsive */}
          <div className="border-b bg-background">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-3 gap-3">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    setAttendanceGrid(new Map());
                    setAttendanceNotes(new Map());
                    setExistingAttendanceIds(new Map());
                    setEditingNoteKey(null);
                    setGlobalNote("");
                    setUseGlobalNote(false);
                  }}
                >
                  <X className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Затвори</span>
                </Button>
                <h1 className="text-base sm:text-lg font-semibold">
                  Добави отсъствие - {classData.name}
                </h1>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                {/* Date Picker */}
                <Popover open={absenceDatePickerOpen} onOpenChange={setAbsenceDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <CalendarIcon className="mr-1 sm:mr-2 h-4 w-4" />
                      {format(absenceDate, "dd.MM.yyyy", { locale: bg })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={absenceDate}
                      onSelect={(date) => {
                        if (date) {
                          // Set time to noon to avoid timezone issues
                          const adjustedDate = new Date(date);
                          adjustedDate.setHours(12, 0, 0, 0);
                          setAbsenceDate(adjustedDate);
                          setAbsenceDatePickerOpen(false);
                          // Clear grid when date changes - will be repopulated by useEffect
                          setAttendanceGrid(new Map());
                          setAttendanceNotes(new Map());
                          setExistingAttendanceIds(new Map());
                        }
                      }}
                      locale={bg}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                <Button
                  onClick={handleSaveAttendance}
                  disabled={isSubmitting || attendanceGrid.size === 0}
                  size="sm"
                >
                  <Save className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">{isSubmitting ? "Запазване..." : "Запази"}</span>
                  <span className="sm:hidden">{isSubmitting ? "..." : "Запази"}</span>
                  {attendanceGrid.size > 0 && ` (${attendanceGrid.size})`}
                </Button>
              </div>
            </div>
          </div>
          
          {/* Grid Content */}
          <div className="flex-1 overflow-auto p-2 sm:p-4">
            {/* Non-school day message */}
            {subjectsForDate?.isNonSchoolDay ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
                  <CalendarIcon className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-2">
                  Неучебен ден
                </h3>
                <p className="text-muted-foreground">
                  {subjectsForDate.nonSchoolDayName || "Няма занятия за избраната дата"}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Изберете друга дата от календара
                </p>
              </div>
            ) : filteredSubjects.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {subjectsForDate && subjectsForDate.subjects.length === 0 
                  ? "Няма предмети по разписание за избраната дата"
                  : isAdmin 
                    ? "Няма предмети за този клас"
                    : "Нямате предмети за този клас. Само учители, които преподават в този клас, могат да добавят отсъствия."
                }
              </div>
            ) : (
              <>
                {/* Global note option */}
                {attendanceGrid.size > 0 && (
                  <div className="mb-4 p-3 bg-muted/30 rounded-lg border">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="useGlobalNote"
                        checked={useGlobalNote}
                        onCheckedChange={(checked) => setUseGlobalNote(checked === true)}
                      />
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="useGlobalNote" className="text-sm font-medium cursor-pointer">
                          Добави обща забележка за всички маркирани ({attendanceGrid.size})
                        </Label>
                        {useGlobalNote && (
                          <Input
                            placeholder="Въведете обща забележка..."
                            value={globalNote}
                            onChange={(e) => setGlobalNote(e.target.value)}
                            className="mt-2"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="overflow-x-auto -mx-2 sm:mx-0">
                  <table className="border-collapse border border-border min-w-full">
                    <thead>
                      <tr>
                        <th className="border border-border p-1 sm:p-2 bg-muted/30 text-left text-xs font-medium sticky left-0 z-10 min-w-[90px] sm:min-w-[130px]">
                          <div className="flex flex-col">
                            <span className="font-semibold">№</span>
                            <span className="font-normal text-muted-foreground text-[10px] sm:text-xs">Ученик</span>
                          </div>
                        </th>
                        {filteredSubjects.map((subject) => {
                          const display = getColumnDisplayName(subject);
                          return (
                            <th 
                              key={subject.uniqueKey} 
                              className="border border-border p-1 bg-muted/30 min-w-[60px] sm:min-w-[75px]"
                            >
                              <div className="flex flex-col items-center text-center">
                                <span className="text-[10px] sm:text-xs font-bold text-primary">
                                  {display.period}
                                </span>
                                <span className="text-[9px] sm:text-[10px] font-medium leading-tight">
                                  {display.subjectWithPrep}
                                </span>
                                <span className="text-[8px] sm:text-[9px] text-muted-foreground leading-tight">
                                  {display.teacherShort}
                                </span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {allStudents?.map((student, index) => {
                        // Get short student name for display
                        // Parse full name to get short version (Име Ф.)
                        const nameParts = student.name?.split(" ") || [];
                        const firstName = nameParts[0] || "";
                        const lastNameInitial = nameParts.length > 1 ? `${nameParts[nameParts.length - 1].charAt(0)}.` : "";
                        const studentName = firstName && lastNameInitial
                          ? `${firstName} ${lastNameInitial}`
                          : student.name || `Ученик ${index + 1}`;
                        
                        return (
                          <tr key={student._id} className="hover:bg-muted/20">
                            <td className="border border-border p-1 sticky left-0 bg-background z-10">
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-xs sm:text-sm w-4 sm:w-5 text-center">{index + 1}</span>
                                <span className="text-[10px] sm:text-xs truncate max-w-[60px] sm:max-w-[90px]" title={student.name}>
                                  {studentName}
                                </span>
                              </div>
                            </td>
                            {filteredSubjects.map((subject) => {
                              // Use uniqueKey (periodIndex + classSubjectId) for the attendance grid key
                              const key = `${student._id}-${subject.uniqueKey}`;
                              const status = attendanceGrid.get(key) || null;
                              const hasNote = attendanceNotes.has(key) && attendanceNotes.get(key)!.trim() !== "";
                              const isMarked = status === "absent" || status === "late";
                              
                              return (
                                <td 
                                  key={subject.uniqueKey}
                                  className={cn(
                                    "border border-border p-0.5 sm:p-1 text-center cursor-pointer transition-colors select-none relative",
                                    status ? getStatusClass(status) : "text-muted-foreground hover:bg-muted/50"
                                  )}
                                  onClick={() => handleCellClick(student._id, subject.uniqueKey, subject.teacherId)}
                                  title={hasNote ? `Бележка: ${attendanceNotes.get(key)}` : "Кликнете за смяна на статус"}
                                >
                                  <div className="flex flex-col items-center justify-center min-h-[32px] sm:min-h-[40px]">
                                    <span className="text-[9px] sm:text-xs font-medium leading-tight">
                                      {status === "absent" ? "Отс." : status === "late" ? "Зак." : "—"}
                                    </span>
                                    {isMarked && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingNoteKey(key);
                                        }}
                                        className={cn(
                                          "mt-0.5 p-0.5 rounded transition-colors",
                                          hasNote 
                                            ? "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50" 
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                        )}
                                        title={hasNote ? "Редактирай бележка" : "Добави бележка"}
                                      >
                                        <MessageSquare className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {/* Individual note editor dialog */}
                {editingNoteKey && (
                  <Dialog open={!!editingNoteKey} onOpenChange={(open) => !open && setEditingNoteKey(null)}>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Добави бележка</DialogTitle>
                        <DialogDescription>
                          Въведете бележка за това отсъствие
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <Textarea
                          placeholder="Бележка към отсъствието..."
                          value={attendanceNotes.get(editingNoteKey) || ""}
                          onChange={(e) => {
                            setAttendanceNotes(prev => {
                              const newMap = new Map(prev);
                              newMap.set(editingNoteKey, e.target.value);
                              return newMap;
                            });
                          }}
                          rows={3}
                          autoFocus
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingNoteKey(null)}>
                          Затвори
                        </Button>
                        <Button onClick={() => setEditingNoteKey(null)}>
                          Запази
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </>
            )}
            
            {/* Legend - responsive */}
            {!subjectsForDate?.isNonSchoolDay && filteredSubjects.length > 0 && (
              <>
                <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm">
                  <span className="text-muted-foreground">Легенда:</span>
                  <div className="flex items-center gap-1">
                    <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-muted-foreground text-xs">—</span>
                    <span className="text-muted-foreground hidden sm:inline">= Присъства</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-xs">Отс.</span>
                    <span className="text-muted-foreground hidden sm:inline">= Отсъствие</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 text-xs">Зак.</span>
                    <span className="text-muted-foreground hidden sm:inline">= Закъснение</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground hidden sm:inline">= Бележка</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Кликнете върху клетка за смяна на статуса. Използвайте иконата за добавяне на индивидуална бележка.
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="border-b bg-background">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 sm:px-6 py-2 sm:py-3 gap-2 sm:gap-0">
              <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/bg/diary/class/${classId}/grades`)}
                  className="px-2 sm:px-3"
                >
                  <ArrowLeftIcon className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Назад</span>
                </Button>
                <h1 className="text-sm sm:text-lg font-semibold truncate">
                  {isAdmin ? (
                    <Link 
                      to={`/bg/admin/classes/${classId}`}
                      className="text-primary hover:underline"
                    >
                      {classData.name}
                    </Link>
                  ) : (
                    classData.name
                  )} - Отсъствия
                </h1>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-end">
                {!isSingleStudentView && !isPurePedagogicalCounselor && (
                  <Button variant="default" size="sm" onClick={handleOpenAddForm} className="px-2 sm:px-3">
                    <Plus className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Добави</span>
                  </Button>
                )}
                <Button variant="outline" size="sm" className="px-2 sm:px-3">
                  <FilterIcon className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Филтри</span>
                </Button>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-6 py-1 sm:py-2 border-t overflow-x-auto">
              {stats.map((stat, index) => {
                const isActive = location.pathname.endsWith(stat.link.split('/').pop() || '');
                return (
                  <Link
                    key={index}
                    to={stat.link}
                    className={cn(
                      "px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium whitespace-nowrap rounded transition-colors",
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
      
      {/* Edit Absence Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактирай отсъствие</DialogTitle>
            <DialogDescription>
              Променете статуса или бележките на отсъствието
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editStatus">Статус *</Label>
              <Select value={editStatus} onValueChange={(val) => setEditStatus(val as "late" | "absent" | "excused" | "present")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Присъства</SelectItem>
                  <SelectItem value="late">Закъснение</SelectItem>
                  <SelectItem value="absent">Отсъствие</SelectItem>
                  <SelectItem value="excused">Уважително</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="editNotes">Бележки</Label>
              <Textarea
                id="editNotes"
                placeholder="Допълнителна информация..."
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowEditDialog(false)}
              disabled={isSubmitting}
            >
              Откажи
            </Button>
            <Button 
              onClick={handleEditAbsence}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Запазване..." : "Запази"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Изтриване на запис</AlertDialogTitle>
            <AlertDialogDescription>
              Сигурни ли сте, че искате да изтриете този запис? Това действие не може да бъде отменено.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)}>
              Откажи
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Изтрий
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-6">
        <Card className="p-0">
          <div className="overflow-x-auto -mx-0">
            <table className="w-full text-xs sm:text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  {!isSingleStudentView && (
                    <>
                      <th className="text-left py-2 px-2 sm:py-3 sm:px-4 font-medium text-muted-foreground w-8 sm:w-16">
                        №
                      </th>
                      <th className="text-left py-2 px-2 sm:py-3 sm:px-4 font-medium text-muted-foreground">
                        Ученик
                      </th>
                    </>
                  )}
                  <th className="text-center py-2 px-1 sm:py-3 sm:px-4 font-medium text-muted-foreground w-16 sm:w-32">
                    Закъсн.
                  </th>
                  <th className="text-center py-2 px-1 sm:py-3 sm:px-4 font-medium text-muted-foreground w-16 sm:w-32">
                    Неув.
                  </th>
                  <th className="text-center py-2 px-1 sm:py-3 sm:px-4 font-medium text-muted-foreground w-16 sm:w-32">
                    О.неув.
                  </th>
                  <th className="text-center py-2 px-1 sm:py-3 sm:px-4 font-medium text-muted-foreground w-16 sm:w-32">
                    О.уваж.
                  </th>
                </tr>
              </thead>
              <tbody>
                {absencesSummary.map((student, index) => {
                  const isExpanded = expandedStudent === student.studentId;
                  return (
                    <>
                      <tr key={student.studentId} className="border-b hover:bg-muted/50">
                        {!isSingleStudentView && (
                          <>
                            <td className="py-2 px-2 sm:py-3 sm:px-4 text-center">{index + 1}</td>
                            <td className="py-2 px-2 sm:py-3 sm:px-4">
                              <div className="flex items-center gap-1 sm:gap-2">
                                <UserIcon className="h-3 w-3 sm:h-4 sm:w-4 text-primary shrink-0" />
                                <span className="truncate max-w-[80px] sm:max-w-none">
                                  <UserNameLink
                                    userId={student.studentUserId}
                                    fullName={student.studentName}
                                  />
                                </span>
                              </div>
                            </td>
                          </>
                        )}
                        <td className="py-2 px-1 sm:py-3 sm:px-4 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setExpandedStudent(isExpanded ? null : student.studentId);
                            }}
                            className="hover:bg-yellow-100 dark:hover:bg-yellow-900/30 px-1 sm:px-2"
                          >
                            {student.lateCount > 0 ? (
                              <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-xs">
                                {student.lateCount}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </Button>
                        </td>
                        <td className="py-2 px-1 sm:py-3 sm:px-4 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setExpandedStudent(isExpanded ? null : student.studentId);
                            }}
                            className="px-1 sm:px-2"
                          >
                            <span className="text-muted-foreground">
                              {student.unexcusedCount}
                            </span>
                          </Button>
                        </td>
                        <td className="py-2 px-1 sm:py-3 sm:px-4 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setExpandedStudent(isExpanded ? null : student.studentId);
                            }}
                            className="px-1 sm:px-2"
                          >
                            <span>{student.totalUnexcused}</span>
                          </Button>
                        </td>
                        <td className="py-2 px-1 sm:py-3 sm:px-4 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setExpandedStudent(isExpanded ? null : student.studentId);
                            }}
                            className="hover:bg-green-100 dark:hover:bg-green-900/30 px-1 sm:px-2"
                          >
                            {student.totalExcused > 0 ? (
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
                                {student.totalExcused}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </Button>
                        </td>
                      </tr>
                      {isExpanded && expandedStudentAbsences && (
                        <tr>
                          <td colSpan={isSingleStudentView ? 4 : 6} className="p-2 sm:p-4 bg-muted/30 border">
                            <div className="space-y-2">
                              <h4 className="font-semibold text-xs sm:text-sm mb-2">
                                Детайли ({expandedStudentAbsences.length})
                              </h4>
                              {expandedStudentAbsences.length > 0 ? (
                                <div className="space-y-2">
                                  {expandedStudentAbsences.map((absence, i) => (
                                    <div key={absence._id} className="flex items-start justify-between gap-1 sm:gap-2 text-xs sm:text-sm p-2 bg-background rounded border">
                                      <div className="flex items-start gap-1 sm:gap-2 flex-1 min-w-0">
                                        <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                            <Badge className={cn(
                                              "text-[10px] sm:text-xs",
                                              absence.status === "late" && "bg-yellow-100 text-yellow-800",
                                              absence.status === "absent" && "bg-red-100 text-red-800",
                                              absence.status === "excused" && "bg-green-100 text-green-800",
                                            )}>
                                              {absence.status === "late" && "Закъсн."}
                                              {absence.status === "absent" && "Отс."}
                                              {absence.status === "excused" && "Уваж."}
                                            </Badge>
                                            <span className="font-medium truncate">{absence.subjectName}</span>
                                          </div>
                                          <div className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                                            {new Date(absence.date).toLocaleDateString("bg-BG")} - {absence.teacherName}
                                            {absence.notes && ` - ${absence.notes}`}
                                          </div>
                                        </div>
                                      </div>
                                      {!isSingleStudentView && (
                                        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 sm:h-8 sm:w-8"
                                            onClick={() => openEditDialog(absence as { _id: Id<"attendance">; status: "late" | "absent" | "present" | "excused"; notes?: string })}
                                          >
                                            <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                                          </Button>
                                          {absence.status !== "excused" && absence.status !== "late" && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 sm:h-8 px-1 sm:px-2 text-[10px] sm:text-xs hidden sm:inline-flex"
                                              onClick={() => handleExcuseAbsence(absence._id)}
                                            >
                                              Извин.
                                            </Button>
                                          )}
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 sm:h-8 sm:w-8 text-red-600 hover:text-red-700 hover:bg-red-100"
                                            onClick={() => handleDeleteClick(absence._id)}
                                          >
                                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center text-muted-foreground py-4 text-xs sm:text-sm">
                                  Няма отсъствия
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
                {/* Totals Row */}
                {!isSingleStudentView && (
                  <tr className="border-t-2 bg-muted/20 font-semibold text-xs sm:text-sm">
                    <td colSpan={2} className="py-2 px-2 sm:py-3 sm:px-4 text-center">
                      Общо
                    </td>
                    <td className="py-2 px-1 sm:py-3 sm:px-4 text-center">
                      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-xs">
                        {totals.lateCount}
                      </Badge>
                    </td>
                    <td className="py-2 px-1 sm:py-3 sm:px-4 text-center">
                      {totals.unexcusedCount}
                    </td>
                    <td className="py-2 px-1 sm:py-3 sm:px-4 text-center">
                      {totals.totalUnexcused}
                    </td>
                    <td className="py-2 px-1 sm:py-3 sm:px-4 text-center">
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
                        {totals.totalExcused}
                      </Badge>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
        </>
      )}
    </div>
  );
}

export default function ClassAbsences() {
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
        <DiaryAccessGuard>
          <ClassAbsencesInner />
        </DiaryAccessGuard>
      </Authenticated>
    </Layout>
  );
}
