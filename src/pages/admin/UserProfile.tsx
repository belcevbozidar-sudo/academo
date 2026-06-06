import { useState, useMemo, useRef } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useAction } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  UserIcon,
  ArrowLeftIcon,
  EditIcon,
  KeyIcon,
  TrashIcon,
  MoreVerticalIcon,
  CheckIcon,
  MessageSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InfoIcon,
  ClockIcon,
  FileTextIcon,
  CameraIcon,
  Loader2Icon,
} from "lucide-react";
import { format, addWeeks, startOfWeek, getISOWeek } from "date-fns";
import { bg } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import EditUserForm from "./EditUser.tsx";
import { useAuth } from "@/hooks/use-auth.ts";
import { formatUserName, formatFullName } from "@/lib/utils.ts";
import { UserNameLink } from "@/components/ui/user-name-link.tsx";

// Component to show student's parents
function StudentParentsSection({ userId }: { userId: Id<"users"> }) {
  const { i18n } = useTranslation("common");
  const parents = useQuery(api.users.getStudentParents, { studentId: userId });

  if (parents === undefined) {
    return <Skeleton className="h-20 w-full" />;
  }

  if (parents.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        Няма добавени родители
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {parents.map((parent) => (
        <div key={parent._id} className="border rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 items-center text-xs sm:text-sm">
            <div className="font-medium text-muted-foreground">Име:</div>
            <div>
              <Link
                to={`/${i18n.language}/admin/user/${parent._id}`}
                className="text-blue-600 hover:underline break-words"
              >
                {formatFullName(parent.name)}
              </Link>
            </div>
          </div>
          {parent.email && (
            <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 items-center text-xs sm:text-sm">
              <div className="font-medium text-muted-foreground">Имейл:</div>
              <div className="text-blue-600 break-words">{parent.email}</div>
            </div>
          )}
          {parent.phone && (
            <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 items-center text-xs sm:text-sm">
              <div className="font-medium text-muted-foreground">Телефон:</div>
              <div className="text-blue-600 break-words">{parent.phone}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Component to show a lesson link with subject name
function LessonLink({
  subjectName,
  classId,
  subjectId,
  periodIndex,
  dayOfWeek,
  className,
  teacherName,
  teacherUserId,
  teacherFirstName,
  teacherMiddleName,
  teacherLastName,
  date,
  isCurrentUserStudent,
  periodTime,
}: {
  subjectName: string;
  classId: Id<"classes">;
  subjectId: Id<"subjects">;
  periodIndex: number;
  dayOfWeek: number;
  className?: string;
  teacherName?: string;
  teacherUserId?: string;
  teacherFirstName?: string;
  teacherMiddleName?: string;
  teacherLastName?: string;
  date?: number;
  isCurrentUserStudent?: boolean;
  periodTime?: { startTime: string; endTime: string };
}) {
  const { i18n } = useTranslation("common");
  
  // Format teacher name
  const formattedTeacherName = teacherUserId && (teacherFirstName || teacherLastName)
    ? formatUserName(teacherFirstName, teacherMiddleName, teacherLastName)
    : teacherName;
  
  // If current user is a student, don't show link
  if (isCurrentUserStudent) {
    return (
      <div className="space-y-1">
        <div className="font-medium text-xs sm:text-sm break-words">
          {subjectName}
        </div>
        {className && (
          <div className="text-[10px] sm:text-xs text-muted-foreground break-words">
            {className}
          </div>
        )}
        {formattedTeacherName && (
          <div className="mt-1">
            {teacherUserId ? (
              <Link
                to={`/${i18n.language}/admin/user/${teacherUserId}`}
                className="text-[10px] sm:text-xs text-primary hover:underline break-words"
              >
                {formattedTeacherName}
              </Link>
            ) : (
              <div className="text-[10px] sm:text-xs text-muted-foreground break-words">
                {formattedTeacherName}
              </div>
            )}
          </div>
        )}
        {periodTime && (
          <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground mt-1">
            <ClockIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
            <span>{periodTime.startTime} - {periodTime.endTime}</span>
          </div>
        )}
      </div>
    );
  }
  
  // Create link params for the lesson
  const linkParams = new URLSearchParams({
    classId,
    subjectId,
    periodIndex: periodIndex.toString(),
    dayOfWeek: dayOfWeek.toString(),
    ...(date && { date: date.toString() }),
  });

  return (
    <div className="space-y-1">
      <Link
        to={`/${i18n.language}/diary/lesson?${linkParams.toString()}`}
        className="font-medium hover:underline text-xs sm:text-sm break-words"
      >
        {subjectName}
      </Link>
      {className && (
        <div className="text-[10px] sm:text-xs text-muted-foreground break-words">{className}</div>
      )}
      {formattedTeacherName && (
        <div className="mt-1">
          {teacherUserId ? (
            <Link
              to={`/${i18n.language}/admin/user/${teacherUserId}`}
              className="text-[10px] sm:text-xs text-primary hover:underline break-words"
            >
              {formattedTeacherName}
            </Link>
          ) : (
            <div className="text-[10px] sm:text-xs text-muted-foreground break-words">{formattedTeacherName}</div>
          )}
        </div>
      )}
      {periodTime && (
        <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground mt-1">
          <ClockIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
          <span>{periodTime.startTime} - {periodTime.endTime}</span>
        </div>
      )}
    </div>
  );
}

export default function UserProfile() {
  const { userId } = useParams<{ userId: string }>();
  const { i18n } = useTranslation("common");
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser } = useAuth();
  
  // Check if we should open schedule tab from query param
  const searchParams = new URLSearchParams(location.search);
  const initialTab = searchParams.get('tab') || 'basic';
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Week navigation state (-5 to +5 weeks from current week)
  const [weekOffset, setWeekOffset] = useState(0);
  
  // Get current user to check if admin
  const currentUser = useQuery(api.users.getCurrentUser, {});
  
  const user = useQuery(
    api.users.getUserById,
    userId ? { userId: userId as Id<"users"> } : "skip"
  );
  const avatarUrl = useQuery(
    api.users.getAvatarUrl,
    userId ? { userId: userId as Id<"users"> } : "skip"
  );
  
  // Check if current user is admin
  const isCurrentUserAdmin = currentUser && (
    currentUser.role === "system_admin" ||
    currentUser.role === "director" ||
    currentUser.role === "vice_director" ||
    currentUser.role === "secretary" ||
    currentUser.roles?.includes("system_admin") ||
    currentUser.roles?.includes("director") ||
    currentUser.roles?.includes("vice_director") ||
    currentUser.roles?.includes("secretary")
  );
  
  // Check if current user is student
  const isCurrentUserStudent = currentUser && (
    currentUser.role === "student" || currentUser.roles?.includes("student")
  );
  
  // Check if current user can view admin profile (admin, director, vice_director, teacher)
  const canViewAdminProfile = currentUser && (
    currentUser.role === "system_admin" ||
    currentUser.role === "director" ||
    currentUser.role === "vice_director" ||
    currentUser.role === "teacher" ||
    currentUser.role === "class_teacher" ||
    currentUser.roles?.includes("system_admin") ||
    currentUser.roles?.includes("director") ||
    currentUser.roles?.includes("vice_director") ||
    currentUser.roles?.includes("teacher") ||
    currentUser.roles?.includes("class_teacher")
  );
  
  // Check if viewing user is student
  const isViewingUserStudent = user && (
    user.role === "student" || user.roles?.includes("student")
  );
  
  // Check if viewing user is teacher/admin/director
  const isViewingUserStaff = user && (
    user.role === "teacher" ||
    user.role === "class_teacher" ||
    user.role === "director" ||
    user.role === "vice_director" ||
    user.role === "system_admin" ||
    user.role === "secretary" ||
    user.role === "pedagogical_counselor" ||
    user.role === "housekeeper" ||
    user.roles?.includes("teacher") ||
    user.roles?.includes("class_teacher") ||
    user.roles?.includes("director") ||
    user.roles?.includes("vice_director") ||
    user.roles?.includes("system_admin") ||
    user.roles?.includes("secretary") ||
    user.roles?.includes("pedagogical_counselor") ||
    user.roles?.includes("housekeeper")
  );
  
  // Get user's class if student
  const studentClassId = useQuery(
    api.users.getStudentClass,
    userId && (user?.role === "student" || user?.roles?.includes("student")) 
      ? { userId: userId as Id<"users"> } 
      : "skip"
  );
  
  const userClass = useQuery(
    api.admin.getClassById,
    studentClassId ? { classId: studentClassId } : "skip"
  );
  
  // Get teacher info if teacher
  const teacherInfo = useQuery(
    api.users.getTeacherInfo,
    userId && (user?.role === "teacher" || user?.roles?.includes("teacher") || user?.role === "class_teacher" || user?.roles?.includes("class_teacher"))
      ? { userId: userId as Id<"users"> }
      : "skip"
  );
  
  // Get detailed teacher info for teacher section
  const teacherDetails = useQuery(
    api.users.getTeacherDetails,
    userId && (user?.role === "teacher" || user?.roles?.includes("teacher") || user?.role === "class_teacher" || user?.roles?.includes("class_teacher"))
      ? { userId: userId as Id<"users"> }
      : "skip"
  );
  
  // Get weekly schedule for user
  const weeklySchedule = useQuery(
    api.weeklySchedules.getActiveScheduleForUser,
    userId ? { userId: userId as Id<"users"> } : "skip"
  );
  
  // Get reviews for student
  const studentReviews = useQuery(
    api.reviews.getStudentReviewsByUserId,
    userId && (user?.role === "student" || user?.roles?.includes("student"))
      ? { userId: userId as Id<"users"> }
      : "skip"
  );
  
  // Get grades for student
  const studentGrades = useQuery(
    api.grades.getGradesByStudentUserId,
    userId && (user?.role === "student" || user?.roles?.includes("student"))
      ? { userId: userId as Id<"users"> }
      : "skip"
  );
  
  // Get attendance for student
  const studentAttendance = useQuery(
    api.attendanceQueries.getStudentAttendanceByUserId,
    userId && (user?.role === "student" || user?.roles?.includes("student"))
      ? { userId: userId as Id<"users"> }
      : "skip"
  );
  
  // Calculate the start of the week for the current offset
  const currentWeekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const currentWeekEnd = addWeeks(currentWeekStart, 1);
  currentWeekEnd.setDate(currentWeekEnd.getDate() - 1);
  
  // Get absences for the current week displayed in schedule
  const userAbsences = useQuery(
    api.teacherAbsences.getAbsencesForUserSchedule,
    userId ? {
      userId: userId as Id<"users">,
      startDate: currentWeekStart.getTime(),
      endDate: currentWeekEnd.getTime(),
    } : "skip"
  );
  
  // Get taken lessons for the current week
  const takenLessons = useQuery(
    api.teacherAbsences.getTakenLessonsForUserSchedule,
    userId ? {
      userId: userId as Id<"users">,
      startDate: currentWeekStart.getTime(),
      endDate: currentWeekEnd.getTime(),
    } : "skip"
  );
  
  // Build absence map: dayOfWeek -> periodIndex -> substitute info
  // Prioritize substitute entries (where teacher is substituting for someone)
  // over own absence entries (where teacher is absent)
  const absenceMap = useMemo(() => {
    const map: Record<number, Record<number, { substituteTeacherName: string | null; originalTeacher: string; isCivicEducation?: boolean; isSubstitute?: boolean }>> = {};
    
    if (userAbsences) {
      // First pass: add substitute entries (higher priority)
      for (const absence of userAbsences) {
        for (const entry of absence.affectedEntries) {
          if (entry.isSubstitute) {
            if (!map[entry.dayOfWeek]) {
              map[entry.dayOfWeek] = {};
            }
            map[entry.dayOfWeek][entry.periodIndex] = {
              substituteTeacherName: entry.substituteTeacherName,
              originalTeacher: absence.teacherName,
              isCivicEducation: entry.isCivicEducation,
              isSubstitute: entry.isSubstitute,
            };
          }
        }
      }
      
      // Second pass: add own absence entries (only if no substitute entry exists for that slot)
      for (const absence of userAbsences) {
        for (const entry of absence.affectedEntries) {
          if (!entry.isSubstitute) {
            if (!map[entry.dayOfWeek]) {
              map[entry.dayOfWeek] = {};
            }
            // Only add if no substitute entry exists for this slot
            if (!map[entry.dayOfWeek][entry.periodIndex]) {
              map[entry.dayOfWeek][entry.periodIndex] = {
                substituteTeacherName: entry.substituteTeacherName,
                originalTeacher: absence.teacherName,
                isCivicEducation: entry.isCivicEducation,
                isSubstitute: entry.isSubstitute,
              };
            }
          }
        }
      }
    }
    
    return map;
  }, [userAbsences]);
  
  // Check if there are any substitution entries (entries where this user is substituting for someone else)
  const substituteOnlySchedule = useMemo(() => {
    if (!userAbsences) return null;
    
    // Find all entries where user is substituting
    const substituteEntries: Array<{
      dayOfWeek: number;
      periodIndex: number;
      subjectName: string;
      className: string;
      classId?: string;
      subjectId?: string;
      originalTeacher: string;
      isCivicEducation?: boolean;
    }> = [];
    
    for (const absence of userAbsences) {
      for (const entry of absence.affectedEntries) {
        if (entry.isSubstitute) {
          substituteEntries.push({
            dayOfWeek: entry.dayOfWeek,
            periodIndex: entry.periodIndex,
            subjectName: entry.subjectName,
            className: entry.className || "—",
            classId: entry.classId,
            subjectId: entry.subjectId,
            originalTeacher: absence.teacherName,
            isCivicEducation: entry.isCivicEducation,
          });
        }
      }
    }
    
    if (substituteEntries.length === 0) return null;
    
    // Build a schedule-like structure from substitute entries
    // Find max period
    const maxPeriod = Math.max(...substituteEntries.map(e => e.periodIndex + 1), 0);
    
    return {
      entries: substituteEntries,
      maxPeriod,
    };
  }, [userAbsences]);
  
  // Check if current user is viewing their own profile
  const isOwnProfile = authUser?.profile?.sub && user?.tokenIdentifier === authUser.profile.sub;
  
  // Mutations
  const adminChangeUserPassword = useAction(api.usersActions.adminChangeUserPasswordAction);
  const softDeleteUser = useMutation(api.users.softDeleteUser);
  const restoreUser = useMutation(api.users.restoreUser);
  const generateUploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const updateAvatar = useMutation(api.users.updateAvatar);
  
  // Check if current user can change avatar (admin, director, vice_director)
  const canChangeAvatar = currentUser && (
    currentUser.role === "system_admin" ||
    currentUser.role === "director" ||
    currentUser.role === "vice_director" ||
    currentUser.roles?.includes("system_admin") ||
    currentUser.roles?.includes("director") ||
    currentUser.roles?.includes("vice_director")
  );
  
  // Handle avatar upload
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

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

    setIsUploadingAvatar(true);
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

      // Update avatar - pass userId to update this user's avatar
      await updateAvatar({ 
        storageId, 
        userId: userId as Id<"users"> 
      });

      toast.success("Снимката е качена успешно");
    } catch (error) {
      console.error("Avatar upload error:", error);
      toast.error(error instanceof Error ? error.message : "Грешка при качване на снимката");
    } finally {
      setIsUploadingAvatar(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };
  
  // Password form state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Calculate ISO week number for the current week being viewed
  const currentISOWeek = getISOWeek(currentWeekStart);
  const weekLabel = `Седмица ${currentISOWeek}`;
  
  const canGoBack = weekOffset > -5;
  const canGoForward = weekOffset < 5;
  
  // Get current day of week (1-5 for Mon-Fri, 0 for Sun, 6 for Sat)
  const today = new Date();
  const todayDayOfWeek = today.getDay() === 0 ? 7 : today.getDay(); // Convert Sunday from 0 to 7
  const isTodayInWeek = weekOffset === 0 && todayDayOfWeek >= 1 && todayDayOfWeek <= 5;

  if (user === undefined) {
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
        <div className="text-center text-muted-foreground">
          Потребителят не е намерен
        </div>
      </Layout>
    );
  }

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
    if (user.role && user.role !== "class_teacher") allRoles.add(user.role);
    if (user.roles) user.roles.forEach((r: string) => { if (r !== "class_teacher") allRoles.add(r); });
    return Array.from(allRoles);
  };

  const getGenderLabel = (gender?: string) => {
    if (gender === "male") return "Мъж";
    if (gender === "female") return "Жена";
    if (gender === "other") return "Друго";
    return "—";
  };

  const fullName = [user.firstName, user.middleName, user.lastName]
    .filter(Boolean)
    .join(" ") || user.name || "Без име";

  // Change password
  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Паролите не съвпадат");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Паролата трябва да е поне 6 символа");
      return;
    }
    try {
      await adminChangeUserPassword({
        userId: user._id,
        newPassword,
      });
      toast.success("Паролата беше успешно променена");
      setPasswordDialogOpen(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error("Грешка при промяна на паролата");
    }
  };

  // Soft delete user
  const handleDeleteUser = async () => {
    try {
      await softDeleteUser({ userId: user._id });
      toast.success("Потребителят беше изтрит");
      setDeleteDialogOpen(false);
    } catch (error) {
      toast.error("Грешка при изтриване на потребителя");
    }
  };

  // Restore user
  const handleRestoreUser = async () => {
    try {
      await restoreUser({ userId: user._id });
      toast.success("Потребителят беше възстановен");
    } catch (error) {
      toast.error("Грешка при възстановяване на потребителя");
    }
  };

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
                // Check if we have a return URL in location state
                const returnUrl = (location.state as { returnUrl?: string })?.returnUrl;
                if (returnUrl) {
                  navigate(returnUrl);
                } else {
                  // Fallback to browser back or users page
                  if (window.history.length > 1) {
                    navigate(-1);
                  } else {
                    navigate(`/${i18n.language}/admin/users`);
                  }
                }
              }}
            >
              <ArrowLeftIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-bold truncate">{fullName}</h1>
              <div className="flex flex-wrap gap-1 items-center">
                {(() => {
                  return getDisplayRoles().map((r) => (
                    <Badge key={r} variant="secondary" className="text-xs">
                      {getRoleLabel(r).toUpperCase()}
                    </Badge>
                  ));
                })()}
                {user.scientificTitle && (
                  <span className="text-xs text-muted-foreground ml-1">{user.scientificTitle}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            {/* Only show edit/delete buttons to admins */}
            {isCurrentUserAdmin && (
              <>
                {user.isDeleted ? (
                  <Button variant="default" className="gap-2 flex-1 sm:flex-initial" onClick={handleRestoreUser} size="sm">
                    <CheckIcon className="h-4 w-4" />
                    <span className="sm:inline">Възстанови</span>
                  </Button>
                ) : !isOwnProfile ? (
                  <>
                    <Button variant="default" className="gap-2 flex-1 sm:flex-initial" onClick={() => setEditDialogOpen(true)} size="sm">
                      <EditIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">Редактирай</span>
                    </Button>
                    <Button variant="secondary" className="gap-2 hidden sm:flex" onClick={() => setPasswordDialogOpen(true)} size="sm">
                      <KeyIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">Смени парола</span>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="sm:w-auto">
                          <MoreVerticalIcon className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="sm:hidden" onClick={() => setPasswordDialogOpen(true)}>
                          <KeyIcon className="mr-2 h-4 w-4" />
                          Смени парола
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)}>
                          <TrashIcon className="mr-2 h-4 w-4" />
                          Изтрий
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                ) : (
                  <Button variant="default" className="gap-2 flex-1 sm:flex-initial" onClick={() => setEditDialogOpen(true)} size="sm">
                    <EditIcon className="h-4 w-4" />
                    <span className="sm:inline">Редактирай</span>
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        <div className={`grid gap-4 sm:gap-6 ${!isOwnProfile ? 'grid-cols-1 lg:grid-cols-[280px_1fr]' : 'lg:grid-cols-[280px_1fr]'}`}>
          {/* Sidebar */}
          <Card className={`${!isOwnProfile ? 'order-1' : 'order-2 lg:order-1'}`}>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-6">
                {/* Profile Image */}
                <div className="flex justify-center">
                  <div className="relative group">
                    {/* Hidden file input */}
                    {canChangeAvatar && (
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                        id="avatar-upload-profile"
                      />
                    )}
                    {/* Avatar - clickable for admins */}
                    <button
                      onClick={() => canChangeAvatar && fileInputRef.current?.click()}
                      disabled={!canChangeAvatar || isUploadingAvatar}
                      className={`flex h-32 w-32 items-center justify-center rounded-full bg-muted overflow-hidden border-8 border-background ${canChangeAvatar ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
                      title={canChangeAvatar ? "Кликнете за да качите снимка" : undefined}
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
                    {canChangeAvatar && (
                      <div
                        className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg pointer-events-none"
                      >
                        {isUploadingAvatar ? (
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

                {/* Quick Actions */}
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-center gap-2"
                    onClick={() => navigate(`/${i18n.language}/messages?user=${userId}`)}
                  >
                    <MessageSquareIcon className="h-4 w-4" />
                    Прати съобщение
                  </Button>
                  {canViewAdminProfile && (
                    <Button
                      variant="secondary"
                      className="w-full justify-center gap-2"
                      onClick={() => navigate(`/${i18n.language}/admin/user/${userId}/admin-profile`)}
                    >
                      <FileTextIcon className="h-4 w-4" />
                      Административен профил
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Content */}
          <Card className={`${!isOwnProfile ? 'order-2' : 'order-1 lg:order-2'}`}>
            <CardHeader className="border-b p-3 sm:p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start h-auto flex-wrap gap-1">
                  <TabsTrigger value="basic" className="text-xs sm:text-sm">Основни данни</TabsTrigger>
                  {/* Hide schedule tab when student views teacher/admin/student profile (not their own) */}
                  {!(isCurrentUserStudent && !isOwnProfile) && (
                    <TabsTrigger value="schedule" className="text-xs sm:text-sm">Разписание</TabsTrigger>
                  )}
                  {/* Hide teacher tab when student views another student's profile */}
                  {!(isCurrentUserStudent && isViewingUserStudent && !isOwnProfile) && (
                    <>
                      {(user.role === "teacher" || user?.roles?.includes("teacher") || user.role === "class_teacher" || user?.roles?.includes("class_teacher")) && (
                        <TabsTrigger value="teacher" className="text-xs sm:text-sm">Учител</TabsTrigger>
                      )}
                    </>
                  )}
                  {/* Hide grades, reviews and attendance tabs when student views another student's profile */}
                  {!(isCurrentUserStudent && isViewingUserStudent && !isOwnProfile) && (
                    <>
                      {(user.role === "student" || user.roles?.includes("student")) && (
                        <>
                          <TabsTrigger value="grades" className="text-xs sm:text-sm">Оценки</TabsTrigger>
                          <TabsTrigger value="reviews" className="text-xs sm:text-sm">Отзиви</TabsTrigger>
                          <TabsTrigger value="attendance" className="text-xs sm:text-sm">Отсъствия</TabsTrigger>
                        </>
                      )}
                    </>
                  )}
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsContent value="basic" className="space-y-4 mt-0">
                  {/* Student viewing another student's profile - show limited data only */}
                  {isCurrentUserStudent && isViewingUserStudent && !isOwnProfile ? (
                    <div className="space-y-4">
                      <h3 className="text-base sm:text-lg font-semibold mb-3 pb-2 border-b">Информация</h3>
                      <div className="grid gap-3">
                        <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center border-b pb-2 text-xs sm:text-sm">
                          <div className="font-medium text-muted-foreground">Име:</div>
                          <div className="break-words">{user.firstName || user.name?.split(" ")[0] || "—"}</div>
                        </div>
                        
                        <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center border-b pb-2 text-xs sm:text-sm">
                          <div className="font-medium text-muted-foreground">Презиме:</div>
                          <div className="break-words">{user.middleName || user.name?.split(" ")[1] || "—"}</div>
                        </div>
                        
                        <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center border-b pb-2 text-xs sm:text-sm">
                          <div className="font-medium text-muted-foreground">Фамилия:</div>
                          <div className="break-words">{user.lastName || user.name?.split(" ").slice(2).join(" ") || "—"}</div>
                        </div>
                        
                        <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center border-b pb-2 text-xs sm:text-sm">
                          <div className="font-medium text-muted-foreground">Роля:</div>
                          <div className="break-words">{getRoleLabel(user.role)}</div>
                        </div>
                        
                        {userClass && (
                          <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center border-b pb-2 text-xs sm:text-sm">
                            <div className="font-medium text-muted-foreground">Паралелка:</div>
                            <div className="flex items-center gap-1">
                              <span className="text-lg">🏫</span> {userClass.name}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : isCurrentUserStudent && isViewingUserStaff && !isOwnProfile ? (
                    /* Student viewing teacher/admin/director profile - show limited data only */
                    <div className="space-y-4">
                      <h3 className="text-base sm:text-lg font-semibold mb-3 pb-2 border-b">Информация</h3>
                      <div className="grid gap-3">
                        <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center border-b pb-2 text-xs sm:text-sm">
                          <div className="font-medium text-muted-foreground">Име:</div>
                          <div className="break-words">{user.firstName || user.name?.split(" ")[0] || "—"}</div>
                        </div>
                        
                        <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center border-b pb-2 text-xs sm:text-sm">
                          <div className="font-medium text-muted-foreground">Презиме:</div>
                          <div className="break-words">{user.middleName || user.name?.split(" ")[1] || "—"}</div>
                        </div>
                        
                        <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center border-b pb-2 text-xs sm:text-sm">
                          <div className="font-medium text-muted-foreground">Фамилия:</div>
                          <div className="break-words">{user.lastName || user.name?.split(" ").slice(2).join(" ") || "—"}</div>
                        </div>
                        
                        <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center border-b pb-2 text-xs sm:text-sm">
                          <div className="font-medium text-muted-foreground">Роля:</div>
                          <div className="break-words">{getRoleLabel(user.role)}</div>
                        </div>
                        
                        {user.scientificTitle && (
                          <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center border-b pb-2 text-xs sm:text-sm">
                            <div className="font-medium text-muted-foreground">Научно звание:</div>
                            <div className="break-words">{user.scientificTitle}</div>
                          </div>
                        )}
                        
                        {teacherDetails?.homeroomClass && (
                          <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center border-b pb-2 text-xs sm:text-sm">
                            <div className="font-medium text-muted-foreground">Класен ръководител на:</div>
                            <div>
                              <span className="text-lg">🏫</span>
                              <span> {teacherDetails.homeroomClass.name}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Default view for admins and own profile - show all data */
                    <div className="grid gap-3 sm:gap-4">
                    <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center border-b pb-2 text-xs sm:text-sm">
                      <div className="font-medium text-muted-foreground">Име:</div>
                      <div className="break-words">{user.firstName || user.name?.split(" ")[0] || "—"}</div>
                    </div>
                    
                    <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center border-b pb-2 text-xs sm:text-sm">
                      <div className="font-medium text-muted-foreground">Презиме:</div>
                      <div className="break-words">{user.middleName || user.name?.split(" ")[1] || "—"}</div>
                    </div>
                    
                    <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center border-b pb-2 text-xs sm:text-sm">
                      <div className="font-medium text-muted-foreground">Фамилия:</div>
                      <div className="break-words">{user.lastName || user.name?.split(" ").slice(2).join(" ") || "—"}</div>
                    </div>
                    
                    <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center border-b pb-2 text-xs sm:text-sm">
                      <div className="font-medium text-muted-foreground">Пол:</div>
                      <div>{getGenderLabel(user.gender)}</div>
                    </div>
                    
                    <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center border-b pb-2 text-xs sm:text-sm">
                      <div className="font-medium text-muted-foreground">Дата на раждане:</div>
                      <div className="break-words">{user.birthDate || "—"}</div>
                    </div>
                    
                    <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center border-b pb-2 text-xs sm:text-sm">
                      <div className="font-medium text-muted-foreground">Място на раждане:</div>
                      <div className="break-words">{user.birthPlace || "—"}</div>
                    </div>
                    
                    <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center border-b pb-2 text-xs sm:text-sm">
                      <div className="font-medium text-muted-foreground">Гражданство:</div>
                      <div>България</div>
                    </div>
                    
                    <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center border-b pb-2 text-xs sm:text-sm">
                      <div className="font-medium text-muted-foreground">Телефон:</div>
                      <div className="text-blue-600 break-words">{user.phone || "—"}</div>
                    </div>
                    
                    <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center border-b pb-2 text-xs sm:text-sm">
                      <div className="font-medium text-muted-foreground">Ел. поща:</div>
                      <div className="text-blue-600 break-all">{user.email || "—"}</div>
                    </div>
                    
                    <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center border-b pb-2 text-xs sm:text-sm">
                      <div className="font-medium text-muted-foreground">Потребителско име:</div>
                      <div className="break-words">{user.username || "—"}</div>
                    </div>
                    
                    <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center border-b pb-2 text-xs sm:text-sm">
                      <div className="font-medium text-muted-foreground">Статус:</div>
                      <div>
                        {user.isDeleted ? (
                          <Badge variant="destructive" className="text-xs">Изтрит</Badge>
                        ) : (
                          <Badge variant="default" className="bg-cyan-500 text-xs">
                            Активен
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr] gap-2 sm:gap-4 items-center border-b pb-2 text-xs sm:text-sm">
                      <div className="font-medium text-muted-foreground">Дата на създаване:</div>
                      <div className="break-words">{format(new Date(user._creationTime), "yyyy-MM-dd HH:mm:ss", { locale: bg })}</div>
                    </div>
                    
                    {/* Show class for students */}
                    {(user.role === "student" || user.roles?.includes("student")) && (
                      <div className="grid grid-cols-[180px_1fr] gap-4 items-center border-b pb-2">
                        <div className="font-medium text-muted-foreground">Клас:</div>
                        <div>
                          {userClass ? (
                            isCurrentUserStudent ? (
                              userClass.name
                            ) : (
                              <Link 
                                to={`/${i18n.language}/admin/classes/${userClass._id}`}
                                className="text-blue-600 hover:underline"
                              >
                                {userClass.name}
                              </Link>
                            )
                          ) : (
                            "Няма клас"
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Show homeroom teacher for students */}
                    {(user.role === "student" || user.roles?.includes("student")) && userClass?.classTeacher && (
                      <div className="grid grid-cols-[180px_1fr] gap-4 items-center border-b pb-2">
                        <div className="font-medium text-muted-foreground">Класен ръководител:</div>
                        <div>
                          {[userClass.classTeacher.firstName, userClass.classTeacher.lastName].filter(Boolean).join(" ") || "—"}
                        </div>
                      </div>
                    )}
                    
                    {/* Show parents for students - only for admins */}
                    {(user.role === "student" || user.roles?.includes("student")) && isCurrentUserAdmin && (
                      <div className="grid grid-cols-[180px_1fr] gap-4 items-start border-b pb-2">
                        <div className="font-medium text-muted-foreground">Родители:</div>
                        <div>
                          <StudentParentsSection userId={user._id} />
                        </div>
                      </div>
                    )}
                    
                    {/* Show subjects for teachers */}
                    {(user.role === "teacher" || user.roles?.includes("teacher") || user.role === "class_teacher" || user.roles?.includes("class_teacher")) && teacherInfo && (
                      <>
                        <div className="grid grid-cols-[180px_1fr] gap-4 items-start border-b pb-2">
                          <div className="font-medium text-muted-foreground">Предмети:</div>
                          <div>
                            {teacherInfo.subjects.length > 0 || teacherInfo.homeroomClass ? (
                              <div className="flex flex-wrap gap-2">
                                {teacherInfo.subjects.map((subject) => (
                                  isCurrentUserStudent ? (
                                    <Badge key={subject._id} variant="secondary">{subject.name}</Badge>
                                  ) : (
                                    <Link
                                      key={subject._id}
                                      to={`/${i18n.language}/admin/subjects/${subject._id}`}
                                      className="text-blue-600 hover:underline"
                                    >
                                      <Badge variant="secondary">{subject.name}</Badge>
                                    </Link>
                                  )
                                ))}
                                {teacherInfo.homeroomClass && (
                                  <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                                    Класен на: {teacherInfo.homeroomClass.name}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              "Няма предмети"
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-[180px_1fr] gap-4 items-start border-b pb-2">
                          <div className="font-medium text-muted-foreground">Преподава в класове:</div>
                          <div>
                            {teacherInfo.classes.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {teacherInfo.classes.map((cls) => (
                                  isCurrentUserStudent ? (
                                    <Badge key={cls._id} variant="outline">{cls.name}</Badge>
                                  ) : (
                                    <Link
                                      key={cls._id}
                                      to={`/${i18n.language}/admin/classes/${cls._id}`}
                                      className="text-blue-600 hover:underline"
                                    >
                                      <Badge variant="outline">{cls.name}</Badge>
                                    </Link>
                                  )
                                ))}
                              </div>
                            ) : (
                              "Не преподава в класове"
                            )}
                          </div>
                        </div>
                      </>
                    )}
                    </div>
                  )}
                </TabsContent>

                {/* Hide schedule tab content when student views any other profile (not their own) */}
                {!(isCurrentUserStudent && !isOwnProfile) && (
                  <TabsContent value="schedule" className="space-y-4 mt-0">
                    {/* Week navigation */}
                    <div className="flex items-center justify-between border-b pb-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setWeekOffset(weekOffset - 1)}
                      disabled={!canGoBack}
                    >
                      <ChevronLeftIcon className="h-5 w-5" />
                    </Button>
                    <div className="text-center">
                      <div className="font-medium">{weekLabel}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(currentWeekStart, "dd.MM.yyyy", { locale: bg })} - {format(addWeeks(currentWeekStart, 1), "dd.MM.yyyy", { locale: bg })}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setWeekOffset(weekOffset + 1)}
                      disabled={!canGoForward}
                    >
                      <ChevronRightIcon className="h-5 w-5" />
                    </Button>
                  </div>
                  
                  {weeklySchedule === undefined ? (
                    <div className="py-8 text-center">
                      <Skeleton className="h-96 w-full" />
                    </div>
                  ) : weeklySchedule ? (
                    <div className="overflow-x-auto -mx-2 sm:mx-0">
                      <div className="inline-block min-w-full align-middle">
                        <table className="w-full table-fixed border-collapse">
                          <thead>
                            <tr>
                              <th className="border border-border bg-muted p-1 sm:p-2 text-xs sm:text-sm font-medium text-center sticky left-0 z-10 w-10 sm:w-12">#</th>
                              {["Понеделник", "Вторник", "Сряда", "Четвъртък", "Петък"].map((day, idx) => {
                                const dayNumber = idx + 1; // 1 = Monday, 2 = Tuesday, etc.
                                const isToday = isTodayInWeek && todayDayOfWeek === dayNumber;
                                const dayDate = new Date(currentWeekStart);
                                dayDate.setDate(dayDate.getDate() + idx);
                                const formattedDate = format(dayDate, "dd.MM", { locale: bg });
                                return (
                                  <th 
                                    key={idx} 
                                    className={`border border-border p-1 sm:p-2 text-xs sm:text-sm font-medium text-center ${
                                      isToday ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-muted'
                                    }`}
                                  >
                                    <div className="flex flex-col items-center">
                                      <span className="hidden sm:inline">{day}</span>
                                      <span className="sm:hidden">{day.substring(0, 2)}</span>
                                      <span className="text-[10px] sm:text-xs font-normal text-muted-foreground mt-0.5">{formattedDate}</span>
                                    </div>
                                    {isToday && (
                                      <span className="text-xs font-normal block mt-0.5">(Днес)</span>
                                    )}
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                          {/* Calculate max periods across all days, including substitute-only periods */}
                          {Array.from({ length: Math.max(
                            ...weeklySchedule.schedule.slice(1, 6).map(day => day?.length || 0),
                            substituteOnlySchedule?.maxPeriod || 0
                          ) }).map((_, periodIdx) => {
                            // Get period time from dayRegimePeriods
                            const periodTime = weeklySchedule.dayRegimePeriods?.find(p => p.periodNumber === periodIdx + 1);
                            
                            return (
                            <tr key={periodIdx}>
                              <td className="border border-border bg-muted p-1 sm:p-2 text-xs sm:text-sm font-medium text-center sticky left-0 z-10 w-10 sm:w-12">
                                {periodIdx + 1}
                              </td>
                              {[1, 2, 3, 4, 5].map((dayIdx) => {
                                const daySchedule = weeklySchedule.schedule[dayIdx];
                                const period = daySchedule?.[periodIdx + 1];
                                
                                // Calculate the date for this specific day
                                const dayDate = addWeeks(currentWeekStart, 0);
                                dayDate.setDate(dayDate.getDate() + (dayIdx - 1));
                                const dayDateTimestamp = dayDate.getTime();
                                
                                const isToday = isTodayInWeek && todayDayOfWeek === dayIdx;
                                
                                // Check for absence/substitution
                                const dayOfWeek = dayIdx;
                                // Use periodIdx directly (0-based) to match absenceMap
                                const absence = absenceMap[dayOfWeek]?.[periodIdx];
                                const isTaken = takenLessons?.[`${dayOfWeek}_${periodIdx + 1}`] || false;
                                
                                return (
                                  <td 
                                    key={dayIdx} 
                                    className={`border border-border p-1 sm:p-2 text-xs sm:text-sm align-top ${
                                      isToday && !isTaken ? 'bg-blue-50 dark:bg-blue-900/10' : isTaken ? 'bg-green-100 dark:bg-green-950/30' : ''
                                    }`}
                                  >
                                    {/* When teacher has their own absence (not substituting), hide the cell completely */}
                                    {absence && !absence.isSubstitute ? (
                                      <div className="text-xs text-muted-foreground">—</div>
                                    ) : period?.subjectName && period?.subjectId && period?.classId !== undefined && period?.periodIndex !== undefined && period?.dayOfWeek !== undefined ? (
                                      <div className="space-y-1">
                                        <LessonLink
                                          subjectName={absence?.isCivicEducation ? "Гражданско образование" : period.subjectName}
                                          classId={period.classId}
                                          subjectId={period.subjectId}
                                          periodIndex={period.periodIndex}
                                          dayOfWeek={period.dayOfWeek}
                                          className={period.className}
                                          teacherName={absence ? undefined : period.teacherName}
                                          teacherUserId={absence ? undefined : period.teacherUserId}
                                          teacherFirstName={absence ? undefined : period.teacherFirstName}
                                          teacherMiddleName={absence ? undefined : period.teacherMiddleName}
                                          teacherLastName={absence ? undefined : period.teacherLastName}
                                          date={dayDateTimestamp}
                                          isCurrentUserStudent={!!isCurrentUserStudent}
                                          periodTime={periodTime ? { startTime: periodTime.startTime, endTime: periodTime.endTime } : undefined}
                                        />
                                        {absence && (
                                          <div className="text-[10px] sm:text-xs text-orange-600 dark:text-orange-400">
                                            {absence.isSubstitute ? (
                                              <>
                                                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                                  <InfoIcon className="h-2 w-2 sm:h-3 sm:w-3 shrink-0" />
                                                  <span className="break-words font-bold">Заместване на {absence.originalTeacher}</span>
                                                </div>
                                              </>
                                            ) : absence.substituteTeacherName ? (
                                              <>
                                                <div className="line-through opacity-60 break-words">{absence.originalTeacher}</div>
                                                <div className="flex items-center gap-1">
                                                  <InfoIcon className="h-2 w-2 sm:h-3 sm:w-3 shrink-0" />
                                                  <span className="break-words">{absence.substituteTeacherName}</span>
                                                </div>
                                              </>
                                            ) : (
                                              <>
                                                <div className="line-through opacity-60 break-words">{absence.originalTeacher}</div>
                                                <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                                  <InfoIcon className="h-2 w-2 sm:h-3 sm:w-3 shrink-0" />
                                                  <span className="break-words font-bold">Свободен час</span>
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    ) : period?.subjectName ? (
                                      <div className="space-y-1">
                                        <div className="font-medium text-xs sm:text-sm break-words">
                                          {absence?.isCivicEducation ? "Гражданско образование" : period.subjectName}
                                        </div>
                                        {period.className && (
                                          <div className="text-[10px] sm:text-xs text-muted-foreground break-words">
                                            {period.className}
                                          </div>
                                        )}
                                        {!absence && (period.teacherUserId || period.teacherName) && (
                                          <div className="mt-1">
                                            {period.teacherUserId ? (
                                              <UserNameLink
                                                userId={period.teacherUserId}
                                                firstName={period.teacherFirstName}
                                                middleName={period.teacherMiddleName}
                                                lastName={period.teacherLastName}
                                                className="text-[10px] sm:text-xs"
                                              />
                                            ) : (
                                              <div className="text-[10px] sm:text-xs text-muted-foreground break-words">
                                                {period.teacherName}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        {periodTime && (
                                          <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground mt-1">
                                            <ClockIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                                            <span>{periodTime.startTime} - {periodTime.endTime}</span>
                                          </div>
                                        )}
                                        {absence && (
                                          <div className="text-[10px] sm:text-xs text-orange-600 dark:text-orange-400">
                                            {absence.isSubstitute ? (
                                              <>
                                                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                                  <InfoIcon className="h-2 w-2 sm:h-3 sm:w-3 shrink-0" />
                                                  <span className="break-words font-bold">Заместване на {absence.originalTeacher}</span>
                                                </div>
                                              </>
                                            ) : absence.substituteTeacherName ? (
                                              <>
                                                <div className="line-through opacity-60 break-words">{absence.originalTeacher}</div>
                                                <div className="flex items-center gap-1">
                                                  <InfoIcon className="h-2 w-2 sm:h-3 sm:w-3 shrink-0" />
                                                  <span className="break-words">{absence.substituteTeacherName}</span>
                                                </div>
                                              </>
                                            ) : (
                                              <>
                                                <div className="line-through opacity-60 break-words">{absence.originalTeacher}</div>
                                                <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                                  <InfoIcon className="h-2 w-2 sm:h-3 sm:w-3 shrink-0" />
                                                  <span className="break-words font-bold">Свободен час</span>
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    ) : absence?.isSubstitute ? (
                                      // Show substitution entry even when there's no regular schedule entry
                                      (() => {
                                        // Find full entry info from substituteOnlySchedule
                                        const subEntry = substituteOnlySchedule?.entries.find(
                                          e => e.dayOfWeek === dayOfWeek && e.periodIndex === periodIdx
                                        );
                                        return (
                                          <div className="space-y-1 bg-green-50 dark:bg-green-900/20 p-1.5 rounded-lg border border-green-200 dark:border-green-800">
                                            <div className="font-medium text-xs sm:text-sm break-words text-green-700 dark:text-green-300">
                                              {subEntry?.subjectName || (absence.isCivicEducation ? "ГО (...)" : "Заместване")}
                                              {absence.isCivicEducation && !subEntry?.subjectName && " (ЗАМ.)"}
                                            </div>
                                            {subEntry?.className && (
                                              <div className="text-[10px] sm:text-xs text-green-600 dark:text-green-400">
                                                {subEntry.className}
                                              </div>
                                            )}
                                            {periodTime && (
                                              <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
                                                <ClockIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                                                <span>{periodTime.startTime} - {periodTime.endTime}</span>
                                              </div>
                                            )}
                                            <div className="flex items-center gap-1 text-[10px] sm:text-xs text-green-600 dark:text-green-400">
                                              <InfoIcon className="h-2 w-2 sm:h-3 sm:w-3 shrink-0" />
                                              <span className="break-words font-bold">Замества: {absence.originalTeacher}</span>
                                            </div>
                                          </div>
                                        );
                                      })()
                                    ) : (
                                      <div className="text-xs text-muted-foreground">—</div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  ) : substituteOnlySchedule ? (
                    /* Show substitute-only schedule when teacher has no regular schedule but has substitutions */
                    <div className="overflow-x-auto -mx-2 sm:mx-0">
                      <div className="inline-block min-w-full align-middle">
                        <div className="text-sm text-green-600 dark:text-green-400 mb-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          Показани са само заместващите часове за тази седмица
                        </div>
                        <table className="w-full table-fixed border-collapse">
                          <thead>
                            <tr>
                              <th className="border border-border bg-muted p-1 sm:p-2 text-xs sm:text-sm font-medium text-center sticky left-0 z-10 w-10 sm:w-12">#</th>
                              {["Понеделник", "Вторник", "Сряда", "Четвъртък", "Петък"].map((day, idx) => {
                                const dayNumber = idx + 1;
                                const isToday = isTodayInWeek && todayDayOfWeek === dayNumber;
                                const dayDate = new Date(currentWeekStart);
                                dayDate.setDate(dayDate.getDate() + idx);
                                const formattedDate = format(dayDate, "dd.MM", { locale: bg });
                                return (
                                  <th 
                                    key={idx} 
                                    className={`border border-border p-1 sm:p-2 text-xs sm:text-sm font-medium text-center ${
                                      isToday ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-muted'
                                    }`}
                                  >
                                    <div className="flex flex-col items-center">
                                      <span className="hidden sm:inline">{day}</span>
                                      <span className="sm:hidden">{day.substring(0, 2)}</span>
                                      <span className="text-[10px] sm:text-xs font-normal text-muted-foreground mt-0.5">{formattedDate}</span>
                                    </div>
                                    {isToday && (
                                      <span className="text-xs font-normal block mt-0.5">(Днес)</span>
                                    )}
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: substituteOnlySchedule.maxPeriod }).map((_, periodIdx) => (
                              <tr key={periodIdx}>
                                <td className="border border-border bg-muted p-1 sm:p-2 text-xs sm:text-sm font-medium text-center sticky left-0 z-10 w-10 sm:w-12">
                                  {periodIdx + 1}
                                </td>
                                {[1, 2, 3, 4, 5].map((dayIdx) => {
                                  const isToday = isTodayInWeek && todayDayOfWeek === dayIdx;
                                  // Find substitute entry for this day and period
                                  const subEntry = substituteOnlySchedule.entries.find(
                                    e => e.dayOfWeek === dayIdx && e.periodIndex === periodIdx
                                  );
                                  
                                  return (
                                    <td 
                                      key={dayIdx} 
                                      className={`border border-border p-1 sm:p-2 text-xs sm:text-sm align-top ${
                                        subEntry ? 'bg-green-100 dark:bg-green-900/30' : isToday ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                                      }`}
                                    >
                                      {subEntry ? (
                                        <div className="space-y-1">
                                          {subEntry.classId && subEntry.subjectId ? (
                                            <Link
                                              to={`/${i18n.language}/diary/class/${subEntry.classId}/grades?subject=${subEntry.subjectId}`}
                                              className="block hover:opacity-80"
                                            >
                                              <div className="font-medium text-green-800 dark:text-green-200 break-words">
                                                {subEntry.isCivicEducation ? "Гражданско образование" : subEntry.subjectName}
                                              </div>
                                              <div className="text-[10px] sm:text-xs text-green-700 dark:text-green-300 break-words">
                                                {subEntry.className}
                                              </div>
                                            </Link>
                                          ) : (
                                            <>
                                              <div className="font-medium text-green-800 dark:text-green-200 break-words">
                                                {subEntry.isCivicEducation ? "Гражданско образование" : subEntry.subjectName}
                                              </div>
                                              <div className="text-[10px] sm:text-xs text-green-700 dark:text-green-300 break-words">
                                                {subEntry.className}
                                              </div>
                                            </>
                                          )}
                                          <div className="flex items-center gap-1 text-[10px] sm:text-xs text-green-600 dark:text-green-400">
                                            <InfoIcon className="h-2 w-2 sm:h-3 sm:w-3 shrink-0" />
                                            <span className="break-words font-bold">Заместване на {subEntry.originalTeacher}</span>
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center space-y-2">
                      <div className="text-muted-foreground">
                        Няма налично разписание за този потребител
                      </div>
                      {(user?.role === "student" || user?.roles?.includes("student")) && (
                        <div className="text-sm text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 max-w-md mx-auto">
                          {!studentClassId ? (
                            <>
                              <div className="font-semibold mb-1">⚠️ Ученикът не е записан в паралелка</div>
                              <div>Моля, добавете ученика към паралелка за да се покаже разписанието.</div>
                            </>
                          ) : userClass ? (
                            <>
                              <div className="font-semibold mb-1">⚠️ Паралелката няма създадено разписание</div>
                              <div>Ученикът е записан в паралелка <strong>{userClass.name}</strong>, но паралелката няма седмично разписание.</div>
                              <div className="mt-2">Моля, създайте седмично разписание за паралелката.</div>
                            </>
                          ) : (
                            <>
                              <div className="font-semibold mb-1">⚠️ Ученикът не е записан в паралелка</div>
                              <div>Моля, добавете ученика към паралелка за да се покаже разписанието.</div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
                )}
                
                {/* Hide teacher tab content when student views another student's profile */}
                {!(isCurrentUserStudent && isViewingUserStudent && !isOwnProfile) && (
                  <TabsContent value="teacher" className="space-y-4 mt-0">
                  {teacherDetails === undefined ? (
                    <div className="py-8 text-center">
                      <Skeleton className="h-96 w-full" />
                    </div>
                  ) : teacherDetails ? (
                    <div className="grid gap-4">
                      {/* Номер по образец */}
                      <div className="grid grid-cols-[180px_1fr] gap-4 items-center border-b pb-2">
                        <div className="font-medium text-muted-foreground">Номер по образец:</div>
                        <div>{teacherDetails.staffNumber || "—"}</div>
                      </div>
                      
                      {/* Класен ръководител */}
                      {teacherDetails.homeroomClass && (
                        <div className="grid grid-cols-[180px_1fr] gap-4 items-center border-b pb-2">
                          <div className="font-medium text-muted-foreground">Класен ръководител:</div>
                          <div>
                            {isCurrentUserStudent ? (
                              <span className="inline-flex items-center gap-1">
                                <span className="text-lg">🏫</span>
                                {teacherDetails.homeroomClass.name}
                              </span>
                            ) : (
                              <Link
                                to={`/${i18n.language}/admin/classes/${teacherDetails.homeroomClass._id}`}
                                className="text-blue-600 hover:underline inline-flex items-center gap-1"
                              >
                                <span className="text-lg">🏫</span>
                                {teacherDetails.homeroomClass.name}
                              </Link>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Преподава на */}
                      <div className="grid grid-cols-[180px_1fr] gap-4 items-center border-b pb-2">
                        <div className="font-medium text-muted-foreground">Преподава на:</div>
                        <div>
                          <span className="text-lg">🏫</span> {teacherDetails.classCount} {teacherDetails.classCount === 1 ? 'паралелка' : 'паралелки'}, <span className="text-lg">👤</span> {teacherDetails.studentCount} {teacherDetails.studentCount === 1 ? 'ученик' : 'ученици'}
                        </div>
                      </div>
                      
                      {/* Преподавател по */}
                      <div className="grid grid-cols-[180px_1fr] gap-4 items-start border-b pb-2">
                        <div className="font-medium text-muted-foreground">Преподавател по:</div>
                        <div>
                          {teacherDetails.subjects.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {teacherDetails.subjects.map((subject) => (
                                <Link
                                  key={subject._id}
                                  to={`/${i18n.language}/admin/subjects/${subject._id}`}
                                  className="hover:opacity-80"
                                >
                                  <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                                    📚 {subject.name}
                                  </Badge>
                                </Link>
                              ))}
                            </div>
                          ) : (
                            "Няма предмети"
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-muted-foreground">
                      Няма информация за учителя
                    </div>
                  )}
                </TabsContent>
                )}
                
                {/* Hide grades tab content when student views another student's profile */}
                {!(isCurrentUserStudent && isViewingUserStudent && !isOwnProfile) && (
                  <TabsContent value="grades" className="space-y-4 mt-0">
                  {studentGrades ? (
                    <div className="space-y-6">
                      {/* Statistics */}
                      <div className="grid grid-cols-2 gap-4">
                        <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50">
                          <div className="text-center">
                            <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">
                              {studentGrades.stats.averageGrade.toFixed(2)}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">Среден успех</div>
                          </div>
                        </Card>
                        <Card className="p-4 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50">
                          <div className="text-center">
                            <div className="text-3xl font-bold text-green-700 dark:text-green-400">
                              {studentGrades.stats.totalGrades}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">Общо оценки</div>
                          </div>
                        </Card>
                      </div>
                      
                      {/* All grades list */}
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Всички оценки</h3>
                        {studentGrades.grades.length > 0 ? (
                          <div className="space-y-2">
                            {studentGrades.grades.map((grade) => {
                              // Color based on grade value
                              const getGradeColor = (value: number | string) => {
                                if (typeof value !== "number") return "bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-900/50";
                                const rounded = Math.round(value);
                                if (rounded <= 2) return "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50";
                                if (rounded === 3) return "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/50";
                                if (rounded === 4) return "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900/50";
                                if (rounded === 5) return "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50";
                                return "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50";
                              };
                              
                              const getGradeTextColor = (value: number | string) => {
                                if (typeof value !== "number") return "text-gray-700 dark:text-gray-400";
                                const rounded = Math.round(value);
                                if (rounded <= 2) return "text-red-700 dark:text-red-400";
                                if (rounded === 3) return "text-orange-700 dark:text-orange-400";
                                if (rounded === 4) return "text-yellow-700 dark:text-yellow-400";
                                if (rounded === 5) return "text-blue-700 dark:text-blue-400";
                                return "text-green-700 dark:text-green-400";
                              };
                              
                              return (
                                <div key={grade._id} className={`p-3 rounded border ${getGradeColor(grade.value)}`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-3">
                                        <span className={`text-2xl font-bold ${getGradeTextColor(grade.value)}`}>
                                          {typeof grade.value === "number" ? grade.value.toFixed(2) : grade.value}
                                        </span>
                                        <div>
                                          <div className="font-medium">{grade.subjectName}</div>
                                          <div className="text-sm text-muted-foreground">
                                            {new Date(grade.date).toLocaleDateString("bg-BG")} - {grade.teacherName}
                                          </div>
                                          {grade.notes && (
                                            <div className="text-sm text-muted-foreground italic mt-1">
                                              {grade.notes}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center text-muted-foreground py-8">
                            Няма оценки
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <Skeleton className="h-96 w-full" />
                    </div>
                  )}
                </TabsContent>
                )}
                
                {/* Hide reviews tab content when student views another student's profile */}
                {!(isCurrentUserStudent && isViewingUserStudent && !isOwnProfile) && (
                  <TabsContent value="reviews" className="space-y-4 mt-0">
                  {studentReviews ? (
                    <div className="space-y-6">
                      {/* Похвали */}
                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-green-700 dark:text-green-400">
                          Похвали ({studentReviews.praises.length})
                        </h3>
                        {studentReviews.praises.length > 0 ? (
                          <div className="space-y-2">
                            {studentReviews.praises.map((praise) => (
                              <div key={praise._id} className="p-3 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-900/50">
                                <div className="font-medium">
                                  {(praise as { badgeLabel?: string }).badgeLabel || praise.content}
                                </div>
                                {(praise as { notes?: string | null }).notes && (
                                  <div className="text-sm text-muted-foreground mt-1 italic">
                                    "{(praise as { notes?: string | null }).notes}"
                                  </div>
                                )}
                                <div className="text-sm text-muted-foreground mt-1">
                                  {new Date(praise.date).toLocaleDateString("bg-BG")}
                                  {praise.subjectName && ` - ${praise.subjectName}`}
                                  {" - "}{praise.teacherName}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center text-muted-foreground py-8">
                            Няма похвали
                          </div>
                        )}
                      </div>
                      
                      {/* Забележки */}
                      <div>
                        <h3 className="text-lg font-semibold mb-3 text-red-700 dark:text-red-400">
                          Забележки ({studentReviews.warnings.length})
                        </h3>
                        {studentReviews.warnings.length > 0 ? (
                          <div className="space-y-2">
                            {studentReviews.warnings.map((warning) => (
                              <div key={warning._id} className="p-3 bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-900/50">
                                <div className="font-medium">
                                  {(warning as { badgeLabel?: string }).badgeLabel || warning.content}
                                </div>
                                {(warning as { notes?: string | null }).notes && (
                                  <div className="text-sm text-muted-foreground mt-1 italic">
                                    "{(warning as { notes?: string | null }).notes}"
                                  </div>
                                )}
                                <div className="text-sm text-muted-foreground mt-1">
                                  {new Date(warning.date).toLocaleDateString("bg-BG")}
                                  {warning.subjectName && ` - ${warning.subjectName}`}
                                  {" - "}{warning.teacherName}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center text-muted-foreground py-8">
                            Няма забележки
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <Skeleton className="h-96 w-full" />
                    </div>
                  )}
                </TabsContent>
                )}
                
                {/* Hide attendance tab content when student views another student's profile */}
                {!(isCurrentUserStudent && isViewingUserStudent && !isOwnProfile) && (
                  <TabsContent value="attendance" className="space-y-4 mt-0">
                  {studentAttendance ? (
                    <div className="space-y-6">
                      {/* Statistics */}
                      <div className="grid grid-cols-3 gap-4">
                        <Card className="p-4 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50">
                          <div className="text-center">
                            <div className="text-3xl font-bold text-red-700 dark:text-red-400">
                              {studentAttendance.stats.totalAbsent}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">Отсъствия</div>
                          </div>
                        </Card>
                        <Card className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900/50">
                          <div className="text-center">
                            <div className="text-3xl font-bold text-yellow-700 dark:text-yellow-400">
                              {studentAttendance.stats.totalLate}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">Закъснения</div>
                          </div>
                        </Card>
                        <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50">
                          <div className="text-center">
                            <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">
                              {studentAttendance.stats.totalExcused}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">Уважителни</div>
                          </div>
                        </Card>
                      </div>
                      
                      {/* All attendance records */}
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Всички записи</h3>
                        {studentAttendance.all.length > 0 ? (
                          <div className="space-y-2">
                            {studentAttendance.all.map((record) => {
                              const statusConfig = {
                                absent: { bg: "bg-red-50 dark:bg-red-950/20", border: "border-red-200 dark:border-red-900/50", text: "Отсъствие" },
                                late: { bg: "bg-yellow-50 dark:bg-yellow-950/20", border: "border-yellow-200 dark:border-yellow-900/50", text: "Закъснение" },
                                excused: { bg: "bg-blue-50 dark:bg-blue-950/20", border: "border-blue-200 dark:border-blue-900/50", text: "Уважително" },
                                present: { bg: "bg-green-50 dark:bg-green-950/20", border: "border-green-200 dark:border-green-900/50", text: "Присъствие" },
                              };
                              const config = statusConfig[record.status];
                              
                              return (
                                <div key={record._id} className={`p-3 rounded border ${config.bg} ${config.border}`}>
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="font-medium">{config.text}</div>
                                      <div className="text-sm text-muted-foreground">
                                        {new Date(record.date).toLocaleDateString("bg-BG")} - Час {record.period}
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {record.subjectName} - {record.teacherName}
                                      </div>
                                      {record.notes && (
                                        <div className="text-sm text-muted-foreground mt-1 italic">
                                          {record.notes}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center text-muted-foreground py-8">
                            Няма записи за отсъствия
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <Skeleton className="h-96 w-full" />
                    </div>
                  )}
                </TabsContent>
                )}
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Edit Profile Dialog */}
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

        {/* Change Password Dialog */}
        <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Смяна на парола</DialogTitle>
              <DialogDescription>
                Промяна на паролата за {fullName}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Нова парола</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Поне 6 символа"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Потвърди паролата</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Въведи отново паролата"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setPasswordDialogOpen(false);
                setNewPassword("");
                setConfirmPassword("");
              }}>
                Отказ
              </Button>
              <Button onClick={handleChangePassword}>
                Смени паролата
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Изтриване на потребител</DialogTitle>
              <DialogDescription>
                Сигурни ли сте, че искате да изтриете {fullName}? Потребителят ще загуби достъп до платформата и няма да може да влиза.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Отказ
              </Button>
              <Button variant="destructive" onClick={handleDeleteUser}>
                Изтрий
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
