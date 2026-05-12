import { useParams, Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
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
import { 
  FilterIcon, 
  UserIcon, 
  ArrowLeftIcon,
  XIcon,
  Plus,
  Trash2Icon,
  EditIcon,
  CheckIcon,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { cn } from "@/lib/utils.ts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Input } from "@/components/ui/input.tsx";
import { toast } from "sonner";
import { UserNameLink } from "@/components/ui/user-name-link.tsx";
import { DiaryAccessGuard } from "@/components/DiaryAccessGuard.tsx";

// Badge type to label mapping
const getBadgeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    general_praise: "Обща похвала",
    active_participation: "Активно участие",
    excellent_presentation: "Отлично представяне",
    completed_task: "Изпълнена задача",
    curiosity: "Любознателност",
    diligence: "Прилежност",
    progress: "Напредък",
    communication: "Добра комуникация",
    sharp_mind: "Остър ум",
    concentration: "Концентрация",
    creativity: "Креативност",
    teamwork: "Работа в екип",
    leadership: "Лидерство",
    patriotism: "Патриотизъм",
    tolerance: "Толерантност",
    emotional_intelligence: "Емоционална интелигентност",
    presentation_skills: "Умения за презентиране",
    digital_skills: "Дигитални умения",
    musical_culture: "Музикална култура",
    physical_culture: "Физическа култура",
    general_remark: "Обща забележка",
    bad_discipline: "Лоша дисциплина",
    lack_of_attention: "Липса на внимание",
    official_remark: "Официална забележка",
    disrespect: "Неуважение",
    aggression: "Агресия",
    removed_from_class: "Отстранен от час",
    late: "Закъснение",
    absence: "Отсъствие",
    poor_performance: "Слабо представяне",
    unprepared: "Без подготовка",
    no_homework: "Без домашна работа",
    no_textbook: "Без учебно помагало",
    no_materials: "Без учебни пособия",
    no_equipment: "Без екип",
    no_uniform: "Без униформа",
    breakfast: "Закуска",
    lunch: "Обяд",
    afternoon_sleep: "Следобеден сън",
    afternoon_snack: "Следобедна закуска",
  };
  return labels[type] || type;
};

