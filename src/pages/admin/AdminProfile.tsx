import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { useTranslation } from "react-i18next";
import {
  UserIcon,
  BriefcaseIcon,
  FileTextIcon,
  ClockIcon,
  GraduationCapIcon,
  UsersIcon,
  ArrowLeftIcon,
  EditIcon,
  CameraIcon,
  Loader2Icon,
  MessageCircleIcon,
  BookOpenIcon,
  MonitorIcon,
  SmartphoneIcon,
  TabletIcon,
  LogInIcon,
  LogOutIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import EditUserForm from "./EditUser.tsx";

export default function AdminProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { i18n } = useTranslation("common");
  const navigate = useNavigate();
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Mutations
  const generateUploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const updateAvatar = useMutation(api.users.updateAvatar);
  
  // Get current user to check permissions
  const currentUser = useQuery(api.users.getCurrentUser, {});
  
  // If no userId provided, use current user's ID
  const targetUserId = userId || currentUser?._id;
  
  const user = useQuery(
    api.users.getUserById,
    targetUserId ? { userId: targetUserId as Id<"users"> } : "skip"
  );
  
  const avatarUrl = useQuery(
    api.users.getAvatarUrl,
    targetUserId ? { userId: targetUserId as Id<"users"> } : "skip"
  );
  
  const parentChildren = useQuery(
    api.users.getParentChildren,
    user && (user.role === "parent" || user.roles?.includes("parent"))
      ? { userId: targetUserId as Id<"users"> }
      : "skip"
  );
  
  // Check if viewing user is a student
  const isStudent = user && (user.role === "student" || user.roles?.includes("student"));
  
  // Get parents for student
  const studentParents = useQuery(
    api.users.getStudentParents,
    isStudent && targetUserId
      ? { studentId: targetUserId as Id<"users"> }
      : "skip"
  );

  // Get teacher info (subjects and classes) - uses isTeacher declared below
  const teacherInfoQuery = useQuery(
    api.users.getTeacherInfo,
    (user && (user.role === "teacher" || user.roles?.includes("teacher") || user.role === "class_teacher" || user.roles?.includes("class_teacher"))) && targetUserId
      ? { userId: targetUserId as Id<"users"> }
      : "skip"
  );

  // Get user sessions (visible to admins and the user themselves)
  const userSessions = useQuery(
    api.users.getUserSessions,
    targetUserId ? { userId: targetUserId as Id<"users">, limit: 50 } : "skip"
  );

  // Check if current user can edit (admin, director, vice_director only - NOT teachers)
  const canEdit = currentUser && (
    currentUser.role === "system_admin" ||
    currentUser.role === "director" ||
    currentUser.role === "vice_director" ||
    currentUser.roles?.includes("system_admin") ||
    currentUser.roles?.includes("director") ||
    currentUser.roles?.includes("vice_director")
  );
  
  // Check if current user can view parents accordion
  // - Admins, directors, vice_directors can always see it
  // - Teachers can see it
  // - Students can see it only for their own profile
  const canViewParents = currentUser && (
    currentUser.role === "system_admin" ||
    currentUser.role === "director" ||
    currentUser.role === "vice_director" ||
    currentUser.roles?.includes("system_admin") ||
    currentUser.roles?.includes("director") ||
    currentUser.roles?.includes("vice_director") ||
    currentUser.role === "teacher" ||
    currentUser.role === "class_teacher" ||
    currentUser.roles?.includes("teacher") ||
    currentUser.roles?.includes("class_teacher") ||
    // Students can see only their own profile's parents
    (targetUserId === currentUser._id)
  );

  const isStaff = user?.roles?.some(r => 
    ["teacher", "director", "vice_director", "secretary", "pedagogical_counselor", "housekeeper", "class_teacher", "system_admin"].includes(r)
  ) || ["teacher", "director", "vice_director", "secretary", "pedagogical_counselor", "housekeeper", "class_teacher", "system_admin"].includes(user?.role || "");
  
  const isTeacher = user?.roles?.includes("teacher") || user?.role === "teacher" || 
                    user?.roles?.includes("class_teacher") || user?.role === "class_teacher";
  
  const isParent = user?.role === "parent" || user?.roles?.includes("parent");

  const fullName = user ? [user.firstName, user.middleName, user.lastName]
    .filter(Boolean)
    .join(" ") || user.name || "Без име" : "";

  const getRoleLabel = (role: string) => {
    const roleMap: Record<string, string> = {
      director: "Директор",
      vice_director: "Заместник-директор",
      system_admin: "Системен администратор",
      teacher: "Учител",
      parent: "Родител",
      student: "Ученик",
      secretary: "Секретар",
      zats: "ЗАТС",
      pedagogical_counselor: "Педагогически съветник",
      housekeeper: "Домакин",
    };
    return roleMap[role] || role;
  };

  // Helper to get all roles excluding class_teacher
  const getDisplayRoles = () => {
    const allRoles = new Set<string>();
    if (user?.role && user.role !== "class_teacher") allRoles.add(user.role);
    if (user?.roles) user.roles.forEach((r) => { if (r !== "class_teacher") allRoles.add(r); });
    return Array.from(allRoles);
  };

  const getGenderLabel = (gender?: string) => {
    if (gender === "male") return "Мъж";
    if (gender === "female") return "Жена";
    if (gender === "other") return "Друго";
    return "—";
  };

  // Handle avatar upload
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Моля, изберете изображение");
      return;
    }

    // Validate file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Снимката е твърде голяма (макс. 20MB)");
      return;
    }

    setIsUploading(true);
    try {
      // Get upload URL
      const uploadUrl = await generateUploadUrl();

      // Upload file
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!response.ok) {
        throw new Error("Грешка при качване на снимката");
      }

      const { storageId } = await response.json();

      // Update avatar - pass userId if editing another user's avatar
      await updateAvatar({ 
        storageId, 
        userId: targetUserId as Id<"users"> 
      });

      toast.success("Снимката е качена успешно");
    } catch (error) {
      console.error("Avatar upload error:", error);
      toast.error(error instanceof Error ? error.message : "Грешка при качване на снимката");
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (user === undefined || currentUser === undefined) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="text-center text-muted-foreground py-8">
          Потребителят не е намерен
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <Button 
              variant="ghost" 
              size="icon" 
              className="shrink-0"
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate(`/${i18n.language}/admin/users`);
                }
              }}
            >
              <ArrowLeftIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-bold truncate">
                Административен профил
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                {fullName}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {/* Send message button - only show if viewing another user's profile */}
            {targetUserId && targetUserId !== currentUser?._id && (
              <Button 
                variant="outline" 
                className="gap-2" 
                onClick={() => navigate(`/${i18n.language}/messages?userId=${targetUserId}`)}
              >
                <MessageCircleIcon className="h-4 w-4" />
                Изпрати съобщение
              </Button>
            )}
            {canEdit && (
              <Button 
                variant="default" 
                className="gap-2" 
                onClick={() => setEditDialogOpen(true)}
              >
                <EditIcon className="h-4 w-4" />
                Редактирай
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[280px_1fr]">
          {/* Sidebar with avatar */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-6">
                {/* Profile Image */}
                <div className="flex justify-center">
                  <div className="relative group">
                    {/* Hidden file input */}
                    {canEdit && (
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                        id="avatar-upload"
                      />
                    )}
                    {/* Avatar - clickable for admins */}
                    <button
                      onClick={() => canEdit && fileInputRef.current?.click()}
                      disabled={!canEdit || isUploading}
                      className={`flex h-32 w-32 items-center justify-center rounded-full bg-muted overflow-hidden border-8 border-background ${canEdit ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
                      title={canEdit ? "Кликнете за да качите снимка" : undefined}
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted">
                          <UserIcon className="h-16 w-16 text-muted-foreground" strokeWidth={1.5} />
                        </div>
                      )}
                    </button>
                    {/* Camera icon indicator for admins */}
                    {canEdit && (
                      <div
                        className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg pointer-events-none"
                      >
                        {isUploading ? (
                          <Loader2Icon className="h-5 w-5 animate-spin" />
                        ) : (
                          <CameraIcon className="h-5 w-5" />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* User Name */}
                <div className="space-y-2 text-center">
                  <h2 className="text-lg font-semibold">{fullName}</h2>
                  <div className="flex flex-wrap gap-1 justify-center">
                    {getDisplayRoles().map((r) => (
                      <Badge key={r} variant="secondary" className="text-xs">
                        {getRoleLabel(r)}
                      </Badge>
                    ))}
                  </div>
                  {user.scientificTitle && (
                    <p className="text-sm text-muted-foreground">{user.scientificTitle}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Content */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <Accordion type="multiple" defaultValue={["basic", "subjects", "parents", "position", "contract", "experience", "education", "children", "sessions"]} className="w-full">
                {/* Основни данни */}
                <AccordionItem value="basic">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4" />
                      <span>Основни данни</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Идентификатор (ЕГН)</div>
                        <div className="text-sm font-medium">{user.identifier || "—"}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Научно звание</div>
                        <div className="text-sm">{user.scientificTitle || "—"}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Име</div>
                        <div className="text-sm">{user.firstName || "—"}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Презиме</div>
                        <div className="text-sm">{user.middleName || "—"}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Фамилия</div>
                        <div className="text-sm">{user.lastName || "—"}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Пол</div>
                        <div className="text-sm">{getGenderLabel(user.gender)}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Дата на раждане</div>
                        <div className="text-sm">{user.birthDate || "—"}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Място на раждане</div>
                        <div className="text-sm">{user.birthPlace || "—"}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Телефон</div>
                        <div className="text-sm text-blue-600">{user.phone ? <a href={`tel:${user.phone}`}>{user.phone}</a> : "—"}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Имейл</div>
                        <div className="text-sm text-blue-600 break-all">{user.email ? <a href={`mailto:${user.email}`}>{user.email}</a> : "—"}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Потребителско име</div>
                        <div className="text-sm">{user.username || "—"}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Роли</div>
                        <div className="flex flex-wrap gap-1">
                          {getDisplayRoles().map((r) => (
                            <Badge key={r} variant="secondary">{getRoleLabel(r)}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Предмети и класове - само за учители */}
                {isTeacher && (
                  <AccordionItem value="subjects">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <BookOpenIcon className="h-4 w-4" />
                        <span>Предмети и класове</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {teacherInfoQuery === undefined ? (
                        <Skeleton className="h-20 w-full" />
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <div className="text-xs text-muted-foreground font-medium">Предмети</div>
                            {teacherInfoQuery.subjects.length > 0 || teacherInfoQuery.homeroomClass ? (
                              <div className="flex flex-wrap gap-1.5">
                                {teacherInfoQuery.subjects.map((subject) => (
                                  <Badge key={subject._id} variant="secondary">{subject.name}</Badge>
                                ))}
                                {teacherInfoQuery.homeroomClass && (
                                  <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                                    Класен на: {teacherInfoQuery.homeroomClass.name}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">Няма предмети</div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div className="text-xs text-muted-foreground font-medium">Преподава в класове</div>
                            {teacherInfoQuery.classes.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {teacherInfoQuery.classes.map((cls) => (
                                  <Badge key={cls._id} variant="outline">{cls.name}</Badge>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">Не преподава в класове</div>
                            )}
                          </div>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Родители - само за ученици (видимо за учители, админи и самия ученик) */}
                {isStudent && canViewParents && (
                  <AccordionItem value="parents">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <UsersIcon className="h-4 w-4" />
                        <span>Родители</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {studentParents === undefined ? (
                        <Skeleton className="h-20 w-full" />
                      ) : studentParents && studentParents.length > 0 ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {studentParents.map((parent) => (
                            <div key={parent._id} className="border rounded-lg p-4 space-y-3 bg-muted/30">
                              <div className="flex items-center gap-2">
                                <UsersIcon className="h-4 w-4 text-muted-foreground" />
                                <Link
                                  to={`/${i18n.language}/admin/user/${parent._id}`}
                                  className="font-medium text-blue-600 hover:underline"
                                >
                                  {parent.name}
                                </Link>
                              </div>
                              {parent.email && (
                                <div className="space-y-1">
                                  <div className="text-xs text-muted-foreground">Имейл</div>
                                  <div className="text-sm text-blue-600">
                                    <a href={`mailto:${parent.email}`}>{parent.email}</a>
                                  </div>
                                </div>
                              )}
                              {parent.phone && (
                                <div className="space-y-1">
                                  <div className="text-xs text-muted-foreground">Телефон</div>
                                  <div className="text-sm text-blue-600">
                                    <a href={`tel:${parent.phone}`}>{parent.phone}</a>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground py-4">
                          Няма добавени родители
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Длъжност - само за персонал */}
                {isStaff && (
                  <AccordionItem value="position">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <BriefcaseIcon className="h-4 w-4" />
                        <span>Длъжност</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Дата на назначаване</div>
                          <div className="text-sm">{user.appointmentDate || "—"}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Тип</div>
                          <div className="text-sm">
                            {user.positionType === "titular" ? "Титуляр" : 
                             user.positionType === "substitute" ? "Заместник" : "—"}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Щат</div>
                          <div className="text-sm">{user.staffQuota || "—"}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Наименование на длъжността</div>
                          <div className="text-sm">{user.positionName || "—"}</div>
                        </div>
                        {isTeacher && (
                          <div className="space-y-1 sm:col-span-2">
                            <div className="text-xs text-muted-foreground">Назначен на щатно място по</div>
                            <div className="text-sm">{user.appointedFor || "—"}</div>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Договор - само за персонал */}
                {isStaff && (
                  <AccordionItem value="contract">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <FileTextIcon className="h-4 w-4" />
                        <span>Договор</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Вид на договора</div>
                          <div className="text-sm">{user.contractType || "—"}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Основание по КТ</div>
                          <div className="text-sm">{user.contractBasis || "—"}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Договор №</div>
                          <div className="text-sm">{user.contractNumber || "—"}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">От година</div>
                          <div className="text-sm">{user.contractYear || "—"}</div>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <div className="text-xs text-muted-foreground">Структура</div>
                          <div className="text-sm">{user.contractStructure || "—"}</div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Трудов стаж - само за персонал */}
                {isStaff && (
                  <AccordionItem value="experience">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <ClockIcon className="h-4 w-4" />
                        <span>Трудов стаж</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Общ стаж</div>
                          <div className="text-sm">
                            {user.totalExperienceYears || 0} г., {user.totalExperienceMonths || 0} м., {user.totalExperienceDays || 0} д.
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Стаж по специалност</div>
                          <div className="text-sm">
                            {user.specialtyExperienceYears || 0} г., {user.specialtyExperienceMonths || 0} м., {user.specialtyExperienceDays || 0} д.
                          </div>
                        </div>
                        {isTeacher && (
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">Учителски стаж</div>
                            <div className="text-sm">
                              {user.teachingExperienceYears || 0} г., {user.teachingExperienceMonths || 0} м., {user.teachingExperienceDays || 0} д.
                            </div>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Образование - само за персонал */}
                {isStaff && (
                  <AccordionItem value="education">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <GraduationCapIcon className="h-4 w-4" />
                        <span>Образование</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Степен</div>
                          <div className="text-sm">
                            {user.educationDegree === "bachelor" ? "Висше (бакалавър)" : 
                             user.educationDegree === "master" ? "Висше (магистър)" : 
                             user.educationDegree === "phd" ? "Доктор" : "—"}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Университет</div>
                          <div className="text-sm">{user.university || "—"}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Специалност</div>
                          <div className="text-sm">{user.specialty || "—"}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Диплома №</div>
                          <div className="text-sm">{user.diplomaNumber || "—"}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Дата на диплома</div>
                          <div className="text-sm">{user.diplomaDate || "—"}</div>
                        </div>
                        {isTeacher && (
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">ПК учител</div>
                            <div className="text-sm">{user.isPedagogicalQualification ? "Да" : "Не"}</div>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Деца - само за родители */}
                {isParent && parentChildren && parentChildren.length > 0 && (
                  <AccordionItem value="children">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <UsersIcon className="h-4 w-4" />
                        <span>Деца ({parentChildren.length})</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-wrap gap-2">
                        {parentChildren.map((child) => (
                          <Link
                            key={child._id}
                            to={`/${i18n.language}/admin/user/${child.userId}`}
                          >
                            <Badge variant="secondary" className="text-sm cursor-pointer hover:bg-secondary/80">
                              {child.name} ({child.className})
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Сесии - видими за админи или за собствения профил */}
                {(canEdit || targetUserId === currentUser?._id) && (
                  <AccordionItem value="sessions">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <MonitorIcon className="h-4 w-4" />
                        <span>История на сесиите{userSessions ? ` (${userSessions.length})` : ""}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {userSessions === undefined ? (
                        <Skeleton className="h-20 w-full" />
                      ) : userSessions.length === 0 ? (
                        <div className="text-center text-muted-foreground py-4">
                          Няма записани сесии
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                          {userSessions.map((session) => {
                            const isLogin = session.sessionType !== "logout";
                            const loginDate = new Date(session.timestamp);
                            const logoutDate = session.logoutTimestamp ? new Date(session.logoutTimestamp) : null;
                            
                            // Calculate duration
                            let durationText = "";
                            if (logoutDate) {
                              const diffMs = logoutDate.getTime() - loginDate.getTime();
                              const diffMin = Math.round(diffMs / 60000);
                              if (diffMin < 60) {
                                durationText = `${diffMin} мин.`;
                              } else {
                                const hours = Math.floor(diffMin / 60);
                                const mins = diffMin % 60;
                                durationText = `${hours} ч. ${mins} мин.`;
                              }
                            }

                            // Device icon
                            const DeviceIcon = session.device === "Мобилен" ? SmartphoneIcon 
                              : session.device === "Таблет" ? TabletIcon 
                              : MonitorIcon;
                            
                            return (
                              <div
                                key={session._id}
                                className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                              >
                                {/* Icon */}
                                <div className={`mt-0.5 p-1.5 rounded-full shrink-0 ${
                                  session.sessionType === "logout"
                                    ? "bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400"
                                    : "bg-green-100 dark:bg-green-950/50 text-green-600 dark:text-green-400"
                                }`}>
                                  {session.sessionType === "logout" ? (
                                    <LogOutIcon className="h-3.5 w-3.5" />
                                  ) : (
                                    <LogInIcon className="h-3.5 w-3.5" />
                                  )}
                                </div>

                                {/* Details */}
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium">
                                      {session.sessionType === "logout" ? "Изход" : "Вход"}
                                    </span>
                                    {session.sessionType === "hercules_auth" && (
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                        Hercules Auth
                                      </Badge>
                                    )}
                                    {session.sessionType === "preauth" && (
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                        Потребител/Парола
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  <div className="text-xs text-muted-foreground">
                                    {loginDate.toLocaleDateString("bg-BG", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })}{" "}
                                    {loginDate.toLocaleTimeString("bg-BG", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                    {logoutDate && (
                                      <>
                                        {" → "}
                                        {logoutDate.toLocaleTimeString("bg-BG", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </>
                                    )}
                                    {durationText && (
                                      <span className="ml-1 text-muted-foreground/70">
                                        ({durationText})
                                      </span>
                                    )}
                                  </div>

                                  {/* Device info */}
                                  {(session.device || session.browser) && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <DeviceIcon className="h-3 w-3" />
                                      <span>
                                        {[session.device, session.browser].filter(Boolean).join(" • ")}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Status indicator */}
                                {isLogin && !logoutDate && session.sessionType !== "logout" && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                                      Активна
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактирай потребител</DialogTitle>
            <DialogDescription>
              Променете данните на потребителя
            </DialogDescription>
          </DialogHeader>
          {user && (
            <EditUserForm 
              userId={user._id} 
              onSuccess={() => {
                setEditDialogOpen(false);
              }} 
            />
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
