import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useState, useEffect } from "react";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import { DiaryAccessGuard } from "@/components/DiaryAccessGuard.tsx";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Input } from "@/components/ui/input.tsx";
import { 
  ArrowLeftIcon,
  Plus,
  Trash2Icon,
  PencilIcon,
  ClipboardListIcon,
  CalendarIcon,
  CheckIcon,
  PlusIcon,
  MinusIcon,
  LockIcon,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { Calendar } from "@/components/ui/calendar.tsx";
import { toast } from "sonner";
import { UserNameLink } from "@/components/ui/user-name-link.tsx";
import { format } from "date-fns";
import { bg } from "date-fns/locale";

// Types for ВЧК (Втори час на класа)
const VCK_TYPES = [
  { value: "student_consultation", label: "Консултиране на ученици" },
  { value: "parent_consultation", label: "Консултиране на родители" },
  { value: "school_documentation", label: "Работа с училищна документация" },
] as const;

type VckType = "student_consultation" | "parent_consultation" | "school_documentation";

// Row data type for multi-row form
type FormRow = {
  id: string;
  type: VckType | "";
  startDate: Date | undefined;
  endDate: Date | undefined;
  roomId: string;
  teacherId: string;
  description: string;
};

function generateRowId() {
  return Math.random().toString(36).substring(2, 11);
}

function createEmptyRow(): FormRow {
  return {
    id: generateRowId(),
    type: "",
    startDate: undefined,
    endDate: undefined,
    roomId: "",
    teacherId: "",
    description: "",
  };
}

function InternalCommissionInner() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  
  // Form state for multi-row
  const [showAddForm, setShowAddForm] = useState(false);
  const [formRows, setFormRows] = useState<FormRow[]>([createEmptyRow()]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const classData = useQuery(
    api.admin.getClassById,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  const currentUser = useQuery(api.users.getCurrentUser, {});
  const platformSettings = useQuery(api.platformSettings.getAllSettings, {});
  
  const records = useQuery(
    api.internalCommission.getByClass,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  const editRecord = useQuery(
    api.internalCommission.getById,
    editId ? { id: editId as Id<"internalCommission"> } : "skip"
  );

  // Get rooms and teachers
  const rooms = useQuery(
    api.internalCommission.getRoomsBySchool,
    classData?.schoolId ? { schoolId: classData.schoolId as Id<"schools"> } : "skip"
  );

  const teachers = useQuery(
    api.internalCommission.getTeachersBySchool,
    classData?.schoolId ? { schoolId: classData.schoolId as Id<"schools"> } : "skip"
  );
  
  const createRecord = useMutation(api.internalCommission.create);
  const bulkCreateRecord = useMutation(api.internalCommission.bulkCreate);
  const updateRecord = useMutation(api.internalCommission.update);
  const deleteRecord = useMutation(api.internalCommission.remove);
  
  // Check if current user is a student or PURE parent (not staff)
  const isCurrentUserStudent = currentUser?.roles?.includes("student");
  const isCurrentUserParent = currentUser?.roles?.includes("parent") && 
    !currentUser?.roles?.includes("director") && 
    !currentUser?.roles?.includes("vice_director") && 
    !currentUser?.roles?.includes("system_admin") &&
    !currentUser?.roles?.includes("teacher") &&
    !currentUser?.roles?.includes("class_teacher") &&
    !currentUser?.roles?.includes("secretary");
  
  // Check if current user is the class teacher of this class
  const isClassTeacher = classData?.classTeacherId && currentUser?._id === classData.classTeacherId;
  
  // Check if current user is admin (can see class details link)
  const isAdmin = currentUser?.roles?.includes("director") || 
                  currentUser?.roles?.includes("vice_director") ||
                  currentUser?.roles?.includes("system_admin");
  
  // Only class teacher and admins can edit ВЧК
  const canEdit = !isCurrentUserStudent && !isCurrentUserParent && (isClassTeacher || isAdmin);

  // Handle edit mode from URL
  useEffect(() => {
    if (editId && editRecord) {
      setShowAddForm(true);
      setIsEditing(true);
      setEditingId(editId);
      setFormRows([{
        id: generateRowId(),
        type: editRecord.type,
        startDate: new Date(editRecord.startDate),
        endDate: new Date(editRecord.endDate),
        roomId: editRecord.roomId || "",
        teacherId: editRecord.teacherId,
        description: editRecord.description || "",
      }]);
    }
  }, [editId, editRecord]);

  const stats = [
    { label: "Оц.", link: `/bg/diary/class/${classId}/grades` },
    { label: "Отс.", link: `/bg/diary/class/${classId}/absences` },
    { label: "Отз.", link: `/bg/diary/class/${classId}/reviews` },
    { label: "Раз.", link: `/bg/diary/class/${classId}/schedule` },
    { label: "Тем.", link: `/bg/diary/class/${classId}/topics` },
    { label: "Кон.", link: `/bg/diary/class/${classId}/tests` },
    { label: "Дом.", link: `/bg/diary/class/${classId}/homework` },
    { label: "ВЧК", link: `/bg/diary/class/${classId}/internal-commission` },
    { label: "Род.", link: `/bg/diary/class/${classId}/parent-meetings` },
    { label: "Поп.", link: `/bg/diary/class/${classId}/remedial-exams` },
    { label: "Под.", link: `/bg/diary/class/${classId}/student-support` },
    { label: "Сан.", link: `/bg/diary/class/${classId}/sanctions` },
    { label: "Год.", link: `/bg/diary/class/${classId}/annual-results` },
    { label: "Уч.", link: `/bg/diary/class/${classId}/students` },
  ];

  const handleDelete = async (recordId: string) => {
    if (!confirm("Сигурни ли сте, че искате да изтриете този запис?")) {
      return;
    }

    try {
      await deleteRecord({ id: recordId as Id<"internalCommission"> });
      toast.success("Записът е изтрит успешно");
    } catch (error) {
      toast.error("Грешка при изтриване");
      console.error(error);
    }
  };

  const handleAddRow = () => {
    setFormRows([...formRows, createEmptyRow()]);
  };

  const handleRemoveRow = (rowId: string) => {
    if (formRows.length > 1) {
      setFormRows(formRows.filter((row) => row.id !== rowId));
    }
  };

  const updateRow = (rowId: string, field: keyof FormRow, value: FormRow[keyof FormRow]) => {
    setFormRows(formRows.map((row) => 
      row.id === rowId ? { ...row, [field]: value } : row
    ));
  };

  const resetForm = () => {
    setFormRows([createEmptyRow()]);
    setIsEditing(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    // Validate rows
    const validRows = formRows.filter(row => 
      row.type && row.startDate && row.endDate && row.teacherId
    );
    
    if (validRows.length === 0) {
      toast.error("Моля, попълнете поне един валиден ред (тип, начало, край, учител)");
      return;
    }

    try {
      if (isEditing && editingId && validRows.length === 1) {
        const row = validRows[0];
        await updateRecord({
          id: editingId as Id<"internalCommission">,
          type: row.type as VckType,
          startDate: row.startDate!.getTime(),
          endDate: row.endDate!.getTime(),
          roomId: row.roomId ? row.roomId as Id<"rooms"> : undefined,
          teacherId: row.teacherId as Id<"users">,
          description: row.description || undefined,
        });
        toast.success("Записът е обновен успешно");
        navigate(`/bg/diary/class/${classId}/internal-commission`);
      } else {
        // Bulk create
        const recordsToCreate = validRows.map(row => ({
          type: row.type as VckType,
          startDate: row.startDate!.getTime(),
          endDate: row.endDate!.getTime(),
          roomId: row.roomId ? row.roomId as Id<"rooms"> : undefined,
          teacherId: row.teacherId as Id<"users">,
          description: row.description || undefined,
        }));

        await bulkCreateRecord({
          classId: classId as Id<"classes">,
          records: recordsToCreate,
        });
        toast.success(`${validRows.length > 1 ? "Записите са добавени" : "Записът е добавен"} успешно`);
      }

      setShowAddForm(false);
      resetForm();
    } catch (error) {
      toast.error("Грешка при запис");
      console.error(error);
    }
  };

  if (!classData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Check if showSecondClassHour is disabled
  const showSecondClassHour = platformSettings?.showSecondClassHour ?? true;
  if (!showSecondClassHour) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <div className="border-b bg-background">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-4">
              <Link to={`/bg/diary/class/${classId}`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeftIcon className="h-4 w-4 mr-2" />
                  Назад
                </Button>
              </Link>
              <h1 className="text-xl font-semibold">
                {classData?.grade}{classData?.letter} - ВЧК
              </h1>
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center space-y-4">
            <LockIcon className="h-16 w-16 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">Модулът е изключен</h2>
            <p className="text-muted-foreground max-w-md">
              Модулът "Втори час на класа" (ВЧК) е изключен от настройките на училището.
            </p>
            <Link to={`/bg/diary/class/${classId}`}>
              <Button variant="outline">
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Обратно към класа
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const classTeacher = classData.classTeacher;

  // Full-screen add/edit form with table layout - matching screenshot exactly
  if (showAddForm) {
    return (
      <div className="flex h-screen flex-col bg-background">
        {/* Header */}
        <div className="border-b bg-background">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-4">
              <ClipboardListIcon className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-lg font-semibold">
                Добавяне на ВЧК часове
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddForm(false);
                  resetForm();
                  if (editId) {
                    navigate(`/bg/diary/class/${classId}/internal-commission`);
                  }
                }}
              >
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Назад
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                className="bg-emerald-500 hover:bg-emerald-600"
              >
                <CheckIcon className="h-4 w-4 mr-2" />
                Запази
              </Button>
            </div>
          </div>
        </div>

        {/* Form Content - Table Layout matching screenshot */}
        <div className="flex-1 overflow-x-auto p-6">
          <div className="min-w-[900px]">
            {/* Table Header */}
            <div className="grid grid-cols-[180px_140px_140px_100px_180px_1fr_80px] gap-2 mb-2 px-2">
              <div className="text-sm font-medium text-center">Тип</div>
              <div className="text-sm font-medium text-center">Начало</div>
              <div className="text-sm font-medium text-center">Край</div>
              <div className="text-sm font-medium text-center">Стая</div>
              <div className="text-sm font-medium text-center">Учител</div>
              <div className="text-sm font-medium text-center">Описание</div>
              <div></div>
            </div>

            {/* Form Rows */}
            {formRows.map((row, index) => (
              <div key={row.id} className="grid grid-cols-[180px_140px_140px_100px_180px_1fr_80px] gap-2 mb-2 items-center">
                {/* Тип */}
                <Select
                  value={row.type}
                  onValueChange={(value) => updateRow(row.id, "type", value)}
                >
                  <SelectTrigger className="h-9 border-primary/50">
                    <SelectValue placeholder="Изберете (тип)" />
                  </SelectTrigger>
                  <SelectContent>
                    {VCK_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Начало */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-9 justify-start text-left font-normal border-primary/50",
                        !row.startDate && "text-muted-foreground"
                      )}
                    >
                      {row.startDate ? format(row.startDate, "dd.MM.yyyy") : "Дата"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={row.startDate}
                      onSelect={(date) => {
                        updateRow(row.id, "startDate", date);
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                {/* Край */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-9 justify-start text-left font-normal border-primary/50",
                        !row.endDate && "text-muted-foreground"
                      )}
                    >
                      {row.endDate ? format(row.endDate, "dd.MM.yyyy") : "Дата"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={row.endDate}
                      onSelect={(date) => {
                        updateRow(row.id, "endDate", date);
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                {/* Стая */}
                <Select
                  value={row.roomId}
                  onValueChange={(value) => updateRow(row.id, "roomId", value)}
                >
                  <SelectTrigger className="h-9 border-primary/50">
                    <SelectValue placeholder="Избе..." />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms?.map((room) => (
                      <SelectItem key={room._id} value={room._id}>
                        {room.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Учител */}
                <Select
                  value={row.teacherId}
                  onValueChange={(value) => updateRow(row.id, "teacherId", value)}
                >
                  <SelectTrigger className="h-9 border-primary/50">
                    <SelectValue placeholder="Изберете учител" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers?.map((teacher) => (
                      <SelectItem key={teacher._id} value={teacher._id}>
                        {teacher.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Описание */}
                <Input
                  value={row.description}
                  onChange={(e) => updateRow(row.id, "description", e.target.value)}
                  placeholder="Описание"
                  className="h-9 border-primary/50"
                />
                
                {/* +/- бутони */}
                <div className="flex items-center justify-center gap-1">
                  {!isEditing && formRows.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 bg-red-500 hover:bg-red-600 text-white rounded"
                      onClick={() => handleRemoveRow(row.id)}
                    >
                      <MinusIcon className="h-4 w-4" />
                    </Button>
                  )}
                  {!isEditing && index === formRows.length - 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded"
                      onClick={handleAddRow}
                    >
                      <PlusIcon className="h-4 w-4" />
                    </Button>
                  )}
                  {!isEditing && formRows.length === 1 && index === 0 && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 bg-red-500 hover:bg-red-600 text-white rounded opacity-50"
                        disabled
                      >
                        <MinusIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded"
                        onClick={handleAddRow}
                      >
                        <PlusIcon className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link to={`/bg/diary/class/${classId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Назад
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <ClipboardListIcon className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-lg font-semibold">
                {isAdmin ? (
                  <Link 
                    to={`/bg/admin/classes/${classId}`}
                    className="text-primary hover:underline"
                  >
                    {classData.name}
                  </Link>
                ) : (
                  classData.name
                )} -{" "}
                {classTeacher ? (
                  <>
                    <UserNameLink
                      userId={classTeacher._id}
                      firstName={classTeacher.firstName}
                      lastName={classTeacher.lastName}
                    /> (класен)
                  </>
                ) : (
                  "Без класен ръководител"
                )}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Добави
              </Button>
            )}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-2 px-6 py-2 border-t overflow-x-auto">
          {stats.map((stat, index) => (
            <Link
              key={index}
              to={stat.link}
              className={cn(
                "px-4 py-2 text-sm font-medium whitespace-nowrap rounded transition-colors",
                stat.link === `/bg/diary/class/${classId}/internal-commission`
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              )}
            >
              {stat.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <ClipboardListIcon className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">ВЧК (Втори час на класа)</h2>
          </div>

          {/* Таблица - показва се винаги */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">№</TableHead>
                  <TableHead className="font-semibold">Тип</TableHead>
                  <TableHead className="font-semibold">Начало</TableHead>
                  <TableHead className="font-semibold">Край</TableHead>
                  <TableHead className="font-semibold">Стая</TableHead>
                  <TableHead className="font-semibold">Учител</TableHead>
                  <TableHead className="font-semibold">Описание</TableHead>
                  {canEdit && <TableHead className="font-semibold text-center">Действия</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {records && records.length > 0 ? (
                  records.map((record, index) => (
                    <TableRow key={record._id} className="hover:bg-muted/50">
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{record.typeLabel}</TableCell>
                      <TableCell>
                        {format(new Date(record.startDate), "dd.MM.yyyy", { locale: bg })}
                      </TableCell>
                      <TableCell>
                        {format(new Date(record.endDate), "dd.MM.yyyy", { locale: bg })}
                      </TableCell>
                      <TableCell>{record.roomName || "-"}</TableCell>
                      <TableCell>
                        <UserNameLink
                          userId={record.teacherId as Id<"users">}
                          firstName={record.teacherName.split(" ")[0]}
                          lastName={record.teacherName.split(" ").slice(1).join(" ")}
                        />
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate" title={record.description || ""}>
                        {record.description || "-"}
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => navigate(`/bg/diary/class/${classId}/internal-commission?edit=${record._id}`)}
                            >
                              <PencilIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(record._id)}
                            >
                              <Trash2Icon className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell 
                      colSpan={canEdit ? 8 : 7} 
                      className="text-center py-12 text-muted-foreground"
                    >
                      <ClipboardListIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Няма добавени ВЧК часове</p>
                      {canEdit && (
                        <Button
                          variant="default"
                          size="sm"
                          className="mt-4"
                          onClick={() => setShowAddForm(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Добави първи запис
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function InternalCommissionPage() {
  return (
    <Layout>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <p className="text-muted-foreground">Моля, влезте в профила си</p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="flex items-center justify-center min-h-screen">
          <Skeleton className="h-96 w-full max-w-md" />
        </div>
      </AuthLoading>
      <Authenticated>
        <DiaryAccessGuard>
          <InternalCommissionInner />
        </DiaryAccessGuard>
      </Authenticated>
    </Layout>
  );
}
