import { useState } from "react";
import { useMutation, useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import { AlertCircleIcon, PlusIcon, XIcon } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { scrollToInvalidField, highlightInvalidField, getErrorMessage } from "@/lib/form-validation.ts";

interface SubjectTeacherRow {
  id: string;
  subjectId: Id<"subjects"> | "";
  teacherIds: (Id<"users"> | "")[]; // Array of teacher IDs for co-teaching
  preparationType: string;
}

interface FormData {
  grade: number;
  letter: string;
  diaryType: string;
  classTeacherId: Id<"users"> | "";
  organizationalForm: string;
  admissionAfter: string;
  educationForm: string;
  organizationOfDay: string;
  financedBy: string;
  isMerged: boolean;
  isSpecial: boolean;
  preparationType: string;
  shiftNumber: 1 | 2;
  subjectsTeachers: SubjectTeacherRow[];
}

interface AddClassFormProps {
  onSuccess?: () => void;
}

export default function AddClassForm({ onSuccess }: AddClassFormProps) {
  const [formData, setFormData] = useState<FormData>({
    grade: 1,
    letter: "А",
    diaryType: "Дневник V – XII клас (3-87)",
    classTeacherId: "",
    organizationalForm: "",
    admissionAfter: "",
    educationForm: "",
    organizationOfDay: "",
    financedBy: "",
    isMerged: false,
    isSpecial: false,
    preparationType: "",
    shiftNumber: 1,
    subjectsTeachers: [],
  });

  const [errors, setErrors] = useState<string[]>([]);

  // Queries
  const teachers = useQuery(api.users.getAllTeachers, {});
  const teachersWithSubjects = useQuery(api.admin.listTeachersWithNames, {});
  const subjects = useQuery(api.admin.listSubjects, {});

  // Helper function to filter teachers by subject
  const getTeachersForSubject = (subjectId: Id<"subjects"> | "") => {
    if (!teachersWithSubjects || !subjectId) return teachers || [];
    
    // Filter teachers who teach this subject
    const filteredTeachers = teachersWithSubjects.filter(t => 
      t.subjectIds?.includes(subjectId as Id<"subjects">)
    );
    
    // If no teachers found for this subject, show all teachers as fallback
    if (filteredTeachers.length === 0) return teachers || [];
    
    // Map to the same format as teachers query
    return filteredTeachers.map(t => ({
      _id: t.userId,
      name: t.name,
    }));
  };

  // Mutations
  const ensureDefaultSchool = useMutation(api.admin.ensureDefaultSchool);
  const createClass = useMutation(api.admin.createClass);

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (!formData.grade || formData.grade < 1 || formData.grade > 12) {
      newErrors.push("Класът трябва да бъде между 1 и 12");
    }
    if (!formData.letter.trim()) newErrors.push("Паралелката е задължителна");
    if (!formData.classTeacherId) newErrors.push("Класният ръководител е задължителен");
    if (!formData.organizationalForm) newErrors.push("Организационната форма е задължителна");
    if (!formData.preparationType) newErrors.push("Видът подготовка е задължителен");

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleAddSubjectTeacher = () => {
    setFormData({
      ...formData,
      subjectsTeachers: [
        ...formData.subjectsTeachers,
        {
          id: Date.now().toString(),
          subjectId: "",
          teacherIds: [""], // Start with one empty teacher slot
          preparationType: "ЗП",
        },
      ],
    });
  };

  // Add another teacher to an existing subject row
  const handleAddTeacherToRow = (rowId: string) => {
    setFormData({
      ...formData,
      subjectsTeachers: formData.subjectsTeachers.map((st) =>
        st.id === rowId
          ? { ...st, teacherIds: [...st.teacherIds, ""] }
          : st
      ),
    });
  };

  // Remove a teacher from a row
  const handleRemoveTeacherFromRow = (rowId: string, teacherIndex: number) => {
    setFormData({
      ...formData,
      subjectsTeachers: formData.subjectsTeachers.map((st) =>
        st.id === rowId
          ? { ...st, teacherIds: st.teacherIds.filter((_, i) => i !== teacherIndex) }
          : st
      ),
    });
  };

  // Update a specific teacher in a row
  const handleUpdateTeacherInRow = (rowId: string, teacherIndex: number, value: string) => {
    setFormData({
      ...formData,
      subjectsTeachers: formData.subjectsTeachers.map((st) =>
        st.id === rowId
          ? {
              ...st,
              teacherIds: st.teacherIds.map((t, i) =>
                i === teacherIndex ? (value as Id<"users"> | "") : t
              ),
            }
          : st
      ),
    });
  };

  const handleRemoveSubjectTeacher = (id: string) => {
    setFormData({
      ...formData,
      subjectsTeachers: formData.subjectsTeachers.filter((st) => st.id !== id),
    });
  };

  const handleUpdateSubjectTeacher = (
    id: string,
    field: "subjectId" | "preparationType",
    value: string
  ) => {
    setFormData({
      ...formData,
      subjectsTeachers: formData.subjectsTeachers.map((st) =>
        st.id === id ? { ...st, [field]: value } : st
      ),
    });
  };

  const handleSubmit = async (saveAndAdd: boolean = false) => {
    if (!validateForm()) {
      toast.error("Моля, коригирайте грешките във формата");
      // Scroll to first error
      const fieldIds = ["grade", "letter", "classTeacher", "organizationalForm", "preparationType"];
      for (const fieldId of fieldIds) {
        const element = document.getElementById(fieldId);
        if (element && errors.some((e) => e.toLowerCase().includes(fieldId))) {
          scrollToInvalidField(element);
          highlightInvalidField(element);
          break;
        }
      }
      return;
    }

    try {
      // Ensure school exists
      const schoolId = await ensureDefaultSchool({});

      // Get current academic year (e.g., "2024/2025")
      const now = new Date();
      const currentYear = now.getFullYear();
      const nextYear = currentYear + 1;
      const academicYear = `${currentYear}/${nextYear}`;

      // Create the class
      await createClass({
        name: `${formData.grade}${formData.letter}`,
        grade: formData.grade,
        letter: formData.letter,
        schoolId: schoolId,
        classTeacherId: formData.classTeacherId || undefined,
        diaryType: formData.diaryType,
        shiftNumber: formData.shiftNumber,
        academicYear: academicYear,
        organizationalForm: formData.organizationalForm || undefined,
        admissionAfter: formData.admissionAfter || undefined,
        educationForm: formData.educationForm || undefined,
        organizationOfDay: formData.organizationOfDay || undefined,
        financedBy: formData.financedBy || undefined,
        isMerged: formData.isMerged || undefined,
        isSpecial: formData.isSpecial || undefined,
        preparationType: formData.preparationType || undefined,
      });

      toast.success("Паралелката е създадена успешно");

      if (saveAndAdd) {
        // Reset form for new entry
        setFormData({
          grade: 1,
          letter: "А",
          diaryType: "Дневник V – XII клас (3-87)",
          classTeacherId: "",
          organizationalForm: "",
          admissionAfter: "",
          educationForm: "",
          organizationOfDay: "",
          financedBy: "",
          isMerged: false,
          isSpecial: false,
          preparationType: "",
          shiftNumber: 1,
          subjectsTeachers: [],
        });
      } else if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      toast.error(errorMsg);
      console.error("Error creating class:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Errors Alert */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertDescription>
            <strong>Грешки във формата:</strong>
            <ul className="mt-2 list-inside list-disc space-y-1">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="basic" className="w-full">
        <TabsList>
          <TabsTrigger value="basic">Основни данни</TabsTrigger>
          <TabsTrigger value="subjects">
            Предмети и учители ({formData.subjectsTeachers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4 mt-4">
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="grade">Клас</Label>
                <Select
                  value={formData.grade.toString()}
                  onValueChange={(value) =>
                    setFormData({ ...formData, grade: parseInt(value) || 1 })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Изберете клас" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((grade) => (
                      <SelectItem key={grade} value={grade.toString()}>
                        {grade} клас
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="letter">Паралелка</Label>
                <Select
                  value={formData.letter}
                  onValueChange={(value) => setFormData({ ...formData, letter: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "Й", "К", "Л", "М", "Н", "О", "П", "Р", "С", "Т", "У", "Ф", "Х", "Ц", "Ч", "Ш", "Щ", "Ъ", "Ь", "Ю", "Я"].map((letter) => (
                      <SelectItem key={letter} value={letter}>
                        {letter}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="diaryType">Тип дневник</Label>
              <Input
                id="diaryType"
                value={formData.diaryType}
                onChange={(e) => setFormData({ ...formData, diaryType: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="classTeacher">
                Класен ръководител <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.classTeacherId}
                onValueChange={(value) =>
                  setFormData({ ...formData, classTeacherId: value as Id<"users"> })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Изберете класен ръководител" />
                </SelectTrigger>
                <SelectContent>
                  {teachers?.map((teacher) => (
                    <SelectItem key={teacher._id} value={teacher._id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="organizationalForm">
                Организационна форма <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.organizationalForm}
                onValueChange={(value) =>
                  setFormData({ ...formData, organizationalForm: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Изберете" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="class">Паралелка</SelectItem>
                  <SelectItem value="group">Група</SelectItem>
                  <SelectItem value="combined">Обединена паралелка</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admissionAfter">Прием след</Label>
              <Select
                value={formData.admissionAfter}
                onValueChange={(value) =>
                  setFormData({ ...formData, admissionAfter: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Изберете" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Няма</SelectItem>
                  <SelectItem value="kindergarten">Детска градина</SelectItem>
                  <SelectItem value="primary">Начално училище</SelectItem>
                  <SelectItem value="secondary">Прогимназия</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="educationForm">Форма на обучение</Label>
              <Select
                value={formData.educationForm}
                onValueChange={(value) =>
                  setFormData({ ...formData, educationForm: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Изберете" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Дневна</SelectItem>
                  <SelectItem value="evening">Вечерна</SelectItem>
                  <SelectItem value="distance">Дистанционна</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="organizationOfDay">Организация на учебния ден</Label>
              <Select
                value={formData.organizationOfDay}
                onValueChange={(value) =>
                  setFormData({ ...formData, organizationOfDay: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Изберете" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shift1">Първа смяна</SelectItem>
                  <SelectItem value="shift2">Втора смяна</SelectItem>
                  <SelectItem value="fullDay">Целодневно обучение</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="financedBy">Финансира се от</Label>
              <Select
                value={formData.financedBy}
                onValueChange={(value) => setFormData({ ...formData, financedBy: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Изберете" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="state">Държавен бюджет</SelectItem>
                  <SelectItem value="municipal">Общински бюджет</SelectItem>
                  <SelectItem value="private">Частно финансиране</SelectItem>
                  <SelectItem value="mixed">Смесено</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant={formData.isMerged ? "default" : "outline"}
                size="sm"
                onClick={() => setFormData({ ...formData, isMerged: !formData.isMerged })}
              >
                {formData.isMerged ? "ДА" : "НЕ"}
              </Button>
              <Label htmlFor="isMerged" className="font-normal">
                Сляла паралелка
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant={formData.isSpecial ? "default" : "outline"}
                size="sm"
                onClick={() => setFormData({ ...formData, isSpecial: !formData.isSpecial })}
              >
                {formData.isSpecial ? "ДА" : "НЕ"}
              </Button>
              <Label htmlFor="isSpecial" className="font-normal">
                Специална паралелка/група (за деца със СОП)
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preparationType">
                Вид подготовка <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.preparationType}
                onValueChange={(value) =>
                  setFormData({ ...formData, preparationType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Изберете" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unprofiled">Непрофилирана</SelectItem>
                  <SelectItem value="profiled">Профилирана</SelectItem>
                  <SelectItem value="specialized">Специализирана</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="subjects" className="mt-4">
          <div className="space-y-4">
            {formData.subjectsTeachers.length > 0 ? (
              <div className="border rounded-md">
                <div className="grid grid-cols-[50px_1fr_1fr_200px_50px] gap-4 p-3 bg-muted font-medium text-sm border-b">
                  <div>#</div>
                  <div>
                    Предмет <span className="text-destructive">*</span>
                  </div>
                  <div>
                    Учител(и) <span className="text-destructive">*</span>
                  </div>
                  <div>
                    Вид подготовка <span className="text-destructive">*</span>
                  </div>
                  <div></div>
                </div>
                {formData.subjectsTeachers.map((st, index) => (
                  <div
                    key={st.id}
                    className="grid grid-cols-[50px_1fr_1fr_200px_50px] gap-4 p-3 border-b last:border-b-0 items-start"
                  >
                    <div className="text-muted-foreground pt-2">{index + 1}</div>
                    <Select
                      value={st.subjectId}
                      onValueChange={(value) =>
                        handleUpdateSubjectTeacher(st.id, "subjectId", value)
                      }
                    >
                      <SelectTrigger className="mt-0">
                        <SelectValue placeholder="Изберете предмет" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects?.map((subject) => (
                          <SelectItem key={subject._id} value={subject._id}>
                            {subject.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* Multiple teachers column */}
                    <div className="flex flex-col gap-2">
                      {st.teacherIds.map((teacherId, teacherIndex) => (
                        <div key={teacherIndex} className="flex gap-2">
                          <Select
                            value={teacherId}
                            onValueChange={(value) =>
                              handleUpdateTeacherInRow(st.id, teacherIndex, value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={teacherIndex === 0 ? "Изберете учител" : "Втори учител"} />
                            </SelectTrigger>
                            <SelectContent>
                              {getTeachersForSubject(st.subjectId).map((teacher) => (
                                <SelectItem key={teacher._id} value={teacher._id}>
                                  {teacher.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {/* Show X button only for additional teachers (not the first one) */}
                          {teacherIndex > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="shrink-0"
                              onClick={() => handleRemoveTeacherFromRow(st.id, teacherIndex)}
                              title="Премахни учител"
                            >
                              <XIcon className="h-4 w-4" />
                            </Button>
                          )}
                          {/* Show + button only on the last teacher row */}
                          {teacherIndex === st.teacherIds.length - 1 && (
                            <Button
                              variant="secondary"
                              size="icon"
                              className="shrink-0 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 border-green-300 dark:border-green-800"
                              onClick={() => handleAddTeacherToRow(st.id)}
                              title="Добави втори учител по същия предмет (съвместно преподаване)"
                            >
                              <PlusIcon className="h-4 w-4 text-green-700 dark:text-green-400" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <Select
                      value={st.preparationType}
                      onValueChange={(value) =>
                        handleUpdateSubjectTeacher(st.id, "preparationType", value)
                      }
                    >
                      <SelectTrigger className="mt-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        <SelectItem value="ЗП">ЗП</SelectItem>
                        <SelectItem value="ЗП (ИЧ)">ЗП (ИЧ)</SelectItem>
                        <SelectItem value="ООП">ООП</SelectItem>
                        <SelectItem value="ООП (др. у-ще)">ООП (др. у-ще)</SelectItem>
                        <SelectItem value="ОБПП">ОБПП</SelectItem>
                        <SelectItem value="СП">СП</SelectItem>
                        <SelectItem value="ОФПВ">ОФПВ</SelectItem>
                        <SelectItem value="ЗИП">ЗИП</SelectItem>
                        <SelectItem value="ЗИП /ДП">ЗИП /ДП</SelectItem>
                        <SelectItem value="ЗИП (ИЧ)">ЗИП (ИЧ)</SelectItem>
                        <SelectItem value="ЗПП">ЗПП</SelectItem>
                        <SelectItem value="ЗПП (ИЧ)">ЗПП (ИЧ)</SelectItem>
                        <SelectItem value="ЗПП /УчПр">ЗПП /УчПр</SelectItem>
                        <SelectItem value="ЗПП/УчПр(ИЧ)">ЗПП/УчПр(ИЧ)</SelectItem>
                        <SelectItem value="ЗПП /практ">ЗПП /практ</SelectItem>
                        <SelectItem value="ЗПП /ТП">ЗПП /ТП</SelectItem>
                        <SelectItem value="ЗИПП">ЗИПП</SelectItem>
                        <SelectItem value="ЗИПП /УчПр">ЗИПП /УчПр</SelectItem>
                        <SelectItem value="ЗИП /МЕ">ЗИП /МЕ</SelectItem>
                        <SelectItem value="ИУЧ - ОтПП">ИУЧ - ОтПП</SelectItem>
                        <SelectItem value="ИУЧ - СПП">ИУЧ - СПП</SelectItem>
                        <SelectItem value="ИУЧ - РПП">ИУЧ - РПП</SelectItem>
                        <SelectItem value="ИУЧ - ПП (зад. модул)">ИУЧ - ПП (зад. модул)</SelectItem>
                        <SelectItem value="ИУЧ - ПП (изб. модул)">ИУЧ - ПП (изб. модул)</SelectItem>
                        <SelectItem value="ИУЧ - РП/УП-А">ИУЧ - РП/УП-А</SelectItem>
                        <SelectItem value="ИУЧ - РП/УП">ИУЧ - РП/УП</SelectItem>
                        <SelectItem value="ИУЧ - П/ЧЕ">ИУЧ - П/ЧЕ</SelectItem>
                        <SelectItem value="ИУЧ - П/ДрУЧ">ИУЧ - П/ДрУЧ</SelectItem>
                        <SelectItem value="ИУЧ - П/МЕ">ИУЧ - П/МЕ</SelectItem>
                        <SelectItem value="ИУЧ - П/Х">ИУЧ - П/Х</SelectItem>
                        <SelectItem value="ИУЧ - П/Р">ИУЧ - П/Р</SelectItem>
                        <SelectItem value="ПОРРС">ПОРРС</SelectItem>
                        <SelectItem value="ИУЧ - СП/СУ">ИУЧ - СП/СУ</SelectItem>
                        <SelectItem value="СИП">СИП</SelectItem>
                        <SelectItem value="СИП (ИЧ)">СИП (ИЧ)</SelectItem>
                        <SelectItem value="СИП /МЕ">СИП /МЕ</SelectItem>
                        <SelectItem value="ФУЧ - ДП/ЧЕ">ФУЧ - ДП/ЧЕ</SelectItem>
                        <SelectItem value="ФУЧ - ДП/ДрУП">ФУЧ - ДП/ДрУП</SelectItem>
                        <SelectItem value="РП">РП</SelectItem>
                        <SelectItem value="ДП">ДП</SelectItem>
                        <SelectItem value="ФП">ФП</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mt-0"
                      onClick={() => handleRemoveSubjectTeacher(st.id)}
                      title="Премахни предмета"
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border rounded-md p-8 text-center text-muted-foreground">
                Няма добавени предмети и учители
              </div>
            )}

            <Button variant="outline" size="sm" onClick={handleAddSubjectTeacher}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Добави предмет и учител
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex gap-4">
        <Button onClick={() => handleSubmit(false)} size="lg">
          Запази
        </Button>
        <Button onClick={() => handleSubmit(true)} variant="outline" size="lg">
          Запази и добави
        </Button>
      </div>
    </div>
  );
}