function ClassReviewsInner() {
  const { classId, lng } = useParams<{ classId: string; lng: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [filterMode, setFilterMode] = useState<"all" | "deleted" | "prev-month" | "current-month" | "current-week">("all");
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [expandedType, setExpandedType] = useState<"remarks" | "praises" | null>(null);
  
  // Get studentId from URL params (for staff viewing their child's diary)
  const studentIdFromUrl = searchParams.get("studentId");
  
  // Create a stable key from the full URL to force re-render when params change
  const urlKey = `${classId}-${studentIdFromUrl || 'class'}`;
  
  // Reset expanded states when URL changes (especially when switching from child view to class view)
  useEffect(() => {
    setExpandedStudent(null);
    setExpandedType(null);
  }, [urlKey]);
  
  const classData = useQuery(
    api.admin.getClassById,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  // Get subjects for this specific class only
  const classSubjectsData = useQuery(
    api.admin.getClassSubjectsTeachers,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  // Get unique subjects from classSubjects
  const subjects = classSubjectsData ? 
    Array.from(
      new Map(classSubjectsData.map(cs => [cs.subjectId, { _id: cs.subjectId, name: cs.subjectName }])).values()
    ) : [];
  
  const currentUser = useQuery(api.users.getCurrentUser, {});
  
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
  
  const deleteReview = useMutation(api.reviews.deleteReview);
  const updateRemark = useMutation(api.reviews.updateRemark);
  const bulkDeleteReviews = useMutation(api.reviews.bulkDeleteReviews);
  
  // Bulk delete mode state
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set());
  const [selectedReviewsData, setSelectedReviewsData] = useState<Map<string, "remark" | "badge">>(new Map());
  
  // Handle toggle review selection for bulk delete
  const handleToggleReviewSelection = (reviewId: string, source: "remark" | "badge") => {
    setSelectedReviews(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reviewId)) {
        newSet.delete(reviewId);
        setSelectedReviewsData(prevData => {
          const newMap = new Map(prevData);
          newMap.delete(reviewId);
          return newMap;
        });
      } else {
        newSet.add(reviewId);
        setSelectedReviewsData(prevData => {
          const newMap = new Map(prevData);
          newMap.set(reviewId, source);
          return newMap;
        });
      }
      return newSet;
    });
  };
  
  // Handle bulk delete
  const handleBulkDeleteReviews = async () => {
    if (selectedReviews.size === 0) {
      toast.error("Моля, изберете поне един отзив за изтриване");
      return;
    }
    
    if (!confirm(`Сигурни ли сте, че искате да изтриете ${selectedReviews.size} отзиви?`)) {
      return;
    }
    
    try {
      const reviewsToDelete = Array.from(selectedReviews).map(id => ({
        reviewId: id,
        source: selectedReviewsData.get(id) || ("remark" as const),
      }));
      
      const deletedCount = await bulkDeleteReviews({
        reviews: reviewsToDelete,
      });
      toast.success(`Успешно изтрити ${deletedCount} отзиви!`);
      setSelectedReviews(new Set());
      setSelectedReviewsData(new Map());
      setBulkDeleteMode(false);
    } catch (error) {
      console.error(error);
      toast.error("Грешка при изтриване на отзивите");
    }
  };
  
  // Exit bulk delete mode
  const handleExitBulkDeleteMode = () => {
    setBulkDeleteMode(false);
    setSelectedReviews(new Set());
    setSelectedReviewsData(new Map());
  };
  
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
  
  // Edit review modal state
  const [editReviewModalOpen, setEditReviewModalOpen] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editingReviewSource, setEditingReviewSource] = useState<"remark" | "badge" | null>(null);
  const [editReviewType, setEditReviewType] = useState<"praise" | "warning">("warning");
  const [editReviewBadgeType, setEditReviewBadgeType] = useState<string>("");
  const [editReviewContent, setEditReviewContent] = useState<string>("");

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
  
  // Get real review counts
  const reviewsCounts = useQuery(
    api.reviews.getReviewsByClass,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  // Get detailed reviews for expanded student
  const expandedStudentReviews = useQuery(
    api.reviews.getStudentReviews,
    expandedStudent && reviewsCounts ? { studentId: expandedStudent as Id<"students"> } : "skip"
  );

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
    { label: "ВЧК", link: `/bg/diary/class/${classId}/internal-commission${studentQueryStr}` },
    { label: "Род.", link: `/bg/diary/class/${classId}/parent-meetings${studentQueryStr}` },
    { label: "Поп.", link: `/bg/diary/class/${classId}/remedial-exams${studentQueryStr}` },
    { label: "Под.", link: `/bg/diary/class/${classId}/student-support${studentQueryStr}` },
    { label: "Сан.", link: `/bg/diary/class/${classId}/sanctions${studentQueryStr}` },
    { label: "Год.", link: `/bg/diary/class/${classId}/annual-results${studentQueryStr}` },
    { label: "Уч.", link: `/bg/diary/class/${classId}/students${studentQueryStr}` },
  ];

  if (!classData || !students) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const classTeacher = classData.classTeacher;

  const handleClearFilters = () => {
    setSelectedSubject("");
    setStartDate("");
    setEndDate("");
    setFilterMode("all");
  };
  
  const handleDeleteReview = async (reviewId: string, source: "remark" | "badge") => {
    if (!confirm("Сигурни ли сте, че искате да премахнете този отзив?")) {
      return;
    }
    
    try {
      await deleteReview({ reviewId, source });
      toast.success("Отзивът е премахнат успешно!");
    } catch (error) {
      toast.error("Грешка при премахване на отзив");
      console.error(error);
    }
  };
  
  // Handle open edit review modal
  const handleOpenEditReviewModal = (
    reviewId: string, 
    source: "remark" | "badge", 
    type: "praise" | "warning",
    badgeType: string | undefined,
    content: string
  ) => {
    setEditingReviewId(reviewId);
    setEditingReviewSource(source);
    setEditReviewType(type);
    setEditReviewBadgeType(badgeType || "");
    setEditReviewContent(content);
    setEditReviewModalOpen(true);
  };
  
  // Handle save edited review
  const handleSaveEditedReview = async () => {
    if (!editingReviewId || !editingReviewSource) {
      return;
    }
    
    // Only remarks can be edited
    if (editingReviewSource === "badge") {
      toast.error("Значките от часовете не могат да се редактират");
      return;
    }
    
    try {
      await updateRemark({
        remarkId: editingReviewId as Id<"remarks">,
        type: editReviewType,
        badgeType: editReviewBadgeType || null,
        content: editReviewContent,
      });
      toast.success("Отзивът е обновен успешно!");
      setEditReviewModalOpen(false);
      setEditingReviewId(null);
    } catch (error) {
      toast.error("Грешка при обновяване на отзива");
      console.error(error);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 sm:px-6 py-2 sm:py-3 gap-2 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <Link to={`/bg/diary/class/${classId}`}>
              <Button variant="ghost" size="sm" className="px-2 sm:px-3">
                <ArrowLeftIcon className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Назад</span>
              </Button>
            </Link>
            <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
              <UserIcon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
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
                )} - {classTeacher ? (
                  <>
                    <span className="hidden sm:inline">
                      <UserNameLink
                        userId={classTeacher._id}
                        firstName={classTeacher.firstName}
                        lastName={classTeacher.lastName}
                      /> (класен)
                    </span>
                    <span className="sm:hidden">
                      {classTeacher.firstName?.charAt(0)}. {classTeacher.lastName}
                    </span>
                  </>
                ) : (
                  <span className="hidden sm:inline">Без класен ръководител</span>
                )}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-end shrink-0">
            {!isSingleStudentView && (
              <>
                {bulkDeleteMode ? (
                  <>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={handleBulkDeleteReviews}
                      disabled={selectedReviews.size === 0}
                      className="px-2 sm:px-3"
                    >
                      <Trash2Icon className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Изтрий</span> ({selectedReviews.size})
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleExitBulkDeleteMode}
                      className="px-2 sm:px-3"
                    >
                      <XIcon className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Отказ</span>
                    </Button>
                  </>
                ) : (
                  <>
                    {!isPurePedagogicalCounselor && (
                      <Button 
                        variant="default" 
                        size="sm"
                        onClick={() => navigate(`/${lng}/diary/class/${classId}/reviews/add`)}
                        className="px-2 sm:px-3"
                      >
                        <Plus className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Добави</span>
                      </Button>
                    )}
                    {isAdmin && (
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => setBulkDeleteMode(true)}
                        className="px-2 sm:px-3"
                      >
                        <Trash2Icon className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Изтрий</span>
                      </Button>
                    )}
                  </>
                )}
              </>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="px-2 sm:px-3"
            >
              <FilterIcon className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Филтри</span>
            </Button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-6 py-1 sm:py-2 border-t overflow-x-auto">
          {stats.map((stat, index) => (
            <Link
              key={index}
              to={stat.link}
              className={cn(
                "px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium whitespace-nowrap rounded transition-colors",
                stat.link === `/bg/diary/class/${classId}/reviews`
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent"
              )}
            >
              {stat.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-6">
        <Card className="p-2 sm:p-6">
          {/* Filter Controls */}
          {showFilters && (
            <div className="mb-6 space-y-4 pb-6 border-b">
              <div className="flex items-center gap-4 flex-wrap">
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Изберете (предмет)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Всички предмети</SelectItem>
                    {subjects?.map((subject) => (
                      <SelectItem key={subject._id} value={subject._id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="date"
                  placeholder="От дата"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-48"
                />

                <Input
                  type="date"
                  placeholder="До дата"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-48"
                />

                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleClearFilters}
                >
                  <XIcon className="h-4 w-4 mr-2" />
                  Изчисти
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={filterMode === "deleted" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterMode("deleted")}
                >
                  Изтрити отзиви
                </Button>
                <Button
                  variant={filterMode === "prev-month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterMode("prev-month")}
                >
                  Преходен месец
                </Button>
                <Button
                  variant={filterMode === "current-month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterMode("current-month")}
                >
                  Текущ месец
                </Button>
                <Button
                  variant={filterMode === "current-week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterMode("current-week")}
                >
                  Текуща седмица
                </Button>
              </div>
            </div>
          )}

          {/* Student Summary Table */}
          <div className="mb-4 sm:mb-6 overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full border text-xs sm:text-sm">
              <thead>
                <tr className="bg-muted">
                  {!isCurrentUserStudent && (
                    <>
                      <th className="text-left py-2 px-2 sm:py-3 sm:px-4 font-medium border w-8 sm:w-auto">№</th>
                      <th className="text-left py-2 px-2 sm:py-3 sm:px-4 font-medium border">Ученик</th>
                    </>
                  )}
                  <th className="text-center py-2 px-2 sm:py-3 sm:px-4 font-medium border bg-red-100 dark:bg-red-950/50 text-foreground">
                    Забел.
                  </th>
                  <th className="text-center py-2 px-2 sm:py-3 sm:px-4 font-medium border bg-green-100 dark:bg-green-950/50 text-foreground">
                    Похв.
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => {
                  const reviewData = reviewsCounts?.find(r => r.studentId === student._id);
                  const notesCount = reviewData?.remarks || 0;
                  const praisesCount = reviewData?.praises || 0;
                  const isExpanded = expandedStudent === student._id;
                  
                  return (
                    <>
                      <tr key={student._id} className="hover:bg-muted/50">
                        {!isCurrentUserStudent && (
                          <>
                            <td className="py-2 px-2 sm:py-3 sm:px-4 border">{index + 1}</td>
                            <td className="py-2 px-2 sm:py-3 sm:px-4 border">
                              <div className="flex items-center gap-1 sm:gap-2">
                                <UserIcon className="h-3 w-3 sm:h-4 sm:w-4 text-primary shrink-0" />
                                <span className="truncate max-w-[100px] sm:max-w-none">
                                  <UserNameLink
                                    userId={student.userId}
                                    fullName={student.name}
                                  />
                                </span>
                              </div>
                            </td>
                          </>
                        )}
                        <td className="py-2 px-1 sm:py-3 sm:px-4 text-center border bg-red-100 dark:bg-red-950/50 font-medium">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-full hover:bg-red-200 dark:hover:bg-red-900/70 px-1 sm:px-2"
                            onClick={() => {
                              if (isExpanded && expandedType === "remarks") {
                                setExpandedStudent(null);
                                setExpandedType(null);
                              } else {
                                setExpandedStudent(student._id);
                                setExpandedType("remarks");
                              }
                            }}
                          >
                            {notesCount}
                          </Button>
                        </td>
                        <td className="py-2 px-1 sm:py-3 sm:px-4 text-center border bg-green-100 dark:bg-green-950/50 font-medium">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full h-full hover:bg-green-200 dark:hover:bg-green-900/70 px-1 sm:px-2"
                            onClick={() => {
                              if (isExpanded && expandedType === "praises") {
                                setExpandedStudent(null);
                                setExpandedType(null);
                              } else {
                                setExpandedStudent(student._id);
                                setExpandedType("praises");
                              }
                            }}
                          >
                            {praisesCount}
                          </Button>
                        </td>
                      </tr>
                      {isExpanded && expandedStudentReviews && (
                        <tr>
                          <td colSpan={isCurrentUserStudent ? 2 : 4} className="p-2 sm:p-4 bg-muted/30 border">
                            <div className="space-y-3">
                              {expandedType === "remarks" && expandedStudentReviews.warnings.length > 0 && (
                                <div>
                                  <h4 className="font-semibold text-sm mb-2 text-red-700 dark:text-red-400">
                                    Забележки ({expandedStudentReviews.warnings.length})
                                  </h4>
                                  <div className="space-y-2">
                                    {expandedStudentReviews.warnings.map((warning, i) => (
                                      <div key={warning._id} className={cn(
                                        "flex items-start gap-2 text-sm p-2 bg-background rounded border border-red-200 dark:border-red-900/50",
                                        bulkDeleteMode && selectedReviews.has(warning._id) && "ring-2 ring-red-500"
                                      )}>
                                        {bulkDeleteMode ? (
                                          <Checkbox
                                            checked={selectedReviews.has(warning._id)}
                                            onCheckedChange={() => handleToggleReviewSelection(warning._id, warning.source)}
                                            className="mt-1"
                                          />
                                        ) : (
                                          <span className="text-muted-foreground">{i + 1}.</span>
                                        )}
                                        <div className="flex-1">
                                          <div className="font-medium">{(warning as { badgeLabel?: string }).badgeLabel || warning.content}</div>
                                          {(warning as { notes?: string | null }).notes && (
                                            <div className="text-xs text-muted-foreground italic mt-0.5">
                                              "{(warning as { notes?: string | null }).notes}"
                                            </div>
                                          )}
                                          <div className="text-xs text-muted-foreground">
                                            {new Date(warning.date).toLocaleDateString("bg-BG")} 
                                            {warning.subjectName && ` - ${warning.subjectName}`}
                                            {" - "}{warning.teacherName}
                                          </div>
                                        </div>
                                        {!isSingleStudentView && !bulkDeleteMode && (
                                          <div className="flex items-center gap-1">
                                            {warning.source === "remark" && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                                                onClick={() => handleOpenEditReviewModal(
                                                  warning._id, 
                                                  warning.source, 
                                                  "warning",
                                                  (warning as { badgeType?: string }).badgeType,
                                                  warning.content
                                                )}
                                              >
                                                <EditIcon className="h-4 w-4" />
                                              </Button>
                                            )}
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
                                              onClick={() => handleDeleteReview(warning._id, warning.source)}
                                            >
                                              <Trash2Icon className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {expandedType === "remarks" && expandedStudentReviews.warnings.length === 0 && (
                                <div className="text-center text-muted-foreground py-4">
                                  Няма забележки
                                </div>
                              )}
                              
                              {expandedType === "praises" && expandedStudentReviews.praises.length > 0 && (
                                <div>
                                  <h4 className="font-semibold text-sm mb-2 text-green-700 dark:text-green-400">
                                    Похвали ({expandedStudentReviews.praises.length})
                                  </h4>
                                  <div className="space-y-2">
                                    {expandedStudentReviews.praises.map((praise, i) => (
                                      <div key={praise._id} className={cn(
                                        "flex items-start gap-2 text-sm p-2 bg-background rounded border border-green-200 dark:border-green-900/50",
                                        bulkDeleteMode && selectedReviews.has(praise._id) && "ring-2 ring-red-500"
                                      )}>
                                        {bulkDeleteMode ? (
                                          <Checkbox
                                            checked={selectedReviews.has(praise._id)}
                                            onCheckedChange={() => handleToggleReviewSelection(praise._id, praise.source)}
                                            className="mt-1"
                                          />
                                        ) : (
                                          <span className="text-muted-foreground">{i + 1}.</span>
                                        )}
                                        <div className="flex-1">
                                          <div className="font-medium">{(praise as { badgeLabel?: string }).badgeLabel || praise.content}</div>
                                          {(praise as { notes?: string | null }).notes && (
                                            <div className="text-xs text-muted-foreground italic mt-0.5">
                                              "{(praise as { notes?: string | null }).notes}"
                                            </div>
                                          )}
                                          <div className="text-xs text-muted-foreground">
                                            {new Date(praise.date).toLocaleDateString("bg-BG")} 
                                            {praise.subjectName && ` - ${praise.subjectName}`}
                                            {" - "}{praise.teacherName}
                                          </div>
                                        </div>
                                        {!isSingleStudentView && !bulkDeleteMode && (
                                          <div className="flex items-center gap-1">
                                            {praise.source === "remark" && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                                                onClick={() => handleOpenEditReviewModal(
                                                  praise._id, 
                                                  praise.source, 
                                                  "praise",
                                                  (praise as { badgeType?: string }).badgeType,
                                                  praise.content
                                                )}
                                              >
                                                <EditIcon className="h-4 w-4" />
                                              </Button>
                                            )}
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30"
                                              onClick={() => handleDeleteReview(praise._id, praise.source)}
                                            >
                                              <Trash2Icon className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {expandedType === "praises" && expandedStudentReviews.praises.length === 0 && (
                                <div className="text-center text-muted-foreground py-4">
                                  Няма похвали
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
                {/* Totals row - calculate totals based on visible students */}
                {/* Only show totals row when there are multiple students */}
                {!isCurrentUserStudent && students.length > 1 && (() => {
                  // Calculate totals based on visible students only (filtered students array)
                  let totalRemarks = 0;
                  let totalPraises = 0;
                  
                  if (students && reviewsCounts) {
                    // Get the IDs of students that are currently visible in the table
                    const visibleStudentIds = students.map(s => s._id);
                    
                    // Sum only the reviews for visible students
                    for (const review of reviewsCounts) {
                      if (visibleStudentIds.includes(review.studentId as Id<"students">)) {
                        totalRemarks += review.remarks;
                        totalPraises += review.praises;
                      }
                    }
                  }
                  
                  return (
                    <tr className="bg-muted font-bold text-xs sm:text-sm">
                      <td colSpan={2} className="py-2 px-2 sm:py-3 sm:px-4 border text-center">
                        Общо
                      </td>
                      <td className="py-2 px-2 sm:py-3 sm:px-4 text-center border bg-red-100 dark:bg-red-950/50">
                        {totalRemarks}
                      </td>
                      <td className="py-2 px-2 sm:py-3 sm:px-4 text-center border bg-green-100 dark:bg-green-950/50">
                        {totalPraises}
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>

          {/* Reviews List - Placeholder */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Отзиви</h3>
            <div className="text-center py-12 text-muted-foreground">
              Няма налични отзиви за избрания период
            </div>
          </div>
        </Card>
      </div>
      
      {/* Edit Review Modal - Full Screen */}
      {editReviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="h-screen flex flex-col">
            {/* Header */}
            <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
              <h2 className="text-lg font-bold">Редактирай отзив</h2>
              <Button 
                onClick={() => setEditReviewModalOpen(false)} 
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
                  <label className="text-sm font-medium">Тип</label>
                  <Select value={editReviewType} onValueChange={(value: "praise" | "warning") => setEditReviewType(value)}>
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warning">Забележка</SelectItem>
                      <SelectItem value="praise">Похвала</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Вид {editReviewType === "praise" ? "похвала" : "забележка"}</label>
                  <Select value={editReviewBadgeType} onValueChange={setEditReviewBadgeType}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Изберете вид" />
                    </SelectTrigger>
                    <SelectContent>
                      {editReviewType === "praise" ? (
                        <>
                          <SelectItem value="general_praise">Обща похвала</SelectItem>
                          <SelectItem value="active_participation">Активно участие</SelectItem>
                          <SelectItem value="excellent_presentation">Отлично представяне</SelectItem>
                          <SelectItem value="completed_task">Изпълнена задача</SelectItem>
                          <SelectItem value="curiosity">Любознателност</SelectItem>
                          <SelectItem value="diligence">Прилежност</SelectItem>
                          <SelectItem value="progress">Напредък</SelectItem>
                          <SelectItem value="communication">Добра комуникация</SelectItem>
                          <SelectItem value="sharp_mind">Остър ум</SelectItem>
                          <SelectItem value="concentration">Концентрация</SelectItem>
                          <SelectItem value="creativity">Креативност</SelectItem>
                          <SelectItem value="teamwork">Работа в екип</SelectItem>
                          <SelectItem value="leadership">Лидерство</SelectItem>
                          <SelectItem value="patriotism">Патриотизъм</SelectItem>
                          <SelectItem value="tolerance">Толерантност</SelectItem>
                          <SelectItem value="emotional_intelligence">Емоционална интелигентност</SelectItem>
                          <SelectItem value="presentation_skills">Умения за презентиране</SelectItem>
                          <SelectItem value="digital_skills">Дигитални умения</SelectItem>
                          <SelectItem value="musical_culture">Музикална култура</SelectItem>
                          <SelectItem value="physical_culture">Физическа култура</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="general_remark">Обща забележка</SelectItem>
                          <SelectItem value="bad_discipline">Лоша дисциплина</SelectItem>
                          <SelectItem value="lack_of_attention">Липса на внимание</SelectItem>
                          <SelectItem value="official_remark">Официална забележка</SelectItem>
                          <SelectItem value="disrespect">Неуважение</SelectItem>
                          <SelectItem value="aggression">Агресия</SelectItem>
                          <SelectItem value="removed_from_class">Отстранен от час</SelectItem>
                          <SelectItem value="late">Закъснение</SelectItem>
                          <SelectItem value="absence">Отсъствие</SelectItem>
                          <SelectItem value="poor_performance">Слабо представяне</SelectItem>
                          <SelectItem value="unprepared">Без подготовка</SelectItem>
                          <SelectItem value="no_homework">Без домашна работа</SelectItem>
                          <SelectItem value="no_textbook">Без учебно помагало</SelectItem>
                          <SelectItem value="no_materials">Без учебни пособия</SelectItem>
                          <SelectItem value="no_equipment">Без екип</SelectItem>
                          <SelectItem value="no_uniform">Без униформа</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Коментар</label>
                  <textarea
                    className="w-full px-3 py-3 border border-input rounded text-base bg-background text-foreground placeholder:text-muted-foreground resize-none min-h-[120px]"
                    value={editReviewContent}
                    onChange={(e) => setEditReviewContent(e.target.value)}
                    placeholder="Въведете коментар (по желание)"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-muted/30 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditReviewModalOpen(false)}
              >
                Отказ
              </Button>
              <Button
                onClick={handleSaveEditedReview}
                className="bg-green-600 hover:bg-green-700"
              >
                Запази
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClassReviews() {
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
          <ClassReviewsInner />
        </DiaryAccessGuard>
      </Authenticated>
    </Layout>
  );
}
