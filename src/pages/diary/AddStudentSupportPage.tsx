import { useState } from "react";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { toast } from "sonner";
import { ArrowLeftIcon, PlusIcon, MinusIcon, InfoIcon, MaximizeIcon } from "lucide-react";
import { cn, formatUserName } from "@/lib/utils.ts";
import { Calendar } from "@/components/ui/calendar.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { bg } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";

// Основания (Reasons)
const SUPPORT_REASONS = [
  { value: "learning_difficulties", label: "Затруднения в обучението" },
  { value: "risk_factors", label: "Рискови фактори в средата" },
  { value: "behavior_problems", label: "Проблемно поведение" },
  { value: "chronic_illness", label: "Хронично заболяване" },
  { value: "advanced", label: "Напредва по-бързо от останалите" },
  { value: "other", label: "Друго" },
];

// Дейности (Activities) - organized by category
const SUPPORT_ACTIVITIES = [
  { value: "general_additional_training", label: "(Обща подкрепа) Допълнително обучение", category: "Обща подкрепа" },
  { value: "general_additional_bel", label: "(Обща подкрепа) Допълнителен БЕЛ", category: "Обща подкрепа" },
  { value: "general_consultation_subject", label: "(Обща подкрепа) Консултация (по предмет)", category: "Обща подкрепа" },
  { value: "general_team_work", label: "(Обща подкрепа) Екипна работа между учители", category: "Обща подкрепа" },
  { value: "general_career_orientation", label: "(Обща подкрепа) Кариерно ориентиране", category: "Обща подкрепа" },
  { value: "general_interests", label: "(Обща подкрепа) Занимания по интереси", category: "Обща подкрепа" },
  { value: "general_health_care", label: "(Обща подкрепа) Грижа за здравето", category: "Обща подкрепа" },
  { value: "general_behavior_prevention", label: "(Обща подкрепа) Превенция на проблемно поведение", category: "Обща подкрепа" },
  { value: "general_learning_prevention", label: "(Обща подкрепа) Превенция на обучителни затруднения", category: "Обща подкрепа" },
  { value: "general_speech_therapist", label: "(Обща подкрепа) Логопед", category: "Обща подкрепа" },
  { value: "general_consultation", label: "(Обща подкрепа) Консултация", category: "Обща подкрепа" },
  { value: "general_psychological", label: "(Обща подкрепа) Психологическо консултиране", category: "Обща подкрепа" },
  { value: "general_healthy_lifestyle", label: "(Обща подкрепа) Здравословен начин на живот", category: "Обща подкрепа" },
  { value: "general_cultural_educational", label: "(Обща подкрепа) Културно - образователни дейности", category: "Обща подкрепа" },
  { value: "general_school_projects", label: "(Обща подкрепа) Училищни проекти", category: "Обща подкрепа" },
  { value: "general_cultural_tourism", label: "(Обща подкрепа) Културно - опознавателен туризъм", category: "Обща подкрепа" },
  { value: "general_case_work", label: "(Обща подкрепа) Работа по конкретен случай", category: "Обща подкрепа" },
  { value: "additional_case_work", label: "(Допълнителна подкрепа) Работа по конкретен случай", category: "Допълнителна подкрепа" },
  { value: "additional_psycho_social", label: "(Допълнителна подкрепа) Психо-социална рехабилитация", category: "Допълнителна подкрепа" },
  { value: "additional_accessible_env", label: "(Допълнителна подкрепа) Осигуряване на достъпна среда", category: "Допълнителна подкрепа" },
  { value: "additional_sensory_training", label: "(Допълнителна подкрепа) Обучение за ученици със сензорни увреждания", category: "Допълнителна подкрепа" },
  { value: "additional_resource_support", label: "(Допълнителна подкрепа) Ресурсно подпомагане (по предмет)", category: "Допълнителна подкрепа" },
  { value: "additional_communication_rehab", label: "(Допълнителна подкрепа) Рехабилитация на комуникативни нарушения", category: "Допълнителна подкрепа" },
  { value: "additional_psychological", label: "(Допълнителна подкрепа) Психологическо консултиране", category: "Допълнителна подкрепа" },
  { value: "additional_hearing_speech", label: "(Допълнителна подкрепа) Рехабилитация на слуха и говора", category: "Допълнителна подкрепа" },
  { value: "additional_visual_rehab", label: "(Допълнителна подкрепа) Зрителна рехабилитация", category: "Допълнителна подкрепа" },
  { value: "additional_communication", label: "(Допълнителна подкрепа) Рехабилитация на комуникативните", category: "Допълнителна подкрепа" },
  { value: "additional_social_skills", label: "(Допълнителна подкрепа) Социални умения", category: "Допълнителна подкрепа" },
  { value: "additional_art_therapy", label: "(Допълнителна подкрепа) Арттерапия", category: "Допълнителна подкрепа" },
  { value: "additional_music_therapy", label: "(Допълнителна подкрепа) Музикотерапия", category: "Допълнителна подкрепа" },
  { value: "additional_work_therapy", label: "(Допълнителна подкрепа) Трудотерапия", category: "Допълнителна подкрепа" },
  { value: "additional_speech_therapist", label: "(Допълнителна подкрепа) Логопед", category: "Допълнителна подкрепа" },
  { value: "admin_other", label: "(Административна дейност) Друга", category: "Административна дейност" },
];

