import { Authenticated, Unauthenticated, AuthLoading, useQuery, useMutation } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { api } from "@/convex/_generated/api.js";
import { useState, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  Users,
  User,
  Star,
  Plus,
  ArrowLeft,
  Printer,
  Copy,
  FileDown,
  Pencil,
  Trash2,
  AlertTriangle,
  BookOpen,
  Info,
  DollarSign,
  GraduationCap,
  UserCircle,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

// Activity categories
const ACTIVITY_CATEGORIES = [
  "Бойни изкуства",
  "Информационни Технологии",
  "Култура",
  "Музика",
  "Образование и наука",
  "Разни",
  "Спорт",
  "Танци",
  "Туризъм",
  "Чужди езици",
] as const;

// Days of week
const DAYS_OF_WEEK = [
  { value: 1, label: "Понеделник", short: "Пон" },
  { value: 2, label: "Вторник", short: "Вт" },
  { value: 3, label: "Сряда", short: "Ср" },
  { value: 4, label: "Четвъртък", short: "Чет" },
  { value: 5, label: "Петък", short: "Пет" },
  { value: 6, label: "Събота", short: "Съб" },
  { value: 7, label: "Неделя", short: "Нед" },
];

// Category colors
function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    "Бойни изкуства": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    "Информационни Технологии": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    "Култура": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    "Музика": "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
    "Образование и наука": "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
    "Разни": "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
    "Спорт": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    "Танци": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    "Туризъм": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
    "Чужди езици": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  };
  return colors[category] || "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
}

// Get current academic year
function getCurrentAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 8) {
    return `${year}/${year + 1}`;
  }
  return `${year - 1}/${year}`;
}

// ============================================
// LIST PAGE
// ============================================

