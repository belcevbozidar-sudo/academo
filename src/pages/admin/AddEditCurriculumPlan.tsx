import Layout from "@/components/Layout.tsx";
import { Authenticated, AuthLoading } from "@/lib/convex-preview";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { useState, useMemo, useEffect } from "react";
import { Plus, ChevronLeft, Check, Minus, TableIcon, ListIcon, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import type { Id } from "@/convex/_generated/dataModel";

// Topic item type
type TopicItem = {
  number: number;
  week: number;
  title: string;
  type: string;
  notes?: string;
};

// Publishers list
const PUBLISHERS = [
  "Авторски материал",
  "изд. \"Изкуства\"",
  "изд. \"Просвета Плюс\"",
  "изд. \"Просвета\"",
  "изд. \"БГ Учебник\"",
  "изд. \"Анубис\"",
  "изд. \"Булвест 2000\"",
  "изд. \"Даниела Убенова\"",
  "изд. \"Домино\"",
  "изд. \"Педагог 6\"",
  "изд. \"Ран\"",
  "Друго",
];

// Topic types
const TOPIC_TYPES = [
  "НЗ - Нови знания",
  "ОС - Обобщаване и систематизиране",
  "УПР - Упражнение",
  "ПК - Проверка и контрол",
  "К - Комбиниран урок",
  "Д - Друго",
];

// Grade options (1-12 + ПГ)
const GRADE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const getGradeLabel = (grade: number) => {
  if (grade === 13) return "ПГ(5Г.)";
  if (grade === 14) return "ПГ(6Г.)";
  return String(grade);
};

function AddEditCurriculumPlanInner() {
  const navigate = useNavigate();
  const { planId } = useParams<{ planId: string }>();
  const isEditing = !!planId;

  const [activeTab, setActiveTab] = useState<"basic" | "topics">("basic");
  
  // Form state
  const [title, setTitle] = useState("");
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [visibility, setVisibility] = useState<"public" | "school" | "private">("public");
  const [publisher, setPublisher] = useState("");
  const [subjectId, setSubjectId] = useState<Id<"subjects"> | null>(null);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [useFileUpload, setUseFileUpload] = useState(false);

  // Get subjects
  const subjects = useQuery(api.admin.listSubjects, {});
  
  // Get existing plan if editing
  const existingPlan = useQuery(
    api.curriculumPlans.getCurriculumPlan,
    isEditing ? { id: planId as Id<"curriculumPlans"> } : "skip"
  );

  // Mutations
  const createPlan = useMutation(api.curriculumPlans.createCurriculumPlan);
  const updatePlan = useMutation(api.curriculumPlans.updateCurriculumPlan);
  const deletePlan = useMutation(api.curriculumPlans.deleteCurriculumPlan);

  // Load existing plan data
  useEffect(() => {
    if (existingPlan) {
      setTitle(existingPlan.title);
      setSelectedGrade(existingPlan.grade);
      setVisibility(existingPlan.visibility || "public");
      setPublisher(existingPlan.publisher || "");
      setSubjectId(existingPlan.subjectId || null);
      setTopics(existingPlan.topics || []);
    }
  }, [existingPlan]);

  const handleAddTopic = () => {
    const newNumber = topics.length + 1;
    setTopics([
      ...topics,
      {
        number: newNumber,
        week: newNumber,
        title: "",
        type: "НЗ - Нови знания",
        notes: "",
      },
    ]);
  };

  const handleRemoveTopic = (index: number) => {
    const newTopics = topics.filter((_, i) => i !== index);
    // Renumber topics
    setTopics(
      newTopics.map((t, i) => ({
        ...t,
        number: i + 1,
      }))
    );
  };

  const handleTopicChange = (
    index: number,
    field: keyof TopicItem,
    value: string | number
  ) => {
    setTopics(
      topics.map((t, i) =>
        i === index ? { ...t, [field]: value } : t
      )
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Моля, въведете име");
      return;
    }
    if (!selectedGrade) {
      toast.error("Моля, изберете клас");
      return;
    }
    if (!subjectId) {
      toast.error("Моля, изберете предмет");
      return;
    }

    try {
      if (isEditing) {
        await updatePlan({
          id: planId as Id<"curriculumPlans">,
          title,
          grade: selectedGrade,
          subjectId,
          publisher: publisher || undefined,
          visibility,
          topics: topics.length > 0 ? topics : undefined,
        });
        toast.success("Разпределението е актуализирано");
      } else {
        await createPlan({
          title,
          grade: selectedGrade,
          subjectId,
          publisher: publisher || undefined,
          visibility,
          topics: topics.length > 0 ? topics : undefined,
        });
        toast.success("Разпределението е създадено");
      }
      navigate(-1);
    } catch {
      toast.error("Грешка при запазване");
    }
  };

  const handleDelete = async () => {
    if (!isEditing) return;
    if (!confirm("Сигурни ли сте, че искате да изтриете това разпределение?")) return;

    try {
      await deletePlan({ id: planId as Id<"curriculumPlans"> });
      toast.success("Разпределението е изтрито");
      navigate(-1);
    } catch {
      toast.error("Грешка при изтриване");
    }
  };

  if (isEditing && existingPlan === undefined) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Назад
            </Button>
            <div className="flex items-center gap-2">
              <TableIcon className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-lg font-semibold">
                {isEditing ? "Редактиране на тематично разпределение" : "Добавяне на тематично разпределение"}
              </h1>
            </div>
          </div>
          <Button onClick={handleSave} className="bg-teal-500 hover:bg-teal-600 text-white">
            <Check className="h-4 w-4 mr-1" />
            Запази
          </Button>
        </div>

        {/* Tabs */}
        <div className="px-6 border-t">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab("basic")}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === "basic"
                  ? "border-teal-500 text-teal-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2">
                <TableIcon className="h-4 w-4" />
                Основни данни
              </div>
            </button>
            <button
              onClick={() => setActiveTab("topics")}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === "topics"
                  ? "border-teal-500 text-teal-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2">
                <ListIcon className="h-4 w-4" />
                Теми
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {activeTab === "basic" && (
          <div className="space-y-6 bg-background border rounded-lg p-4 sm:p-6">
            {/* Name */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <Label className="sm:w-32 sm:text-right text-sm">
                Име: <span className="text-red-500">*</span>
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Заглавие на тематичното разпределение"
                className="flex-1"
              />
            </div>

            {/* Grade */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <Label className="sm:w-32 sm:text-right text-sm">
                Клас: <span className="text-red-500">*</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {GRADE_OPTIONS.map((grade) => (
                  <Button
                    key={grade}
                    variant={selectedGrade === grade ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedGrade(grade)}
                    className={cn(
                      "min-w-[40px] sm:min-w-[48px]",
                      selectedGrade === grade && "bg-teal-500 hover:bg-teal-600"
                    )}
                  >
                    {getGradeLabel(grade)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Visibility */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <Label className="sm:w-32 sm:text-right text-sm">
                Ниво на видимост: <span className="text-red-500">*</span>
              </Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as typeof visibility)}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Публично достъпно</SelectItem>
                  <SelectItem value="school">Само за моето училище</SelectItem>
                  <SelectItem value="private">Само за мен</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Publisher */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <Label className="sm:w-32 sm:text-right text-sm">
                Издателство: <span className="text-red-500">*</span>
              </Label>
              <Select value={publisher} onValueChange={setPublisher}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Изберете издателство" />
                </SelectTrigger>
                <SelectContent>
                  {PUBLISHERS.map((pub) => (
                    <SelectItem key={pub} value={pub}>
                      {pub}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <Label className="sm:w-32 sm:text-right text-sm">
                Предмет: <span className="text-red-500">*</span>
              </Label>
              <Select
                value={subjectId || "none"}
                onValueChange={(v) => setSubjectId(v === "none" ? null : v as Id<"subjects">)}
              >
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Изберете" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Изберете</SelectItem>
                  {subjects?.map((subject) => (
                    <SelectItem key={subject._id} value={subject._id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Delete button for editing */}
            {isEditing && (
              <div className="pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Изтрий разпределението
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === "topics" && (
          <div className="space-y-4 bg-background border rounded-lg p-4 sm:p-6">
            {/* File upload toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <Label className="text-sm">Качване на файл:</Label>
              <div className="flex items-center border rounded-full overflow-hidden">
                <button
                  className={cn(
                    "px-4 py-1 text-sm font-medium transition-colors",
                    !useFileUpload
                      ? "bg-yellow-400 text-black"
                      : "bg-transparent text-muted-foreground"
                  )}
                  onClick={() => setUseFileUpload(false)}
                >
                  НЕ
                </button>
                <button
                  className={cn(
                    "px-4 py-1 text-sm font-medium transition-colors",
                    useFileUpload
                      ? "bg-teal-500 text-white"
                      : "bg-transparent text-muted-foreground"
                  )}
                  onClick={() => setUseFileUpload(true)}
                >
                  ДА
                </button>
              </div>
            </div>

            {useFileUpload ? (
              <div className="py-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                <p>Функцията за качване на файл ще бъде добавена скоро.</p>
                <p className="text-sm">Моля, въведете темите ръчно.</p>
              </div>
            ) : (
              <>
                {/* Topics table */}
                <div className="border rounded-lg overflow-x-auto">
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-14 text-center">№</TableHead>
                        <TableHead className="w-16 text-center">Седм.</TableHead>
                        <TableHead className="min-w-[150px]">Тема</TableHead>
                        <TableHead className="w-40">Вид</TableHead>
                        <TableHead className="w-28">Бележки</TableHead>
                        <TableHead className="w-20 text-center">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topics.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Няма добавени теми. Натиснете бутона по-долу, за да добавите тема.
                          </TableCell>
                        </TableRow>
                      ) : (
                        topics.map((topic, index) => (
                          <TableRow key={index}>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                value={topic.number}
                                onChange={(e) =>
                                  handleTopicChange(index, "number", parseInt(e.target.value) || 0)
                                }
                                className="w-14 text-center"
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                value={topic.week}
                                onChange={(e) =>
                                  handleTopicChange(index, "week", parseInt(e.target.value) || 0)
                                }
                                className="w-14 text-center"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={topic.title}
                                onChange={(e) =>
                                  handleTopicChange(index, "title", e.target.value)
                                }
                                placeholder="Тема"
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={topic.type}
                                onValueChange={(v) => handleTopicChange(index, "type", v)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TOPIC_TYPES.map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {type}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={topic.notes || ""}
                                onChange={(e) =>
                                  handleTopicChange(index, "notes", e.target.value)
                                }
                                placeholder="Бележки"
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleRemoveTopic(index)}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                {index === topics.length - 1 && (
                                  <Button
                                    size="icon"
                                    className="h-8 w-8 bg-teal-500 hover:bg-teal-600"
                                    onClick={handleAddTopic}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Add first topic button */}
                {topics.length === 0 && (
                  <Button
                    onClick={handleAddTopic}
                    className="bg-teal-500 hover:bg-teal-600 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Добави тема
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AddEditCurriculumPlan() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
      </AuthLoading>

      <Authenticated>
        <Layout>
          <AddEditCurriculumPlanInner />
        </Layout>
      </Authenticated>
    </>
  );
}