function AddStudentSupportInner() {
  const navigate = useNavigate();
  const { classId } = useParams<{ classId: string }>();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  
  // Form state
  const [selectedStudents, setSelectedStudents] = useState<string[]>([""]);
  const [reason, setReason] = useState<string>("");
  const [activity, setActivity] = useState<string>("");
  const [date, setDate] = useState<Date>(new Date());
  const [dateOpen, setDateOpen] = useState(false);
  const [subjectId, setSubjectId] = useState<string>("");
  const [teacherId, setTeacherId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const classData = useQuery(
    api.admin.getClassById,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  const allStudents = useQuery(
    api.admin.getStudentsByClass,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  const subjects = useQuery(
    api.weeklySchedules.getTeacherSubjectsFromScheduleOnly,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  const teachers = useQuery(api.admin.listTeachersWithNames, {});
  const currentUser = useQuery(api.users.getCurrentUser, {});
  
  // Get existing record for editing
  const supportRecords = useQuery(
    api.studentSupport.getStudentSupportByClass,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  const bulkCreateSupport = useMutation(api.studentSupport.bulkCreateStudentSupport);
  const updateSupport = useMutation(api.studentSupport.updateStudentSupport);
  
  // Load edit data
  const editRecord = editId ? supportRecords?.find(r => r._id === editId) : null;
  
  // Set initial values for edit mode
  if (editRecord && selectedStudents[0] === "" && !reason) {
    setSelectedStudents([editRecord.studentId]);
    setReason(editRecord.reason || "");
    setActivity(editRecord.activity || editRecord.supportType || "");
    setDate(new Date(editRecord.date || editRecord.startDate || editRecord.createdAt));
    setSubjectId(editRecord.subjectId || "");
    setTeacherId(editRecord.teacherId || "");
  }
  
  // Auto-select current teacher
  const currentTeacher = teachers?.find(t => t.userId === currentUser?._id);
  if (currentTeacher && !teacherId && !editId) {
    setTeacherId(currentTeacher._id);
  }
  
  const addStudent = () => {
    setSelectedStudents([...selectedStudents, ""]);
  };
  
  const removeStudent = (index: number) => {
    if (selectedStudents.length > 1) {
      setSelectedStudents(selectedStudents.filter((_, i) => i !== index));
    }
  };
  
  const updateStudent = (index: number, value: string) => {
    const newStudents = [...selectedStudents];
    newStudents[index] = value;
    setSelectedStudents(newStudents);
  };
  
  const handleSave = async (andAdd: boolean = false) => {
    // Validate
    const validStudents = selectedStudents.filter(s => s && s !== "");
    if (validStudents.length === 0) {
      toast.error("Моля, изберете поне един ученик");
      return;
    }
    if (!reason) {
      toast.error("Моля, изберете основание");
      return;
    }
    if (!activity) {
      toast.error("Моля, изберете дейност");
      return;
    }
    if (!teacherId) {
      toast.error("Моля, изберете учител");
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (editId) {
        await updateSupport({
          id: editId as Id<"studentSupport">,
          reason,
          activity,
          date: date.getTime(),
          subjectId: subjectId ? subjectId as Id<"subjects"> : undefined,
          teacherId: teacherId as Id<"teachers">,
        });
        toast.success("Записът е обновен успешно!");
        navigate(`/bg/diary/class/${classId}/student-support`);
      } else {
        await bulkCreateSupport({
          classId: classId as Id<"classes">,
          studentIds: validStudents as Id<"students">[],
          reason,
          activity,
          date: date.getTime(),
          subjectId: subjectId ? subjectId as Id<"subjects"> : undefined,
          teacherId: teacherId as Id<"teachers">,
        });
        toast.success(`Добавени ${validStudents.length} записа успешно!`);
        
        if (andAdd) {
          // Reset form for another entry
          setSelectedStudents([""]);
          setReason("");
          setActivity("");
          setDate(new Date());
          setSubjectId("");
        } else {
          navigate(`/bg/diary/class/${classId}/student-support`);
        }
      }
    } catch (error) {
      toast.error("Грешка при запазване");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Get teacher display name
  const getTeacherDisplayName = (teacher: { name: string; userId: Id<"users">; roles?: string[] }) => {
    const roleLabels: string[] = [];
    if (teacher.roles?.includes("director")) roleLabels.push("Директор");
    else if (teacher.roles?.includes("vice_director")) roleLabels.push("Зам. директор");
    else if (teacher.roles?.includes("system_admin")) roleLabels.push("Системен администратор");
    return roleLabels.length > 0 ? `${teacher.name} (${roleLabels.join(", ")})` : teacher.name;
  };
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">
              {editId ? "Редактиране на" : "Добавяне на"} ученическа подкрепа в {classData?.name}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/bg/diary/class/${classId}/student-support`)}
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Назад
            </Button>
            <Button
              variant="default"
              size="sm"
              className="bg-cyan-500 hover:bg-cyan-600"
              onClick={() => handleSave(false)}
              disabled={isSubmitting}
            >
              Запиши
            </Button>
            {!editId && (
              <Button
                variant="default"
                size="sm"
                className="bg-green-500 hover:bg-green-600"
                onClick={() => handleSave(true)}
                disabled={isSubmitting}
              >
                Запиши и добави
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
            >
              <MaximizeIcon className="h-4 w-4 mr-1" />
              Разшири
            </Button>
          </div>
        </div>
      </div>
      
      {/* Form */}
      <div className="max-w-3xl mx-auto p-6">
        <div className="space-y-6">
          {/* Участници (Students) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Участници:</Label>
            {selectedStudents.map((studentId, index) => (
              <div key={index} className="flex items-center gap-2">
                <Select 
                  value={studentId} 
                  onValueChange={(value) => updateStudent(index, value)}
                  disabled={!!editId}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Изберете" />
                  </SelectTrigger>
                  <SelectContent>
                    {allStudents?.map((student) => (
                      <SelectItem 
                        key={student._id} 
                        value={student._id}
                        disabled={selectedStudents.includes(student._id) && studentId !== student._id}
                      >
                        {student.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!editId && (
                  <>
                    <Button
                      type="button"
                      variant="default"
                      size="icon"
                      className="bg-red-500 hover:bg-red-600 h-9 w-9"
                      onClick={() => removeStudent(index)}
                      disabled={selectedStudents.length <= 1}
                    >
                      <MinusIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      size="icon"
                      className="bg-cyan-500 hover:bg-cyan-600 h-9 w-9"
                      onClick={addStudent}
                    >
                      <PlusIcon className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
          
          {/* Основание (Reason) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Основание: <span className="text-red-500">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Изберете" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORT_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.label}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="default"
                size="icon"
                className="bg-red-500 hover:bg-red-600 h-9 w-9"
                onClick={() => setReason("")}
              >
                <MinusIcon className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="default"
                size="icon"
                className="bg-cyan-500 hover:bg-cyan-600 h-9 w-9"
                disabled
              >
                <PlusIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Дата (Date) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Дата: <span className="text-red-500">*</span>
            </Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "dd.MM.yyyy", { locale: bg }) : "Изберете дата"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    if (d) setDate(d);
                    setDateOpen(false);
                  }}
                  locale={bg}
                />
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Дейност (Activity) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1">
              Дейност:
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InfoIcon className="h-4 w-4 text-blue-500 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Изберете вид дейност за ученическа подкрепа</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span className="text-red-500">*</span>
            </Label>
            <Select value={activity} onValueChange={setActivity}>
              <SelectTrigger>
                <SelectValue placeholder="Изберете" />
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                {SUPPORT_ACTIVITIES.map((a) => (
                  <SelectItem key={a.value} value={a.label}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Предмет (Subject) - optional */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Предмет:</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Изберете" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Без предмет --</SelectItem>
                {subjects?.map((subject) => (
                  <SelectItem key={subject.uniqueKey} value={subject.subjectId}>
                    {subject.subjectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Учител (Teacher) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Учител: <span className="text-red-500">*</span>
            </Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger>
                <SelectValue placeholder="Изберете" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {teachers?.map((teacher) => (
                  <SelectItem key={teacher._id} value={teacher._id}>
                    {getTeacherDisplayName(teacher)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AddStudentSupportPage() {
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
        <AddStudentSupportInner />
      </Authenticated>
    </Layout>
  );
}