function ActivitiesListPage() {
  const navigate = useNavigate();
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [teacherFilter, setTeacherFilter] = useState<string>("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const activities = useQuery(api.extracurricular.listAllActivities, {
    includeDeleted,
    onlyMine,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
    teacherId: teacherFilter !== "all" ? teacherFilter as Id<"teachers"> : undefined,
  });

  const teachersWithActivities = useQuery(api.extracurricular.getTeachersWithActivities, {});

  // Delete handling
  const [activityToDelete, setActivityToDelete] = useState<Id<"extracurricularActivities"> | null>(null);
  const [activityToPermanentlyDelete, setActivityToPermanentlyDelete] = useState<Id<"extracurricularActivities"> | null>(null);
  const deleteActivity = useMutation(api.extracurricular.deleteActivity);
  const permanentlyDeleteActivity = useMutation(api.extracurricular.permanentlyDeleteActivity);

  // Check auth
  const isAuthorized = useMemo(() => {
    if (!currentUser) return false;
    const authorizedRoles = ["system_admin", "director", "vice_director", "teacher", "class_teacher"];
    if (authorizedRoles.includes(currentUser.role)) return true;
    if (currentUser.roles?.some((r: string) => authorizedRoles.includes(r))) return true;
    return false;
  }, [currentUser]);

  if (currentUser === undefined || activities === undefined) {
    return (
      <div className="p-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <p className="text-muted-foreground">
              Нямате права за достъп до тази страница.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Export handlers
  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    const text = activities
      .map((a) => {
        let line = `${a.name} | ${a.category || "—"} | ${a.teacherName} | ${a.enrolledCount} записани`;
        if (a.paymentType === "paid" && a.pricePerWeek) {
          line += ` | ${a.pricePerWeek} €/${a.pricePeriod === "monthly" ? "месец" : "седмица"} на дете`;
        }
        return line;
      })
      .join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Копирано в клипборда");
  };

  const handleCSV = () => {
    const headers = ["Заглавие", "Категория", "Учител", "Записани", "Заплащане", "Цена"];
    const rows = activities.map((a) => [
      a.name,
      a.category || "",
      a.teacherName,
      String(a.enrolledCount),
      a.paymentType === "paid" ? "Платено" : "Безплатно",
      a.paymentType === "paid" && a.pricePerWeek ? `${a.pricePerWeek} €/${a.pricePeriod === "monthly" ? "месец" : "седмица"}` : "",
    ]);
    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `extracurricular-activities-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV файлът е изтеглен");
  };

  const handleDeleteActivity = async () => {
    if (!activityToDelete) return;
    try {
      await deleteActivity({ id: activityToDelete });
      toast.success("Дейността е изтрита");
      setActivityToDelete(null);
    } catch {
      toast.error("Грешка при изтриване на дейността");
    }
  };

  const handlePermanentlyDelete = async () => {
    if (!activityToPermanentlyDelete) return;
    try {
      await permanentlyDeleteActivity({ id: activityToPermanentlyDelete });
      toast.success("Дейността е изтрита окончателно");
      setActivityToPermanentlyDelete(null);
    } catch {
      toast.error("Грешка при окончателно изтриване");
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            Извънкласни дейности
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Всички извънкласни дейности
          </p>
        </div>
        <Button onClick={() => navigate("/extracurricular/all-activities/add")}>
          <Plus className="h-4 w-4 mr-2" />
          Добави дейност
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Category filter */}
            <div className="space-y-2">
              <Label>Категория</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Всички категории" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Всички категории</SelectItem>
                  {ACTIVITY_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Teacher filter */}
            <div className="space-y-2">
              <Label>Учител</Label>
              <Select value={teacherFilter} onValueChange={setTeacherFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Всички учители" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Всички учители</SelectItem>
                  {teachersWithActivities?.map((t) => (
                    <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Checkboxes */}
            <div className="space-y-3 pt-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="onlyMine"
                  checked={onlyMine}
                  onCheckedChange={(checked) => setOnlyMine(checked === true)}
                />
                <Label htmlFor="onlyMine" className="cursor-pointer">Само мои</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeDeleted"
                  checked={includeDeleted}
                  onCheckedChange={(checked) => setIncludeDeleted(checked === true)}
                />
                <Label htmlFor="includeDeleted" className="cursor-pointer">Покажи изтрити</Label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-end gap-2">
              <Button variant="outline" size="icon" onClick={handlePrint} title="Принтиране">
                <Printer className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleCopy} title="Копиране">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleCSV} title="Изтегли CSV">
                <FileDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activities Table */}
      {activities.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Няма намерени извънкласни дейности.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Заглавие</TableHead>
                    <TableHead>Категория</TableHead>
                    <TableHead>Учител</TableHead>
                    <TableHead className="hidden md:table-cell">График</TableHead>
                    <TableHead>Записани</TableHead>
                    <TableHead className="hidden sm:table-cell">Заплащане</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map((activity) => (
                    <TableRow
                      key={activity._id}
                      className={activity.isDeleted ? "opacity-50 bg-red-50 dark:bg-red-950/20" : ""}
                    >
                      <TableCell>
                        <button
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                          onClick={() => navigate(`/extracurricular/all-activities/${activity._id}`)}
                        >
                          {activity.name}
                        </button>
                        {activity.isDeleted && (
                          <Badge variant="destructive" className="ml-2 text-xs">Изтрита</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {activity.category ? (
                          <Badge className={getCategoryColor(activity.category)}>
                            <Star className="h-3 w-3 mr-1" />
                            {activity.category}
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{activity.teacherName}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {activity.scheduleDays && activity.scheduleDays.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {activity.scheduleDays.map((day) => (
                              <Badge key={day} variant="secondary" className="text-xs">
                                {DAYS_OF_WEEK.find((d) => d.value === day)?.short || day}
                              </Badge>
                            ))}
                            {activity.scheduleStartTime && (
                              <span className="text-xs text-muted-foreground ml-1">
                                {activity.scheduleStartTime}
                                {activity.scheduleEndTime && `-${activity.scheduleEndTime}`}
                              </span>
                            )}
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-auto p-1">
                              <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                                <Users className="h-3 w-3 mr-1" />
                                {activity.totalParticipants}
                              </Badge>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3" align="start">
                            <div className="space-y-3">
                              <h4 className="font-semibold text-sm">Участници ({activity.totalParticipants})</h4>
                              {activity.participantNames.length > 0 ? (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                  {activity.studentCount > 0 && (
                                    <div>
                                      <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                                        <GraduationCap className="h-3 w-3" />
                                        Ученици ({activity.studentCount})
                                      </p>
                                      <div className="space-y-0.5">
                                        {activity.participantNames
                                          .filter(p => p.type === "student")
                                          .map((p, i) => (
                                            <p key={`student-${i}`} className="text-sm">{p.name}</p>
                                          ))}
                                      </div>
                                    </div>
                                  )}
                                  {activity.parentCount > 0 && (
                                    <div>
                                      <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                                        <UserCircle className="h-3 w-3" />
                                        Родители ({activity.parentCount})
                                      </p>
                                      <div className="space-y-0.5">
                                        {activity.participantNames
                                          .filter(p => p.type === "parent")
                                          .map((p, i) => (
                                            <p key={`parent-${i}`} className="text-sm">{p.name}</p>
                                          ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">Няма участници</p>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {activity.paymentType === "paid" ? (
                          <div className="flex flex-col">
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                              <DollarSign className="h-3 w-3 mr-1" />
                              Платено
                            </Badge>
                            {activity.pricePerWeek && (
                              <span className="text-xs text-muted-foreground mt-1">
                                {activity.pricePerWeek} €/{activity.pricePeriod === "monthly" ? "месец" : "седмица"} на дете
                              </span>
                            )}
                          </div>
                        ) : (
                          <Badge variant="secondary">Безплатно</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!activity.isDeleted ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(`/extracurricular/all-activities/${activity._id}?edit=true`)}
                                title="Редактирай"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setActivityToDelete(activity._id)}
                                title="Изтрий"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setActivityToPermanentlyDelete(activity._id)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Изтрий окончателно
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!activityToDelete} onOpenChange={() => setActivityToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Изтриване на дейност</AlertDialogTitle>
            <AlertDialogDescription>
              Сигурни ли сте, че искате да изтриете тази дейност? Дейността ще бъде маркирана като изтрита и няма да се показва в списъка.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отказ</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteActivity} className="bg-red-600 hover:bg-red-700">
              Изтрий
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Confirmation Dialog */}
      <AlertDialog open={!!activityToPermanentlyDelete} onOpenChange={() => setActivityToPermanentlyDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Окончателно изтриване
            </AlertDialogTitle>
            <AlertDialogDescription>
              Това действие е необратимо! Дейността и всички свързани данни ще бъдат изтрити завинаги.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отказ</AlertDialogCancel>
            <AlertDialogAction onClick={handlePermanentlyDelete} className="bg-red-600 hover:bg-red-700">
              Изтрий окончателно
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================
// DETAIL PAGE
// ============================================

function ActivityDetailPage({ activityId }: { activityId: Id<"extracurricularActivities"> }) {
  const navigate = useNavigate();
  const location = useLocation();
  const activity = useQuery(api.extracurricular.getActivityById, { id: activityId });
  const [isEditing, setIsEditing] = useState(location.search.includes("edit=true"));

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState<string>("");
  const [editPaymentType, setEditPaymentType] = useState<"free" | "paid">("free");
  const [editPricePerWeek, setEditPricePerWeek] = useState("");
  const [editPricePeriod, setEditPricePeriod] = useState<"weekly" | "monthly">("weekly");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editScheduleDays, setEditScheduleDays] = useState<number[]>([]);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editClassIds, setEditClassIds] = useState<Id<"classes">[]>([]);
  const [editStudentIds, setEditStudentIds] = useState<Id<"students">[]>([]);
  const [editParentIds, setEditParentIds] = useState<Id<"users">[]>([]);

  const updateActivity = useMutation(api.extracurricular.updateActivity);

  // Queries for editing classes and students
  const allClasses = useQuery(api.admin.listClasses, isEditing ? {} : "skip");
  const studentsForClasses = useQuery(
    api.extracurricular.getStudentsForActivity,
    isEditing && editClassIds.length > 0 ? { classIds: editClassIds } : "skip"
  );
  const parentsForStudents = useQuery(
    api.extracurricular.getParentsForStudents,
    isEditing && editStudentIds.length > 0 ? { studentIds: editStudentIds } : "skip"
  );
  const activityParentIds = useQuery(
    api.extracurricular.getActivityParentIds,
    isEditing && activity ? { id: activityId } : "skip"
  );

  // Sort classes by grade and name
  const sortedClasses = useMemo(() => {
    if (!allClasses) return [];
    return [...allClasses].sort((a, b) => {
      if (a.grade !== b.grade) return a.grade - b.grade;
      return a.name.localeCompare(b.name, "bg");
    });
  }, [allClasses]);

  // Initialize edit form when activity loads
  useMemo(() => {
    if (activity && isEditing) {
      setEditName(activity.name);
      setEditDescription(activity.description || "");
      setEditCategory(activity.category || "");
      setEditPaymentType(activity.paymentType || "free");
      setEditPricePerWeek(activity.pricePerWeek?.toString() || "");
      setEditPricePeriod(activity.pricePeriod || "weekly");
      setEditStartDate(activity.startDate ? new Date(activity.startDate).toISOString().split("T")[0] : "");
      setEditEndDate(activity.endDate ? new Date(activity.endDate).toISOString().split("T")[0] : "");
      setEditScheduleDays(activity.scheduleDays || []);
      setEditStartTime(activity.scheduleStartTime || "");
      setEditEndTime(activity.scheduleEndTime || "");
      // Set student IDs from enrolled students
      const studentIds = activity.enrolledStudents
        ?.filter((s): s is NonNullable<typeof s> => s !== null)
        .map(s => s._id) || [];
      setEditStudentIds(studentIds);
    }
  }, [activity, isEditing]);

  // Fetch class IDs when activity loads for editing
  const activityClassIds = useQuery(
    api.extracurricular.getActivityClassIds,
    isEditing && activity ? { id: activityId } : "skip"
  );

  // Set class IDs when they load
  useMemo(() => {
    if (activityClassIds && isEditing) {
      setEditClassIds(activityClassIds);
    }
  }, [activityClassIds, isEditing]);

  // Set parent IDs when they load
  useMemo(() => {
    if (activityParentIds && isEditing) {
      setEditParentIds(activityParentIds);
    }
  }, [activityParentIds, isEditing]);

  if (activity === undefined) {
    return (
      <div className="p-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const toggleEditClass = (classId: Id<"classes">) => {
    setEditClassIds((prev) => {
      const newClassIds = prev.includes(classId) 
        ? prev.filter((id) => id !== classId) 
        : [...prev, classId];
      
      // Remove students from classes that are no longer selected
      if (!newClassIds.includes(classId)) {
        // We need to filter out students from this class
        // This will be handled when studentsForClasses updates
      }
      return newClassIds;
    });
  };

  const toggleEditStudent = (studentId: Id<"students">) => {
    setEditStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const toggleAllStudentsInClass = (classStudents: Array<{ _id: Id<"students"> }>, select: boolean) => {
    const studentIds = classStudents.map((s) => s._id);
    if (select) {
      setEditStudentIds((prev) => [...new Set([...prev, ...studentIds])]);
    } else {
      setEditStudentIds((prev) => prev.filter((id) => !studentIds.includes(id)));
    }
  };

  const toggleEditParent = (parentId: Id<"users">) => {
    setEditParentIds((prev) =>
      prev.includes(parentId) ? prev.filter((id) => id !== parentId) : [...prev, parentId]
    );
  };

  const toggleAllParentsForStudentInEdit = (parents: Array<{ _id: Id<"users"> }>, select: boolean) => {
    const parentIds = parents.map((p) => p._id);
    if (select) {
      setEditParentIds((prev) => [...new Set([...prev, ...parentIds])]);
    } else {
      setEditParentIds((prev) => prev.filter((id) => !parentIds.includes(id)));
    }
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      toast.error("Моля, въведете заглавие");
      return;
    }

    try {
      await updateActivity({
        id: activityId,
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        category: editCategory || undefined,
        paymentType: editPaymentType,
        pricePerWeek: editPaymentType === "paid" && editPricePerWeek ? Number(editPricePerWeek) : undefined,
        pricePeriod: editPaymentType === "paid" ? editPricePeriod : undefined,
        startDate: editStartDate ? new Date(editStartDate).getTime() : undefined,
        endDate: editEndDate ? new Date(editEndDate).getTime() : undefined,
        scheduleDays: editScheduleDays.length > 0 ? editScheduleDays : undefined,
        scheduleStartTime: editStartTime || undefined,
        scheduleEndTime: editEndTime || undefined,
        classIds: editClassIds.length > 0 ? editClassIds : undefined,
        studentIds: editStudentIds,
        parentIds: editParentIds,
      });
      toast.success("Дейността е обновена");
      setIsEditing(false);
      navigate("/extracurricular/all-activities", { replace: true });
    } catch {
      toast.error("Грешка при обновяване на дейността");
    }
  };

  const toggleScheduleDay = (day: number) => {
    setEditScheduleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  if (isEditing) {
    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/extracurricular/all-activities")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Редактиране на дейност</h1>
            <p className="text-sm text-muted-foreground">{activity.name}</p>
          </div>
        </div>

        {/* Edit Form */}
        <Card>
          <CardContent className="p-6 space-y-6">
            {/* Basic info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editName">Заглавие *</Label>
                <Input
                  id="editName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Име на дейността"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editCategory">Категория</Label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger id="editCategory">
                    <SelectValue placeholder="Изберете категория" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editDescription">Описание</Label>
              <Textarea
                id="editDescription"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Описание на дейността"
                rows={3}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editStartDate">Начална дата</Label>
                <Input
                  id="editStartDate"
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editEndDate">Крайна дата</Label>
                <Input
                  id="editEndDate"
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Schedule */}
            <div className="space-y-2">
              <Label>Дни от седмицата</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <Button
                    key={day.value}
                    type="button"
                    variant={editScheduleDays.includes(day.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleScheduleDay(day.value)}
                  >
                    {day.short}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editStartTime">Начален час</Label>
                <Input
                  id="editStartTime"
                  type="time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editEndTime">Краен час</Label>
                <Input
                  id="editEndTime"
                  type="time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                />
              </div>
            </div>

            {/* Payment */}
            <div className="space-y-4">
              <Label>Заплащане</Label>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="editFree"
                    checked={editPaymentType === "free"}
                    onCheckedChange={() => setEditPaymentType("free")}
                  />
                  <Label htmlFor="editFree" className="cursor-pointer">Безплатно</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="editPaid"
                    checked={editPaymentType === "paid"}
                    onCheckedChange={() => setEditPaymentType("paid")}
                  />
                  <Label htmlFor="editPaid" className="cursor-pointer">Платено</Label>
                </div>
              </div>

              {editPaymentType === "paid" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-amber-500">
                  <div className="space-y-2">
                    <Label htmlFor="editPricePeriod">Период на плащане</Label>
                    <Select value={editPricePeriod} onValueChange={(v) => setEditPricePeriod(v as "weekly" | "monthly")}>
                      <SelectTrigger id="editPricePeriod">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Седмично</SelectItem>
                        <SelectItem value="monthly">Месечно</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editPrice">Цена на дете (€)</Label>
                    <Input
                      id="editPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editPricePerWeek}
                      onChange={(e) => setEditPricePerWeek(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Class selection */}
            <div className="space-y-2">
              <Label>Класове</Label>
              <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {sortedClasses.map((cls) => (
                    <div key={cls._id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-class-${cls._id}`}
                        checked={editClassIds.includes(cls._id)}
                        onCheckedChange={() => toggleEditClass(cls._id)}
                      />
                      <Label htmlFor={`edit-class-${cls._id}`} className="cursor-pointer text-sm">
                        {cls.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              {editClassIds.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Избрани: {editClassIds.length} клас(а)
                </p>
              )}
            </div>

            {/* Student selection */}
            {editClassIds.length > 0 && (
              <div className="space-y-4">
                <Label>Ученици</Label>
                {studentsForClasses === undefined ? (
                  <Skeleton className="h-32 w-full" />
                ) : studentsForClasses.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Няма ученици в избраните класове.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {studentsForClasses.map((classData) => (
                      <div key={classData.classId} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium flex items-center gap-2">
                            <GraduationCap className="h-4 w-4" />
                            {classData.className}
                            <Badge variant="secondary" className="text-xs">
                              {classData.students.filter(s => editStudentIds.includes(s._id)).length} / {classData.students.length}
                            </Badge>
                          </h4>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => toggleAllStudentsInClass(classData.students, true)}
                            >
                              Избери всички
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => toggleAllStudentsInClass(classData.students, false)}
                            >
                              Изчисти
                            </Button>
                          </div>
                        </div>
                        <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {classData.students.map((student) => (
                              <div key={student._id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`edit-student-${student._id}`}
                                  checked={editStudentIds.includes(student._id)}
                                  onCheckedChange={() => toggleEditStudent(student._id)}
                                />
                                <Label htmlFor={`edit-student-${student._id}`} className="cursor-pointer text-sm">
                                  {student.studentNumber && `${student.studentNumber}. `}
                                  {student.name}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Общо избрани: <strong>{editStudentIds.length}</strong> ученици
                </p>
              </div>
            )}

            {/* Parent selection - show after students are selected */}
            {editStudentIds.length > 0 && parentsForStudents && parentsForStudents.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <UserCircle className="h-5 w-5" />
                    Родители
                    <Badge variant="secondary">{editParentIds.length} избрани</Badge>
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Изберете родители, които да получават известия за тази дейност.
                </p>
                <div className="space-y-4">
                  {parentsForStudents.map((data) => (
                    <div key={data.studentId} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {data.studentName}
                        </h4>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleAllParentsForStudentInEdit(data.parents, true)}
                          >
                            Избери всички
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleAllParentsForStudentInEdit(data.parents, false)}
                          >
                            Изчисти
                          </Button>
                        </div>
                      </div>
                      <div className="border rounded-lg p-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {data.parents.map((parent) => (
                            <div key={parent._id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`edit-parent-${parent._id}`}
                                checked={editParentIds.includes(parent._id)}
                                onCheckedChange={() => toggleEditParent(parent._id)}
                              />
                              <Label htmlFor={`edit-parent-${parent._id}`} className="cursor-pointer text-sm">
                                {parent.name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button onClick={handleSave}>Запази промените</Button>
              <Button variant="outline" onClick={() => navigate("/extracurricular/all-activities")}>
                Отказ
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/extracurricular/all-activities")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            {activity.name}
            {activity.category && (
              <Badge className={getCategoryColor(activity.category)}>
                <Star className="h-3 w-3 mr-1" />
                {activity.category}
              </Badge>
            )}
          </h1>
        </div>
        <Button variant="outline" onClick={() => setIsEditing(true)}>
          <Pencil className="h-4 w-4 mr-2" />
          Редактирай
        </Button>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Основна информация
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-[140px_1fr] gap-y-3">
              <span className="font-medium text-muted-foreground">Учител:</span>
              <span className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                {activity.teacherName}
              </span>

              <span className="font-medium text-muted-foreground">Описание:</span>
              <span className="whitespace-pre-wrap">{activity.description || "—"}</span>

              <span className="font-medium text-muted-foreground">Период:</span>
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {activity.startDate && activity.endDate
                  ? `${new Date(activity.startDate).toLocaleDateString("bg-BG")} - ${new Date(activity.endDate).toLocaleDateString("bg-BG")}`
                  : "—"}
              </span>

              <span className="font-medium text-muted-foreground">График:</span>
              <span>
                {activity.scheduleDays && activity.scheduleDays.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1">
                    {activity.scheduleDays.map((day) => (
                      <Badge key={day} variant="secondary">
                        {DAYS_OF_WEEK.find((d) => d.value === day)?.label || day}
                      </Badge>
                    ))}
                    {activity.scheduleStartTime && (
                      <span className="ml-2 flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {activity.scheduleStartTime}
                        {activity.scheduleEndTime && ` - ${activity.scheduleEndTime}`}
                      </span>
                    )}
                  </div>
                ) : "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Участници и плащане
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-[140px_1fr] gap-y-3">
              <span className="font-medium text-muted-foreground">Заплащане:</span>
              <span>
                {activity.paymentType === "paid" ? (
                  <div>
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                      <DollarSign className="h-3 w-3 mr-1" />
                      Платено
                    </Badge>
                    {activity.pricePerWeek && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {activity.pricePerWeek} €/{activity.pricePeriod === "monthly" ? "месец" : "седмица"} на дете
                      </p>
                    )}
                  </div>
                ) : (
                  <Badge variant="secondary">Безплатно</Badge>
                )}
              </span>

              <span className="font-medium text-muted-foreground">Участници:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-auto p-0 justify-start">
                    <span className="flex items-center gap-2 hover:underline cursor-pointer">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-primary">{activity.totalParticipants}</span>
                      <span className="text-muted-foreground">
                        ({activity.studentCount} уч. + {activity.parentCount} род.)
                      </span>
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3" align="start">
                  <div className="space-y-3">
                    <h4 className="font-semibold">Участници ({activity.totalParticipants})</h4>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {activity.enrolledStudents && activity.enrolledStudents.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <GraduationCap className="h-3 w-3" />
                            Ученици ({activity.studentCount})
                          </p>
                          <div className="space-y-1">
                            {activity.enrolledStudents.filter((s): s is NonNullable<typeof s> => s !== null).map((student) => (
                              <p key={student._id} className="text-sm">{student.name}</p>
                            ))}
                          </div>
                        </div>
                      )}
                      {activity.enrolledParents && activity.enrolledParents.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <UserCircle className="h-3 w-3" />
                            Родители ({activity.parentCount})
                          </p>
                          <div className="space-y-1">
                            {activity.enrolledParents.filter((p): p is NonNullable<typeof p> => p !== null).map((parent) => (
                              <p key={parent._id} className="text-sm">{parent.name}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <span className="font-medium text-muted-foreground">Класове:</span>
              <span className="flex flex-wrap gap-1">
                {activity.classNames.length > 0
                  ? activity.classNames.map((name, i) => (
                      <Badge key={i} variant="secondary">
                        <GraduationCap className="h-3 w-3 mr-1" />
                        {name}
                      </Badge>
                    ))
                  : "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enrolled Participants */}
      {((activity.enrolledStudents && activity.enrolledStudents.length > 0) || 
        (activity.enrolledParents && activity.enrolledParents.length > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Записани участници ({activity.totalParticipants})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Students */}
            {activity.enrolledStudents && activity.enrolledStudents.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  Ученици ({activity.studentCount})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {activity.enrolledStudents.filter((s): s is NonNullable<typeof s> => s !== null).map((student) => (
                    <div
                      key={student._id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{student.name}</span>
                      <span className="text-xs text-muted-foreground">({student.className})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parents */}
            {activity.enrolledParents && activity.enrolledParents.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <UserCircle className="h-4 w-4 text-muted-foreground" />
                  Родители ({activity.parentCount})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {activity.enrolledParents.filter((p): p is NonNullable<typeof p> => p !== null).map((parent) => (
                    <div
                      key={parent._id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30"
                    >
                      <UserCircle className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">{parent.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Audit info */}
      {(activity.createdByInfo || activity.lastEditedByInfo) && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            <div className="flex flex-wrap gap-6">
              {activity.createdByInfo && (
                <div>
                  <span className="font-medium">Създадена:</span>{" "}
                  {activity.createdByInfo.name} на{" "}
                  {new Date(activity.createdByInfo.at).toLocaleString("bg-BG")}
                </div>
              )}
              {activity.lastEditedByInfo && (
                <div>
                  <span className="font-medium">Последна редакция:</span>{" "}
                  {activity.lastEditedByInfo.name} на{" "}
                  {new Date(activity.lastEditedByInfo.at).toLocaleString("bg-BG")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================
// ADD PAGE
// ============================================

function AddActivityPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("");
  const [teacherId, setTeacherId] = useState<string>("");
  const [paymentType, setPaymentType] = useState<"free" | "paid">("free");
  const [pricePerWeek, setPricePerWeek] = useState("");
  const [pricePeriod, setPricePeriod] = useState<"weekly" | "monthly">("weekly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<Id<"classes">[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Id<"students">[]>([]);
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [scheduleStartTime, setScheduleStartTime] = useState("");
  const [scheduleEndTime, setScheduleEndTime] = useState("");
  const [selectedParentIds, setSelectedParentIds] = useState<Id<"users">[]>([]);

  // Queries
  const allTeachers = useQuery(api.extracurricular.getAllTeachers, {});
  const allClasses = useQuery(api.admin.listClasses, {});
  const studentsForClasses = useQuery(
    api.extracurricular.getStudentsForActivity,
    selectedClassIds.length > 0 ? { classIds: selectedClassIds } : "skip"
  );
  const parentsForStudents = useQuery(
    api.extracurricular.getParentsForStudents,
    selectedStudentIds.length > 0 ? { studentIds: selectedStudentIds } : "skip"
  );

  const createActivity = useMutation(api.extracurricular.createActivity);

  const toggleClass = (classId: Id<"classes">) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
    // Reset student selection when classes change
    setSelectedStudentIds([]);
  };

  const toggleStudent = (studentId: Id<"students">) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const toggleAllStudentsInClass = (classStudents: Array<{ _id: Id<"students"> }>, select: boolean) => {
    const studentIds = classStudents.map((s) => s._id);
    if (select) {
      setSelectedStudentIds((prev) => [...new Set([...prev, ...studentIds])]);
    } else {
      setSelectedStudentIds((prev) => prev.filter((id) => !studentIds.includes(id)));
    }
  };

  const toggleScheduleDay = (day: number) => {
    setScheduleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  const toggleParent = (parentId: Id<"users">) => {
    setSelectedParentIds((prev) =>
      prev.includes(parentId) ? prev.filter((id) => id !== parentId) : [...prev, parentId]
    );
  };

  const toggleAllParentsForStudent = (parents: Array<{ _id: Id<"users"> }>, select: boolean) => {
    const parentIds = parents.map((p) => p._id);
    if (select) {
      setSelectedParentIds((prev) => [...new Set([...prev, ...parentIds])]);
    } else {
      setSelectedParentIds((prev) => prev.filter((id) => !parentIds.includes(id)));
    }
  };

  const handleNext = () => {
    if (!name.trim()) {
      toast.error("Моля, въведете заглавие");
      return;
    }
    if (!category) {
      toast.error("Моля, изберете категория");
      return;
    }
    if (!teacherId) {
      toast.error("Моля, изберете учител");
      return;
    }
    if (paymentType === "paid" && !pricePeriod) {
      toast.error("Моля, изберете период на плащане");
      return;
    }
    if (selectedClassIds.length === 0) {
      toast.error("Моля, изберете поне един клас");
      return;
    }
    setStep(2);
  };

  const handleCreate = async () => {
    if (selectedStudentIds.length === 0) {
      toast.error("Моля, изберете поне един ученик");
      return;
    }

    try {
      await createActivity({
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        teacherId: teacherId as Id<"teachers">,
        paymentType,
        pricePerWeek: paymentType === "paid" && pricePerWeek ? Number(pricePerWeek) : undefined,
        pricePeriod: paymentType === "paid" ? pricePeriod : undefined,
        startDate: startDate ? new Date(startDate).getTime() : undefined,
        endDate: endDate ? new Date(endDate).getTime() : undefined,
        classIds: selectedClassIds,
        studentIds: selectedStudentIds,
        parentIds: selectedParentIds.length > 0 ? selectedParentIds : undefined,
        scheduleDays: scheduleDays.length > 0 ? scheduleDays : undefined,
        scheduleStartTime: scheduleStartTime || undefined,
        scheduleEndTime: scheduleEndTime || undefined,
        academicYear: getCurrentAcademicYear(),
      });
      toast.success("Дейността е създадена успешно");
      navigate("/extracurricular/all-activities");
    } catch {
      toast.error("Грешка при създаване на дейността");
    }
  };

  // Sort classes by grade and name
  const sortedClasses = useMemo(() => {
    if (!allClasses) return [];
    return [...allClasses].sort((a, b) => {
      if (a.grade !== b.grade) return a.grade - b.grade;
      return a.name.localeCompare(b.name, "bg");
    });
  }, [allClasses]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => step === 1 ? navigate("/extracurricular/all-activities") : setStep(1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Добавяне на извънкласна дейност</h1>
          <p className="text-sm text-muted-foreground">
            Стъпка {step} от 2: {step === 1 ? "Основна информация" : "Избор на ученици"}
          </p>
        </div>
      </div>

      {step === 1 ? (
        <Card>
          <CardContent className="p-6 space-y-6">
            {/* Basic info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Заглавие *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Име на дейността"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Категория *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Изберете категория" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Описание на дейността"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="teacher">Учител *</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger id="teacher">
                  <SelectValue placeholder="Изберете учител" />
                </SelectTrigger>
                <SelectContent>
                  {allTeachers?.map((t) => (
                    <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Начална дата</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Крайна дата</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Schedule */}
            <div className="space-y-2">
              <Label>Дни от седмицата</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <Button
                    key={day.value}
                    type="button"
                    variant={scheduleDays.includes(day.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleScheduleDay(day.value)}
                  >
                    {day.short}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scheduleStartTime">Начален час</Label>
                <Input
                  id="scheduleStartTime"
                  type="time"
                  value={scheduleStartTime}
                  onChange={(e) => setScheduleStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduleEndTime">Краен час</Label>
                <Input
                  id="scheduleEndTime"
                  type="time"
                  value={scheduleEndTime}
                  onChange={(e) => setScheduleEndTime(e.target.value)}
                />
              </div>
            </div>

            {/* Payment */}
            <div className="space-y-4">
              <Label>Заплащане</Label>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="free"
                    checked={paymentType === "free"}
                    onCheckedChange={() => setPaymentType("free")}
                  />
                  <Label htmlFor="free" className="cursor-pointer">Безплатно</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="paid"
                    checked={paymentType === "paid"}
                    onCheckedChange={() => setPaymentType("paid")}
                  />
                  <Label htmlFor="paid" className="cursor-pointer">Платено</Label>
                </div>
              </div>

              {paymentType === "paid" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-amber-500">
                  <div className="space-y-2">
                    <Label htmlFor="pricePeriod">Период на плащане *</Label>
                    <Select value={pricePeriod} onValueChange={(v) => setPricePeriod(v as "weekly" | "monthly")}>
                      <SelectTrigger id="pricePeriod">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Седмично</SelectItem>
                        <SelectItem value="monthly">Месечно</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Цена на дете (€)</Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={pricePerWeek}
                      onChange={(e) => setPricePerWeek(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Class selection */}
            <div className="space-y-2">
              <Label>Класове *</Label>
              <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {sortedClasses.map((cls) => (
                    <div key={cls._id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`class-${cls._id}`}
                        checked={selectedClassIds.includes(cls._id)}
                        onCheckedChange={() => toggleClass(cls._id)}
                      />
                      <Label htmlFor={`class-${cls._id}`} className="cursor-pointer text-sm">
                        {cls.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              {selectedClassIds.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Избрани: {selectedClassIds.length} клас(а)
                </p>
              )}
            </div>

            {/* Next button */}
            <div className="flex justify-end pt-4">
              <Button onClick={handleNext}>
                Напред: Избор на ученици
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 space-y-6">
            {/* Student selection */}
            {studentsForClasses === undefined ? (
              <Skeleton className="h-64 w-full" />
            ) : studentsForClasses.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Няма ученици в избраните класове.
              </p>
            ) : (
              <div className="space-y-6">
                {studentsForClasses.map((classData) => (
                  <div key={classData.classId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2">
                        <GraduationCap className="h-4 w-4" />
                        {classData.className}
                        <Badge variant="secondary">{classData.students.length} ученици</Badge>
                      </h3>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleAllStudentsInClass(classData.students, true)}
                        >
                          Избери всички
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleAllStudentsInClass(classData.students, false)}
                        >
                          Изчисти
                        </Button>
                      </div>
                    </div>
                    <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {classData.students.map((student) => (
                          <div key={student._id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`student-${student._id}`}
                              checked={selectedStudentIds.includes(student._id)}
                              onCheckedChange={() => toggleStudent(student._id)}
                            />
                            <Label htmlFor={`student-${student._id}`} className="cursor-pointer text-sm">
                              {student.studentNumber && `${student.studentNumber}. `}
                              {student.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Parent selection - show after students are selected */}
            {selectedStudentIds.length > 0 && parentsForStudents && parentsForStudents.length > 0 && (
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <UserCircle className="h-5 w-5" />
                    Родители
                    <Badge variant="secondary">{selectedParentIds.length} избрани</Badge>
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Изберете родители, които да получават известия за тази дейност.
                </p>
                <div className="space-y-4">
                  {parentsForStudents.map((data) => (
                    <div key={data.studentId} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {data.studentName}
                        </h4>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleAllParentsForStudent(data.parents, true)}
                          >
                            Избери всички
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleAllParentsForStudent(data.parents, false)}
                          >
                            Изчисти
                          </Button>
                        </div>
                      </div>
                      <div className="border rounded-lg p-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {data.parents.map((parent) => (
                            <div key={parent._id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`parent-${parent._id}`}
                                checked={selectedParentIds.includes(parent._id)}
                                onCheckedChange={() => toggleParent(parent._id)}
                              />
                              <Label htmlFor={`parent-${parent._id}`} className="cursor-pointer text-sm">
                                {parent.name}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary and create button */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Избрани: <strong>{selectedStudentIds.length}</strong> ученици</p>
                {selectedParentIds.length > 0 && (
                  <p>Родители: <strong>{selectedParentIds.length}</strong></p>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Назад
                </Button>
                <Button onClick={handleCreate} disabled={selectedStudentIds.length === 0}>
                  Създай дейност ({selectedStudentIds.length} ученици)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT WITH ROUTING
// ============================================

function AllActivitiesInner() {
  const { id } = useParams();
  const location = useLocation();

  // Check if we're on the add page
  if (location.pathname.endsWith("/add")) {
    return <AddActivityPage />;
  }

  // Check if we have an activity ID
  if (id) {
    return <ActivityDetailPage activityId={id as Id<"extracurricularActivities">} />;
  }

  // Default: list page
  return <ActivitiesListPage />;
}

export default function AllActivities() {
  return (
    <Layout>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-4">
          <p className="text-muted-foreground">
            Моля, влезте в акаунта си, за да видите извънкласните дейности.
          </p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="p-6">
          <Skeleton className="h-96 w-full" />
        </div>
      </AuthLoading>
      <Authenticated>
        <AllActivitiesInner />
      </Authenticated>
    </Layout>
  );
}
