import { useParams, Link, useLocation, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useState, useEffect } from "react";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { FilterIcon, UserIcon, ChevronDownIcon, ChevronUpIcon, Plus, ChevronRightIcon, ChevronLeftIcon, CalendarIcon, SettingsIcon, XIcon, EditIcon, Trash2Icon, CheckIcon, ArrowLeftIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { cn, formatUserName, formatFullName } from "@/lib/utils.ts";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth.ts";
import { useIsMobile } from "@/hooks/use-mobile.ts";
import { format } from "date-fns";
import { bg } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { UserNameLink } from "@/components/ui/user-name-link.tsx";
import { DiaryAccessGuard } from "@/components/DiaryAccessGuard.tsx";

function ClassGradesInner() {
  const { classId } = useParams<{ classId: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  
  // Get subject from URL params (for auto-selection when navigating from schedule)
  const subjectFromUrl = searchParams.get("subject");
  // Get studentId from URL params (for staff viewing their child's diary)
  const studentIdFromUrl = searchParams.get("studentId");
  
  // Create a stable key from the full URL to force re-render when params change
  const urlKey = `${classId}-${studentIdFromUrl || 'class'}`;
  
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const platformSettings = useQuery(api.platformSettings.getAllSettings, {});
  
  // Get staff parent info - for staff who are also parents viewing their child
  const staffParentInfo = useQuery(api.users.getStaffParentInfo, {});
  
  // Get the specific child being viewed (for staff viewing child)
  // IMPORTANT: Also verify that the child's classId matches the current classId
  // This prevents showing child data when staff navigates to a different class
  const viewedChild = staffParentInfo?.children?.find(c => c.userId === studentIdFromUrl);
  
  // Check if this is a staff member viewing their child's diary
  // Must also verify the child is in the current class being viewed
  const isStaffViewingChild = Boolean(
    studentIdFromUrl && 
    viewedChild &&
    viewedChild.classId === classId
  );
  
  // Check if current user is a PURE parent (not staff or admin)
  // Staff who are also parents should use isStaffViewingChild instead
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
  
  const [selectedSubject, setSelectedSubject] = useState<string | null>(subjectFromUrl);
  const [selectedView, setSelectedView] = useState<"term1" | "term2" | "yearly">(() => {
    // Auto-select current term based on today's date
    // Bulgarian school year: Term 1 = Sept-Jan, Term 2 = Feb-June
    const month = new Date().getMonth(); // 0=Jan, 1=Feb, ..., 11=Dec
    return (month >= 1 && month <= 5) ? "term2" : "term1";
  });
  const [term1Expanded, setTerm1Expanded] = useState(true);
  const [term2Expanded, setTerm2Expanded] = useState(true);
  const [viewSelectorOpen, setViewSelectorOpen] = useState(false);
  const [termPanelOpen, setTermPanelOpen] = useState(false);
  const [expandedGrade, setExpandedGrade] = useState<Id<"grades"> | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  
  // Reset expanded states when URL changes (especially when switching from child view to class view)
  useEffect(() => {
    setExpandedGrade(null);
    setExpandedStudentId(null);
    setSelectedSubject(subjectFromUrl);
  }, [urlKey, subjectFromUrl]);
  
  // Term grade modal state
  const [termGradeModalOpen, setTermGradeModalOpen] = useState(false);
  const [termGradeStudentId, setTermGradeStudentId] = useState<string | null>(null);
  const [termGradeValue, setTermGradeValue] = useState<string>("");
  const [editingTermGradeId, setEditingTermGradeId] = useState<Id<"grades"> | null>(null);
  const [termNumber, setTermNumber] = useState<1 | 2>(1);
  
  // Edit grade modal state
  const [editGradeModalOpen, setEditGradeModalOpen] = useState(false);
  const [editingGradeId, setEditingGradeId] = useState<Id<"grades"> | null>(null);
  const [editGradeValue, setEditGradeValue] = useState<string>("");
  const [editGradeType, setEditGradeType] = useState<string>("");
  const [editGradeNotes, setEditGradeNotes] = useState<string>("");
  const [editGradeDate, setEditGradeDate] = useState<string>("");
  const [editGradeDatePopoverOpen, setEditGradeDatePopoverOpen] = useState(false);
  
  // Delete grade reason dialog state
  const [deleteReasonDialogOpen, setDeleteReasonDialogOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState<string>("");
  
  // Bulk delete mode state
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [selectedGradeIds, setSelectedGradeIds] = useState<Set<Id<"grades">>>(new Set());
  
  // Add grades modal state
  const [addGradesModalOpen, setAddGradesModalOpen] = useState(false);
  const [bulkSubject, setBulkSubject] = useState<string>("");
  const [bulkGradeType, setBulkGradeType] = useState<string>("");
  const [bulkDate, setBulkDate] = useState<string>(() => {
    const today = new Date();
    return `${today.getDate().toString().padStart(2, "0")}.${(today.getMonth() + 1).toString().padStart(2, "0")}.${today.getFullYear()}`;
  });
  const [studentGrades, setStudentGrades] = useState<Record<string, string>>({});
  // Individual settings per student
  const [studentSubjects, setStudentSubjects] = useState<Record<string, string>>({});
  const [studentGradeTypes, setStudentGradeTypes] = useState<Record<string, string>>({});
  const [studentDates, setStudentDates] = useState<Record<string, string>>({});
  const [studentComments, setStudentComments] = useState<Record<string, string>>({});
  const [openPopovers, setOpenPopovers] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  // Load students when modal opens
  const handleOpenAddGradesModal = () => {
    setAddGradesModalOpen(true);
    // Reset state when opening
    setStudentGrades({});
    setStudentSubjects({});
    setStudentGradeTypes({});
    setStudentDates({});
    setStudentComments({});
  };
  
  // Mutation for saving grades
  const bulkCreateGrades = useMutation(api.grades.bulkCreateGrades);
  const setTermGrade = useMutation(api.grades.setTermGrade);
  const updateTermGrade = useMutation(api.grades.updateTermGrade);
  const deleteTermGrade = useMutation(api.grades.deleteTermGrade);
  const updateGrade = useMutation(api.grades.updateGrade);
  const deleteGrade = useMutation(api.grades.deleteGrade);
  const bulkDeleteGrades = useMutation(api.grades.bulkDeleteGrades);
  
  // Handle toggle grade selection for bulk delete
  const handleToggleGradeSelection = (gradeId: Id<"grades">) => {
    setSelectedGradeIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(gradeId)) {
        newSet.delete(gradeId);
      } else {
        newSet.add(gradeId);
      }
      return newSet;
    });
  };
  
  // Handle bulk delete
  const handleBulkDeleteGrades = async () => {
    if (isSaving) return; // Prevent double-click
    if (selectedGradeIds.size === 0) {
      toast.error("Моля, изберете поне една оценка за изтриване");
      return;
    }
    
    if (!confirm(`Сигурни ли сте, че искате да изтриете ${selectedGradeIds.size} оценки?`)) {
      return;
    }
    
    try {
      setIsSaving(true);
      const deletedCount = await bulkDeleteGrades({
        gradeIds: Array.from(selectedGradeIds),
      });
      toast.success(`Успешно изтрити ${deletedCount} оценки!`);
      setSelectedGradeIds(new Set());
      setBulkDeleteMode(false);
    } catch (error) {
      console.error(error);
      toast.error("Грешка при изтриване на оценките");
    } finally {
      setIsSaving(false);
    }
  };
  
  // Exit bulk delete mode
  const handleExitBulkDeleteMode = () => {
    setBulkDeleteMode(false);
    setSelectedGradeIds(new Set());
  };
  
  const classData = useQuery(
    api.admin.getClassById,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  // Use subjects from both classSubjects table AND weekly schedule (real-time updates)
  const subjects = useQuery(
    api.weeklySchedules.getSubjectsForClass,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  // Auto-select first subject when subjects load and none is selected
  if (subjects && subjects.length > 0 && !selectedSubject) {
    setSelectedSubject(subjects[0].uniqueKey);
  }
  
  const teachers = useQuery(api.admin.listTeachersWithNames, {});

  const allStudents = useQuery(
    api.admin.getStudentsByClass,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  // Check if current user is a student
  const isCurrentUserStudent = currentUser?.roles?.includes("student");
  
  // Get current user's student record if they are a student
  const currentUserStudent = allStudents?.find(s => s.userId === currentUser?._id);
  
  // Get the viewed child's student record (for staff viewing their child)
  const viewedChildStudent = isStaffViewingChild && viewedChild
    ? allStudents?.find(s => s.userId === viewedChild.userId)
    : null;
  
  // Get IDs of parent's children in this class
  const parentChildrenInClass = parentChildren?.filter(c => c.classId === classId);
  const parentChildStudentIds = parentChildrenInClass?.map(c => c._id) || [];
  
  // Check if we should show single-student view (parent-like view)
  const isSingleStudentView = isCurrentUserStudent || isCurrentUserParent || isStaffViewingChild;
  
  // Filter students - show only current student if they are a student,
  // show only parent's children if they are a parent,
  // show only viewed child if staff viewing their child, otherwise show all
  const students = isCurrentUserStudent && currentUserStudent
    ? [currentUserStudent]
    : isStaffViewingChild && viewedChildStudent
    ? [viewedChildStudent]
    : isCurrentUserParent && parentChildStudentIds.length > 0
    ? allStudents?.filter(s => parentChildStudentIds.includes(s._id))
    : allStudents;
  
  // Get the selected subject object and its actual ID for API calls
  const selectedSubjectObj = subjects?.find((s) => s.uniqueKey === selectedSubject);
  const selectedSubjectId = selectedSubjectObj?._id;
  
  // Get grades for selected subject (for staff NOT viewing child)
  const grades = useQuery(
    api.grades.getGradesByClassAndSubject,
    classId && selectedSubjectId && !isCurrentUserStudent && !isCurrentUserParent && !isStaffViewingChild
      ? { classId: classId as Id<"classes">, subjectId: selectedSubjectId as Id<"subjects"> }
      : "skip"
  );
  
  // Get grades for parent's children or staff viewing child
  const parentGrades = useQuery(
    api.grades.getGradesByClassAndSubject,
    classId && selectedSubjectId && (isCurrentUserParent || isStaffViewingChild)
      ? { classId: classId as Id<"classes">, subjectId: selectedSubjectId as Id<"subjects"> }
      : "skip"
  );
  
  // Filter parent grades to only show their children or viewed child
  const filteredParentGrades = isStaffViewingChild && viewedChildStudent
    ? parentGrades?.filter(g => g.studentId === viewedChildStudent._id)
    : parentGrades?.filter(g => parentChildStudentIds.includes(g.studentId));
  
  // Use appropriate grades based on role
  const rawActiveGrades = (isCurrentUserParent || isStaffViewingChild) ? filteredParentGrades : grades;
  
  // Only filter by teacher when the same subject+preparationType has multiple teachers
  // This prevents hiding grades that were added by admins or substitute teachers
  const hasMultipleTeachersForSubject = selectedSubjectObj
    ? (subjects?.filter(s => 
        s._id === selectedSubjectObj._id && 
        s.preparationType === selectedSubjectObj.preparationType
      ).length ?? 0) > 1
    : false;
  
  const activeGrades = hasMultipleTeachersForSubject && selectedSubjectObj?.teacherId
    ? rawActiveGrades?.filter(g => g.teacherId === selectedSubjectObj.teacherId)
    : rawActiveGrades;
  
  // Get all grades for student/parent/staff viewing child
  const allGrades = useQuery(
    api.grades.getGradesByClass,
    classId && (isCurrentUserStudent || isCurrentUserParent || isStaffViewingChild)
      ? { classId: classId as Id<"classes"> }
      : "skip"
  );
  
  // Filter all grades for parent's children or viewed child
  const filteredAllGrades = isStaffViewingChild && viewedChildStudent
    ? allGrades?.filter(g => g.studentId === viewedChildStudent._id)
    : isCurrentUserParent 
    ? allGrades?.filter(g => parentChildStudentIds.includes(g.studentId))
    : allGrades;
  
  // Get teacher data
  const teacherData = currentUser && teachers 
    ? teachers.find(t => t.userId === currentUser._id)
    : undefined;
  
  // Check if user is admin
  const isAdmin = currentUser?.roles?.includes("director") || 
                  currentUser?.roles?.includes("vice_director") ||
                  currentUser?.roles?.includes("system_admin");
  
  // Check if user is PURE pedagogical counselor (can only add student support, not grades/reviews/absences)
  // If they also have teacher role, they can add grades/reviews/absences for subjects they teach
  const isPurePedagogicalCounselor = currentUser?.roles?.includes("pedagogical_counselor") &&
    !currentUser?.roles?.includes("teacher") &&
    !currentUser?.roles?.includes("class_teacher") &&
    !isAdmin;
  
  // Filter subjects based on teacher for THIS specific class
  // Admin sees all subjects, teachers only see subjects they teach in this class
  const availableSubjects = isAdmin 
    ? subjects 
    : subjects?.filter(s => s.teacherUserId === currentUser?._id);

  // Check if ВЧК should be shown
  const showVCK = platformSettings?.showSecondClassHour ?? true;

  // Query string to append for student-specific view
  const studentQueryStr = studentIdFromUrl ? `?studentId=${studentIdFromUrl}` : '';

  const stats = [
    { label: "Оц.", link: `/bg/diary/class/${classId}/grades${studentQueryStr}` },
    { label: "Отс.", link: `/bg/diary/class/${classId}/absences${studentQueryStr}` },
    { label: "Отз.", link: `/bg/diary/class/${classId}/reviews${studentQueryStr}` },
    { label: "Раз.", link: `/bg/diary/class/${classId}/schedule${studentQueryStr}` },
    { label: "Тем.", link: `/bg/diary/class/${classId}/topics${studentQueryStr}` },
    { label: "Кон.", link: `/bg/diary/class/${classId}/tests${studentQueryStr}` },
    { label: "Дом.", link: `/bg/diary/class/${classId}/homework${studentQueryStr}` },
    ...(showVCK ? [{ label: "ВЧК", link: `/bg/diary/class/${classId}/internal-commission${studentQueryStr}` }] : []),
    { label: "Род.", link: `/bg/diary/class/${classId}/parent-meetings${studentQueryStr}` },
    { label: "Поп.", link: `/bg/diary/class/${classId}/remedial-exams${studentQueryStr}` },
    { label: "Под.", link: `/bg/diary/class/${classId}/student-support${studentQueryStr}` },
    { label: "Сан.", link: `/bg/diary/class/${classId}/sanctions${studentQueryStr}` },
    { label: "Год.", link: `/bg/diary/class/${classId}/annual-results${studentQueryStr}` },
    { label: "Уч.", link: `/bg/diary/class/${classId}/students${studentQueryStr}` },
  ];
  
  // Grade color helper
  const getGradeButtonColor = (grade: number) => {
    if (grade === 2) return "bg-red-500 hover:bg-red-600 text-white";
    if (grade === 3) return "bg-orange-500 hover:bg-orange-600 text-white";
    if (grade === 4) return "bg-yellow-500 hover:bg-yellow-600 text-white";
    if (grade === 5) return "bg-lime-500 hover:bg-lime-600 text-white";
    if (grade === 6) return "bg-green-600 hover:bg-green-700 text-white";
    return "";
  };
  
  // Grade box color helper (for displaying grades)
  const getGradeBoxColor = (value: number | "absent", isFinalized?: boolean, isTermGrade?: boolean) => {
    // Term grades without finalization have no color
    if (isTermGrade && !isFinalized) return "bg-gray-200 dark:bg-gray-700 text-foreground";
    
    if (value === "absent") return "bg-gray-500";
    if (typeof value === "number") {
      // Use floor for color determination to match display (2.67 → 2 = red, 3.49 → 3 = orange)
      const floored = Math.floor(value);
      if (floored <= 2) return "bg-red-500";
      if (floored === 3) return "bg-orange-500";
      if (floored === 4) return "bg-yellow-500";
      if (floored === 5) return "bg-blue-500";
      if (floored >= 6) return "bg-green-600";
    }
    return "bg-gray-500";
  };
  
  // Round grade for display - always floor to show base grade (2.67 → 2, 3.83 → 3)
  const roundGradeForDisplay = (value: number): number => {
    return Math.floor(value);
  };
  
  // Get class grade level (1-12) from class name (e.g., "1а" -> 1, "10б" -> 10)
  const getClassGradeLevel = (className: string): number => {
    const match = className.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  // Check if class is lower grades (1-3) - show emojis instead of numbers
  const isLowerGrades = classData ? getClassGradeLevel(classData.name) <= 3 : false;

  // Get emoji for lower grades (1-3)
  const getGradeEmoji = (value: number): string => {
    switch (Math.floor(value)) {
      case 2: return "😢";
      case 3: return "😐";
      case 4: return "🙂";
      case 5: return "💙";
      case 6: return "⭐";
      default: return value.toString();
    }
  };

  // Format grade for display in table (show emoji for 1-3 class, rounded integer for others)
  const formatGradeDisplay = (value: number | "absent"): string => {
    if (value === "absent") return "О";
    if (typeof value === "number") {
      if (isLowerGrades) return getGradeEmoji(value);
      return roundGradeForDisplay(value).toString();
    }
    return String(value);
  };
  
  // Shorten subject name helper
  const shortenSubjectName = (name: string) => {
    // Common abbreviations for Bulgarian subjects
    const abbreviations: Record<string, string> = {
      "Български език и литература": "БЕЛ",
      "Български език": "БЕ",
      "Литература": "Лит.",
      "Математика": "Мат.",
      "Английски език": "АЕ",
      "Немски език": "НЕ",
      "Френски език": "ФЕ",
      "Руски език": "РЕ",
      "Испански език": "ИспЕ",
      "Италиански език": "ИтЕ",
      "История и цивилизации": "ИЦ",
      "История": "Ист.",
      "География и икономика": "ГИ",
      "География": "Геогр.",
      "Биология и здравно образование": "БЗО",
      "Биология": "Био.",
      "Физика и астрономия": "ФА",
      "Физика": "Физ.",
      "Химия и опазване на околната среда": "ХООС",
      "Химия": "Хим.",
      "Информационни технологии": "ИТ",
      "Информатика": "Инф.",
      "Изобразително изкуство": "ИИ",
      "Музика": "Муз.",
      "Технологии и предприемачество": "ТП",
      "Физическо възпитание и спорт": "ФВС",
      "Гражданско образование": "ГО",
      "Философия": "Фил.",
      "Психология и логика": "ПЛ",
      "Етика и право": "ЕП",
      "Свят и личност": "СЛ",
      "Човекът и природата": "ЧП",
      "Човекът и обществото": "ЧО",
      "Родинознание": "Род.",
      "Домашна техника и икономика": "ДТИ",
      "Компютърно моделиране": "КМ",
    };
    
    // Check for exact match
    if (abbreviations[name]) return abbreviations[name];
    
    // Check if name contains a known subject
    for (const [full, abbr] of Object.entries(abbreviations)) {
      if (name.includes(full)) {
        return name.replace(full, abbr);
      }
    }
    
    // Fallback: take first letters of each word or truncate
    if (name.length > 12) {
      const words = name.split(" ");
      if (words.length >= 2) {
        return words.map(w => w.charAt(0).toUpperCase()).join("");
      }
      return name.substring(0, 10) + ".";
    }
    
    return name;
  };
  
  // Handle quick grade button click
  const handleQuickGrade = (studentId: string, grade: number) => {
    setStudentGrades(prev => ({ ...prev, [studentId]: grade.toString() }));
  };
  
  // Handle manual grade input
  const handleManualGrade = (studentId: string, value: string) => {
    // Allow empty or valid grade values (2-6 with decimals)
    if (value === "" || (/^\d*\.?\d*$/.test(value) && parseFloat(value) >= 2 && parseFloat(value) <= 6)) {
      setStudentGrades(prev => ({ ...prev, [studentId]: value }));
    }
  };
  
  // Handle opening term grade modal
  const handleOpenTermGradeModal = (studentId: string, existingGrade?: { _id: Id<"grades">; value: number | "absent"; isFinalized?: boolean }, term: 1 | 2 = 1, calculatedAvg?: number) => {
    setTermGradeStudentId(studentId);
    setTermNumber(term);
    if (existingGrade) {
      setEditingTermGradeId(existingGrade._id);
      setTermGradeValue(typeof existingGrade.value === "number" ? existingGrade.value.toString() : "");
    } else {
      setEditingTermGradeId(null);
      // Pre-fill with calculated average if available
      setTermGradeValue(calculatedAvg !== undefined ? calculatedAvg.toFixed(2) : "");
    }
    setTermGradeModalOpen(true);
  };
  
  // Handle save term grade
  const handleSaveTermGrade = async () => {
    if (isSaving) return; // Prevent double-click
    if (!termGradeStudentId || !termGradeValue || !selectedSubjectId || !classId) {
      toast.error("Моля, въведете оценка");
      return;
    }
    
    const value = parseFloat(termGradeValue);
    if (isNaN(value) || value < 2 || value > 6) {
      toast.error("Оценката трябва да е между 2 и 6");
      return;
    }
    
    try {
      setIsSaving(true);
      if (editingTermGradeId) {
        await updateTermGrade({
          gradeId: editingTermGradeId,
          value: value,
          isFinalized: true,
        });
        toast.success("Срочната оценка е обновена!");
      } else {
        await setTermGrade({
          studentId: termGradeStudentId as Id<"students">,
          classId: classId as Id<"classes">,
          subjectId: selectedSubjectId as Id<"subjects">,
          teacherId: teacherData?._id as Id<"teachers">,
          value: value,
          termNumber: termNumber,
          isFinalized: true,
        });
        toast.success("Срочната оценка е записана!");
      }
      setTermGradeModalOpen(false);
      setTermGradeStudentId(null);
      setTermGradeValue("");
      setEditingTermGradeId(null);
    } catch (error) {
      console.error(error);
      toast.error("Грешка при запазване на оценката");
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle delete term grade
  const handleDeleteTermGrade = async (gradeId: Id<"grades">) => {
    try {
      await deleteTermGrade({ gradeId });
      toast.success("Срочната оценка е изтрита!");
      setTermGradeModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Грешка при изтриване на оценката");
    }
  };
  
  // Handle open edit grade modal
  const handleOpenEditGradeModal = (grade: { _id: Id<"grades">; value: number | "absent"; gradeType?: string; notes?: string; date: number }) => {
    setEditingGradeId(grade._id);
    setEditGradeValue(typeof grade.value === "number" ? grade.value.toString() : "");
    setEditGradeType(grade.gradeType || "");
    setEditGradeNotes(grade.notes || "");
    setEditGradeDate(format(new Date(grade.date), "dd.MM.yyyy"));
    setEditGradeModalOpen(true);
    setExpandedGrade(null);
    setExpandedStudentId(null);
  };
  
  // Handle save edited grade
  const handleSaveEditedGrade = async () => {
    if (isSaving) return; // Prevent double-click
    if (!editingGradeId || !editGradeValue) {
      toast.error("Моля, въведете оценка");
      return;
    }
    
    const value = parseFloat(editGradeValue);
    if (isNaN(value) || value < 2 || value > 6) {
      toast.error("Оценката трябва да е между 2 и 6");
      return;
    }
    
    try {
      setIsSaving(true);
      await updateGrade({
        id: editingGradeId,
        value: value,
        notes: editGradeNotes || undefined,
      });
      toast.success("Оценката е обновена!");
      setEditGradeModalOpen(false);
      setEditingGradeId(null);
    } catch (error) {
      console.error(error);
      toast.error("Грешка при обновяване на оценката");
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle delete grade
  const handleDeleteGrade = async () => {
    if (isSaving) return; // Prevent double-click
    if (!editingGradeId) return;
    
    // For non-admin users, show the reason dialog
    if (!isAdmin) {
      setDeleteReasonDialogOpen(true);
      return;
    }
    
    if (!confirm("Сигурни ли сте, че искате да изтриете тази оценка?")) {
      return;
    }
    
    try {
      setIsSaving(true);
      await deleteGrade({ id: editingGradeId });
      toast.success("Оценката е изтрита!");
      setEditGradeModalOpen(false);
      setEditingGradeId(null);
    } catch (error) {
      console.error(error);
      toast.error("Грешка при изтриване на оценката");
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle confirm delete with reason (for non-admin users)
  const handleConfirmDeleteWithReason = async () => {
    if (isSaving) return; // Prevent double-click
    if (!editingGradeId) return;
    
    if (!deleteReason.trim()) {
      toast.error("Моля, въведете причина за изтриване");
      return;
    }
    
    try {
      setIsSaving(true);
      await deleteGrade({ id: editingGradeId, reason: deleteReason.trim() });
      toast.success("Заявката за изтриване е изпратена за одобрение");
      setDeleteReasonDialogOpen(false);
      setEditGradeModalOpen(false);
      setEditingGradeId(null);
      setDeleteReason("");
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "Грешка при изпращане на заявката";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle save grades
  const handleSaveGrades = async () => {
    if (isSaving) return; // Prevent double-click
    
    // Filter out students with missing data
    const validGrades = Object.entries(studentGrades)
      .filter(([studentId, value]) => {
        const subject = studentSubjects[studentId] || bulkSubject;
        const gradeType = studentGradeTypes[studentId] || bulkGradeType;
        const date = studentDates[studentId] || bulkDate;
        return value && value.trim() !== "" && subject && gradeType && date;
      })
      .map(([studentId, value]) => ({
        studentId: studentId as Id<"students">,
        value: parseFloat(value),
        subjectId: (studentSubjects[studentId] || bulkSubject) as Id<"subjects">,
        gradeType: studentGradeTypes[studentId] || bulkGradeType,
        date: studentDates[studentId] || bulkDate,
        comment: studentComments[studentId] || "",
      }));
    
    if (validGrades.length === 0) {
      toast.error("Моля, въведете поне една оценка с предмет, тип и дата");
      return;
    }
    
    if (!teacherData && !isAdmin) {
      toast.error("Не сте оторизиран да поставяте оценки");
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Parse dates and group grades by (subjectId, gradeType, date, comment)
      // so we send one backend call per group instead of one per student
      const groups: Record<string, {
        subjectId: Id<"subjects">;
        gradeType: string;
        dateTimestamp: number;
        comment: string;
        students: Array<{ studentId: Id<"students">; value: number }>;
      }> = {};
      
      for (const gradeData of validGrades) {
        const dateParts = gradeData.date.split(".");
        if (dateParts.length !== 3) {
          toast.error(`Невалиден формат на дата: ${gradeData.date}. Използвайте ДД.ММ.ГГГГ`);
          setIsSaving(false);
          return;
        }
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const year = parseInt(dateParts[2], 10);
        const dateTimestamp = Date.UTC(year, month, day, 0, 0, 0, 0);
        
        const groupKey = `${gradeData.subjectId}|${gradeData.gradeType}|${dateTimestamp}|${gradeData.comment}`;
        
        if (!groups[groupKey]) {
          groups[groupKey] = {
            subjectId: gradeData.subjectId,
            gradeType: gradeData.gradeType,
            dateTimestamp,
            comment: gradeData.comment,
            students: [],
          };
        }
        groups[groupKey].students.push({
          studentId: gradeData.studentId,
          value: gradeData.value,
        });
      }
      
      // Send all groups in parallel (typically just one group when bulk settings are shared)
      await Promise.all(
        Object.values(groups).map((group) =>
          bulkCreateGrades({
            classId: classId as Id<"classes">,
            subjectId: group.subjectId,
            teacherId: teacherData?._id as Id<"teachers">,
            gradeType: group.gradeType,
            date: group.dateTimestamp,
            comment: group.comment || undefined,
            studentGrades: group.students,
          })
        )
      );
      
      toast.success(`Успешно добавени ${validGrades.length} оценки!`);
      setAddGradesModalOpen(false);
      
      // Reset form
      setBulkSubject("");
      setBulkGradeType("");
      setStudentGrades({});
      setStudentSubjects({});
      setStudentGradeTypes({});
      setStudentDates({});
      setStudentComments({});
    } catch (error) {
      console.error(error);
      toast.error("Грешка при запазване на оценките");
    } finally {
      setIsSaving(false);
    }
  };

  if (!classData || !students) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const classTeacher = classData.classTeacher;

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
                <>
                  <UserNameLink
                    userId={classTeacher._id}
                    firstName={classTeacher.firstName}
                    lastName={classTeacher.lastName}
                  /> (класен)
                </>
              ) : (
                "Без класен ръководител"
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {!isSingleStudentView && (
              <>
                {bulkDeleteMode ? (
                  <>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={handleBulkDeleteGrades}
                      disabled={selectedGradeIds.size === 0 || isSaving}
                    >
                      <Trash2Icon className="h-4 w-4 mr-2" />
                      Изтрий ({selectedGradeIds.size})
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleExitBulkDeleteMode}
                    >
                      <XIcon className="h-4 w-4 mr-2" />
                      Отказ
                    </Button>
                  </>
                ) : (
                  <>
                    {!isPurePedagogicalCounselor && (
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={handleOpenAddGradesModal}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Добави
                      </Button>
                    )}
                    {isAdmin && (
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => setBulkDeleteMode(true)}
                      >
                        <Trash2Icon className="h-4 w-4 mr-2" />
                        Изтрий
                      </Button>
                    )}
                  </>
                )}
              </>
            )}
            <Button variant="outline" size="sm">
              <FilterIcon className="h-4 w-4 mr-2" />
              Филтри
            </Button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-2 px-6 py-2 border-t overflow-x-auto">
          {stats.map((stat, index) => {
            const isActive = location.pathname.endsWith(stat.link.split('/').pop() || '');
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
      <div className="flex flex-1 overflow-hidden">
        {/* Student/Parent/Staff-Viewing-Child Layout - Enhanced Table like Teacher View */}
        {isSingleStudentView ? (
          <div className="flex-1 overflow-y-auto p-2 sm:p-6">
            <Card className="p-3 sm:p-6">
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h2 className="text-sm sm:text-lg font-semibold">
                  {isStaffViewingChild && viewedChild
                    ? `Оценки на ${viewedChild.name}`
                    : isCurrentUserParent 
                    ? `Оценки на ${parentChildrenInClass?.map(c => c.name).join(", ") || "детето"}` 
                    : "Моите оценки"}
                </h2>
                
                {/* Term selector for parent/student view */}
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTermPanelOpen(!termPanelOpen)}
                    className="flex items-center gap-1 text-xs h-7"
                  >
                    <SettingsIcon className="h-3 w-3" />
                    {selectedView === "term1" && "Първи срок"}
                    {selectedView === "term2" && "Втори срок"}
                    {selectedView === "yearly" && "Годишна"}
                    <ChevronDownIcon className={cn("h-3 w-3 transition-transform", termPanelOpen && "rotate-180")} />
                  </Button>
                  
                  {/* Term selector dropdown */}
                  {termPanelOpen && (
                    <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-popover border rounded-lg shadow-lg p-1.5 space-y-0.5">
                      <button
                        onClick={() => { setSelectedView("term1"); setTermPanelOpen(false); }}
                        className={cn(
                          "w-full text-left px-2 py-1.5 text-xs rounded transition-colors",
                          selectedView === "term1" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                        )}
                      >
                        Първи срок
                      </button>
                      <button
                        onClick={() => { setSelectedView("term2"); setTermPanelOpen(false); }}
                        className={cn(
                          "w-full text-left px-2 py-1.5 text-xs rounded transition-colors",
                          selectedView === "term2" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                        )}
                      >
                        Втори срок
                      </button>
                      <button
                        onClick={() => { setSelectedView("yearly"); setTermPanelOpen(false); }}
                        className={cn(
                          "w-full text-left px-2 py-1.5 text-xs rounded transition-colors",
                          selectedView === "yearly" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                        )}
                      >
                        Годишна
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* All subjects with grades in one table */}
              <div className="overflow-x-auto">
                <table className="w-full border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left py-1.5 px-2 text-xs sm:text-sm font-medium border w-28 sm:w-auto">Предмет</th>
                      <th className="text-center py-1.5 px-2 text-xs sm:text-sm font-medium border">Текущи</th>
                      <th className="text-center py-1.5 px-2 text-xs sm:text-sm font-medium border w-20 sm:w-24">Срочна</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects?.map((subject) => {
                      // Get grades for this subject, filtered by teacher when available
                      const subjectGrades = filteredAllGrades?.filter(g => 
                        g.subjectId === subject._id && 
                        // Filter by teacher when subject has a specific teacher
                        (!subject.teacherId || g.teacherId === subject.teacherId) &&
                        (isCurrentUserStudent 
                          ? g.studentId === currentUserStudent?._id
                          : isStaffViewingChild && viewedChildStudent
                          ? g.studentId === viewedChildStudent._id
                          : parentChildStudentIds.includes(g.studentId))
                      );
                      
                      // Month filter based on selected view
                      // JavaScript months: 0=Jan, 1=Feb, ..., 7=Aug, 8=Sept, 11=Dec
                      // Bulgarian school year:
                      // - First term (Първи срок): September(8) to January(0)
                      // - Second term (Втори срок): February(1) to June(5)
                      const getMonthFilter = () => {
                        if (selectedView === "term1") {
                          return (m: number) => m >= 8 || m === 0; // Sept-Jan (8,9,10,11,0)
                        } else if (selectedView === "term2") {
                          return (m: number) => m >= 1 && m <= 5; // Feb-June (1,2,3,4,5)
                        } else {
                          return () => true; // Yearly - all months
                        }
                      };
                      const monthFilter = getMonthFilter();
                      
                      // Filter grades by term
                      const currentGrades = subjectGrades?.filter(g => 
                        g.type === "current" && monthFilter(new Date(g.date).getMonth())
                      ) || [];
                      
                      // Get term grade
                      const termGrade = subjectGrades?.find(g => 
                        g.type === "term" && monthFilter(new Date(g.date).getMonth())
                      );
                      
                      // Calculate average for this subject
                      const numericCurrentGrades = currentGrades
                        .map(g => g.value)
                        .filter((v): v is number => typeof v === "number");
                      
                      const subjectAverage = numericCurrentGrades.length > 0
                        ? numericCurrentGrades.reduce((sum, val) => sum + val, 0) / numericCurrentGrades.length
                        : null;
                      
                      return (
                        <>
                          <tr key={subject._id} className="border-b hover:bg-muted/50">
                            <td className="py-0.5 px-1 sm:py-1 sm:px-2 text-[10px] sm:text-sm font-medium border align-middle">
                              {subject.displayName || subject.name}
                            </td>
                            <td className="py-0.5 px-1 sm:py-1 sm:px-2 border">
                              <div className="flex flex-wrap gap-0.5 justify-center">
                                {currentGrades.length > 0 ? (
                                  currentGrades.map((g) => (
                                    <button
                                      key={g._id}
                                      onClick={() => setExpandedGrade(expandedGrade === g._id ? null : g._id)}
                                      title={typeof g.value === "number" ? g.value.toFixed(2) : String(g.value)}
                                      className={cn(
                                        "w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center flex-shrink-0 font-bold text-white text-[9px] sm:text-[10px] shadow-sm hover:shadow-md transition-all",
                                        getGradeBoxColor(g.value),
                                        expandedGrade === g._id && "ring-2 ring-offset-1 ring-primary"
                                      )}
                                    >
                                      {formatGradeDisplay(g.value)}
                                    </button>
                                  ))
                                ) : (
                                  <span className="text-[10px] sm:text-xs text-muted-foreground">—</span>
                                )}
                              </div>
                            </td>
                            <td className="py-0.5 px-1 sm:py-1 sm:px-2 border text-center">
                              {/* Show finalized term grade if available - rounded to whole number */}
                              {termGrade && termGrade.isFinalized ? (
                                <button
                                  onClick={() => setExpandedGrade(expandedGrade === termGrade._id ? null : termGrade._id)}
                                  title={typeof termGrade.value === "number" ? termGrade.value.toFixed(2) : String(termGrade.value)}
                                  className={cn(
                                    "min-w-6 h-5 sm:h-6 px-1.5 rounded inline-flex items-center justify-center font-bold text-white text-[9px] sm:text-[10px] shadow-sm hover:shadow-md transition-all",
                                    getGradeBoxColor(termGrade.value),
                                    expandedGrade === termGrade._id && "ring-2 ring-offset-1 ring-primary"
                                  )}
                                >
                                  {typeof termGrade.value === "number" 
                                    ? (isLowerGrades ? getGradeEmoji(termGrade.value) : Math.round(termGrade.value)) 
                                    : termGrade.value}
                                </button>
                              ) : termGrade && !termGrade.isFinalized ? (
                                /* Show unfinalized term grade - with decimals */
                                <span 
                                  className="inline-flex items-center justify-center min-w-6 h-5 sm:h-6 px-1.5 rounded bg-muted text-foreground text-[9px] sm:text-[10px] font-medium border border-dashed"
                                  title={typeof termGrade.value === "number" ? termGrade.value.toFixed(2) : String(termGrade.value)}
                                >
                                  {typeof termGrade.value === "number" ? termGrade.value.toFixed(2) : termGrade.value}
                                </span>
                              ) : subjectAverage !== null ? (
                                /* No term grade - show calculated average */
                                <span 
                                  className={cn(
                                    "inline-flex items-center justify-center min-w-6 h-5 sm:h-6 px-1.5 rounded text-[9px] sm:text-[10px] font-bold",
                                    Math.floor(subjectAverage) <= 2 && "text-red-500",
                                    Math.floor(subjectAverage) === 3 && "text-orange-500",
                                    Math.floor(subjectAverage) === 4 && "text-yellow-600 dark:text-yellow-400",
                                    Math.floor(subjectAverage) === 5 && "text-blue-500",
                                    Math.floor(subjectAverage) >= 6 && "text-green-600 dark:text-green-400"
                                  )}
                                  title={`Средна: ${subjectAverage.toFixed(2)}`}
                                >
                                  {subjectAverage.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-[10px] sm:text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                          
                          {/* Show grade details below the row when expanded */}
                          {expandedGrade && subjectGrades?.find(g => g._id === expandedGrade) && (
                            <tr>
                              <td colSpan={3} className="p-3 bg-muted/30 border">
                                {(() => {
                                  const g = subjectGrades.find(gr => gr._id === expandedGrade);
                                  if (!g) return null;
                                  return (
                                    <div className="space-y-2 text-xs sm:text-sm">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">Оценка:</span>
                                        <span className={cn(
                                          "font-bold",
                                          typeof g.value === "number" && Math.floor(g.value) <= 2 && "text-red-500",
                                          typeof g.value === "number" && Math.floor(g.value) === 3 && "text-orange-500",
                                          typeof g.value === "number" && Math.floor(g.value) === 4 && "text-yellow-600",
                                          typeof g.value === "number" && Math.floor(g.value) === 5 && "text-blue-600",
                                          typeof g.value === "number" && Math.floor(g.value) >= 6 && "text-green-600"
                                        )}>
                                          {g.value === "absent" ? "Отсъстващ" : typeof g.value === "number" ? g.value.toFixed(2) : g.value}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">Тип:</span>
                                        <span>{g.type === "term" ? "Срочна оценка" : (g.gradeType || "Текуща оценка")}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">Учител:</span>
                                        <span>
                                          {(() => {
                                            const teacher = teachers?.find(t => t._id === g.teacherId);
                                            return teacher ? teacher.name : "Неизвестен";
                                          })()}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">Дата:</span>
                                        <span>{format(new Date(g.date), "dd.MM.yyyy", { locale: bg })}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">Час:</span>
                                        <span>{format(new Date(g._creationTime), "HH:mm", { locale: bg })}</span>
                                      </div>
                                      {g.notes && (
                                        <div className="flex items-start gap-2">
                                          <span className="font-medium">Забележка:</span>
                                          <span>{g.notes}</span>
                                        </div>
                                      )}
                                      <div className="pt-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setExpandedGrade(null)}
                                          className="w-full"
                                        >
                                          Затвори
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Overall average across all subjects */}
              <div className="mt-6 pt-4 border-t">
                <p className="text-center text-sm text-muted-foreground font-medium">
                  Обща средна оценка по всички предмети
                </p>
                {(() => {
                  // Get student IDs
                  const studentIds = isCurrentUserStudent && currentUserStudent
                    ? [currentUserStudent._id]
                    : isStaffViewingChild && viewedChildStudent
                    ? [viewedChildStudent._id]
                    : parentChildStudentIds;
                  
                  // Calculate overall average from ALL current grades across all subjects
                  // (no term filtering - shows total average)
                  const allCurrentGrades = filteredAllGrades?.filter(g => 
                    g.type === "current" && 
                    studentIds.includes(g.studentId)
                  ) || [];
                  
                  const numericGrades = allCurrentGrades
                    .map(g => g.value)
                    .filter((v): v is number => typeof v === "number");
                  
                  if (numericGrades.length === 0) {
                    return (
                      <p className="text-center text-lg font-semibold text-muted-foreground mt-2">
                        Няма оценки
                      </p>
                    );
                  }
                  
                  const overallAverage = numericGrades.reduce((sum, val) => sum + val, 0) / numericGrades.length;
                  
                  // Color based on average
                  const getAverageColor = (avg: number) => {
                    const r = Math.floor(avg);
                    if (r <= 2) return "text-red-500";
                    if (r === 3) return "text-orange-500";
                    if (r === 4) return "text-yellow-600 dark:text-yellow-400";
                    if (r === 5) return "text-blue-500";
                    return "text-green-600 dark:text-green-400";
                  };
                  
                  return (
                    <div className="text-center mt-2">
                      <span className={cn("text-2xl font-bold", getAverageColor(overallAverage))}>
                        {overallAverage.toFixed(2)}
                      </span>
                      <span className="text-sm text-muted-foreground ml-2">
                        (от {numericGrades.length} {numericGrades.length === 1 ? "оценка" : "оценки"})
                      </span>
                    </div>
                  );
                })()}
              </div>
            </Card>
          </div>
        ) : (
          <>
            {/* Teacher/Admin Layout - Original Split View */}
            {/* Left Sidebar - Subjects (Full names) */}
            <div className={cn(
              "border-r bg-background overflow-y-auto flex-shrink-0",
              isMobile ? "w-28" : "w-48"
            )}>
              <div className="p-1 space-y-0.5">
                {subjects?.map((subject, index) => (
                  <button
                    key={subject.uniqueKey}
                    onClick={() => setSelectedSubject(subject.uniqueKey)}
                    title={subject.displayName || subject.name}
                    className={cn(
                      "w-full flex items-center gap-1 px-1.5 py-1.5 text-[10px] rounded transition-colors",
                      selectedSubject === subject.uniqueKey
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted text-foreground"
                    )}
                  >
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full flex-shrink-0",
                      selectedSubject === subject.uniqueKey ? "bg-primary" : "bg-muted-foreground/50"
                    )} />
                    <span className="text-left truncate leading-tight">{subject.displayName || subject.name}</span>
                  </button>
                ))}
              </div>
            </div>

        {/* Center Content - Students Table */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-4">
          {selectedSubject ? (
            <Card className="p-2 sm:p-4">
              <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-xs sm:text-sm font-semibold">
                  {selectedSubjectObj?.displayName || selectedSubjectObj?.name || "Предмет"}{" "}
                  {selectedSubjectObj?.teacherUserId && selectedSubjectObj?.teacherName && (
                    <>
                      -{" "}
                      <UserNameLink
                        userId={selectedSubjectObj.teacherUserId}
                        firstName={selectedSubjectObj.teacherName.split(" ")[0] || ""}
                        lastName={selectedSubjectObj.teacherName.split(" ").slice(1).join(" ") || ""}
                      />
                    </>
                  )}
                </h2>
                
                {/* Term selector button */}
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTermPanelOpen(!termPanelOpen)}
                    className="flex items-center gap-1 text-xs h-7"
                  >
                    <SettingsIcon className="h-3 w-3" />
                    {selectedView === "term1" && "I срок"}
                    {selectedView === "term2" && "II срок"}
                    {selectedView === "yearly" && "Годишна"}
                    <ChevronDownIcon className={cn("h-3 w-3 transition-transform", termPanelOpen && "rotate-180")} />
                  </Button>
                  
                  {/* Term selector dropdown */}
                  {termPanelOpen && (
                    <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-popover border rounded-lg shadow-lg p-1.5 space-y-0.5">
                      <button
                        onClick={() => { setSelectedView("term1"); setTermPanelOpen(false); }}
                        className={cn(
                          "w-full text-left px-2 py-1.5 text-xs rounded transition-colors",
                          selectedView === "term1" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                        )}
                      >
                        Първи срок
                      </button>
                      <button
                        onClick={() => { setSelectedView("term2"); setTermPanelOpen(false); }}
                        className={cn(
                          "w-full text-left px-2 py-1.5 text-xs rounded transition-colors",
                          selectedView === "term2" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                        )}
                      >
                        Втори срок
                      </button>
                      <button
                        onClick={() => { setSelectedView("yearly"); setTermPanelOpen(false); }}
                        className={cn(
                          "w-full text-left px-2 py-1.5 text-xs rounded transition-colors",
                          selectedView === "yearly" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                        )}
                      >
                        Годишна
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Mobile view selector dropdown - now always hidden since we have the button above */}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      {!isCurrentUserStudent && (
                        <>
                          <th className="text-left py-1.5 px-2 text-xs font-medium text-muted-foreground">
                            №
                          </th>
                          <th className="text-left py-1.5 px-2 text-xs font-medium text-muted-foreground">
                            Ученик
                          </th>
                        </>
                      )}
                      
                      {/* Term 1 columns */}
                      {(selectedView === "term1" || selectedView === "yearly") && (
                        <th className="text-center py-1.5 px-2 text-xs font-medium text-muted-foreground border-l">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setTerm1Expanded(!term1Expanded)}
                              className="flex items-center gap-1 hover:text-foreground"
                            >
                              {term1Expanded ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
                              Първи срок
                            </button>
                          </div>
                        </th>
                      )}
                      
                      {/* Term 2 columns */}
                      {(selectedView === "term2" || selectedView === "yearly") && (
                        <th className="text-center py-1.5 px-2 text-xs font-medium text-muted-foreground border-l">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setTerm2Expanded(!term2Expanded)}
                              className="flex items-center gap-1 hover:text-foreground"
                            >
                              {term2Expanded ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
                              Втори срок
                            </button>
                          </div>
                        </th>
                      )}
                      
                      {/* Yearly column */}
                      {selectedView === "yearly" && (
                        <th className="text-center py-1.5 px-2 text-xs font-medium text-muted-foreground border-l">
                          Годишна
                        </th>
                      )}
                    </tr>
                    
                    {/* Subheadings row for expanded terms */}
                    {(term1Expanded || term2Expanded) && (
                      <tr className="border-b bg-muted/30">
                        {!isCurrentUserStudent && (
                          <>
                            <th></th>
                            <th></th>
                          </>
                        )}
                        
                        {(selectedView === "term1" || selectedView === "yearly") && term1Expanded && (
                          <th className="border-l">
                            <div className="flex">
                              <div className="flex-1 text-center py-1 px-1 text-[10px] font-medium text-muted-foreground border-r">
                                Текущи
                              </div>
                              <div className="flex-1 text-center py-1 px-1 text-[10px] font-medium text-muted-foreground">
                                Срочна
                              </div>
                            </div>
                          </th>
                        )}
                        
                        {(selectedView === "term2" || selectedView === "yearly") && term2Expanded && (
                          <th className="border-l">
                            <div className="flex">
                              <div className="flex-1 text-center py-1 px-1 text-[10px] font-medium text-muted-foreground border-r">
                                Текущи
                              </div>
                              <div className="flex-1 text-center py-1 px-1 text-[10px] font-medium text-muted-foreground">
                                Срочна
                              </div>
                            </div>
                          </th>
                        )}
                        
                        {selectedView === "yearly" && <th></th>}
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {students?.map((student, index) => {
                      // Get all grades for this student
                      const studentAllGrades = activeGrades?.filter(g => g.studentId === student._id) || [];
                      const selectedGrade = expandedGrade && expandedStudentId === student._id 
                        ? studentAllGrades.find(g => g._id === expandedGrade) 
                        : null;
                      
                      // Helper to handle grade click
                      const handleGradeClick = (gradeId: Id<"grades">) => {
                        if (expandedGrade === gradeId && expandedStudentId === student._id) {
                          setExpandedGrade(null);
                          setExpandedStudentId(null);
                        } else {
                          setExpandedGrade(gradeId);
                          setExpandedStudentId(student._id);
                        }
                      };
                      
                      // Render grade button (for current grades)
                      const renderGradeButton = (g: typeof studentAllGrades[0]) => (
                        <div key={g._id} className="relative">
                          {bulkDeleteMode && (
                            <Checkbox
                              checked={selectedGradeIds.has(g._id)}
                              onCheckedChange={() => handleToggleGradeSelection(g._id)}
                              className="absolute -top-1 -left-1 z-10 h-3 w-3 bg-white border-primary"
                            />
                          )}
                          <button
                            onClick={() => bulkDeleteMode ? handleToggleGradeSelection(g._id) : handleGradeClick(g._id)}
                            className={cn(
                              "w-5 h-5 sm:w-6 sm:h-6 rounded flex items-center justify-center flex-shrink-0 font-bold text-white text-[9px] sm:text-[10px] shadow-sm hover:shadow-md transition-all",
                              getGradeBoxColor(g.value),
                              expandedGrade === g._id && !bulkDeleteMode && "ring-2 ring-offset-1 ring-primary",
                              bulkDeleteMode && selectedGradeIds.has(g._id) && "ring-2 ring-offset-1 ring-red-500"
                            )}
                          >
                            {formatGradeDisplay(g.value)}
                          </button>
                        </div>
                      );
                      
                      // Render term grade cell (clickable to set/edit term grade)
                      const renderTermGradeCell = (termNum: 1 | 2) => {
                        // JavaScript months: 0=Jan, 1=Feb, ..., 8=Sept, 11=Dec
                        // Term 1: Sept(8) to Jan(0) - months 8,9,10,11,0
                        // Term 2: Feb(1) to June(5) - months 1,2,3,4,5
                        const monthCheck = termNum === 1 
                          ? (m: number) => m >= 8 || m === 0 
                          : (m: number) => m >= 1 && m <= 5;
                        const termGrade = studentAllGrades.find(g => g.type === "term" && monthCheck(new Date(g.date).getMonth()));
                        
                        // Calculate average from current grades for this term
                        const termCurrentGrades = studentAllGrades
                          .filter(g => g.type === "current" && monthCheck(new Date(g.date).getMonth()))
                          .map(g => g.value)
                          .filter((v): v is number => typeof v === "number");
                        
                        const calculatedAverage = termCurrentGrades.length > 0
                          ? termCurrentGrades.reduce((sum, val) => sum + val, 0) / termCurrentGrades.length
                          : null;
                        
                        // If there's a saved finalized term grade, show it with color and rounded value
                        if (termGrade && termGrade.isFinalized) {
                          return (
                            <button
                              onClick={() => handleOpenTermGradeModal(student._id, termGrade, termNum, calculatedAverage ?? undefined)}
                              className={cn(
                                "min-w-6 h-5 sm:h-6 px-1 rounded flex items-center justify-center flex-shrink-0 font-bold text-white text-[9px] sm:text-[10px] shadow-sm hover:shadow-md transition-all",
                                getGradeBoxColor(termGrade.value)
                              )}
                            >
                              {typeof termGrade.value === "number" 
                                ? (isLowerGrades ? getGradeEmoji(termGrade.value) : Math.round(termGrade.value)) 
                                : termGrade.value}
                            </button>
                          );
                        }
                        
                        // If there's an unfinalized term grade, show it without color but with exact value
                        if (termGrade && !termGrade.isFinalized) {
                          return (
                            <button
                              onClick={() => handleOpenTermGradeModal(student._id, termGrade, termNum, calculatedAverage ?? undefined)}
                              className="min-w-6 h-5 sm:h-6 px-1 rounded flex items-center justify-center flex-shrink-0 font-bold text-foreground text-[9px] sm:text-[10px] bg-muted border border-dashed border-muted-foreground hover:bg-muted/80 transition-all"
                            >
                              {typeof termGrade.value === "number" ? termGrade.value.toFixed(2) : termGrade.value}
                            </button>
                          );
                        }
                        
                        // No term grade saved - show calculated average (exact value without color) or placeholder
                        if (calculatedAverage !== null) {
                          return (
                            <button
                              onClick={() => handleOpenTermGradeModal(student._id, undefined, termNum, calculatedAverage)}
                              className="min-w-6 h-5 sm:h-6 px-1 rounded flex items-center justify-center flex-shrink-0 font-bold text-foreground text-[9px] sm:text-[10px] bg-muted border border-dashed border-muted-foreground hover:bg-muted/80 transition-all"
                              title={`Изчислена средна: ${calculatedAverage.toFixed(2)}`}
                            >
                              {calculatedAverage.toFixed(2)}
                            </button>
                          );
                        }
                        
                        // No grades at all - show empty placeholder
                        return (
                          <button
                            onClick={() => handleOpenTermGradeModal(student._id, undefined, termNum, undefined)}
                            className="min-w-6 h-5 sm:h-6 px-1 rounded flex items-center justify-center flex-shrink-0 text-[9px] sm:text-[10px] border border-dashed border-muted-foreground text-muted-foreground hover:bg-muted transition-all"
                          >
                            -
                          </button>
                        );
                      };
                      
                      // Calculate column count for colspan
                      const colCount = 2 + 
                        ((selectedView === "term1" || selectedView === "yearly") ? 1 : 0) + 
                        ((selectedView === "term2" || selectedView === "yearly") ? 1 : 0) + 
                        (selectedView === "yearly" ? 1 : 0);
                      
                      return (
                        <>
                          <tr key={student._id} className={cn("border-b hover:bg-muted/50", selectedGrade && "bg-muted/30")}>
                            {!isCurrentUserStudent && (
                              <>
                                <td className="py-0.5 px-1 sm:py-1 sm:px-2 text-[10px] sm:text-xs">{index + 1}</td>
                                <td className="py-0.5 px-1 sm:py-1 sm:px-2 text-[10px] sm:text-xs">
                                  <div className="flex items-center gap-1">
                                    <UserIcon className="h-3 w-3 text-primary" />
                                    <UserNameLink
                                      userId={student.userId}
                                      fullName={student.name}
                                    />
                                  </div>
                                </td>
                              </>
                            )}
                            
                            {/* Term 1 data */}
                            {/* Term 1: Sept(8) to Jan(0) - months 8,9,10,11,0 */}
                            {(selectedView === "term1" || selectedView === "yearly") && (
                              <td className="py-0.5 px-1 sm:py-1 sm:px-2 text-[10px] sm:text-xs text-center border-l">
                                {term1Expanded ? (
                                  <div className="flex">
                                    <div className="flex-1 border-r px-0.5 sm:px-1">
                                      <div className="flex flex-wrap gap-0.5 justify-center">
                                        {studentAllGrades
                                          .filter((g) => g.type === "current" && (new Date(g.date).getMonth() >= 8 || new Date(g.date).getMonth() === 0))
                                          .map(renderGradeButton)}
                                        {studentAllGrades.filter(g => g.type === "current" && (new Date(g.date).getMonth() >= 8 || new Date(g.date).getMonth() === 0)).length === 0 && "-"}
                                      </div>
                                    </div>
                                    <div className="flex-1 px-1 flex justify-center items-center">
                                      {renderTermGradeCell(1)}
                                    </div>
                                  </div>
                                ) : "-"}
                              </td>
                            )}
                            
                            {/* Term 2 data */}
                            {/* Term 2: Feb(1) to June(5) - months 1,2,3,4,5 */}
                            {(selectedView === "term2" || selectedView === "yearly") && (
                              <td className="py-0.5 px-1 sm:py-1 sm:px-2 text-[10px] sm:text-xs text-center border-l">
                                {term2Expanded ? (
                                  <div className="flex">
                                    <div className="flex-1 border-r px-0.5 sm:px-1">
                                      <div className="flex flex-wrap gap-0.5 justify-center">
                                        {studentAllGrades
                                          .filter((g) => g.type === "current" && new Date(g.date).getMonth() >= 1 && new Date(g.date).getMonth() <= 5)
                                          .map(renderGradeButton)}
                                        {studentAllGrades.filter(g => g.type === "current" && new Date(g.date).getMonth() >= 1 && new Date(g.date).getMonth() <= 5).length === 0 && "-"}
                                      </div>
                                    </div>
                                    <div className="flex-1 px-1 flex justify-center items-center">
                                      {renderTermGradeCell(2)}
                                    </div>
                                  </div>
                                ) : "-"}
                              </td>
                            )}
                            
                            {/* Yearly data */}
                            {selectedView === "yearly" && (
                              <td className="py-0.5 px-1 sm:py-1 sm:px-2 text-[10px] sm:text-xs text-center border-l">-</td>
                            )}
                          </tr>
                          
                          {/* Grade details row - shown below when a grade is clicked */}
                          {selectedGrade && (
                            <tr key={`${student._id}-details`} className="bg-muted/20">
                              <td colSpan={colCount} className="py-2 px-3 border-b">
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Оценка:</span>
                                    <span className={cn(
                                      "font-bold",
                                      typeof selectedGrade.value === "number" && roundGradeForDisplay(selectedGrade.value) <= 2 && "text-red-500",
                                      typeof selectedGrade.value === "number" && roundGradeForDisplay(selectedGrade.value) === 3 && "text-orange-500",
                                      typeof selectedGrade.value === "number" && roundGradeForDisplay(selectedGrade.value) === 4 && "text-yellow-600",
                                      typeof selectedGrade.value === "number" && roundGradeForDisplay(selectedGrade.value) === 5 && "text-blue-600",
                                      typeof selectedGrade.value === "number" && roundGradeForDisplay(selectedGrade.value) >= 6 && "text-green-600"
                                    )}>
                                      {selectedGrade.value === "absent" ? "Отсъстващ" : selectedGrade.value}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Предмет:</span>
                                    <span>{subjects?.find(s => s._id === selectedGrade.subjectId)?.name || "—"}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Тип:</span>
                                    <span>{selectedGrade.gradeType || (selectedGrade.type === "term" ? "Срочна" : "Текуща")}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Учител:</span>
                                    <span>{teachers?.find(t => t._id === selectedGrade.teacherId)?.name || "—"}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Дата:</span>
                                    <span>{format(new Date(selectedGrade.date), "dd.MM.yyyy", { locale: bg })}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Въведена:</span>
                                    <span>{format(new Date(selectedGrade._creationTime), "dd.MM.yyyy HH:mm", { locale: bg })}</span>
                                  </div>
                                  {selectedGrade.notes && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-muted-foreground">Забележка:</span>
                                      <span>{selectedGrade.notes}</span>
                                    </div>
                                  )}
                                  <div className="ml-auto flex items-center gap-1">
                                    {!isSingleStudentView && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-primary hover:text-primary hover:bg-primary/10"
                                        onClick={() => handleOpenEditGradeModal(selectedGrade)}
                                      >
                                        <EditIcon className="h-4 w-4 mr-1" />
                                        Редактирай
                                      </Button>
                                    )}
                                    <button
                                      onClick={() => { setExpandedGrade(null); setExpandedStudentId(null); }}
                                      className="text-muted-foreground hover:text-foreground"
                                    >
                                      <XIcon className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 pt-4 border-t">
                <p className="text-center text-sm text-muted-foreground font-medium">
                  Средно за паралелката
                </p>
                {(() => {
                  // Determine month filter based on selected view
                  // JavaScript months: 0=Jan, 1=Feb, ..., 8=Sept, 11=Dec
                  // Bulgarian school year:
                  // - First term (Първи срок): September(8) to January(0)
                  // - Second term (Втори срок): February(1) to June(5)
                  const getMonthFilter = () => {
                    if (selectedView === "term1") {
                      return (m: number) => m >= 8 || m === 0; // Sept-Jan (8,9,10,11,0)
                    } else if (selectedView === "term2") {
                      return (m: number) => m >= 1 && m <= 5; // Feb-June (1,2,3,4,5)
                    } else {
                      // Yearly - include all months
                      return () => true;
                    }
                  };
                  const monthFilter = getMonthFilter();
                  
                  // Get list of current student IDs in this class
                  const currentStudentIds = new Set(students.map(s => s._id));
                  
                  // Calculate class average for the selected subject
                  // Only count current grades (not term grades) for the selected term
                  // AND only for students currently in this class
                  const currentGrades = activeGrades?.filter(g => 
                    g.type === "current" && 
                    monthFilter(new Date(g.date).getMonth()) &&
                    currentStudentIds.has(g.studentId)
                  ) || [];
                  
                  // Get only numeric values
                  const numericGrades = currentGrades
                    .map(g => g.value)
                    .filter((v): v is number => typeof v === "number");
                  
                  // If no grades at all, show "Няма оценки"
                  if (numericGrades.length === 0) {
                    return (
                      <p className="text-center text-lg font-semibold text-muted-foreground mt-2">
                        Няма оценки
                      </p>
                    );
                  }
                  
                  const average = numericGrades.reduce((sum, val) => sum + val, 0) / numericGrades.length;
                  
                  // Color based on average
                  const getAverageColor = (avg: number) => {
                    const r = Math.round(avg);
                    if (r <= 2) return "text-red-500";
                    if (r === 3) return "text-orange-500";
                    if (r === 4) return "text-yellow-600 dark:text-yellow-400";
                    if (r === 5) return "text-blue-500";
                    return "text-green-600 dark:text-green-400";
                  };
                  
                  return (
                    <div className="text-center mt-2">
                      <span className={cn("text-2xl font-bold", getAverageColor(average))}>
                        {average.toFixed(2)}
                      </span>
                      <span className="text-sm text-muted-foreground ml-2">
                        (от {numericGrades.length} {numericGrades.length === 1 ? "оценка" : "оценки"})
                      </span>
                    </div>
                  );
                })()}
              </div>
            </Card>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Изберете предмет от лявата страна</p>
            </div>
          )}
        </div>
          </>
        )}
      </div>
      
      {/* Add Grades Modal */}
      {/* Full-screen table modal */}
      {addGradesModalOpen && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="h-screen flex flex-col">
            {/* Header */}
            <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                Добави оценки за {classData.name}
              </h2>
              <Button 
                onClick={() => setAddGradesModalOpen(false)} 
                variant="ghost"
                size="sm"
              >
                ← Назад
              </Button>
            </div>

            {/* Bulk apply section - NOW AT TOP */}
            <div className="p-3 md:p-4 border-b bg-primary/5">
              <p className="text-sm font-semibold text-primary mb-3">Приложи за всички ученици:</p>
              <div className="flex flex-wrap gap-3 items-end">
                {/* Bulk Subject */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Предмет</label>
                  <div className="flex gap-1">
                    <select
                      className="px-2 py-1.5 border border-input rounded text-xs bg-background min-w-[100px]"
                      value={bulkSubject}
                      onChange={(e) => setBulkSubject(e.target.value)}
                    >
                      <option value="">Избери</option>
                      {/* Use uniqueKey to preserve ИУЧ and other preparation type variants */}
                      {availableSubjects?.map((subject) => (
                        <option key={subject.uniqueKey} value={subject._id}>
                          {subject.displayName || subject.name}{subject.teacherName ? ` - ${subject.teacherName}` : ""}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => {
                        if (!bulkSubject) {
                          toast.error("Изберете предмет");
                          return;
                        }
                        const newSubjects: Record<string, string> = {};
                        students?.forEach(s => { newSubjects[s._id] = bulkSubject; });
                        setStudentSubjects(newSubjects);
                        toast.success("Предметът е приложен за всички");
                      }}
                    >
                      <CheckIcon className="h-3 w-3 mr-1" />
                      Всички
                    </Button>
                  </div>
                </div>
                
                {/* Bulk Grade Type */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Тип оценка</label>
                  <div className="flex gap-1">
                    <select
                      className="px-2 py-1.5 border border-input rounded text-xs bg-background min-w-[120px]"
                      value={bulkGradeType}
                      onChange={(e) => setBulkGradeType(e.target.value)}
                    >
                      <option value="">Избери</option>
                      <option value="Устно изпитване">Устно изпитване</option>
                      <option value="Писмено изпитване">Писмено изпитване</option>
                      <option value="Практическа работа">Практическа работа</option>
                      <option value="Тест">Тест</option>
                      <option value="Активно участие">Активно участие</option>
                      <option value="Проект">Проект</option>
                      <option value="Самостоятелна работа">Самостоятелна работа</option>
                      <option value="Домашна работа">Домашна работа</option>
                      <option value="Контролна работа">Контролна работа</option>
                      <option value="Класна работа">Класна работа</option>
                      <option value="Входно ниво">Входно ниво</option>
                      <option value="Междинно ниво">Междинно ниво</option>
                      <option value="Изходно ниво">Изходно ниво</option>
                    </select>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => {
                        if (!bulkGradeType) {
                          toast.error("Изберете тип оценка");
                          return;
                        }
                        const newTypes: Record<string, string> = {};
                        students?.forEach(s => { newTypes[s._id] = bulkGradeType; });
                        setStudentGradeTypes(newTypes);
                        toast.success("Типът е приложен за всички");
                      }}
                    >
                      <CheckIcon className="h-3 w-3 mr-1" />
                      Всички
                    </Button>
                  </div>
                </div>
                
                {/* Bulk Comment */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Коментар</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      className="px-2 py-1.5 border border-input rounded text-xs bg-background min-w-[150px]"
                      placeholder="Въведете коментар"
                      id="bulkComment"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => {
                        const input = document.getElementById('bulkComment') as HTMLInputElement;
                        const comment = input?.value || "";
                        if (!comment.trim()) {
                          toast.error("Въведете коментар");
                          return;
                        }
                        const newComments: Record<string, string> = {};
                        students?.forEach(s => { newComments[s._id] = comment; });
                        setStudentComments(newComments);
                        toast.success("Коментарът е приложен за всички");
                      }}
                    >
                      <CheckIcon className="h-3 w-3 mr-1" />
                      Всички
                    </Button>
                  </div>
                </div>
                
                {/* Bulk Grade Value */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Оценка</label>
                  <div className="flex gap-1 items-center">
                    {[2, 3, 4, 5, 6].map((grade) => (
                      <button
                        key={grade}
                        onClick={() => {
                          const newGrades: Record<string, string> = {};
                          students?.forEach(s => { newGrades[s._id] = grade.toString(); });
                          setStudentGrades(newGrades);
                          toast.success(`Оценка ${grade} е приложена за всички`);
                        }}
                        className={cn(
                          "w-8 h-8 rounded text-xs font-bold transition-all",
                          getGradeButtonColor(grade)
                        )}
                        title={`Приложи ${grade} за всички`}
                      >
                        {isLowerGrades ? getGradeEmoji(grade) : grade}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Clear All */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => {
                    setStudentGrades({});
                    setStudentSubjects({});
                    setStudentGradeTypes({});
                    setStudentDates({});
                    setStudentComments({});
                    const input = document.getElementById('bulkComment') as HTMLInputElement;
                    if (input) input.value = "";
                    toast.success("Всички полета са изчистени");
                  }}
                >
                  <XIcon className="h-3 w-3 mr-1" />
                  Изчисти всички
                </Button>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse">
                <thead className="bg-muted sticky top-0 z-10">
                  <tr>
                    <th className="text-left py-2 px-2 text-xs font-bold border-b-2 border-r border-border w-10">№</th>
                    <th className="text-left py-2 px-2 text-xs font-bold border-b-2 border-r border-border min-w-[120px]">Ученик</th>
                    <th className="text-left py-2 px-2 text-xs font-bold border-b-2 border-r border-border min-w-[110px]">Предмет</th>
                    <th className="text-left py-2 px-2 text-xs font-bold border-b-2 border-r border-border min-w-[110px]">Тип</th>
                    <th className="text-left py-2 px-2 text-xs font-bold border-b-2 border-r border-border min-w-[100px]">Дата</th>
                    <th className="text-left py-2 px-2 text-xs font-bold border-b-2 border-r border-border min-w-[120px]">Коментар</th>
                    <th className="text-center py-2 px-2 text-xs font-bold border-b-2 border-border min-w-[100px]">Оценка</th>
                  </tr>
                </thead>
                <tbody>
                  {students?.map((student, index) => (
                    <tr key={student._id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="py-1 px-1.5 font-medium border-r border-border text-xs">{index + 1}</td>
                      <td className="py-1 px-1.5 font-medium border-r border-border text-xs">{student.name}</td>
                      <td className="py-1 px-1.5 border-r border-border">
                        <select
                          className="w-full px-1.5 py-1 border border-input rounded text-xs bg-background text-foreground"
                          value={studentSubjects[student._id] || bulkSubject || ""}
                          onChange={(e) => setStudentSubjects(prev => ({ ...prev, [student._id]: e.target.value }))}
                        >
                          <option value="">Избери</option>
                          {/* Use uniqueKey to preserve ИУЧ and other preparation type variants */}
                          {availableSubjects?.map((subject) => (
                            <option key={subject.uniqueKey} value={subject._id}>
                              {subject.displayName || subject.name}{subject.teacherName ? ` - ${subject.teacherName}` : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1 px-1.5 border-r border-border">
                        <select
                          className="w-full px-1.5 py-1 border border-input rounded text-xs bg-background text-foreground"
                          value={studentGradeTypes[student._id] || bulkGradeType || ""}
                          onChange={(e) => setStudentGradeTypes(prev => ({ ...prev, [student._id]: e.target.value }))}
                        >
                          <option value="">Избери</option>
                          <option value="Устно изпитване">Устно изпитване</option>
                          <option value="Писмено изпитване">Писмено изпитване</option>
                          <option value="Практическа работа">Практическа работа</option>
                          <option value="Тест">Тест</option>
                          <option value="Активно участие">Активно участие</option>
                          <option value="Проект">Проект</option>
                          <option value="Самостоятелна работа">Самостоятелна работа</option>
                          <option value="Домашна работа">Домашна работа</option>
                          <option value="Контролна работа">Контролна работа</option>
                          <option value="Класна работа">Класна работа</option>
                          <option value="Входно ниво">Входно ниво</option>
                          <option value="Междинно ниво">Междинно ниво</option>
                          <option value="Изходно ниво">Изходно ниво</option>
                          <option value="Срочна оценка">Срочна оценка</option>
                          <option value="Годишна оценка">Годишна оценка</option>
                        </select>
                      </td>
                      <td className="py-1 px-1.5 border-r">
                        <Popover 
                          open={openPopovers[student._id] || false}
                          onOpenChange={(open) => setOpenPopovers(prev => ({ ...prev, [student._id]: open }))}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal px-1.5 py-0.5 h-auto text-xs",
                                !(studentDates[student._id] || bulkDate) && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-1 h-3 w-3" />
                              {studentDates[student._id] || bulkDate || "Дата"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={
                                (() => {
                                  const dateStr = studentDates[student._id] || bulkDate;
                                  if (!dateStr) return undefined;
                                  const parts = dateStr.split(".");
                                  if (parts.length !== 3) return undefined;
                                  const day = parseInt(parts[0], 10);
                                  const month = parseInt(parts[1], 10) - 1;
                                  const year = parseInt(parts[2], 10);
                                  return new Date(year, month, day);
                                })()
                              }
                              onSelect={(date) => {
                                if (date) {
                                  const formatted = format(date, "dd.MM.yyyy");
                                  setStudentDates(prev => ({ ...prev, [student._id]: formatted }));
                                  setOpenPopovers(prev => ({ ...prev, [student._id]: false }));
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </td>
                      <td className="py-1 px-1.5 border-r border-border">
                        <textarea
                          className="w-full px-1.5 py-1 border border-input rounded text-xs resize-none bg-background text-foreground placeholder:text-muted-foreground"
                          value={studentComments[student._id] || ""}
                          onChange={(e) => setStudentComments(prev => ({ ...prev, [student._id]: e.target.value }))}
                          placeholder="Коментар"
                          rows={1}
                        />
                      </td>
                      <td className="py-1 px-1.5 text-center">
                        <div className="flex items-center justify-center gap-0.5 flex-wrap">
                          {/* Quick grade buttons */}
                          {[2, 3, 4, 5, 6].map((grade) => (
                            <button
                              key={grade}
                              onClick={() => handleQuickGrade(student._id, grade)}
                              className={cn(
                                "w-7 h-7 rounded text-xs font-bold transition-all",
                                getGradeButtonColor(grade),
                                studentGrades[student._id] === grade.toString() && "ring-2 ring-offset-1 ring-primary"
                              )}
                            >
                              {isLowerGrades ? getGradeEmoji(grade) : grade}
                            </button>
                          ))}
                          
                          {/* Manual grade input */}
                          <input
                            type="text"
                            className="w-12 h-7 px-1 border border-input rounded text-xs text-center font-bold bg-background text-foreground placeholder:text-muted-foreground"
                            value={studentGrades[student._id] || ""}
                            onChange={(e) => handleManualGrade(student._id, e.target.value)}
                            placeholder="2-6"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer with save button only */}
            <div className="p-3 md:p-4 border-t bg-muted/30">
              <div className="flex items-center justify-end">
                <Button 
                  onClick={handleSaveGrades}
                  size="lg" 
                  className="bg-teal-600 hover:bg-teal-700 min-w-[200px]"
                  disabled={isSaving}
                >
                  {isSaving ? "Запазване..." : "Запази оценките"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Term Grade Modal - Full Screen */}
      {termGradeModalOpen && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="h-screen flex flex-col">
            {/* Header */}
            <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editingTermGradeId ? "Редактирай срочна оценка" : "Въведи срочна оценка"} - {termNumber === 1 ? "I срок" : "II срок"}
              </h2>
              <Button 
                onClick={() => setTermGradeModalOpen(false)} 
                variant="ghost"
                size="sm"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Назад
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-md mx-auto space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Оценка (2-6)</label>
                  <div className="flex gap-3 flex-wrap">
                    {[2, 3, 4, 5, 6].map((grade) => (
                      <button
                        key={grade}
                        onClick={() => setTermGradeValue(grade.toString())}
                        className={cn(
                          "w-14 h-14 rounded text-lg font-bold transition-all",
                          getGradeButtonColor(grade),
                          termGradeValue === grade.toString() && "ring-2 ring-offset-2 ring-primary"
                        )}
                      >
                        {isLowerGrades ? getGradeEmoji(grade) : grade}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="2"
                    max="6"
                    className="w-full px-3 py-3 border border-input rounded text-base bg-background text-foreground placeholder:text-muted-foreground"
                    value={termGradeValue}
                    onChange={(e) => setTermGradeValue(e.target.value)}
                    placeholder="Или въведете точна оценка (напр. 4.50)"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-muted/30 flex items-center justify-end gap-2">
              {editingTermGradeId && (
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteTermGrade(editingTermGradeId)}
                >
                  <Trash2Icon className="h-4 w-4 mr-2" />
                  Изтрий
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setTermGradeModalOpen(false)}
              >
                Отказ
              </Button>
              <Button
                onClick={handleSaveTermGrade}
                className="bg-green-600 hover:bg-green-700"
                disabled={isSaving}
              >
                {isSaving ? "Запазване..." : (editingTermGradeId ? "Обнови" : "Запази")}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Grade Modal - Full Screen */}
      {editGradeModalOpen && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="h-screen flex flex-col">
            {/* Header */}
            <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
              <h2 className="text-lg font-bold">Редактирай оценка</h2>
              <Button 
                onClick={() => setEditGradeModalOpen(false)} 
                variant="ghost"
                size="sm"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Назад
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-md mx-auto space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Оценка (2-6)</label>
                  <div className="flex gap-3 flex-wrap">
                    {[2, 3, 4, 5, 6].map((grade) => (
                      <button
                        key={grade}
                        onClick={() => setEditGradeValue(grade.toString())}
                        className={cn(
                          "w-14 h-14 rounded text-lg font-bold transition-all",
                          getGradeButtonColor(grade),
                          editGradeValue === grade.toString() && "ring-2 ring-offset-2 ring-primary"
                        )}
                      >
                        {isLowerGrades ? getGradeEmoji(grade) : grade}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="2"
                    max="6"
                    className="w-full px-3 py-3 border border-input rounded text-base bg-background text-foreground placeholder:text-muted-foreground"
                    value={editGradeValue}
                    onChange={(e) => setEditGradeValue(e.target.value)}
                    placeholder="Или въведете точна оценка (напр. 4.50)"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Тип на оценката</label>
                  <select
                    className="w-full px-3 py-3 border border-input rounded text-base bg-background text-foreground"
                    value={editGradeType}
                    onChange={(e) => setEditGradeType(e.target.value)}
                    disabled
                  >
                    <option value="">Изберете тип</option>
                    <option value="Устно изпитване">Устно изпитване</option>
                    <option value="Писмено изпитване">Писмено изпитване</option>
                    <option value="Практическа работа">Практическа работа</option>
                    <option value="Тест">Тест</option>
                    <option value="Активно участие">Активно участие</option>
                    <option value="Проект">Проект</option>
                    <option value="Самостоятелна работа">Самостоятелна работа</option>
                    <option value="Домашна работа">Домашна работа</option>
                    <option value="Контролна работа">Контролна работа</option>
                    <option value="Класна работа">Класна работа</option>
                    <option value="Входно ниво">Входно ниво</option>
                    <option value="Междинно ниво">Междинно ниво</option>
                    <option value="Изходно ниво">Изходно ниво</option>
                  </select>
                  <p className="text-xs text-muted-foreground">Типът на оценката не може да се променя</p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Дата</label>
                  <input
                    type="text"
                    className="w-full px-3 py-3 border border-input rounded text-base bg-muted text-muted-foreground"
                    value={editGradeDate}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">Датата не може да се променя</p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Забележка</label>
                  <textarea
                    className="w-full px-3 py-3 border border-input rounded text-base bg-background text-foreground placeholder:text-muted-foreground resize-none"
                    value={editGradeNotes}
                    onChange={(e) => setEditGradeNotes(e.target.value)}
                    placeholder="Добавете забележка (по желание)"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-muted/30 flex items-center justify-end gap-2">
              <Button
                variant="destructive"
                onClick={handleDeleteGrade}
                disabled={isSaving}
              >
                <Trash2Icon className="h-4 w-4 mr-2" />
                {isAdmin ? "Изтрий" : "Заяви изтриване"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setEditGradeModalOpen(false)}
                disabled={isSaving}
              >
                Отказ
              </Button>
              <Button
                onClick={handleSaveEditedGrade}
                className="bg-green-600 hover:bg-green-700"
                disabled={isSaving}
              >
                {isSaving ? "Запазване..." : "Запази"}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Reason Dialog */}
      {deleteReasonDialogOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-background rounded-lg w-full max-w-md shadow-xl">
            <div className="p-4 border-b">
              <h2 className="text-lg font-bold">Заявка за изтриване на оценка</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Моля, въведете причина за изтриването. Заявката ще бъде изпратена за одобрение от директор или зам.-директор.
              </p>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Причина за изтриване *</label>
                <textarea
                  className="w-full px-3 py-3 border border-input rounded text-base bg-background text-foreground placeholder:text-muted-foreground resize-none"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Въведете причина за изтриването..."
                  rows={3}
                  autoFocus
                />
              </div>
            </div>
            
            <div className="p-4 border-t bg-muted/30 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setDeleteReasonDialogOpen(false);
                  setDeleteReason("");
                }}
              >
                Отказ
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDeleteWithReason}
                disabled={isSaving}
              >
                {isSaving ? "Изпращане..." : "Изпрати заявка"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClassGrades() {
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
          <ClassGradesInner />
        </DiaryAccessGuard>
      </Authenticated>
    </Layout>
  );
}

