import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { useParams, useNavigate } from "react-router-dom";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { Calendar } from "@/components/ui/calendar.tsx";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { bg } from "date-fns/locale";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";

export default function AddTestPage() {
  const navigate = useNavigate();
  const { classId, testId } = useParams<{ classId: string; testId?: string }>();
  const isEditMode = Boolean(testId);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [type, setType] = useState("Контролна работа");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const currentUser = useQuery(api.users.getCurrentUser, {});

  // Load existing test data for edit mode
  const existingTest = useQuery(
    api.assignments.getAssignmentById,
    testId ? { assignmentId: testId as Id<"assignments"> } : "skip"
  );
  
  // Get subjects from actual schedule entries only
  const teacherScheduleSubjects = useQuery(
    api.weeklySchedules.getTeacherSubjectsFromScheduleOnly,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  // For admin editing - get all class subjects 
  const classSubjectsData = useQuery(
    api.admin.getClassSubjectsTeachers,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  const isAdmin = currentUser?.roles?.includes("director") || 
                  currentUser?.roles?.includes("vice_director") ||
                  currentUser?.roles?.includes("system_admin");

  // Use class subjects for admins (they may not have schedule entries), teacher schedule for teachers
  const subjectsToShow = isAdmin && (!teacherScheduleSubjects || teacherScheduleSubjects.length === 0)
    ? classSubjectsData?.map(cs => ({
        uniqueKey: cs.subjectId,
        subjectId: cs.subjectId,
        subjectName: cs.subjectName,
      })) || []
    : teacherScheduleSubjects || [];

  const teachers = useQuery(api.admin.listTeachersWithNames, {});
  const teacherData = currentUser && teachers 
    ? teachers.find(t => t.userId === currentUser._id)
    : undefined;

  const createAssignment = useMutation(api.assignments.createAssignment);
  const updateAssignment = useMutation(api.assignments.updateAssignment);

  // Pre-fill form when editing
  useEffect(() => {
    if (isEditMode && existingTest && !hasLoaded) {
      setTitle(existingTest.title || "");
      if (existingTest.subjectId) setSubject(existingTest.subjectId);
      setType(existingTest.type || "Контролна работа");
      setDescription(existingTest.description || "");
      if (existingTest.dueDate) setDueDate(new Date(existingTest.dueDate));
      setHasLoaded(true);
    }
  }, [isEditMode, existingTest, hasLoaded]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Моля, въведете заглавие");
      return;
    }
    if (!subject) {
      toast.error("Моля, изберете предмет");
      return;
    }
    if (!dueDate) {
      toast.error("Моля, изберете дата");
      return;
    }

    // For edit mode, we don't need teacherData if user is admin
    if (!isEditMode && !teacherData && !isAdmin) {
      toast.error("Не сте оторизиран да добавяте контролни работи");
      return;
    }

    const dateTimestamp = dueDate.getTime();
    setIsSaving(true);

    try {
      if (isEditMode && testId) {
        await updateAssignment({
          assignmentId: testId as Id<"assignments">,
          title: title.trim(),
          type,
          description: description.trim() || undefined,
          dueDate: dateTimestamp,
          subjectId: subject as Id<"subjects">,
        });
        toast.success("Контролната работа е обновена успешно!");
      } else {
        // Get teacher ID - use current user's teacher record, or for admin find the first teacher for this subject
        let teacherId = teacherData?._id;
        
        if (!teacherId && isAdmin && teachers) {
          // Admin creating - use the first teacher record available
          const firstTeacher = teachers[0];
          if (firstTeacher) {
            teacherId = firstTeacher._id as Id<"teachers">;
          }
        }

        if (!teacherId) {
          toast.error("Не е намерен учител за създаване на контролна работа");
          setIsSaving(false);
          return;
        }

        await createAssignment({
          classId: classId as Id<"classes">,
          subjectId: subject as Id<"subjects">,
          teacherId: teacherId as Id<"teachers">,
          title: title.trim(),
          type,
          description: description.trim() || undefined,
          dueDate: dateTimestamp,
        });
        toast.success("Успешно добавена контролна работа!");
      }
      navigate(`/bg/diary/class/${classId}/tests`);
    } catch (error) {
      console.error(error);
      toast.error("Грешка при запазване");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            {isEditMode ? "Редактирай контролна работа" : "Добави контролна работа"}
          </h1>
          <Button variant="ghost" onClick={() => navigate(`/bg/diary/class/${classId}/tests`)}>
            Отказ
          </Button>
        </div>

        <div className="bg-background border rounded-lg p-6 space-y-4">
          <div>
            <Label htmlFor="title">Заглавие *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Контролна работа по математика"
            />
          </div>

          <div>
            <Label htmlFor="subject">Предмет *</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Изберете предмет" />
              </SelectTrigger>
              <SelectContent>
                {subjectsToShow.map((s) => (
                  <SelectItem key={s.uniqueKey || s.subjectId} value={s.subjectId}>
                    {s.subjectName}
                  </SelectItem>
                ))}
                {subjectsToShow.length === 0 && (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    Нямате часове по предмети в разписанието на тази паралелка
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="type">Тип</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Контролна работа">Контролна работа</SelectItem>
                <SelectItem value="Класна работа">Класна работа</SelectItem>
                <SelectItem value="Тест">Тест</SelectItem>
                <SelectItem value="Изпит">Изпит</SelectItem>
                <SelectItem value="Проект">Проект</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="dueDate">Дата *</Label>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-left font-normal border",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "dd.MM.yyyy", { locale: bg }) : "Изберете дата"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={(date) => {
                    setDueDate(date);
                    setDatePickerOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label htmlFor="description">Описание (опционално)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Например: Теми 1-5 от учебника"
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => navigate(`/bg/diary/class/${classId}/tests`)}
          >
            Откажи
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditMode ? "Запази промените" : "Запази"}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
