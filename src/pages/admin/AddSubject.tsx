import { useState } from "react";
import { useMutation, useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import { AlertCircleIcon } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Link, useParams } from "react-router-dom";
import { scrollToInvalidField, highlightInvalidField, getErrorMessage } from "@/lib/form-validation.ts";

interface FormData {
  name: string;
  shortName: string;
  group: string;
  isModule: boolean;
  isPrimary: boolean;
  selectedTeachers: Id<"users">[];
}

interface AddSubjectFormProps {
  onSuccess?: () => void;
}

export default function AddSubjectForm({ onSuccess }: AddSubjectFormProps) {
  const { lng } = useParams<{ lng: string }>();
  const [formData, setFormData] = useState<FormData>({
    name: "",
    shortName: "",
    group: "",
    isModule: false,
    isPrimary: false,
    selectedTeachers: [],
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [showTeacherSelect, setShowTeacherSelect] = useState(false);

  // Query all teachers
  const teachers = useQuery(api.users.getAllTeachers, {});

  // Mutations
  const ensureDefaultSchool = useMutation(api.admin.ensureDefaultSchool);
  const createSubject = useMutation(api.admin.createSubject);

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (!formData.name.trim()) newErrors.push("Името е задължително");
    if (!formData.shortName.trim()) newErrors.push("Съкратеното име е задължително");
    if (!formData.group) newErrors.push("Групата е задължителна");

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleAddTeacher = (teacherId: Id<"users">) => {
    if (!formData.selectedTeachers.includes(teacherId)) {
      setFormData({
        ...formData,
        selectedTeachers: [...formData.selectedTeachers, teacherId],
      });
    }
    setShowTeacherSelect(false);
  };

  const handleRemoveTeacher = (teacherId: Id<"users">) => {
    setFormData({
      ...formData,
      selectedTeachers: formData.selectedTeachers.filter((id) => id !== teacherId),
    });
  };

  const handleSubmit = async (saveAndAdd: boolean = false) => {
    if (!validateForm()) {
      toast.error("Моля, коригирайте грешките във формата");
      // Scroll to first error
      const fieldIds = ["name", "shortName", "group"];
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

      // Create the subject
      await createSubject({
        name: formData.name,
        shortName: formData.shortName,
        group: formData.group,
        isPrimary: formData.isPrimary,
        schoolId: schoolId,
      });

      toast.success("Предметът е създаден успешно");
      
      if (saveAndAdd) {
        // Reset form for new entry
        setFormData({
          name: "",
          shortName: "",
          group: "",
          isModule: false,
          isPrimary: false,
          selectedTeachers: [],
        });
      } else if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      toast.error(errorMsg);
      console.error("Error creating subject:", error);
    }
  };

  const selectedTeachersData = teachers?.filter((t) =>
    formData.selectedTeachers.includes(t._id)
  );

  const availableTeachers = teachers?.filter(
    (t) => !formData.selectedTeachers.includes(t._id)
  );

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
          <TabsTrigger value="teachers">Учители ({formData.selectedTeachers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4 mt-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Име <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Име на предмета"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shortName">
                Съкратено име <span className="text-destructive">*</span>
              </Label>
              <Input
                id="shortName"
                value={formData.shortName}
                onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                placeholder="Съкратено (кратко) име на предмета"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="group">
                Група <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.group}
                onValueChange={(value) => setFormData({ ...formData, group: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Изберете група" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Основни</SelectItem>
                  <SelectItem value="language">Езици</SelectItem>
                  <SelectItem value="science">Науки</SelectItem>
                  <SelectItem value="arts">Изкуства</SelectItem>
                  <SelectItem value="physical">Физическо възпитание</SelectItem>
                  <SelectItem value="other">Други</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isModule"
                checked={formData.isModule}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isModule: checked as boolean })
                }
              />
              <Label htmlFor="isModule" className="font-normal">
                НЕ
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isPrimary"
                checked={formData.isPrimary}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isPrimary: checked as boolean })
                }
              />
              <Label htmlFor="isPrimary" className="font-normal">
                Основен предмет
              </Label>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="teachers" className="mt-4">
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Учители ({formData.selectedTeachers.length})</h3>
              {selectedTeachersData && selectedTeachersData.length > 0 ? (
                <div className="border rounded-md divide-y">
                  {selectedTeachersData.map((teacher) => (
                    <div key={teacher._id} className="p-3 flex items-center justify-between">
                      <div>
                        <Link
                          to={`/${lng}/admin/user/${teacher._id}`}
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {teacher.name}
                        </Link>
                        {teacher.email && (
                          <div className="text-sm text-muted-foreground">{teacher.email}</div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveTeacher(teacher._id)}
                      >
                        Премахни
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border rounded-md p-4 min-h-[200px] text-center text-muted-foreground flex items-center justify-center">
                  Няма добавени учители
                </div>
              )}
            </div>

            {showTeacherSelect ? (
              <div className="border rounded-md p-4">
                <h4 className="font-medium mb-2">Изберете учител</h4>
                {availableTeachers && availableTeachers.length > 0 ? (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {availableTeachers.map((teacher) => (
                      <button
                        key={teacher._id}
                        onClick={() => handleAddTeacher(teacher._id)}
                        className="w-full text-left p-3 border rounded-md hover:bg-accent transition-colors"
                      >
                        <Link
                          to={`/${lng}/admin/user/${teacher._id}`}
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {teacher.name}
                        </Link>
                        {teacher.email && (
                          <div className="text-sm text-muted-foreground">{teacher.email}</div>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    Няма налични учители
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTeacherSelect(false)}
                  >
                    Отказ
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTeacherSelect(true)}
                disabled={!availableTeachers || availableTeachers.length === 0}
              >
                + Добави учител
              </Button>
            )}
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
