import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { AlertTriangleIcon } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

const categories = [
  "Училищно събитие",
  "Административно събитие",
  "Държавен зрелостен изпит",
  "Национално външно оценяване",
  "Официален празник",
  "Ваканция",
  "ДКИ по теория и практика на професията",
];

function formatDateForInput(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString().split("T")[0];
}

export default function EditNonSchoolDayPage() {
  const navigate = useNavigate();
  const { lng, id } = useParams<{ lng: string; id: string }>();
  
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedClasses, setSelectedClasses] = useState<Set<Id<"classes">>>(new Set());
  const [appliesToAllClasses, setAppliesToAllClasses] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  const existingDay = useQuery(
    api.nonSchoolDays.getById,
    id ? { id: id as Id<"nonSchoolDays"> } : "skip"
  );
  const classes = useQuery(api.admin.listClasses, {});
  const updateNonSchoolDay = useMutation(api.nonSchoolDays.updateNonSchoolDay);

  // Load existing data
  useEffect(() => {
    if (existingDay && !isLoaded) {
      setTitle(existingDay.name);
      setCategory(existingDay.category);
      setStartDate(formatDateForInput(existingDay.startDate));
      setEndDate(formatDateForInput(existingDay.endDate));
      setAppliesToAllClasses(existingDay.appliesToAllClasses);
      if (existingDay.classIds) {
        setSelectedClasses(new Set(existingDay.classIds));
      }
      setIsLoaded(true);
    }
  }, [existingDay, isLoaded]);

  // Group classes by grade
  const classesByGrade: Record<number, typeof classes> = {};
  if (classes) {
    classes.forEach((cls) => {
      if (!classesByGrade[cls.grade]) {
        classesByGrade[cls.grade] = [];
      }
      classesByGrade[cls.grade]!.push(cls);
    });
  }

  const sortedGrades = Object.keys(classesByGrade)
    .map(Number)
    .sort((a, b) => a - b);

  const toggleClass = (classId: Id<"classes">) => {
    const newSelected = new Set(selectedClasses);
    if (newSelected.has(classId)) {
      newSelected.delete(classId);
    } else {
      newSelected.add(classId);
    }
    setSelectedClasses(newSelected);
  };

  const toggleAllInGrade = (grade: number) => {
    const gradeClasses = classesByGrade[grade] || [];
    const allSelected = gradeClasses.every((cls) => selectedClasses.has(cls._id));
    
    const newSelected = new Set(selectedClasses);
    if (allSelected) {
      gradeClasses.forEach((cls) => newSelected.delete(cls._id));
    } else {
      gradeClasses.forEach((cls) => newSelected.add(cls._id));
    }
    setSelectedClasses(newSelected);
  };

  const handleSubmit = async () => {
    if (!title || !category || !startDate || !endDate || !id) {
      toast.error("Моля попълнете всички полета");
      return;
    }

    try {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();

      await updateNonSchoolDay({
        id: id as Id<"nonSchoolDays">,
        name: title,
        startDate: start,
        endDate: end,
        category,
        appliesToAllClasses,
        classIds: appliesToAllClasses ? undefined : Array.from(selectedClasses),
      });

      toast.success("Събитието е обновено успешно");
      navigate(`/${lng}/admin/non-school-days`);
    } catch (error) {
      toast.error("Грешка при обновяване на събитието");
    }
  };

  if (existingDay === undefined) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-6">
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  if (existingDay === null) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="text-center text-muted-foreground">
            Събитието не е намерено
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Редактиране на събитие</h1>
          <Button variant="outline" onClick={() => navigate(`/${lng}/admin/non-school-days`)}>
            Отказ
          </Button>
        </div>

        {step === 1 ? (
          <div className="space-y-6 bg-background border rounded-lg p-6">
            <div className="flex gap-2 border-b pb-4">
              <button className="px-6 py-3 bg-primary text-primary-foreground font-medium rounded-t">
                1 ОСНОВНИ ДАННИ
              </button>
              <button className="px-6 py-3 bg-muted text-muted-foreground font-medium rounded-t">
                2 ПОТВЪРЖДЕНИЕ
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="title">
                  Заглавие: <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Коледна ваканция"
                />
              </div>

              <div>
                <Label htmlFor="description">Описание:</Label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full min-h-[150px] px-3 py-2 border rounded-md bg-background"
                  placeholder="Описание..."
                />
                <div className="text-sm text-muted-foreground mt-1">
                  {description.length} / 15000
                </div>
              </div>

              <div>
                <Label htmlFor="category">
                  Категория: <span className="text-red-500">*</span>
                </Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Изберете категория" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="startDate">
                  Начална дата: <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="endDate">
                  Крайна дата: <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div>
                <Label>
                  Паралелки: <span className="text-red-500">*</span>
                </Label>
                
                <div className="flex items-center gap-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={appliesToAllClasses}
                      onCheckedChange={(checked) => {
                        setAppliesToAllClasses(!!checked);
                        if (checked) {
                          setSelectedClasses(new Set());
                        }
                      }}
                    />
                    <span>Всички</span>
                  </label>
                </div>

                {!appliesToAllClasses && (
                  <div className="border rounded-lg p-4 space-y-2">
                    <div className="font-medium mb-2">Основни</div>
                    <div className="space-y-2">
                      {sortedGrades.map((grade) => {
                        const gradeClasses = (classesByGrade[grade] || []).sort(
                          (a, b) => a.letter.localeCompare(b.letter)
                        );
                        const allSelected = gradeClasses.every((cls) =>
                          selectedClasses.has(cls._id)
                        );

                        return (
                          <div key={grade} className="space-y-2">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={allSelected}
                                onCheckedChange={() => toggleAllInGrade(grade)}
                              />
                              <span className="font-medium">{grade} клас</span>
                            </div>
                            <div className="flex gap-2 ml-8 flex-wrap">
                              {gradeClasses.map((cls) => (
                                <button
                                  key={cls._id}
                                  onClick={() => toggleClass(cls._id)}
                                  className={`px-3 py-1 rounded transition-colors ${
                                    selectedClasses.has(cls._id)
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted hover:bg-accent"
                                  }`}
                                >
                                  {cls.letter}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>Напред</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6 bg-background border rounded-lg p-6">
            <div className="flex gap-2 border-b pb-4">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 bg-muted text-muted-foreground font-medium rounded-t hover:bg-accent"
              >
                1 ОСНОВНИ ДАННИ
              </button>
              <button className="px-6 py-3 bg-primary text-primary-foreground font-medium rounded-t">
                2 ПОТВЪРЖДЕНИЕ
              </button>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 flex gap-3">
              <AlertTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-yellow-900 dark:text-yellow-100">ВНИМАНИЕ:</p>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Промяната ще обнови данните за събитието "{title}".
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-lg mb-4">Обща информация</h3>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-muted-foreground">Име:</div>
                  <div>{title}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-muted-foreground">Категория:</div>
                  <div>{category}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-muted-foreground">Период:</div>
                  <div>
                    {startDate} - {endDate}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-muted-foreground">Паралелки:</div>
                  <div>{appliesToAllClasses ? "Всички" : `${selectedClasses.size} избрани`}</div>
                </div>
              </div>
            </div>

            {!appliesToAllClasses && selectedClasses.size > 0 && (
              <div>
                <h3 className="font-medium text-lg mb-4">Основни</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-primary/10">
                      <tr>
                        {sortedGrades.map((grade) => (
                          <th key={grade} className="px-4 py-2 text-center font-medium">
                            {grade} клас
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {sortedGrades.map((grade) => {
                          const gradeClasses = (classesByGrade[grade] || [])
                            .filter((cls) => selectedClasses.has(cls._id))
                            .sort((a, b) => a.letter.localeCompare(b.letter));
                          
                          return (
                            <td key={grade} className="px-4 py-2 text-center align-top">
                              {gradeClasses.map((cls) => cls.letter).join(", ") || "—"}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Назад
              </Button>
              <Button onClick={handleSubmit}>Запази</Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
