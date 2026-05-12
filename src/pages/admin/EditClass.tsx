import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import { AlertCircleIcon, PlusIcon, XIcon, Users2Icon, UserIcon } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { cn } from "@/lib/utils.ts";

interface SubjectTeacherRow {
  id: string;
  subjectId: Id<"subjects"> | "";
  teacherIds: (Id<"users"> | "")[]; // Array of teacher IDs for co-teaching
  preparationType: string;
}

interface EditClassFormProps {
  classId: Id<"classes">;
  onSuccess?: () => void;
}

export default function EditClassForm({ classId, onSuccess }: EditClassFormProps) {
  const [formData, setFormData] = useState({
    grade: 1,
    letter: "А",
    diaryType: "Дневник V – XII клас (3-87)",
    classTeacherId: "" as Id<"users"> | "",
    shiftNumber: 1 as 1 | 2,
    organizationalForm: "",
    admissionAfter: "",
    educationForm: "",
    organizationOfDay: "",
    financedBy: "",
    isMerged: false,
    isSpecial: false,
    preparationType: "",
    subjectsTeachers: [] as SubjectTeacherRow[],
  });

  const [errors, setErrors] = useState<string[]>([]);

  // Queries
  const teachers = useQuery(api.users.getAllTeachers, {});
  const teachersWithSubjects = useQuery(api.admin.listTeachersWithNames, {});
  const classes = useQuery(api.admin.listClasses, {});
  const subjects = useQuery(api.admin.listSubjects, {});
  const classSubjectsTeachers = useQuery(api.admin.getClassSubjectsTeachers, { classId });
  
  // Find current class
  const currentClass = classes?.find(c => c._id === classId);

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

  // Groups queries & mutations
  const classGroups = useQuery(api.classGroups.listByClass, { classId });
  const students = useQuery(api.admin.getStudentsByClass, { classId });

  const saveAllGroups = useMutation(api.classGroups.saveAllForClass);
  const removeGroup = useMutation(api.classGroups.remove);

  // Groups local state
  interface GroupRow {
    localId: string;
    dbId?: Id<"classGroups">;
    name: string;
    groupType: "full_class" | "partial" | "ifo";
    subjectId: Id<"subjects"> | "";
    teacherId: Id<"teachers"> | ""; // Track which teacher is assigned to this group
    preparationType: string;
    selectedOptionKey?: string; // Track which dropdown option was selected (includes teacher)
    studentIds: string[];
    normativ: number;
    educationAddress: string;
  }
  const [groupRows, setGroupRows] = useState<GroupRow[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [showCommonGroups, setShowCommonGroups] = useState(false);
  const [groupSubjectSearch, setGroupSubjectSearch] = useState("");
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [studentDialogGroupIndex, setStudentDialogGroupIndex] = useState<number>(-1);
  const [tempSelectedStudents, setTempSelectedStudents] = useState<string[]>([]);

  // Sort students alphabetically by name (matching diary order)
  const sortedStudents = students
    ? [...students].sort((a, b) => a.name.localeCompare(b.name, "bg"))
    : [];

  // Build subject options for groups dropdown with teacher names and prep types
  // Each unique (subjectId, preparationType, teacher) combination is a separate option
  const subjectOptions = (() => {
    if (!classSubjectsTeachers) return [];

    return classSubjectsTeachers.map((cs) => {
      const prepType = cs.preparationType || "ЗП";
      // Include teacher in the key to keep entries with same subject but different teachers separate
      const key = `${cs.subjectId as string}__${prepType}__${cs.teacherId as string}`;

      // Only show prep type if it's NOT ЗП or ООП
      const showPrepType = prepType !== "ЗП" && prepType !== "ООП";
      const prepLabel = showPrepType ? ` (${prepType})` : "";
      const teacherLabel = cs.teacherName && cs.teacherName !== "—" ? ` — ${cs.teacherName}` : "";

      return {
        key,
        subjectId: cs.subjectId,
        preparationType: prepType,
        label: `${cs.subjectName}${prepLabel}${teacherLabel}`,
        subjectName: cs.subjectName,
      };
    });
  })();

  // Helper: find the composite key for a group row's subjectId + preparationType + teacherId
  const getSubjectOptionKey = (subjectId: Id<"subjects"> | "", preparationType?: string, teacherId?: Id<"teachers"> | "", selectedOptionKey?: string) => {
    if (!subjectId) return "none";
    // If a specific option key was stored, use it if still valid
    if (selectedOptionKey) {
      const match = subjectOptions.find((o) => o.key === selectedOptionKey);
      if (match) return match.key;
    }
    // Try exact match (subjectId + prepType + teacherId)
    if (teacherId) {
      const exactMatch = subjectOptions.find(
        (o) => o.subjectId === subjectId && o.preparationType === (preparationType || "ЗП") && o.key.endsWith(`__${teacherId}`)
      );
      if (exactMatch) return exactMatch.key;
    }
    // Try match by subjectId + prepType only
    if (preparationType) {
      const match = subjectOptions.find(
        (o) => o.subjectId === subjectId && o.preparationType === preparationType
      );
      if (match) return match.key;
    }
    // Fallback: match by subjectId only (pick first)
    const fallback = subjectOptions.find((o) => o.subjectId === subjectId);
    return fallback?.key || "none";
  };

  // Load groups from DB
  useEffect(() => {
    if (classGroups && !groupsLoaded) {
      setGroupRows(classGroups.map((g) => ({
        localId: g._id,
        dbId: g._id,
        name: g.name,
        groupType: g.groupType,
        subjectId: g.subjectId,
        teacherId: g.teacherId || ("" as Id<"teachers"> | ""),
        preparationType: g.preparationType || "ЗП",
        studentIds: g.studentIds as string[],
        normativ: g.normativ,
        educationAddress: g.educationAddress,
      })));
      setGroupsLoaded(true);
    }
  }, [classGroups, groupsLoaded]);

  // Resolve missing teacherIds after groups and subjectOptions are ready
  useEffect(() => {
    if (!groupsLoaded || !classSubjectsTeachers || classSubjectsTeachers.length === 0) return;
    let hasChanges = false;
    const updated = groupRows.map(r => {
      if (r.teacherId || !r.subjectId) return r;
      // Find the matching teacher from classSubjectsTeachers
      const match = classSubjectsTeachers.find(
        st => st.subjectId === r.subjectId &&
          (st.preparationType || "ЗП") === (r.preparationType || "ЗП")
      );
      if (match) {
        hasChanges = true;
        return { ...r, teacherId: match.teacherId as Id<"teachers"> };
      }
      return r;
    });
    if (hasChanges) {
      setGroupRows(updated);
    }
    // Run only once after initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupsLoaded, classSubjectsTeachers]);

  const handleAddGroupRow = () => {
    const nextNum = groupRows.length + 1;
    setGroupRows([...groupRows, {
      localId: `new_${Date.now()}`,
      name: `Група ${nextNum}`,
      groupType: "partial",
      subjectId: "",
      teacherId: "",
      preparationType: "ЗП",
      studentIds: [],
      normativ: 0,
      educationAddress: "Основна",
    }]);
  };

  const handleRemoveGroupRow = (localId: string) => {
    setGroupRows(groupRows.filter(r => r.localId !== localId));
  };

  const handleUpdateGroupRow = (localId: string, field: keyof GroupRow, value: unknown) => {
    setGroupRows(groupRows.map(r => r.localId === localId ? { ...r, [field]: value } : r));
  };

  const handleOpenStudentDialog = (index: number) => {
    setStudentDialogGroupIndex(index);
    setTempSelectedStudents([...groupRows[index].studentIds]);
    setStudentDialogOpen(true);
  };

  const handleToggleStudentInDialog = (studentId: string) => {
    setTempSelectedStudents(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const handleConfirmStudentDialog = () => {
    if (studentDialogGroupIndex >= 0 && studentDialogGroupIndex < groupRows.length) {
      const row = groupRows[studentDialogGroupIndex];
      handleUpdateGroupRow(row.localId, "studentIds", tempSelectedStudents);
    }
    setStudentDialogOpen(false);
  };

  const handleSaveGroups = async () => {
    const validGroups = groupRows
      .filter(g => g.subjectId)
      .map(g => ({
        id: g.dbId,
        name: g.name,
        groupType: g.groupType,
        subjectId: g.subjectId as Id<"subjects">,
        teacherId: g.teacherId ? g.teacherId as Id<"teachers"> : undefined,
        preparationType: g.preparationType || undefined,
        studentIds: g.studentIds as Id<"students">[],
        normativ: g.normativ,
        educationAddress: g.educationAddress,
      }));

    try {
      await saveAllGroups({ classId, groups: validGroups });
      toast.success("Групите са запазени успешно");
      setGroupsLoaded(false); // Reload from DB
    } catch {
      toast.error("Грешка при запазване на групите");
    }
  };

  // Filter groups for display
  const filteredGroupRows = groupRows.filter(g => {
    if (!showCommonGroups && g.groupType === "full_class") return false;
    if (groupSubjectSearch) {
      const option = subjectOptions.find(s => s.subjectId === g.subjectId && s.preparationType === g.preparationType);
      const subjectName = option?.subjectName || "";
      if (subjectName && !subjectName.toLowerCase().includes(groupSubjectSearch.toLowerCase())) return false;
      if (!subjectName && g.subjectId) return false;
    }
    return true;
  });

  // Mutations
  const updateClass = useMutation(api.admin.updateClass);
  const updateClassSubjectsTeachers = useMutation(api.admin.updateClassSubjectsTeachers);

  // Load current class data
  useEffect(() => {
    if (currentClass) {
      setFormData({
        grade: currentClass.grade,
        letter: currentClass.letter,
        diaryType: currentClass.diaryType,
        classTeacherId: currentClass.classTeacherId || "",
        shiftNumber: currentClass.shiftNumber,
        organizationalForm: currentClass.organizationalForm || "",
        admissionAfter: currentClass.admissionAfter || "",
        educationForm: currentClass.educationForm || "",
        organizationOfDay: currentClass.organizationOfDay || "",
        financedBy: currentClass.financedBy || "",
        isMerged: currentClass.isMerged || false,
        isSpecial: currentClass.isSpecial || false,
        preparationType: currentClass.preparationType || "",
        subjectsTeachers: [],
      });
    }
  }, [currentClass]);

  // Load class subjects and teachers
  useEffect(() => {
    if (classSubjectsTeachers !== undefined) {
      // Group by subjectId + preparationType to combine multiple teachers for same subject
      const groupedMap = new Map<string, SubjectTeacherRow>();
      
      for (const cst of classSubjectsTeachers) {
        const key = `${cst.subjectId}_${cst.preparationType || "ЗП"}`;
        const existing = groupedMap.get(key);
        
        if (existing) {
          // Add teacher to existing subject row
          if (cst.userId && !existing.teacherIds.includes(cst.userId)) {
            existing.teacherIds.push(cst.userId);
          }
        } else {
          // Create new row
          groupedMap.set(key, {
            id: cst._id,
            subjectId: cst.subjectId,
            teacherIds: cst.userId ? [cst.userId] : [""],
            preparationType: cst.preparationType || "ЗП",
          });
        }
      }
      
      const loadedRows: SubjectTeacherRow[] = Array.from(groupedMap.values());
      setFormData(prev => ({ ...prev, subjectsTeachers: loadedRows }));
    }
  }, [classSubjectsTeachers]);

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (!formData.grade || formData.grade < 1 || formData.grade > 12) {
      newErrors.push("Класът трябва да бъде между 1 и 12");
    }
    if (!formData.letter.trim()) newErrors.push("Паралелката е задължителна");

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

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error("Моля, коригирайте грешките във формата");
      return;
    }

    try {
      await updateClass({
        id: classId,
        name: `${formData.grade}${formData.letter}`,
        grade: formData.grade,
        letter: formData.letter,
        classTeacherId: formData.classTeacherId || undefined,
        diaryType: formData.diaryType,
        shiftNumber: formData.shiftNumber,
        organizationalForm: formData.organizationalForm || undefined,
        admissionAfter: formData.admissionAfter || undefined,
        educationForm: formData.educationForm || undefined,
        organizationOfDay: formData.organizationOfDay || undefined,
        financedBy: formData.financedBy || undefined,
        isMerged: formData.isMerged || undefined,
        isSpecial: formData.isSpecial || undefined,
        preparationType: formData.preparationType || undefined,
      });

      // Save subjects and teachers - flatten teacherIds array to separate entries
      const validSubjectsTeachers: Array<{
        subjectId: Id<"subjects">;
        userId: Id<"users">;
        preparationType: string;
      }> = [];
      
      for (const st of formData.subjectsTeachers) {
        if (!st.subjectId) continue;
        
        for (const teacherId of st.teacherIds) {
          if (teacherId) {
            validSubjectsTeachers.push({
              subjectId: st.subjectId as Id<"subjects">,
              userId: teacherId as Id<"users">,
              preparationType: st.preparationType || "ЗП",
            });
          }
        }
      }

      await updateClassSubjectsTeachers({
        classId,
        subjectsTeachers: validSubjectsTeachers,
      });

      toast.success("Паралелката е актуализирана успешно");
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error updating class:", error);
      toast.error("Грешка при актуализиране на паралелка");
    }
  };

  if (!currentClass) {
    return <div>Зареждане...</div>;
  }

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
          <TabsTrigger value="groups">
            <Users2Icon className="h-4 w-4 mr-1.5" />
            Групи ({classGroups?.length || 0})
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
          <Label htmlFor="classTeacher">Класен ръководител</Label>
          <Select
            value={formData.classTeacherId || "none"}
            onValueChange={(value) =>
              setFormData({ ...formData, classTeacherId: value === "none" ? "" : value as Id<"users"> })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Изберете класен ръководител" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Без класен ръководител</SelectItem>
              {teachers?.map((teacher) => (
                <SelectItem key={teacher._id} value={teacher._id}>
                  {teacher.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="organizationalForm">Организационна форма</Label>
          <Select
            value={formData.organizationalForm || "none"}
            onValueChange={(value) =>
              setFormData({ ...formData, organizationalForm: value === "none" ? "" : value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Изберете" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Не е посочена</SelectItem>
              <SelectItem value="class">Паралелка</SelectItem>
              <SelectItem value="group">Група</SelectItem>
              <SelectItem value="combined">Обединена паралелка</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="admissionAfter">Прием след</Label>
          <Select
            value={formData.admissionAfter || "none"}
            onValueChange={(value) =>
              setFormData({ ...formData, admissionAfter: value === "none" ? "" : value })
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
            value={formData.educationForm || "none"}
            onValueChange={(value) =>
              setFormData({ ...formData, educationForm: value === "none" ? "" : value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Изберете" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Не е посочена</SelectItem>
              <SelectItem value="daily">Дневна</SelectItem>
              <SelectItem value="evening">Вечерна</SelectItem>
              <SelectItem value="distance">Дистанционна</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="organizationOfDay">Организация на учебния ден</Label>
          <Select
            value={formData.organizationOfDay || "none"}
            onValueChange={(value) =>
              setFormData({ ...formData, organizationOfDay: value === "none" ? "" : value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Изберете" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Не е посочена</SelectItem>
              <SelectItem value="shift1">Първа смяна</SelectItem>
              <SelectItem value="shift2">Втора смяна</SelectItem>
              <SelectItem value="fullDay">Целодневно обучение</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="financedBy">Финансира се от</Label>
          <Select
            value={formData.financedBy || "none"}
            onValueChange={(value) => setFormData({ ...formData, financedBy: value === "none" ? "" : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Изберете" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Не е посочено</SelectItem>
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
          <Label htmlFor="preparationType">Вид подготовка</Label>
          <Select
            value={formData.preparationType || "none"}
            onValueChange={(value) =>
              setFormData({ ...formData, preparationType: value === "none" ? "" : value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Изберете" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Не е посочена</SelectItem>
              <SelectItem value="unprofiled">Непрофилирана</SelectItem>
              <SelectItem value="profiled">Профилирана</SelectItem>
              <SelectItem value="specialized">Специализирана</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="shiftNumber">Смяна</Label>
          <Select
            value={formData.shiftNumber.toString()}
            onValueChange={(value) =>
              setFormData({ ...formData, shiftNumber: parseInt(value) as 1 | 2 })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Първа смяна</SelectItem>
              <SelectItem value="2">Втора смяна</SelectItem>
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

        <TabsContent value="groups" className="mt-4">
          <div className="space-y-4">
            {/* Warning banner */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
              Не може да премахвате и сменяте предмета на групи, които са включени в седмичното разписание или имат въведено тематично разпределение.
            </div>

            {/* Filter row */}
            <div className="flex items-center justify-between gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showCommonGroups}
                  onChange={(e) => setShowCommonGroups(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Покажи общите групи
              </label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Търси предмет"
                  value={groupSubjectSearch}
                  onChange={(e) => setGroupSubjectSearch(e.target.value)}
                  className="w-48"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => { setGroupSubjectSearch(""); setShowCommonGroups(false); }}
                >
                  <XIcon className="h-4 w-4 mr-1" />
                  Изчисти
                </Button>
              </div>
            </div>

            {/* Groups table */}
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted border-b">
                    <th className="text-left py-3 px-3 text-sm font-medium italic">Име</th>
                    <th className="text-left py-3 px-3 text-sm font-medium italic">Тип</th>
                    <th className="text-left py-3 px-3 text-sm font-medium italic">Предмет</th>
                    <th className="text-left py-3 px-3 text-sm font-medium italic">Ученици</th>
                    <th className="text-left py-3 px-3 text-sm font-medium italic">Норматив</th>
                    <th className="text-left py-3 px-3 text-sm font-medium italic">Адрес на обучение</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroupRows.map((row, index) => {
                    const realIndex = groupRows.findIndex(r => r.localId === row.localId);
                    return (
                      <tr key={row.localId} className="border-b last:border-b-0">
                        {/* Име - free text input */}
                        <td className="py-2 px-3">
                          <Input
                            value={row.name}
                            onChange={(e) => handleUpdateGroupRow(row.localId, "name", e.target.value)}
                            className="w-24 h-9"
                          />
                        </td>
                        {/* Тип - dropdown */}
                        <td className="py-2 px-3">
                          <Select
                            value={row.groupType}
                            onValueChange={(val) => handleUpdateGroupRow(row.localId, "groupType", val)}
                          >
                            <SelectTrigger className="w-36 h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full_class">Обща за цялата паралелка</SelectItem>
                              <SelectItem value="partial">Частична</SelectItem>
                              <SelectItem value="ifo">ИФО</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        {/* Предмет - dropdown with teacher names and prep type */}
                        <td className="py-2 px-3">
                          <Select
                            value={getSubjectOptionKey(row.subjectId, row.preparationType, row.teacherId, row.selectedOptionKey)}
                            onValueChange={(val) => {
                              if (val === "none") {
                                handleUpdateGroupRow(row.localId, "subjectId", "");
                                handleUpdateGroupRow(row.localId, "teacherId", "");
                                handleUpdateGroupRow(row.localId, "preparationType", "ЗП");
                                handleUpdateGroupRow(row.localId, "selectedOptionKey", undefined);
                              } else {
                                const option = subjectOptions.find(o => o.key === val);
                                if (option) {
                                  // Extract teacherId from the composite key: subjectId__prepType__teacherId
                                  const parts = val.split("__");
                                  const teacherId = parts.length >= 3 ? parts[2] : "";
                                  setGroupRows(prev => prev.map(r =>
                                    r.localId === row.localId
                                      ? { ...r, subjectId: option.subjectId, preparationType: option.preparationType, teacherId: teacherId as Id<"teachers"> | "", selectedOptionKey: val }
                                      : r
                                  ));
                                }
                              }
                            }}
                          >
                            <SelectTrigger className="w-80 h-9">
                              <SelectValue placeholder="Изберете предмет" />
                            </SelectTrigger>
                            <SelectContent>
                              {subjectOptions.map((opt) => (
                                <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        {/* Ученици - button to open dialog */}
                        <td className="py-2 px-3">
                          <Button
                            size="sm"
                            className="bg-teal-500 hover:bg-teal-600 text-white h-9"
                            onClick={() => handleOpenStudentDialog(realIndex)}
                          >
                            <Users2Icon className="h-4 w-4 mr-1" />
                            Избери ученици ({row.studentIds.length})
                          </Button>
                        </td>
                        {/* Норматив */}
                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            min={0}
                            value={row.normativ}
                            onChange={(e) => handleUpdateGroupRow(row.localId, "normativ", parseInt(e.target.value) || 0)}
                            className="w-16 h-9"
                          />
                        </td>
                        {/* Адрес на обучение */}
                        <td className="py-2 px-3">
                          <Select
                            value={row.educationAddress || "Основна"}
                            onValueChange={(val) => handleUpdateGroupRow(row.localId, "educationAddress", val)}
                          >
                            <SelectTrigger className="w-28 h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Основна">Основна</SelectItem>
                              <SelectItem value="Допълнителна">Допълнителна</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        {/* Delete button */}
                        <td className="py-2 px-2">
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => handleRemoveGroupRow(row.localId)}
                          >
                            <XIcon className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredGroupRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        Няма добавени групи
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Add group button */}
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleAddGroupRow}
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Добави група
            </Button>

            {/* Save groups button */}
            {groupRows.length > 0 && (
              <div className="flex justify-end">
                <Button onClick={handleSaveGroups}>
                  Запази групите
                </Button>
              </div>
            )}

            {/* Student selection dialog */}
            <Dialog open={studentDialogOpen} onOpenChange={setStudentDialogOpen}>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Избери ученици</DialogTitle>
                </DialogHeader>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="w-10 py-2 px-3">
                          <input
                            type="checkbox"
                            checked={tempSelectedStudents.length === sortedStudents.length && sortedStudents.length > 0}
                            onChange={() => {
                              if (tempSelectedStudents.length === sortedStudents.length) {
                                setTempSelectedStudents([]);
                              } else {
                                setTempSelectedStudents(sortedStudents.map(s => s._id as string));
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                        </th>
                        <th className="text-left py-2 px-3 text-sm font-medium">Номер</th>
                        <th className="text-left py-2 px-3 text-sm font-medium">Ученик</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedStudents.map((student, idx) => {
                        const isSelected = tempSelectedStudents.includes(student._id as string);
                        return (
                          <tr
                            key={student._id}
                            className={cn(
                              "border-t cursor-pointer hover:bg-muted/50",
                              isSelected && "bg-primary/5"
                            )}
                            onClick={() => handleToggleStudentInDialog(student._id as string)}
                          >
                            <td className="py-2 px-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleStudentInDialog(student._id as string)}
                                className="rounded border-gray-300"
                              />
                            </td>
                            <td className="py-2 px-3 text-sm text-center">{idx + 1}</td>
                            <td className="py-2 px-3 text-sm">
                              <div className="flex items-center gap-2">
                                <UserIcon className="h-4 w-4 text-muted-foreground" />
                                {student.name}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setStudentDialogOpen(false)}>Отказ</Button>
                  <Button onClick={handleConfirmStudentDialog}>OK</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex gap-4">
        <Button onClick={handleSubmit} size="lg">
          Запази промените
        </Button>
      </div>
    </div>
  );
}
