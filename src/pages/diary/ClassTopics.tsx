import { useParams, Link, useLocation } from "react-router-dom";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useState, useEffect } from "react";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import { DiaryAccessGuard } from "@/components/DiaryAccessGuard.tsx";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { 
  FilterIcon, 
  UserIcon, 
  ArrowLeftIcon,
  PlusIcon,
  Trash2Icon,
  PencilIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CheckIcon,
  LockIcon,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";

// Topic types for the dropdown with colors
const TOPIC_TYPES = [
  { value: "НЗ", label: "НЗ - Нови знания", color: "bg-emerald-500" },
  { value: "ОС", label: "ОС - Обобщаване и систематизиране", color: "bg-amber-500" },
  { value: "УПР", label: "УПР - Упражнение", color: "bg-sky-500" },
  { value: "ПК", label: "ПК - Проверка и контрол", color: "bg-pink-500" },
  { value: "К", label: "К - Комбиниран урок", color: "bg-purple-500" },
  { value: "Д", label: "Д - Друго", color: "bg-gray-500" },
];

function getTypeColor(typeValue: string): string {
  const type = TOPIC_TYPES.find(t => t.value === typeValue);
  return type?.color || "bg-gray-500";
}

function ClassTopicsInner() {
  const { classId } = useParams<{ classId: string }>();
  const location = useLocation();
  const [selectedSubjectKey, setSelectedSubjectKey] = useState<string | null>(null);
  
  // Build return URL for profile links
  const returnUrl = location.pathname + location.search;
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isScheduleSelectModalOpen, setIsScheduleSelectModalOpen] = useState(false);
  const [isDateSelectModalOpen, setIsDateSelectModalOpen] = useState(false);
  const [topicToMark, setTopicToMark] = useState<Id<"curriculumTopics"> | null>(null);
  const [selectedScheduleEntry, setSelectedScheduleEntry] = useState<{
    dayOfWeek: number;
    periodIndex: number;
    teacherId: Id<"teachers">;
  } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [editingTopic, setEditingTopic] = useState<{
    _id: Id<"curriculumTopics">;
    topicNumber: number;
    weekNumber: number;
    title: string;
    topicType: string;
  } | null>(null);
  
  // Form state for adding topics
  const [topicNumber, setTopicNumber] = useState("");
  const [title, setTitle] = useState("");
  const [topicType, setTopicType] = useState("НЗ");
  
  // Bulk add state - for adding multiple topics at once
  const [bulkTopics, setBulkTopics] = useState<Array<{
    id: string;
    topicNumber: string;
    title: string;
    topicType: string;
  }>>([]);
  
  const classData = useQuery(
    api.admin.getClassById,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  // Get current user and platform settings for access control
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const platformSettings = useQuery(api.platformSettings.getAllSettings, {});

  // High-level roles that can edit ALL topics of ALL subjects
  const isHighRole = currentUser?.roles?.includes("system_admin") ||
    currentUser?.roles?.includes("director") ||
    currentUser?.roles?.includes("vice_director");

  // Teacher role (can edit topics within their own subjects)
  const isTeacher = currentUser?.roles?.includes("teacher") || currentUser?.role === "teacher";

  // Can add/edit topics: high roles or teachers (even if they also have parent/student role)
  const canEditTopics = !!(isHighRole || isTeacher);
  
  // Check if current user is admin (can see class details link)
  const isAdmin = isHighRole;

  // For visibility checks: only restrict if user has ONLY student/parent roles
  const isStudentOrParent = !isHighRole && !isTeacher && (
    currentUser?.role === "student" || 
    currentUser?.role === "parent" ||
    currentUser?.roles?.includes("student") ||
    currentUser?.roles?.includes("parent")
  );

  // Check if topics are visible to students/parents
  const canViewTopics = !isStudentOrParent || (platformSettings?.studentsParentsSeeTopics ?? true);

  // Get only subjects assigned to this class that the current teacher teaches
  // (admins see all subjects)
  const subjects = useQuery(
    api.weeklySchedules.getSubjectsForClassByTeacher,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  // Get the selected subject's actual ID and prep type from uniqueKey
  const selectedSubjectData = subjects?.find((s) => s.uniqueKey === selectedSubjectKey);
  const selectedSubjectId = selectedSubjectData?._id;
  // Extract preparation type from uniqueKey (format: "subjectId__preparationType")
  const selectedPrepType = selectedSubjectKey?.split("__")[1] || undefined;

  // Get topics for the selected subject - filtered by preparation type
  const topics = useQuery(
    api.curriculumPlans.listCurriculumTopics,
    classId && selectedSubjectId
      ? { 
          classId: classId as Id<"classes">, 
          subjectId: selectedSubjectId,
          preparationType: selectedPrepType === "DEFAULT" ? undefined : selectedPrepType,
        }
      : "skip"
  );

  // Get weekly schedule entries for the selected subject
  const scheduleEntries = useQuery(
    api.lessons.getWeeklyScheduleLessonsForSubject,
    classId && selectedSubjectId
      ? { classId: classId as Id<"classes">, subjectId: selectedSubjectId }
      : "skip"
  );

  const createTopic = useMutation(api.curriculumPlans.createCurriculumTopic);
  const updateTopic = useMutation(api.curriculumPlans.updateCurriculumTopic);
  const deleteTopic = useMutation(api.curriculumPlans.deleteCurriculumTopic);
  const markAsCovered = useMutation(api.curriculumPlans.markTopicAsCovered);
  const unmarkAsCovered = useMutation(api.curriculumPlans.unmarkTopicAsCovered);
  const createOrGetLesson = useMutation(api.lessons.createOrGetLesson);

  // Auto-select first subject using uniqueKey
  useEffect(() => {
    if (subjects && subjects.length > 0 && !selectedSubjectKey) {
      setSelectedSubjectKey(subjects[0].uniqueKey);
    }
  }, [subjects, selectedSubjectKey]);

  // Check if ВЧК should be shown
  const showVCK = platformSettings?.showSecondClassHour ?? true;

  const stats = [
    { label: "Оц.", link: `/bg/diary/class/${classId}/grades` },
    { label: "Отс.", link: `/bg/diary/class/${classId}/absences` },
    { label: "Отз.", link: `/bg/diary/class/${classId}/reviews` },
    { label: "Раз.", link: `/bg/diary/class/${classId}/schedule` },
    { label: "Тем.", link: `/bg/diary/class/${classId}/topics` },
    { label: "Кон.", link: `/bg/diary/class/${classId}/tests` },
    { label: "Дом.", link: `/bg/diary/class/${classId}/homework` },
    ...(showVCK ? [{ label: "ВЧК", link: `/bg/diary/class/${classId}/internal-commission` }] : []),
    { label: "Род.", link: `/bg/diary/class/${classId}/parent-meetings` },
    { label: "Поп.", link: `/bg/diary/class/${classId}/remedial-exams` },
    { label: "Под.", link: `/bg/diary/class/${classId}/student-support` },
    { label: "Сан.", link: `/bg/diary/class/${classId}/sanctions` },
    { label: "Год.", link: `/bg/diary/class/${classId}/annual-results` },
    { label: "Уч.", link: `/bg/diary/class/${classId}/students` },
  ];

  const resetForm = () => {
    setTopicNumber("");
    setTitle("");
    setTopicType("НЗ");
  };

  const handleOpenAddModal = () => {
    resetForm();
    // Pre-fill with 5 empty rows, starting from next topic number
    const nextNumber = topics && topics.length > 0 
      ? Math.max(...topics.map(t => t.topicNumber)) + 1 
      : 1;
    
    const initialTopics = Array.from({ length: 5 }, (_, i) => ({
      id: crypto.randomUUID(),
      topicNumber: String(nextNumber + i),
      title: "",
      topicType: "НЗ",
    }));
    setBulkTopics(initialTopics);
    setIsAddModalOpen(true);
  };

  const handleAddMoreRows = () => {
    const lastNumber = bulkTopics.length > 0 
      ? Math.max(...bulkTopics.filter(t => t.topicNumber).map(t => parseInt(t.topicNumber) || 0))
      : (topics && topics.length > 0 ? Math.max(...topics.map(t => t.topicNumber)) : 0);
    
    const newTopics = Array.from({ length: 5 }, (_, i) => ({
      id: crypto.randomUUID(),
      topicNumber: String(lastNumber + i + 1),
      title: "",
      topicType: "НЗ",
    }));
    setBulkTopics(prev => [...prev, ...newTopics]);
  };

  const handleUpdateBulkTopic = (id: string, field: keyof typeof bulkTopics[0], value: string) => {
    setBulkTopics(prev => prev.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const handleRemoveBulkTopic = (id: string) => {
    setBulkTopics(prev => prev.filter(t => t.id !== id));
  };

  const handleBulkApplyType = (type: string) => {
    setBulkTopics(prev => prev.map(t => ({ ...t, topicType: type })));
    toast.success(`Тип "${type}" е приложен за всички`);
  };

  const handleOpenEditModal = (topic: typeof editingTopic) => {
    if (!topic) return;
    setEditingTopic(topic);
    setTopicNumber(String(topic.topicNumber));
    setTitle(topic.title);
    setTopicType(topic.topicType);
    setIsEditModalOpen(true);
  };

  const handleAddTopics = async () => {
    if (!classId || !selectedSubjectId) {
      toast.error("Моля, изберете предмет");
      return;
    }

    // Filter valid topics (those with title)
    const validTopics = bulkTopics.filter(t => t.title.trim() && t.topicNumber);
    
    if (validTopics.length === 0) {
      toast.error("Моля, въведете поне една тема");
      return;
    }

    try {
      let addedCount = 0;
      for (const topic of validTopics) {
        await createTopic({
          classId: classId as Id<"classes">,
          subjectId: selectedSubjectId,
          title: topic.title.trim(),
          topicNumber: parseInt(topic.topicNumber),
          weekNumber: 1,
          topicType: topic.topicType,
          academicYear: classData?.academicYear || "2024/2025",
          preparationType: selectedPrepType === "DEFAULT" ? undefined : selectedPrepType,
        });
        addedCount++;
      }
      toast.success(`Успешно добавени ${addedCount} теми`);
      setIsAddModalOpen(false);
      setBulkTopics([]);
    } catch (error) {
      toast.error("Грешка при добавяне на теми");
    }
  };

  const handleUpdateTopic = async () => {
    if (!editingTopic || !title.trim() || !topicNumber) {
      toast.error("Моля, попълнете всички полета");
      return;
    }

    try {
      await updateTopic({
        topicId: editingTopic._id,
        title: title.trim(),
        topicNumber: parseInt(topicNumber),
        weekNumber: editingTopic.weekNumber, // Keep existing week number
        topicType,
      });
      toast.success("Темата е обновена успешно");
      setIsEditModalOpen(false);
      setEditingTopic(null);
      resetForm();
    } catch (error) {
      toast.error("Грешка при обновяване на тема");
    }
  };

  const handleDeleteTopic = async (topicId: Id<"curriculumTopics">) => {
    if (!confirm("Сигурни ли сте, че искате да изтриете тази тема?")) return;

    try {
      await deleteTopic({ topicId });
      toast.success("Темата е изтрита успешно");
    } catch (error) {
      toast.error("Грешка при изтриване на тема");
    }
  };

  const handleOpenLessonSelectModal = (topicId: Id<"curriculumTopics">) => {
    setTopicToMark(topicId);
    setSelectedScheduleEntry(null);
    setSelectedDate("");
    setIsScheduleSelectModalOpen(true);
  };

  const handleSelectScheduleEntry = (entry: { dayOfWeek: number; periodIndex: number; teacherId: Id<"teachers"> }) => {
    setSelectedScheduleEntry(entry);
    // Set default date to today if it matches the day of week, otherwise next occurrence
    const today = new Date();
    const currentDayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
    
    let targetDate: Date;
    if (currentDayOfWeek === entry.dayOfWeek) {
      targetDate = today;
    } else {
      const daysUntilTarget = (entry.dayOfWeek - currentDayOfWeek + 7) % 7 || 7;
      targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() - (7 - daysUntilTarget) - 7); // Go back to last week
    }
    
    setSelectedDate(targetDate.toISOString().split("T")[0]);
    setIsScheduleSelectModalOpen(false);
    setIsDateSelectModalOpen(true);
  };

  const handleMarkAsCovered = async () => {
    if (!topicToMark || !selectedScheduleEntry || !selectedDate || !classId || !selectedSubjectId) {
      toast.error("Моля, изберете час и дата");
      return;
    }

    try {
      // Parse the selected date and create a UTC timestamp
      const [year, month, day] = selectedDate.split("-").map(Number);
      const dateTimestamp = Date.UTC(year, month - 1, day, 0, 0, 0, 0);

      // Create or get the lesson for the selected schedule entry and date
      const lessonId = await createOrGetLesson({
        classId: classId as Id<"classes">,
        subjectId: selectedSubjectId,
        teacherId: selectedScheduleEntry.teacherId,
        date: dateTimestamp,
        periodIndex: selectedScheduleEntry.periodIndex,
      });

      // Mark the topic as covered with the lesson
      await markAsCovered({
        topicId: topicToMark,
        lessonId: lessonId,
      });
      
      toast.success("Темата е маркирана като взета");
      setIsDateSelectModalOpen(false);
      setTopicToMark(null);
      setSelectedScheduleEntry(null);
      setSelectedDate("");
    } catch (error) {
      toast.error("Грешка при маркиране на тема");
    }
  };

  const handleUnmarkAsCovered = async (topicId: Id<"curriculumTopics">) => {
    try {
      await unmarkAsCovered({ topicId });
      toast.success("Темата е маркирана като невзета");
    } catch (error) {
      toast.error("Грешка при обновяване на статуса");
    }
  };

  if (!classData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Access denied for students/parents if setting is disabled
  if (!canViewTopics) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <div className="border-b bg-background">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-4">
              <Link to={`/bg/diary/class/${classId}`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeftIcon className="h-4 w-4 mr-2" />
                  Назад
                </Button>
              </Link>
              <h1 className="text-xl font-semibold">
                {classData?.grade}{classData?.letter} - Теми
              </h1>
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center space-y-4">
            <LockIcon className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">Достъпът е ограничен</h2>
            <p className="text-muted-foreground max-w-md">
              Преглеждането на теми не е разрешено от настройките на училището.
            </p>
            <Link to={`/bg/diary/class/${classId}`}>
              <Button variant="outline">
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Обратно към класа
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const classTeacher = classData.classTeacher;

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link to={`/bg/diary/class/${classId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Назад
              </Button>
            </Link>
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
          </div>
          <Button variant="outline" size="sm">
            <FilterIcon className="h-4 w-4 mr-2" />
            Филтри
          </Button>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-2 px-6 py-2 border-t overflow-x-auto">
          {stats.map((stat, index) => (
            <Link
              key={index}
              to={stat.link}
              className={cn(
                "px-4 py-2 text-sm font-medium whitespace-nowrap rounded transition-colors",
                stat.link === `/bg/diary/class/${classId}/topics`
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
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* Left Sidebar - Subjects */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r bg-background overflow-y-auto shrink-0">
          <div className="p-2 md:p-4 flex md:flex-col gap-1 md:gap-2 overflow-x-auto md:overflow-x-visible">
            {subjects && subjects.length > 0 ? (
              subjects.map((subject) => (
                <button
                  key={subject.uniqueKey}
                  onClick={() => setSelectedSubjectKey(subject.uniqueKey)}
                  className={cn(
                    "flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm rounded-lg transition-colors whitespace-nowrap shrink-0 md:w-full",
                    selectedSubjectKey === subject.uniqueKey
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <div className="w-1.5 md:w-2 h-1.5 md:h-2 rounded-full bg-primary shrink-0" />
                  <span className="truncate">{subject.displayName}</span>
                </button>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-4 text-sm">
                Няма добавени предмети към паралелката
              </div>
            )}
          </div>
        </div>

        {/* Center Content - Topics Table */}
        <div className="flex-1 overflow-y-auto p-3 md:p-6">
          {selectedSubjectKey ? (
            <Card className="p-3 md:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
                <h2 className="text-base md:text-lg font-semibold">
                  {selectedSubjectData?.displayName || "Предмет"} ({classData.name})
                </h2>
                {canEditTopics && (
                  <Button onClick={handleOpenAddModal} size="sm" className="shrink-0">
                    <PlusIcon className="h-4 w-4 mr-1 md:mr-2" />
                    <span className="hidden sm:inline">Добави тема</span>
                    <span className="sm:hidden">Добави</span>
                  </Button>
                )}
              </div>

              <div className="overflow-x-auto -mx-3 md:mx-0">
                <table className="w-full border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-center py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-medium border w-10 md:w-16">
                        №
                      </th>
                      <th className="text-center py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-medium border w-20 md:w-28">
                        Взета
                      </th>
                      <th className="text-center py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-medium border w-12 md:w-16">
                        Тип
                      </th>
                      <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-medium border">
                        Тема
                      </th>
                      {canEditTopics && (
                        <th className="text-center py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm font-medium border w-20 md:w-28">
                          
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {topics && topics.length > 0 ? (
                      topics.map((topic) => (
                        <tr 
                          key={topic._id} 
                          className={cn(
                            topic.isCovered 
                              ? "bg-emerald-100 dark:bg-emerald-900/30" 
                              : "bg-white dark:bg-background hover:bg-muted/50"
                          )}
                        >
                          {/* № with checkmark */}
                          <td className="py-1.5 md:py-2 px-2 md:px-4 border text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              {topic.isCovered && (
                                <CheckIcon className="h-3 md:h-4 w-3 md:w-4 text-emerald-600" />
                              )}
                              <span className="text-xs md:text-sm">{topic.topicNumber}</span>
                            </div>
                          </td>
                          
                          {/* Взета на */}
                          <td className="py-1.5 md:py-2 px-2 md:px-4 border text-center text-xs md:text-sm">
                            {topic.isCovered && topic.coveredDate 
                              ? new Date(topic.coveredDate).toLocaleDateString("bg-BG")
                              : "—"}
                          </td>
                          
                          {/* Тип badge */}
                          <td className="py-1.5 md:py-2 px-2 md:px-4 border text-center">
                            <span className={cn(
                              "inline-flex items-center justify-center px-1.5 md:px-2 py-0.5 text-[10px] md:text-xs font-medium text-white rounded",
                              getTypeColor(topic.topicType)
                            )}>
                              {topic.topicType}
                            </span>
                          </td>
                          
                          {/* Тема */}
                          <td className="py-1.5 md:py-2 px-2 md:px-4 border text-xs md:text-sm">
                            {topic.title}
                          </td>
                          
                          {/* Действия */}
                          {canEditTopics && (
                            <td className="py-1.5 md:py-2 px-1 md:px-4 border">
                              <div className="flex items-center justify-center gap-0">
                                {topic.isCovered ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleUnmarkAsCovered(topic._id)}
                                    title="Маркирай като невзета"
                                    className="h-7 w-7 md:h-8 md:w-8 p-0 text-emerald-600"
                                  >
                                    <XCircleIcon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenLessonSelectModal(topic._id)}
                                    title="Маркирай като взета"
                                    className="h-7 w-7 md:h-8 md:w-8 p-0"
                                  >
                                    <CheckCircleIcon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenEditModal({
                                    _id: topic._id,
                                    topicNumber: topic.topicNumber,
                                    weekNumber: topic.weekNumber,
                                    title: topic.title,
                                    topicType: topic.topicType,
                                  })}
                                  className="h-7 w-7 md:h-8 md:w-8 p-0"
                                >
                                  <PencilIcon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteTopic(topic._id)}
                                  className="h-7 w-7 md:h-8 md:w-8 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 md:py-12 text-center text-muted-foreground text-sm">
                          Все още не е въведено тематично разпределение за този предмет.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-sm">Изберете предмет</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Topics Modal - Full Screen with Table */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="h-screen flex flex-col">
            {/* Header */}
            <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                Добави теми за {selectedSubjectData?.displayName || "Предмет"} ({classData?.name})
              </h2>
              <Button 
                onClick={() => {
                  setIsAddModalOpen(false);
                  setBulkTopics([]);
                }} 
                variant="ghost"
                size="sm"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Назад
              </Button>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full border-collapse">
                <thead className="bg-muted sticky top-0 z-10">
                  <tr>
                    <th className="text-center py-2 px-2 text-xs font-bold border-b-2 border-r border-border w-16">№</th>
                    <th className="text-center py-2 px-2 text-xs font-bold border-b-2 border-r border-border w-28">Тип</th>
                    <th className="text-left py-2 px-2 text-xs font-bold border-b-2 border-r border-border">Тема</th>
                    <th className="text-center py-2 px-2 text-xs font-bold border-b-2 border-border w-16">X</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkTopics.map((topic) => (
                    <tr key={topic.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="py-1 px-2 border-r border-border">
                        <Input
                          type="number"
                          value={topic.topicNumber}
                          onChange={(e) => handleUpdateBulkTopic(topic.id, "topicNumber", e.target.value)}
                          className="w-full h-8 text-center text-sm bg-background"
                          min="1"
                        />
                      </td>
                      <td className="py-1 px-2 border-r border-border">
                        <Select 
                          value={topic.topicType} 
                          onValueChange={(value) => handleUpdateBulkTopic(topic.id, "topicType", value)}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TOPIC_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                <span className={cn("inline-block w-2 h-2 rounded-full mr-2", type.color)} />
                                {type.value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-1 px-2 border-r border-border">
                        <Input
                          value={topic.title}
                          onChange={(e) => handleUpdateBulkTopic(topic.id, "title", e.target.value)}
                          placeholder="Въведете темата..."
                          className="w-full h-8 text-sm bg-background"
                        />
                      </td>
                      <td className="py-1 px-2 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveBulkTopic(topic.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2Icon className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer with bulk apply and save button */}
            <div className="p-3 md:p-4 border-t bg-muted/30">
              {/* Bulk apply row */}
              <div className="mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-xs font-medium text-primary mb-2">Приложи за всички редове:</p>
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-muted-foreground">Тип:</span>
                  {TOPIC_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => handleBulkApplyType(type.value)}
                      className={cn(
                        "px-2 py-1 rounded text-xs font-medium text-white transition-all hover:opacity-80",
                        type.color
                      )}
                      title={type.label}
                    >
                      {type.value}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <Button 
                  variant="outline"
                  onClick={handleAddMoreRows}
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Добави още 5 реда
                </Button>
                <Button 
                  onClick={handleAddTopics}
                  size="lg" 
                  className="bg-teal-600 hover:bg-teal-700 min-w-[200px]"
                >
                  Запази темите ({bulkTopics.filter(t => t.title.trim()).length})
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Topic Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактиране на тема</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editTopicNumber">№</Label>
              <Input
                id="editTopicNumber"
                type="number"
                value={topicNumber}
                onChange={(e) => setTopicNumber(e.target.value)}
                placeholder="1"
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editTopicType">Тип</Label>
              <Select value={topicType} onValueChange={setTopicType}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TOPIC_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editTitle">Тема</Label>
              <Input
                id="editTitle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Въведете име на темата"
                className="bg-background"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditModalOpen(false);
              setEditingTopic(null);
              resetForm();
            }}>
              Отказ
            </Button>
            <Button onClick={handleUpdateTopic}>
              Запази
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Entry Selection Modal */}
      <Dialog open={isScheduleSelectModalOpen} onOpenChange={setIsScheduleSelectModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Изберете час от разписанието</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {scheduleEntries && scheduleEntries.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {scheduleEntries.map((entry, index) => {
                  const dayNames = ["", "Понеделник", "Вторник", "Сряда", "Четвъртък", "Петък", "Събота", "Неделя"];
                  return (
                    <button
                      key={index}
                      onClick={() => handleSelectScheduleEntry(entry)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors text-left"
                    >
                      <ClockIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">
                          {dayNames[entry.dayOfWeek]} - {entry.periodIndex}. час
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {entry.teacherName}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Няма часове по този предмет в разписанието.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsScheduleSelectModalOpen(false);
              setTopicToMark(null);
            }}>
              Отказ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Date Selection Modal */}
      <Dialog open={isDateSelectModalOpen} onOpenChange={setIsDateSelectModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Изберете дата</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {selectedScheduleEntry && (
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                <div className="font-medium text-foreground">
                  {["", "Понеделник", "Вторник", "Сряда", "Четвъртък", "Петък", "Събота", "Неделя"][selectedScheduleEntry.dayOfWeek]} - {selectedScheduleEntry.periodIndex}. час
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="lessonDate">Дата на провеждане</Label>
              <Input
                id="lessonDate"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-background"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsDateSelectModalOpen(false);
              setSelectedScheduleEntry(null);
              setSelectedDate("");
              setIsScheduleSelectModalOpen(true);
            }}>
              Назад
            </Button>
            <Button onClick={handleMarkAsCovered} disabled={!selectedDate}>
              Потвърди
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ClassTopics() {
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
          <ClassTopicsInner />
        </DiaryAccessGuard>
      </Authenticated>
    </Layout>
  );
}
