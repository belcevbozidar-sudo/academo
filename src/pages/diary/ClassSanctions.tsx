import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useState, useEffect } from "react";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
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
import { 
  ArrowLeftIcon,
  Plus,
  Trash2Icon,
  PencilIcon,
  AlertTriangleIcon,
  UserIcon,
  FileIcon,
  CheckIcon,
  XIcon,
  ImageIcon,
  FileTextIcon,
  EyeIcon,
  GripVerticalIcon,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { UserNameLink } from "@/components/ui/user-name-link.tsx";
import { format } from "date-fns";
import { bg } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { CalendarIcon } from "lucide-react";

// Sanction types matching the backend
const SANCTION_TYPES = [
  "чл. 199 ал. 1 т. 1 Забележка",
  "чл. 199 ал. 1 т. 2 Преместване в друга паралелка в същото училище",
  "чл. 199 ал. 1 т. 3 Предупреждение за преместване в друго училище",
  "чл. 199 ал. 1 т. 4 Преместване в друго училище",
  "чл. 199 ал. 1 т. 5 Преместване от дневна в самостоятелна форма на обучение",
  "чл. 139 ал. 1 т. 2 Извършване на дейности в полза на училището",
];

function AddSanctionForm({ classId, onCancel, editId }: { classId: string; onCancel: () => void; editId?: string }) {
  const navigate = useNavigate();
  
  const classStudents = useQuery(
    api.admin.getStudentsByClass,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  const existingSanction = useQuery(
    api.sanctions.getSanctionById,
    editId ? { id: editId as Id<"sanctions"> } : "skip"
  );
  
  const createSanction = useMutation(api.sanctions.createSanction);
  const updateSanction = useMutation(api.sanctions.updateSanction);
  const generateUploadUrl = useMutation(api.sanctions.generateUploadUrl);
  
  const [studentId, setStudentId] = useState("");
  const [sanctionType, setSanctionType] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [orderDate, setOrderDate] = useState<Date | undefined>(new Date());
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<Array<{ id: string; url: string }>>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAndAdding, setIsSavingAndAdding] = useState(false);

  // Helper to check if URL is an image
  const isImageUrl = (url: string) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    return imageExtensions.some(ext => url.toLowerCase().includes(ext));
  };

  // Load existing data for editing
  useEffect(() => {
    if (existingSanction) {
      setStudentId(existingSanction.studentId);
      setSanctionType(existingSanction.sanctionType);
      setOrderNumber(existingSanction.orderNumber);
      setOrderDate(new Date(existingSanction.orderDate));
      setReason(existingSanction.reason);
      setStartDate(new Date(existingSanction.startDate));
      setEndDate(existingSanction.endDate ? new Date(existingSanction.endDate) : undefined);
      // Load existing files with their IDs and URLs
      if (existingSanction.fileIds && existingSanction.fileUrls) {
        const existingFilesData = existingSanction.fileIds.map((id: string, index: number) => ({
          id,
          url: existingSanction.fileUrls?.[index] || '',
        })).filter((f: { id: string; url: string }) => f.url);
        setExistingFiles(existingFilesData);
      }
    }
  }, [existingSanction]);

  const handleSave = async (addAnother: boolean) => {
    if (!studentId || !sanctionType || !orderNumber || !orderDate || !reason || !startDate) {
      toast.error("Моля, попълнете всички задължителни полета");
      return;
    }

    if (addAnother) {
      setIsSavingAndAdding(true);
    } else {
      setIsSaving(true);
    }

    try {
      // Upload new files
      const uploadedFileIds: Id<"_storage">[] = [];
      for (const file of files) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await result.json();
        uploadedFileIds.push(storageId);
      }

      // Combine existing file IDs (in order) with new uploads
      const allFileIds = [...existingFiles.map(f => f.id) as Id<"_storage">[], ...uploadedFileIds];

      if (editId) {
        await updateSanction({
          id: editId as Id<"sanctions">,
          studentId: studentId as Id<"students">,
          sanctionType,
          orderNumber,
          orderDate: orderDate.getTime(),
          reason,
          startDate: startDate.getTime(),
          endDate: endDate ? endDate.getTime() : undefined,
          // Always pass fileIds array, even if empty (to clear files when all are removed)
          fileIds: allFileIds,
        });
        toast.success("Санкцията е обновена успешно");
      } else {
        await createSanction({
          studentId: studentId as Id<"students">,
          classId: classId as Id<"classes">,
          sanctionType,
          orderNumber,
          orderDate: orderDate.getTime(),
          reason,
          startDate: startDate.getTime(),
          endDate: endDate ? endDate.getTime() : undefined,
          fileIds: allFileIds.length > 0 ? allFileIds : undefined,
        });
        toast.success("Санкцията е добавена успешно");
      }

      if (addAnother) {
        // Reset form for new entry
        setStudentId("");
        setSanctionType("");
        setOrderNumber("");
        setOrderDate(new Date());
        setReason("");
        setStartDate(new Date());
        setEndDate(undefined);
        setFiles([]);
        setExistingFiles([]);
      } else {
        onCancel();
      }
    } catch (error) {
      toast.error("Грешка при записване");
      console.error(error);
    } finally {
      setIsSaving(false);
      setIsSavingAndAdding(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
    }
  };

  const handleRemoveExistingFile = (fileId: string) => {
    setExistingFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleRemoveNewFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const moveExistingFile = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= existingFiles.length) return;
    const newFiles = [...existingFiles];
    [newFiles[index], newFiles[newIndex]] = [newFiles[newIndex], newFiles[index]];
    setExistingFiles(newFiles);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="flex items-center justify-between px-3 md:px-6 py-3">
          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="sm" onClick={onCancel} className="px-2 md:px-3">
              <ArrowLeftIcon className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Назад</span>
            </Button>
            <div className="flex items-center gap-2">
              <AlertTriangleIcon className="h-4 w-4 md:h-5 md:w-5 text-orange-500" />
              <h1 className="text-sm md:text-lg font-semibold">
                {editId ? "Редактиране" : "Добавяне"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <Button 
              variant="default" 
              size="sm"
              onClick={() => handleSave(false)}
              disabled={isSaving || isSavingAndAdding}
              className="px-2 md:px-3"
            >
              <CheckIcon className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">{isSaving ? "Запазване..." : "Запази"}</span>
            </Button>
            {!editId && (
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => handleSave(true)}
                disabled={isSaving || isSavingAndAdding}
                className="hidden md:flex"
              >
                <CheckIcon className="h-4 w-4 mr-2" />
                {isSavingAndAdding ? "Запазване..." : "Запази и добави"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        <Card className="max-w-3xl mx-auto p-4 md:p-6">
          <div className="space-y-4 md:space-y-6">
            {/* Student */}
            <div className="flex flex-col md:grid md:grid-cols-[160px_1fr] gap-2 md:items-center md:gap-4">
              <Label className="text-sm md:text-base font-medium">
                Ученик: <span className="text-destructive">*</span>
              </Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Изберете" />
                </SelectTrigger>
                <SelectContent>
                  {classStudents?.map((student) => (
                    <SelectItem key={student._id} value={student._id}>
                      {student.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sanction Type */}
            <div className="flex flex-col md:grid md:grid-cols-[160px_1fr] gap-2 md:items-center md:gap-4">
              <Label className="text-sm md:text-base font-medium">
                Санкция: <span className="text-destructive">*</span>
              </Label>
              <Select value={sanctionType} onValueChange={setSanctionType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Изберете" />
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)]">
                  {SANCTION_TYPES.map((type) => (
                    <SelectItem key={type} value={type} className="whitespace-normal">
                      <span className="line-clamp-2">{type}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Order Number */}
            <div className="flex flex-col md:grid md:grid-cols-[160px_1fr] gap-2 md:items-center md:gap-4">
              <Label className="text-sm md:text-base font-medium">
                № заповед: <span className="text-destructive">*</span>
              </Label>
              <Input
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="Въведете номер"
                className="w-full"
              />
            </div>

            {/* Order Date */}
            <div className="flex flex-col md:grid md:grid-cols-[160px_1fr] gap-2 md:items-center md:gap-4">
              <Label className="text-sm md:text-base font-medium">
                Дата заповед: <span className="text-destructive">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !orderDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {orderDate ? format(orderDate, "dd.MM.yyyy", { locale: bg }) : "Изберете дата"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={orderDate}
                    onSelect={setOrderDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Reason */}
            <div className="flex flex-col md:grid md:grid-cols-[160px_1fr] gap-2 md:items-start md:gap-4">
              <Label className="text-sm md:text-base font-medium md:pt-2">
                Основание: <span className="text-destructive">*</span>
              </Label>
              <div className="space-y-1">
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value.slice(0, 15000))}
                  placeholder="Въведете основание"
                  rows={4}
                  className="w-full resize-none"
                />
                <div className="text-xs text-muted-foreground text-right">
                  {reason.length} / 15000
                </div>
              </div>
            </div>

            {/* Start Date */}
            <div className="flex flex-col md:grid md:grid-cols-[160px_1fr] gap-2 md:items-center md:gap-4">
              <Label className="text-sm md:text-base font-medium">
                Начало: <span className="text-destructive">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd.MM.yyyy", { locale: bg }) : "Изберете дата"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="flex flex-col md:grid md:grid-cols-[160px_1fr] gap-2 md:items-center md:gap-4">
              <Label className="text-sm md:text-base font-medium">
                Край:
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd.MM.yyyy", { locale: bg }) : "Изберете дата"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Existing Files */}
            {existingFiles.length > 0 && (
              <div className="flex flex-col md:grid md:grid-cols-[160px_1fr] gap-2 md:items-start md:gap-4">
                <Label className="text-sm md:text-base font-medium md:pt-2">
                  Прикачени:
                </Label>
                <div className="space-y-2">
                  {existingFiles.map((file, index) => (
                    <div key={file.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                      <div className="flex flex-col gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => moveExistingFile(index, 'up')}
                          disabled={index === 0}
                        >
                          <GripVerticalIcon className="h-3 w-3 rotate-90" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => moveExistingFile(index, 'down')}
                          disabled={index === existingFiles.length - 1}
                        >
                          <GripVerticalIcon className="h-3 w-3 -rotate-90" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isImageUrl(file.url) ? (
                          <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <FileTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="text-sm truncate">Файл {index + 1}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => window.open(file.url, '_blank')}
                          title="Преглед"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveExistingFile(file.id)}
                          title="Премахни"
                        >
                          <Trash2Icon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Files to Upload */}
            {files.length > 0 && (
              <div className="flex flex-col md:grid md:grid-cols-[160px_1fr] gap-2 md:items-start md:gap-4">
                <Label className="text-sm md:text-base font-medium md:pt-2">
                  Нови файлове:
                </Label>
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileIcon className="h-4 w-4 shrink-0 text-blue-500" />
                        <span className="text-sm truncate">{file.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveNewFile(index)}
                        title="Премахни"
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Files */}
            <div className="flex flex-col md:grid md:grid-cols-[160px_1fr] gap-2 md:items-center md:gap-4">
              <Label className="text-sm md:text-base font-medium">
                Добави файл:
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => document.getElementById("file-upload")?.click()}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Избери
                </Button>
                <span className="text-xs text-muted-foreground">
                  {existingFiles.length + files.length} файл(а)
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SanctionsListView({ classId }: { classId: string }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const viewId = searchParams.get("view");
  
  const classData = useQuery(
    api.admin.getClassById,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  const currentUser = useQuery(api.users.getCurrentUser, {});
  
  const sanctions = useQuery(
    api.sanctions.getSanctionsByClass,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  const deleteSanction = useMutation(api.sanctions.deleteSanction);
  
  const [showAddForm, setShowAddForm] = useState(!!editId);
  const [previewFile, setPreviewFile] = useState<{ url: string; isImage: boolean } | null>(null);
  
  // Get the selected sanction for full-screen view
  const selectedSanction = viewId 
    ? sanctions?.find(s => s._id === viewId) 
    : null;
  
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
  
  // Check if current user is admin
  const isAdmin = currentUser?.roles?.includes("director") || 
                  currentUser?.roles?.includes("vice_director") ||
                  currentUser?.roles?.includes("system_admin");
  
  // Only class teacher and admins can edit санкции
  const canEdit = !isCurrentUserStudent && !isCurrentUserParent && (isClassTeacher || isAdmin);

  // Helper to check if URL is an image
  const isImageUrl = (url: string) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    return imageExtensions.some(ext => url.toLowerCase().includes(ext));
  };

  // Helper to get file icon
  const getFileIcon = (url: string) => {
    if (isImageUrl(url)) return <ImageIcon className="h-4 w-4" />;
    return <FileTextIcon className="h-4 w-4" />;
  };

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

  const handleDelete = async (sanctionId: string) => {
    if (!confirm("Сигурни ли сте, че искате да изтриете тази санкция?")) {
      return;
    }

    try {
      await deleteSanction({ id: sanctionId as Id<"sanctions"> });
      toast.success("Санкцията е изтрита успешно");
    } catch (error) {
      toast.error("Грешка при изтриване");
      console.error(error);
    }
  };

  if (showAddForm || editId) {
    return (
      <AddSanctionForm 
        classId={classId} 
        onCancel={() => {
          setShowAddForm(false);
          navigate(`/bg/diary/class/${classId}/sanctions`);
        }}
        editId={editId || undefined}
      />
    );
  }

  // Full-screen detail view
  if (selectedSanction) {
    return (
      <div className="flex h-screen flex-col bg-background">
        {/* Header */}
        <div className="border-b bg-background">
          <div className="flex items-center justify-between px-3 md:px-6 py-3">
            <div className="flex items-center gap-2 md:gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate(`/bg/diary/class/${classId}/sanctions`)}
                className="px-2 md:px-3"
              >
                <ArrowLeftIcon className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Назад</span>
              </Button>
              <div className="flex items-center gap-2">
                <AlertTriangleIcon className="h-4 w-4 md:h-5 md:w-5 text-orange-500" />
                <h1 className="text-sm md:text-lg font-semibold">
                  Детайли за санкция
                </h1>
              </div>
            </div>
            {canEdit && (
              <div className="flex items-center gap-1 md:gap-2">
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => navigate(`/bg/diary/class/${classId}/sanctions?edit=${selectedSanction._id}`)}
                  className="px-2 md:px-3"
                >
                  <PencilIcon className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Редактирай</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 md:p-6">
          <Card className="max-w-3xl mx-auto p-4 md:p-6">
            <div className="space-y-4 md:space-y-5">
              {/* Student */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="font-medium text-muted-foreground text-sm min-w-[120px]">Ученик:</span>
                <span className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-primary" />
                  <span className="font-medium">{selectedSanction.studentName}</span>
                </span>
              </div>

              {/* Sanction Type */}
              <div className="flex flex-col gap-1">
                <span className="font-medium text-muted-foreground text-sm">Санкция:</span>
                <span className="font-medium text-sm md:text-base">{selectedSanction.sanctionType}</span>
              </div>

              {/* Order Number */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="font-medium text-muted-foreground text-sm min-w-[120px]">№ на заповед:</span>
                <span>{selectedSanction.orderNumber}</span>
              </div>

              {/* Order Date */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="font-medium text-muted-foreground text-sm min-w-[120px]">Дата заповед:</span>
                <span>{format(new Date(selectedSanction.orderDate), "dd.MM.yyyy", { locale: bg })}</span>
              </div>

              {/* Dates */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="font-medium text-muted-foreground text-sm min-w-[120px]">Начало:</span>
                <span>{format(new Date(selectedSanction.startDate), "dd.MM.yyyy", { locale: bg })}</span>
              </div>

              {selectedSanction.endDate && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                  <span className="font-medium text-muted-foreground text-sm min-w-[120px]">Край:</span>
                  <span>{format(new Date(selectedSanction.endDate), "dd.MM.yyyy", { locale: bg })}</span>
                </div>
              )}

              {/* Reason */}
              <div className="space-y-2">
                <span className="font-medium text-muted-foreground text-sm">Основание:</span>
                <div className="p-3 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap">
                  {selectedSanction.reason}
                </div>
              </div>

              {/* Created By */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <span className="font-medium text-muted-foreground text-sm min-w-[120px]">Въведена от:</span>
                <span>{selectedSanction.createdByName}</span>
              </div>

              {/* Files */}
              {selectedSanction.fileUrls && selectedSanction.fileUrls.length > 0 && (
                <div className="space-y-2">
                  <span className="font-medium text-muted-foreground text-sm">Прикачени файлове:</span>
                  <div className="grid gap-2">
                    {selectedSanction.fileUrls.map((url, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          {getFileIcon(url)}
                          <span className="text-sm truncate">Файл {index + 1}</span>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="shrink-0"
                          onClick={() => {
                            if (isImageUrl(url)) {
                              setPreviewFile({ url, isImage: true });
                            } else {
                              window.open(url, '_blank');
                            }
                          }}
                        >
                          <EyeIcon className="h-4 w-4 mr-1" />
                          Преглед
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* File Preview Overlay */}
        {previewFile && (
          <div 
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setPreviewFile(null)}
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 h-10 w-10 text-white hover:bg-white/20"
              onClick={() => setPreviewFile(null)}
            >
              <XIcon className="h-6 w-6" />
            </Button>
            <img 
              src={previewFile.url} 
              alt="Преглед" 
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const classTeacher = classData.classTeacher;

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="flex items-center justify-between px-3 md:px-6 py-3">
          <div className="flex items-center gap-2 md:gap-4">
            <Link to={`/bg/diary/class/${classId}`}>
              <Button variant="ghost" size="sm" className="px-2 md:px-3">
                <ArrowLeftIcon className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Назад</span>
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <AlertTriangleIcon className="h-4 w-4 md:h-5 md:w-5 text-orange-500" />
              <h1 className="text-sm md:text-lg font-semibold truncate">
                {isAdmin ? (
                  <Link 
                    to={`/bg/admin/classes/${classId}`}
                    className="text-primary hover:underline"
                  >
                    {classData.name}
                  </Link>
                ) : (
                  classData.name
                )} 
                <span className="hidden md:inline">
                  {" "}-{" "}
                  {classTeacher ? (
                    <>
                      <UserNameLink
                        userId={classTeacher._id}
                        firstName={classTeacher.firstName}
                        lastName={classTeacher.lastName}
                      /> (класен)
                    </>
                  ) : (
                    "Без класен"
                  )}
                </span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => setShowAddForm(true)}
                className="px-2 md:px-3"
              >
                <Plus className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Добави</span>
              </Button>
            )}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-1 md:gap-2 px-3 md:px-6 py-2 border-t overflow-x-auto">
          {stats.map((stat, index) => (
            <Link
              key={index}
              to={stat.link}
              className={cn(
                "px-2 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium whitespace-nowrap rounded transition-colors",
                stat.link === `/bg/diary/class/${classId}/sanctions`
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
      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        <Card className="p-3 md:p-6">
          <div className="flex items-center gap-2 mb-4 md:mb-6">
            <AlertTriangleIcon className="h-4 w-4 md:h-5 md:w-5 text-orange-500" />
            <h2 className="text-base md:text-lg font-semibold">Санкции</h2>
          </div>

          {sanctions && sanctions.length > 0 ? (
            <>
              {/* Mobile card view */}
              <div className="md:hidden space-y-3">
                {sanctions.map((sanction) => (
                  <div 
                    key={sanction._id} 
                    className="p-3 border rounded-lg bg-card cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/bg/diary/class/${classId}/sanctions?view=${sanction._id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <UserIcon className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-medium text-sm truncate">{sanction.studentName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {sanction.sanctionType}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>№ {sanction.orderNumber}</span>
                          <span>{format(new Date(sanction.startDate), "dd.MM.yyyy", { locale: bg })}</span>
                          {sanction.fileUrls && sanction.fileUrls.length > 0 && (
                            <span className="flex items-center gap-1">
                              <FileIcon className="h-3 w-3" />
                              {sanction.fileUrls.length}
                            </span>
                          )}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/bg/diary/class/${classId}/sanctions?edit=${sanction._id}`);
                            }}
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(sanction._id);
                            }}
                          >
                            <Trash2Icon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Санкция</TableHead>
                      <TableHead className="font-semibold">Ученик</TableHead>
                      <TableHead className="font-semibold">№ заповед</TableHead>
                      <TableHead className="font-semibold">Начало</TableHead>
                      <TableHead className="font-semibold">Край</TableHead>
                      <TableHead className="font-semibold">Файлове</TableHead>
                      <TableHead className="font-semibold text-center">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sanctions.map((sanction) => (
                      <TableRow key={sanction._id} className="hover:bg-muted/50">
                        <TableCell className="max-w-[200px]">
                          <span 
                            className="text-sm truncate cursor-pointer hover:text-primary block" 
                            title="Кликнете за пълен преглед"
                            onClick={() => navigate(`/bg/diary/class/${classId}/sanctions?view=${sanction._id}`)}
                          >
                            {sanction.sanctionType}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div 
                            className="flex items-center gap-2 cursor-pointer hover:text-primary"
                            onClick={() => navigate(`/bg/diary/class/${classId}/sanctions?view=${sanction._id}`)}
                          >
                            <UserIcon className="h-4 w-4 text-primary" />
                            {sanction.studentName}
                          </div>
                        </TableCell>
                        <TableCell>{sanction.orderNumber}</TableCell>
                        <TableCell>
                          {format(new Date(sanction.startDate), "dd.MM.yyyy", { locale: bg })}
                        </TableCell>
                        <TableCell>
                          {sanction.endDate 
                            ? format(new Date(sanction.endDate), "dd.MM.yyyy", { locale: bg })
                            : "-"
                          }
                        </TableCell>
                        <TableCell>
                          {sanction.fileUrls && sanction.fileUrls.length > 0 ? (
                            <div className="flex items-center gap-1">
                              <FileIcon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                {sanction.fileUrls.length}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => navigate(`/bg/diary/class/${classId}/sanctions?view=${sanction._id}`)}
                              title="Преглед"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </Button>
                            {canEdit && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => navigate(`/bg/diary/class/${classId}/sanctions?edit=${sanction._id}`)}
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(sanction._id)}
                                >
                                  <Trash2Icon className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="text-center py-8 md:py-12 text-muted-foreground border rounded-lg">
              <AlertTriangleIcon className="h-10 w-10 md:h-12 md:w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm md:text-base">Все още не са въвеждани санкции.</p>
              {canEdit && (
                <Button
                  variant="default"
                  size="sm"
                  className="mt-4"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Добави първа санкция
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* File Preview Overlay */}
      {previewFile && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewFile(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 h-10 w-10 text-white hover:bg-white/20"
            onClick={() => setPreviewFile(null)}
          >
            <XIcon className="h-6 w-6" />
          </Button>
          <img 
            src={previewFile.url} 
            alt="Преглед" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function ClassSanctionsInner() {
  const { classId } = useParams<{ classId: string }>();
  
  if (!classId) {
    return null;
  }

  return <SanctionsListView classId={classId} />;
}

export default function ClassSanctions() {
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
        <ClassSanctionsInner />
      </Authenticated>
    </Layout>
  );
}
