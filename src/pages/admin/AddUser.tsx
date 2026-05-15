import { useState } from "react";
import { useAction, useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import { AlertCircleIcon } from "lucide-react";
import { scrollToInvalidField, highlightInvalidField, getErrorMessage } from "@/lib/form-validation.ts";

interface FormData {
  // Основни данни
  firstName: string;
  middleName: string;
  lastName: string;
  identifier: string;
  identifierType: "egn" | "lnch" | "other";
  birthDate: string;
  birthPlace: string;
  citizenship: string;
  gender: "male" | "female" | "other";
  phone: string;
  email: string;
  username: string;
  password: string;

  // Роля
  role: "teacher" | "student" | "parent" | "director" | "vice_director" | "system_admin" | "secretary" | "pedagogical_counselor" | "housekeeper";
  roles: Array<"teacher" | "student" | "parent" | "director" | "vice_director" | "system_admin" | "secretary" | "pedagogical_counselor" | "housekeeper">;
  teacherSubjectIds: string[];
  
  // За ученици
  classId: string;
  personalDoctor: string;

  // За родители
  studentIds: string[]; // Student record IDs

  // За администратори/учители - класове и предмети за преподаване
  teachingClassIds: string[];

  // Длъжност (за персонал)
  appointmentDate: string;
  positionType: "titular" | "substitute";
  staffQuota: "1" | "0.5" | "0.25";
  personnelType: string;
  positionName: string;
  appointedFor: string; // предмет/направление

  // Договор
  contractType: string;
  contractBasis: string;
  contractNumber: string;
  contractYear: string;
  contractStructure: string;

  // Трудов стаж
  totalExperienceYears: number;
  totalExperienceMonths: number;
  totalExperienceDays: number;
  specialtyExperienceYears: number;
  specialtyExperienceMonths: number;
  specialtyExperienceDays: number;
  teachingExperienceYears: number;
  teachingExperienceMonths: number;
  teachingExperienceDays: number;

  // Образование
  educationDegree: string;
  university: string;
  specialty: string;
  diplomaNumber: string;
  diplomaDate: string;
  isPedagogicalQualification: boolean;
  teachingSubjects: string[];
}

interface AddUserFormProps {
  onSuccess?: () => void;
}

export default function AddUserForm({ onSuccess }: AddUserFormProps) {
  const subjects = useQuery(api.admin.listSubjects, {});
  const classes = useQuery(api.admin.listClasses, {});
  const defaultSchool = useQuery(api.admin.getDefaultSchool, {});
  const students = useQuery(api.users.getAllStudents, {}); // Get all students for parent selection
  
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    middleName: "",
    lastName: "",
    identifier: "",
    identifierType: "egn",
    birthDate: "",
    birthPlace: "",
    citizenship: "",
    gender: "male",
    phone: "+359",
    email: "",
    username: "",
    password: "",
    role: "student",
    roles: [],
    teacherSubjectIds: [],
    classId: "",
    personalDoctor: "",
    studentIds: [],
    teachingClassIds: [],
    appointmentDate: "",
    positionType: "titular",
    staffQuota: "1",
    personnelType: "",
    positionName: "",
    appointedFor: "",
    contractType: "",
    contractBasis: "",
    contractNumber: "",
    contractYear: "",
    contractStructure: "",
    totalExperienceYears: 0,
    totalExperienceMonths: 0,
    totalExperienceDays: 0,
    specialtyExperienceYears: 0,
    specialtyExperienceMonths: 0,
    specialtyExperienceDays: 0,
    teachingExperienceYears: 0,
    teachingExperienceMonths: 0,
    teachingExperienceDays: 0,
    educationDegree: "",
    university: "",
    specialty: "",
    diplomaNumber: "",
    diplomaDate: "",
    isPedagogicalQualification: false,
    teachingSubjects: [],
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [backendError, setBackendError] = useState<string>("");

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    // Основни данни валидации
    if (!formData.firstName.trim()) newErrors.push("Името е задължително");
    if (!formData.lastName.trim()) newErrors.push("Фамилията е задължителна");
    if (!formData.identifier.trim()) newErrors.push("Идентификаторът е задължителен");
    
    // Валидация за роли
    if (formData.roles.length === 0) newErrors.push("Изберете поне една роля");
    
    // Специална валидация за ученици
    if (formData.roles.includes("student") && !formData.birthDate) {
      newErrors.push("Датата на раждане е задължителна за ученици");
    }
    if (formData.roles.includes("student") && !formData.classId) {
      newErrors.push("Класът е задължителен за ученици");
    }

    // Родител на - вече не е задължително

    if (!formData.phone.trim() || formData.phone === "+359") {
      newErrors.push("Телефонът е задължителен");
    }

    if (!formData.email.trim()) {
      newErrors.push("Имейлът е задължителен");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.push("Имейлът е невалиден");
    }

    // Валидация за username и password - задължителни полета
    if (!formData.username.trim()) {
      newErrors.push("Потребителското име е задължително");
    }
    if (!formData.password.trim()) {
      newErrors.push("Паролата е задължителна");
    }
    if (formData.password.trim() && formData.password.trim().length < 6) {
      newErrors.push("Паролата трябва да бъде поне 6 символа");
    }

    // Валидация за учители
    if (formData.roles.includes("teacher")) {
      if (formData.teacherSubjectIds.length === 0) newErrors.push("Изберете поне един предмет за учителя");
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const createUser = useAction(api.usersActions.createUserAction);

  const handleSubmit = async (saveAndAdd: boolean = false) => {
    // Clear backend error when attempting new submission
    setBackendError("");
    
    if (!validateForm()) {
      toast.error("Моля, попълнете всички задължителни полета");
      
      // Map errors to field IDs
      const errorToFieldMap: Record<string, string> = {
        "Името е задължително": "firstName",
        "Фамилията е задължителна": "lastName",
        "Идентификаторът е задължителен": "identifier",
        "Телефонът е задължителен": "phone",
        "Имейлът е задължителен": "email",
        "Имейлът е невалиден": "email",
        "Потребителското име е задължително": "username",
        "Паролата е задължителна": "password",
        "Паролата трябва да бъде поне 6 символа": "password",
        "Изберете поне една роля": "roles",
        "Класът е задължителен за ученици": "classId",
        "Изберете поне едно дете за родителя": "parentStudents",
        "Датата на раждане е задължителна за ученици": "birthDate",
        "Изберете поне един предмет за учителя": "teacherSubjects",
      };
      
      // Find first error and scroll to it
      for (const error of errors) {
        const fieldId = errorToFieldMap[error];
        if (fieldId) {
          const element = document.getElementById(fieldId);
          if (element) {
            scrollToInvalidField(element);
            highlightInvalidField(element);
            break;
          }
        }
      }
      return;
    }

    try {
      // Get schoolId
      const schoolId = defaultSchool?.schoolId || undefined;

      await createUser({
        firstName: formData.firstName,
        middleName: formData.middleName || undefined,
        lastName: formData.lastName,
        identifier: formData.identifier,
        identifierType: "egn",
        birthDate: formData.birthDate || undefined,
        birthPlace: formData.birthPlace || undefined,
        citizenship: undefined,
        gender: formData.gender,
        phone: formData.phone,
        email: formData.email,
        isActive: true, // Винаги активен
        username: formData.username,
        password: formData.password,
        role: formData.role,
        roles: formData.roles.length > 0 ? formData.roles : undefined,
        classId: formData.classId ? (formData.classId as Id<"classes">) : undefined,
        personalDoctor: formData.personalDoctor || undefined,
        studentIds: formData.studentIds.length > 0 ? formData.studentIds.map(id => id as Id<"students">) : undefined,
        teachingClassIds: undefined, // Not used anymore
        teacherSubjects: formData.teacherSubjectIds.length > 0 ? formData.teacherSubjectIds.map(id => id as Id<"subjects">) : undefined,
        schoolId: schoolId,
        appointmentDate: formData.appointmentDate || undefined,
        positionType: formData.positionType || undefined,
        staffQuota: formData.staffQuota || undefined,
        personnelType: formData.personnelType || undefined,
        positionName: formData.positionName || undefined,
        appointedFor: formData.appointedFor || undefined,
        contractType: formData.contractType || undefined,
        contractBasis: formData.contractBasis || undefined,
        contractNumber: formData.contractNumber || undefined,
        contractYear: formData.contractYear || undefined,
        contractStructure: formData.contractStructure || undefined,
        totalExperienceYears: formData.totalExperienceYears || undefined,
        totalExperienceMonths: formData.totalExperienceMonths || undefined,
        totalExperienceDays: formData.totalExperienceDays || undefined,
        specialtyExperienceYears: formData.specialtyExperienceYears || undefined,
        specialtyExperienceMonths: formData.specialtyExperienceMonths || undefined,
        specialtyExperienceDays: formData.specialtyExperienceDays || undefined,
        teachingExperienceYears: formData.teachingExperienceYears || undefined,
        teachingExperienceMonths: formData.teachingExperienceMonths || undefined,
        teachingExperienceDays: formData.teachingExperienceDays || undefined,
        educationDegree: formData.educationDegree || undefined,
        university: formData.university || undefined,
        specialty: formData.specialty || undefined,
        diplomaNumber: formData.diplomaNumber || undefined,
        diplomaDate: formData.diplomaDate || undefined,
        isPedagogicalQualification: formData.isPedagogicalQualification || undefined,
        teachingSubjects: formData.teachingSubjects.length > 0 ? formData.teachingSubjects : undefined,
      });

      toast.success("Потребителят е създаден успешно");
      
      // Always close dialog on success
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      // Log full error for debugging
      console.error("Full error object:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
      }
      
      const errorMsg = getErrorMessage(error);
      console.log("Extracted error message:", errorMsg);
      
      setBackendError(errorMsg); // Set backend error for display
      toast.error(errorMsg);
      console.error("Грешка при създаване на потребител:", error);
      
      // Scroll to and highlight relevant field based on error
      if (errorMsg.includes("телефон") || errorMsg.toLowerCase().includes("phone")) {
        const phoneField = document.getElementById("phone");
        if (phoneField) {
          scrollToInvalidField(phoneField);
          highlightInvalidField(phoneField);
        }
      } else if (errorMsg.includes("имейл") || errorMsg.toLowerCase().includes("email")) {
        const emailField = document.getElementById("email");
        if (emailField) {
          scrollToInvalidField(emailField);
          highlightInvalidField(emailField);
        }
      } else if (errorMsg.includes("име") || errorMsg.toLowerCase().includes("name")) {
        const nameField = document.getElementById("firstName");
        if (nameField) {
          scrollToInvalidField(nameField);
          highlightInvalidField(nameField);
        }
      }
      
      // Scroll to top to show error alert
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Backend Error Alert - shown at top */}
      {backendError && (
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertDescription>
            <strong>Грешка:</strong> {backendError}
          </AlertDescription>
        </Alert>
      )}

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

      {/* Основни данни */}
      <Card>
          <CardHeader>
            <CardTitle>Основни данни</CardTitle>
            <CardDescription>
              Полетата с * са задължителни
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">Име *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="Иван"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="middleName">Презиме</Label>
                <Input
                  id="middleName"
                  value={formData.middleName}
                  onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                  placeholder="Петров"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Фамилия *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Георгиев"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="identifierType">Тип идентификатор</Label>
                <Input id="identifierType" value="ЕГН" readOnly className="bg-muted font-medium" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="identifier">Идентификатор *</Label>
                <Input
                  id="identifier"
                  value={formData.identifier}
                  onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                  placeholder="0123456789"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="birthDate">
                  Дата на раждане {formData.role === "student" && "*"}
                </Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthPlace">Място на раждане</Label>
                <Input
                  id="birthPlace"
                  value={formData.birthPlace}
                  onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
                  placeholder="София"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="gender">Пол</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value: "male" | "female" | "other") =>
                    setFormData({ ...formData, gender: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Мъж</SelectItem>
                    <SelectItem value="female">Жена</SelectItem>
                    <SelectItem value="other">Друго</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Телефон *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+359 895 000 000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Имейл *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="ivan.petrov@example.com"
                />
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="username">Потребителско име *</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="username123"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Парола *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Минимум 6 символа"
                  />
                </div>
              </div>
            </div>
          </CardContent>
      </Card>

      {/* Роля */}
      <Card>
          <CardHeader>
            <CardTitle>Роли</CardTitle>
            <CardDescription>Изберете една или повече роли за потребителя</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Роли *</Label>
              <div className="grid gap-2 md:grid-cols-2">
                {["teacher", "student", "parent", "director", "vice_director", "system_admin", "secretary", "pedagogical_counselor", "housekeeper"].map((roleOption) => {
                  return (
                    <div key={roleOption} className="flex items-center gap-2">
                      <Checkbox
                        checked={formData.roles.includes(roleOption as FormData["role"])}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            const newRoles = [...formData.roles, roleOption as FormData["role"]];
                            setFormData({ 
                              ...formData, 
                              roles: newRoles,
                              role: formData.roles.length === 0 ? roleOption as FormData["role"] : formData.role 
                            });
                          } else {
                            const newRoles = formData.roles.filter((r) => r !== roleOption);
                            setFormData({ 
                              ...formData, 
                              roles: newRoles,
                              role: newRoles.length > 0 ? newRoles[0] : formData.role
                            });
                          }
                        }}
                      />
                      <Label className="font-normal">
                        {{
                          teacher: "Учител",
                          student: "Ученик",
                          parent: "Родител",
                          director: "Директор",
                          vice_director: "Заместник-директор",
                          system_admin: "Системен администратор",
                          secretary: "Секретар",
                          pedagogical_counselor: "Педагогически съветник",
                          housekeeper: "Домакин",
                        }[roleOption as string]}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>

            {formData.roles.includes("student") && formData.birthDate && (
              <Alert>
                <AlertCircleIcon className="h-4 w-4" />
                <AlertDescription>
                  {(() => {
                    const age = new Date().getFullYear() - new Date(formData.birthDate).getFullYear();
                    return age < 14
                      ? "Ученик под 14 години - изисква одобрение от родител"
                      : "Ученик над 14 години";
                  })()}
                </AlertDescription>
              </Alert>
            )}

            {/* Клас за ученици */}
            {formData.roles.includes("student") && (
              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="classId">Ученик в *</Label>
                {classes === undefined ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select
                    value={formData.classId}
                    onValueChange={(value) => setFormData({ ...formData, classId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Изберете клас" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls._id} value={cls._id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Личен лекар за ученици */}
            {formData.roles.includes("student") && (
              <div className="space-y-2">
                <Label htmlFor="personalDoctor">Личен лекар (опционално)</Label>
                <Input
                  id="personalDoctor"
                  value={formData.personalDoctor}
                  onChange={(e) => setFormData({ ...formData, personalDoctor: e.target.value })}
                  placeholder="Д-р Иванов"
                />
              </div>
            )}

            {/* Ученици за родители */}
            {formData.roles.includes("parent") && (
              <div className="space-y-2 border-t pt-4">
                <Label id="parentStudents">Родител на</Label>
                {students === undefined ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select
                    value={formData.studentIds.length > 0 ? formData.studentIds[0] : ""}
                    onValueChange={(value) => {
                      if (value && !formData.studentIds.includes(value)) {
                        setFormData({ ...formData, studentIds: [...formData.studentIds, value] });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Изберете ученик" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.studentRecordId} value={student.studentRecordId}>
                          {student.name} ({student.className})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {/* Show selected students */}
                {formData.studentIds.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <Label className="text-sm text-muted-foreground">Избрани ученици:</Label>
                    {formData.studentIds.map((studentId) => {
                      const student = students?.find(s => s.studentRecordId === studentId);
                      return (
                        <div key={studentId} className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
                          <span className="text-sm">{student?.name} ({student?.className})</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setFormData({ 
                              ...formData, 
                              studentIds: formData.studentIds.filter(id => id !== studentId) 
                            })}
                          >
                            Премахни
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </CardContent>
      </Card>

      {/* Предмети (само за учители) */}
      {formData.roles.includes("teacher") && (
        <Card>
          <CardHeader>
            <CardTitle>Преподаване</CardTitle>
            <CardDescription>Изберете предмети за преподаване</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Предмети */}
            <div className="space-y-2">
              <Label>Предмети</Label>
              {subjects === undefined ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <div className="grid gap-2 md:grid-cols-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  {subjects.map((subject) => (
                    <div key={subject._id} className="flex items-center gap-2">
                      <Checkbox
                        checked={formData.teacherSubjectIds.includes(subject._id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({ 
                              ...formData, 
                              teacherSubjectIds: [...formData.teacherSubjectIds, subject._id],
                            });
                          } else {
                            setFormData({ 
                              ...formData, 
                              teacherSubjectIds: formData.teacherSubjectIds.filter((id) => id !== subject._id),
                            });
                          }
                        }}
                      />
                      <Label className="font-normal">
                        {subject.name} ({subject.shortName})
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Длъжност (за персонал) */}
      {(["teacher", "director", "vice_director", "secretary", "pedagogical_counselor", "housekeeper", "system_admin"].some(r => formData.roles.includes(r as FormData["role"]))) && (
        <Card>
            <CardHeader>
              <CardTitle>Длъжност</CardTitle>
              <CardDescription>Данни за назначаване и щатно място</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="appointmentDate">Дата на назначаване</Label>
                  <Input
                    id="appointmentDate"
                    type="date"
                    value={formData.appointmentDate}
                    onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="positionType">Тип</Label>
                  <Select
                    value={formData.positionType}
                    onValueChange={(value: "titular" | "substitute") =>
                      setFormData({ ...formData, positionType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="titular">Титуляр</SelectItem>
                      <SelectItem value="substitute">Заместник</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staffQuota">Щат</Label>
                  <Select
                    value={formData.staffQuota}
                    onValueChange={(value: "1" | "0.5" | "0.25") =>
                      setFormData({ ...formData, staffQuota: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="0.5">0.5</SelectItem>
                      <SelectItem value="0.25">0.25</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="personnelType">Вид персонал</Label>
                  <Input
                    id="personnelType"
                    value={formData.personnelType}
                    onChange={(e) => setFormData({ ...formData, personnelType: e.target.value })}
                    placeholder="Педагогически специалисти: прогимназиален етап"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="positionName">Наименование на длъжността</Label>
                  <Input
                    id="positionName"
                    value={formData.positionName}
                    onChange={(e) => setFormData({ ...formData, positionName: e.target.value })}
                    placeholder="Учител/Преподавател"
                  />
                </div>
              </div>

              {formData.roles.includes("teacher") && (
                <div className="space-y-2">
                  <Label htmlFor="appointedFor">Назначен на щатно място по</Label>
                  <Input
                    id="appointedFor"
                    value={formData.appointedFor}
                    onChange={(e) => setFormData({ ...formData, appointedFor: e.target.value })}
                    placeholder="Математика"
                  />
                </div>
              )}
            </CardContent>
        </Card>
      )}

      {/* Договор (опционално за персонал) */}
      {(["teacher", "director", "vice_director", "secretary", "system_admin"].some(r => formData.roles.includes(r as FormData["role"]))) && (
        <Card>
            <CardHeader>
              <CardTitle>Договор (опционално)</CardTitle>
              <CardDescription>Данни за трудовия договор</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contractType">Вид на договора</Label>
                  <Input
                    id="contractType"
                    value={formData.contractType}
                    onChange={(e) => setFormData({ ...formData, contractType: e.target.value })}
                    placeholder="Трудов договор"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contractBasis">Основание по КТ</Label>
                  <Input
                    id="contractBasis"
                    value={formData.contractBasis}
                    onChange={(e) => setFormData({ ...formData, contractBasis: e.target.value })}
                    placeholder="чл. 67, ал. 1, т. 1 КТ"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="contractNumber">Договор №</Label>
                  <Input
                    id="contractNumber"
                    value={formData.contractNumber}
                    onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                    placeholder="23"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contractYear">От година</Label>
                  <Input
                    id="contractYear"
                    value={formData.contractYear}
                    onChange={(e) => setFormData({ ...formData, contractYear: e.target.value })}
                    placeholder="2026"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contractStructure">Структура</Label>
                  <Input
                    id="contractStructure"
                    value={formData.contractStructure}
                    onChange={(e) => setFormData({ ...formData, contractStructure: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
        </Card>
      )}

      {/* Трудов стаж */}
      {(["teacher", "director", "vice_director", "system_admin"].some(r => formData.roles.includes(r as FormData["role"]))) && (
        <Card>
            <CardHeader>
              <CardTitle>Трудов стаж</CardTitle>
              <CardDescription>Години, месеци и дни опит</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label>Общ стаж</Label>
                <div className="grid gap-4 md:grid-cols-3">
                  <Input
                    type="number"
                    placeholder="Години"
                    value={formData.totalExperienceYears}
                    onChange={(e) =>
                      setFormData({ ...formData, totalExperienceYears: parseInt(e.target.value) || 0 })
                    }
                  />
                  <Input
                    type="number"
                    placeholder="Месеци"
                    value={formData.totalExperienceMonths}
                    onChange={(e) =>
                      setFormData({ ...formData, totalExperienceMonths: parseInt(e.target.value) || 0 })
                    }
                  />
                  <Input
                    type="number"
                    placeholder="Дни"
                    value={formData.totalExperienceDays}
                    onChange={(e) =>
                      setFormData({ ...formData, totalExperienceDays: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Стаж по специалност</Label>
                <div className="grid gap-4 md:grid-cols-3">
                  <Input
                    type="number"
                    placeholder="Години"
                    value={formData.specialtyExperienceYears}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        specialtyExperienceYears: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                  <Input
                    type="number"
                    placeholder="Месеци"
                    value={formData.specialtyExperienceMonths}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        specialtyExperienceMonths: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                  <Input
                    type="number"
                    placeholder="Дни"
                    value={formData.specialtyExperienceDays}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        specialtyExperienceDays: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              {formData.roles.includes("teacher") && (
                <div className="space-y-3">
                  <Label>Учителски стаж</Label>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Input
                      type="number"
                      placeholder="Години"
                      value={formData.teachingExperienceYears}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          teachingExperienceYears: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <Input
                      type="number"
                      placeholder="Месеци"
                      value={formData.teachingExperienceMonths}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          teachingExperienceMonths: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                    <Input
                      type="number"
                      placeholder="Дни"
                      value={formData.teachingExperienceDays}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          teachingExperienceDays: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </CardContent>
        </Card>
      )}

      {/* Образование */}
      {(["teacher", "director", "vice_director", "system_admin"].some(r => formData.roles.includes(r as FormData["role"]))) && (
        <Card>
            <CardHeader>
              <CardTitle>Образование</CardTitle>
              <CardDescription>Степен, университет и специалност</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="educationDegree">Степен *</Label>
                  <Select
                    value={formData.educationDegree}
                    onValueChange={(value) => setFormData({ ...formData, educationDegree: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Изберете" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bachelor">Висше (бакалавър)</SelectItem>
                      <SelectItem value="master">Висше (магистър)</SelectItem>
                      <SelectItem value="phd">Доктор</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="university">Университет</Label>
                  <Input
                    id="university"
                    value={formData.university}
                    onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                    placeholder="Софийски университет 'Св. Климент Охридски'"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialty">Специалност</Label>
                  <Input
                    id="specialty"
                    value={formData.specialty}
                    onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                    placeholder="Математика и информатика"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="diplomaNumber">Диплома №</Label>
                  <Input
                    id="diplomaNumber"
                    value={formData.diplomaNumber}
                    onChange={(e) => setFormData({ ...formData, diplomaNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="diplomaDate">Дата на диплома</Label>
                  <Input
                    id="diplomaDate"
                    type="date"
                    value={formData.diplomaDate}
                    onChange={(e) => setFormData({ ...formData, diplomaDate: e.target.value })}
                  />
                </div>
              </div>

              {formData.roles.includes("teacher") && (
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isPedagogicalQualification"
                      checked={formData.isPedagogicalQualification}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, isPedagogicalQualification: checked as boolean })
                      }
                    />
                    <Label htmlFor="isPedagogicalQualification">ПК учител</Label>
                  </div>
                </div>
              )}
            </CardContent>
        </Card>
      )}

      {/* Достъп */}
      <Card>
          <CardHeader>
            <CardTitle>Достъп</CardTitle>
            <CardDescription>
              Правата се определят автоматично според ролята
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertCircleIcon className="h-4 w-4" />
              <AlertDescription>
                {formData.roles.includes("teacher") && !formData.roles.some(r => ["director", "vice_director", "system_admin"].includes(r)) && 
                  "Достъп до: Мои часове, Оценки, Разписания, Дневник"}
                {formData.roles.includes("student") && 
                  "Достъп до: Моите оценки, Разписание, Задачи"}
                {formData.roles.includes("parent") && !formData.roles.some(r => ["director", "vice_director", "system_admin", "teacher"].includes(r)) && 
                  "Достъп до: Оценки на детето, Съобщения"}
                {(["director", "vice_director", "system_admin", "secretary", "pedagogical_counselor", "housekeeper"].some(r => formData.roles.includes(r as FormData["role"]))) &&
                  "Пълен административен достъп + Достъп до всички функции (Мои часове, Оценки, Разписания, Дневник)"}
              </AlertDescription>
            </Alert>
          </CardContent>
      </Card>

      {/* Backend Error Alert - shown at bottom before actions */}
      {backendError && (
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertDescription>
            <strong>Грешка:</strong> {backendError}
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <Button onClick={() => handleSubmit(false)} size="lg">
          Запази
        </Button>
      </div>
    </div>
  );
}
