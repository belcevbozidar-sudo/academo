import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useAction, useMutation } from "@/lib/convex-preview";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Calendar } from "@/components/ui/calendar.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { 
  PlusIcon, 
  XIcon, 
  FilterIcon, 
  ChevronLeftIcon, 
  CheckIcon, 
  SettingsIcon,
  HashIcon,
  UsersIcon,
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  HighlighterIcon,
  ListIcon,
  ListOrderedIcon,
  IndentDecreaseIcon,
  IndentIncreaseIcon,
  Redo2Icon,
  TableIcon,
  PencilIcon,
  TypeIcon,
  CalendarIcon,
  FileIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import { format } from "date-fns";
import { bg } from "date-fns/locale";

// Class grade options
const CLASS_GRADES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "ПГ(4Г.)", "ПГ(5Г.)", "ПГ(6Г.)"];

function MyTasksInner() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Edit mode
  const editId = searchParams.get("edit");
  const [showAddForm, setShowAddForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Form state
  const [isExtendedMode, setIsExtendedMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"basic" | "participants">("basic");
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formClassId, setFormClassId] = useState("");
  const [formSubjectId, setFormSubjectId] = useState("");
  const [targetType, setTargetType] = useState<"class" | "activity">("class");
  const [formActivityId, setFormActivityId] = useState("");
  const [selectedClassGrade, setSelectedClassGrade] = useState<string>("");
  const [isGroupTask, setIsGroupTask] = useState(false);
  
  // Date/Time state
  const [activeFromDate, setActiveFromDate] = useState<Date | undefined>();
  const [activeFromTime, setActiveFromTime] = useState("");
  const [activeFromCalendarOpen, setActiveFromCalendarOpen] = useState(false);
  const [activeToDate, setActiveToDate] = useState<Date | undefined>();
  const [activeToTime, setActiveToTime] = useState("");
  const [activeToCalendarOpen, setActiveToCalendarOpen] = useState(false);
  
  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ id: Id<"_storage">; name: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Participants tab state
  const [participantsClassFilter, setParticipantsClassFilter] = useState<string>("all");
  const [participantsParalelkaFilter, setParticipantsParalelkaFilter] = useState<string>("all");
  const [participantsGroupFilter, setParticipantsGroupFilter] = useState<string>("all");
  const [showStudents, setShowStudents] = useState(false);
  const [showParents, setShowParents] = useState(false);
  const [showTeachers, setShowTeachers] = useState(false);
  const [showStaff, setShowStaff] = useState(false);
  const [participantsNameSearch, setParticipantsNameSearch] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [participantsPage, setParticipantsPage] = useState(1);
  const PARTICIPANTS_PER_PAGE = 15;

  const currentUser = useQuery(api.users.getCurrentUser, {});
  const assignments = useQuery(api.assignmentsQueries.getMyAssignments, {});
  const classes = useQuery(api.admin.listClasses, {});
  const subjects = useQuery(api.admin.listSubjects, {});
  const allUsers = useQuery(api.admin.listUsers, {});
  const activities = useQuery(
    api.events.listExtracurricularActivities,
    currentUser?.schoolId ? { schoolId: currentUser.schoolId } : "skip"
  );
  const createAssignment = useAction(api.assignmentsActions.createAssignmentAction);
  const updateAssignment = useMutation(api.assignments.updateAssignment);
  const generateUploadUrl = useMutation(api.assignments.generateUploadUrl);
  
  // Query for editing assignment
  const editingAssignment = useQuery(
    api.assignments.getAssignmentById,
    editId ? { assignmentId: editId as Id<"assignments"> } : "skip"
  );

  // Effect to open form and populate data when editing
  useEffect(() => {
    if (editId && editingAssignment) {
      setShowAddForm(true);
      setIsEditMode(true);
      setIsExtendedMode(editingAssignment.isExtended || false);
      setFormName(editingAssignment.title || "");
      setFormType(editingAssignment.type || "");
      setFormDescription(editingAssignment.description || "");
      setFormClassId(editingAssignment.classId || "");
      setFormSubjectId(editingAssignment.subjectId || "");
      setTargetType(editingAssignment.targetType || "class");
      setFormActivityId(editingAssignment.extracurricularActivityId || "");
      setIsGroupTask(editingAssignment.isGroupTask || false);
      
      // Set dates if present
      if (editingAssignment.activeFrom) {
        const fromDate = new Date(editingAssignment.activeFrom);
        setActiveFromDate(fromDate);
        setActiveFromTime(format(fromDate, "HH:mm"));
      }
      if (editingAssignment.activeTo) {
        const toDate = new Date(editingAssignment.activeTo);
        setActiveToDate(toDate);
        setActiveToTime(format(toDate, "HH:mm"));
      }
      
      // Set class grade for extended mode
      if (editingAssignment.isExtended && editingAssignment.className) {
        const grade = editingAssignment.className.match(/^\d+|ПГ\(\d+Г\.\)/)?.[0];
        if (grade) setSelectedClassGrade(grade);
      }
      
      // Set selected participants
      if (editingAssignment.participants && editingAssignment.participants.length > 0) {
        const participantUserIds = editingAssignment.participants
          .map(p => p.userId)
          .filter(Boolean);
        setSelectedParticipants(new Set(participantUserIds));
      }
    }
  }, [editId, editingAssignment]);

  // Filter users for participants tab
  const filteredParticipants = useMemo(() => {
    if (!allUsers) return [];
    
    const filtered = allUsers.filter(user => {
      const roleFilters: string[] = [];
      if (showStudents) roleFilters.push("student");
      if (showParents) roleFilters.push("parent");
      if (showTeachers) roleFilters.push("teacher", "class_teacher");
      if (showStaff) roleFilters.push("director", "vice_director", "secretary", "system_admin", "pedagogical_counselor", "housekeeper");
      
      if (roleFilters.length > 0) {
        const userRoles: string[] = [user.role, ...(user.roles || [])];
        if (!roleFilters.some(r => userRoles.includes(r))) return false;
      }
      
      if (participantsNameSearch) {
        const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ").toLowerCase();
        if (!fullName.includes(participantsNameSearch.toLowerCase())) return false;
      }
      
      if (participantsParalelkaFilter !== "all") {
        if (user.classId !== participantsParalelkaFilter) return false;
      }
      
      return true;
    });
    
    return filtered;
  }, [allUsers, showStudents, showParents, showTeachers, showStaff, participantsNameSearch, participantsParalelkaFilter]);

  const paginatedParticipants = useMemo(() => {
    const start = (participantsPage - 1) * PARTICIPANTS_PER_PAGE;
    return filteredParticipants.slice(start, start + PARTICIPANTS_PER_PAGE);
  }, [filteredParticipants, participantsPage]);

  const totalPages = Math.ceil(filteredParticipants.length / PARTICIPANTS_PER_PAGE);

  const getRoleDisplay = (user: { role: string; roles?: string[] }) => {
    const roleMap: Record<string, string> = {
      student: "Ученик",
      parent: "Родител",
      teacher: "Учител",
      director: "Директор",
      vice_director: "Зам. директор",
      secretary: "Секретар",
      system_admin: "Администратор",
      zats: "ЗАТС",
      pedagogical_counselor: "Педагогически съветник",
      housekeeper: "Домакин",
    };
    
    if (user.role === "parent" || user.roles?.includes("parent")) {
      return "Родител на ...";
    }
    
    return roleMap[user.role] || user.role;
  };

  const getClassName = (user: { classId?: string }) => {
    if (!user.classId || !classes) return "-";
    const cls = classes.find(c => c._id === user.classId);
    return cls?.name || "-";
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await result.json();
        setUploadedFiles(prev => [...prev, { id: storageId, name: file.name }]);
      }
      toast.success("Файлът е качен успешно");
    } catch (error) {
      toast.error("Грешка при качване на файл");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeFile = (fileId: Id<"_storage">) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleSubmit = async (saveAndAdd?: boolean) => {
    try {
      const title = isExtendedMode ? formName : formType;
      const description = formDescription;
      
      if (!title || !description) {
        toast.error("Моля, попълнете всички задължителни полета");
        return;
      }

      if (!isExtendedMode) {
        if (targetType === "class" && (!formClassId || !formSubjectId)) {
          toast.error("Моля, изберете паралелка и предмет");
          return;
        }

        if (targetType === "activity" && !formActivityId) {
          toast.error("Моля, изберете извънкласна дейност");
          return;
        }
      } else {
        if (!selectedClassGrade || !formSubjectId) {
          toast.error("Моля, изберете клас и предмет");
          return;
        }
      }

      let classId = formClassId;
      if (isExtendedMode && selectedClassGrade) {
        const matchingClass = classes?.find(c => c.name.startsWith(selectedClassGrade));
        if (matchingClass) {
          classId = matchingClass._id;
        }
      }

      // Parse dates
      let activeFrom: number | undefined;
      let activeTo: number | undefined;
      
      if (activeFromDate) {
        const fromDate = new Date(activeFromDate);
        if (activeFromTime) {
          const [hours, minutes] = activeFromTime.split(":").map(Number);
          fromDate.setHours(hours, minutes);
        }
        activeFrom = fromDate.getTime();
      }
      
      if (activeToDate) {
        const toDate = new Date(activeToDate);
        if (activeToTime) {
          const [hours, minutes] = activeToTime.split(":").map(Number);
          toDate.setHours(hours, minutes);
        }
        activeTo = toDate.getTime();
      }

      if (isEditMode && editId) {
        // Update existing assignment
        await updateAssignment({
          assignmentId: editId as Id<"assignments">,
          title: title,
          type: formType || "Домашна",
          description: description,
          classId: classId ? (classId as Id<"classes">) : undefined,
          subjectId: formSubjectId ? (formSubjectId as Id<"subjects">) : undefined,
          targetType: isExtendedMode ? "class" : targetType,
          extracurricularActivityId: targetType === "activity" && !isExtendedMode ? (formActivityId as Id<"extracurricularActivities">) : undefined,
          isExtended: isExtendedMode,
          activeFrom,
          activeTo,
          isGroupTask,
          fileIds: uploadedFiles.length > 0 ? uploadedFiles.map(f => f.id) : undefined,
          participantIds: selectedParticipants.size > 0 ? Array.from(selectedParticipants) as Id<"users">[] : undefined,
        });
        toast.success("Задачата е обновена успешно");
      } else {
        // Create new assignment
        await createAssignment({
          title: title,
          type: formType || "Домашна",
          description: description,
          classId: classId ? (classId as Id<"classes">) : undefined,
          subjectId: formSubjectId ? (formSubjectId as Id<"subjects">) : undefined,
          status: "pending",
          targetType: isExtendedMode ? "class" : targetType,
          extracurricularActivityId: targetType === "activity" && !isExtendedMode ? (formActivityId as Id<"extracurricularActivities">) : undefined,
          isExtended: isExtendedMode,
          activeFrom,
          activeTo,
          isGroupTask,
          fileIds: uploadedFiles.length > 0 ? uploadedFiles.map(f => f.id) : undefined,
          participantIds: selectedParticipants.size > 0 ? Array.from(selectedParticipants) as Id<"users">[] : undefined,
        });
        toast.success("Задачата е добавена успешно");
      }
      
      resetForm();

      if (isEditMode && editId) {
        // Navigate back to task detail after editing
        setSearchParams({});
        setIsEditMode(false);
        setShowAddForm(false);
        navigate(`/bg/tasks/my-tasks/${editId}`);
      } else if (!saveAndAdd) {
        setShowAddForm(false);
      }
    } catch (error) {
      console.error("Error saving assignment:", error);
      toast.error(isEditMode ? "Грешка при обновяване на задача" : "Грешка при добавяне на задача");
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormType("");
    setFormDescription("");
    setFormClassId("");
    setFormSubjectId("");
    setFormActivityId("");
    setActiveFromDate(undefined);
    setActiveFromTime("");
    setActiveToDate(undefined);
    setActiveToTime("");
    setSelectedClassGrade("");
    setIsGroupTask(false);
    setTargetType("class");
    setSelectedParticipants(new Set());
    setActiveTab("basic");
    setUploadedFiles([]);
  };

  const handleBack = () => {
    setShowAddForm(false);
    setIsExtendedMode(false);
    setIsEditMode(false);
    // Clear edit param from URL
    if (editId) {
      setSearchParams({});
    }
    resetForm();
  };

  const handleClearParticipantsFilters = () => {
    setParticipantsClassFilter("all");
    setParticipantsParalelkaFilter("all");
    setParticipantsGroupFilter("all");
    setShowStudents(false);
    setShowParents(false);
    setShowTeachers(false);
    setShowStaff(false);
    setParticipantsNameSearch("");
    setParticipantsPage(1);
  };

  const toggleParticipant = (userId: string) => {
    const newSet = new Set(selectedParticipants);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedParticipants(newSet);
  };

  const toggleAllParticipants = () => {
    if (selectedParticipants.size === paginatedParticipants.length) {
      setSelectedParticipants(new Set());
    } else {
      setSelectedParticipants(new Set(paginatedParticipants.map(p => p._id)));
    }
  };

  const filteredAssignments = assignments?.filter((assignment) => {
    const matchesName = !nameFilter || assignment.title.toLowerCase().includes(nameFilter.toLowerCase());
    const matchesSubject = subjectFilter === "all" || assignment.subjectName === subjectFilter;
    const matchesClass = classFilter === "all" || assignment.className === classFilter;
    const matchesStatus = statusFilter === "all" || assignment.status === statusFilter;
    
    return matchesName && matchesSubject && matchesClass && matchesStatus;
  });

  const handleClearFilters = () => {
    setNameFilter("");
    setSubjectFilter("all");
    setClassFilter("all");
    setStatusFilter("all");
  };

  const handleTaskClick = (taskId: string) => {
    navigate(`/bg/tasks/my-tasks/${taskId}`);
  };

  // Full-screen Add Form
  if (showAddForm) {
    return (
      <Layout>
        <div className="min-h-screen bg-background">
          {/* Header */}
          <div className="border-b bg-card">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="text-xl font-semibold text-foreground">
                  ☰ {isEditMode ? "Редактиране на задача" : "Добавяне на задача"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeftIcon className="h-4 w-4 mr-1" />
                  Назад
                </Button>
                <Button 
                  onClick={() => handleSubmit(false)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckIcon className="h-4 w-4 mr-1" />
                  Запази
                </Button>
                {!isExtendedMode && !isEditMode && (
                  <Button 
                    onClick={() => handleSubmit(true)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckIcon className="h-4 w-4 mr-1" />
                    Запази и добави
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Extended Mode Tabs */}
          {isExtendedMode && (
            <div className="border-b bg-card px-6">
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTab("basic")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                    activeTab === "basic"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <HashIcon className="h-4 w-4" />
                  Основни данни
                </button>
                <button
                  onClick={() => setActiveTab("participants")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                    activeTab === "participants"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <UsersIcon className="h-4 w-4" />
                  Участници
                  <span className="bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {selectedParticipants.size}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Form Content */}
          {isExtendedMode ? (
            activeTab === "basic" ? (
              <div className="max-w-4xl mx-auto p-6">
                <div className="space-y-5">
                  <div className="flex justify-end">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-muted-foreground"
                      onClick={() => setIsExtendedMode(false)}
                    >
                      <SettingsIcon className="h-4 w-4 mr-1" />
                      Кратък
                    </Button>
                  </div>

                  {/* Name Field */}
                  <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                    <Label className="text-right">
                      Име: <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      placeholder="Заглавие на задача"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                    />
                  </div>

                  {/* Type Field */}
                  <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                    <Label className="text-right">
                      Тип: <span className="text-destructive">*</span>
                    </Label>
                    <Select value={formType} onValueChange={setFormType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Домашно" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Домашна">Домашна</SelectItem>
                        <SelectItem value="Проект">Проект</SelectItem>
                        <SelectItem value="Административна задача">Административна задача</SelectItem>
                        <SelectItem value="Друго">Друго</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Files Field */}
                  <div className="grid grid-cols-[160px_1fr] items-start gap-4">
                    <Label className="text-right pt-2">Файлове:</Label>
                    <div className="space-y-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        multiple
                      />
                      <Button 
                        type="button"
                        variant="default" 
                        size="sm" 
                        className="w-fit bg-cyan-500 hover:bg-cyan-600"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        <PlusIcon className="h-4 w-4 mr-1" />
                        {isUploading ? "Качване..." : "Добавяне на файл"}
                      </Button>
                      {uploadedFiles.length > 0 && (
                        <div className="space-y-1">
                          {uploadedFiles.map((file) => (
                            <div key={file.id} className="flex items-center gap-2 text-sm">
                              <FileIcon className="h-4 w-4 text-muted-foreground" />
                              <span>{file.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-destructive"
                                onClick={() => removeFile(file.id)}
                              >
                                <Trash2Icon className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description Field */}
                  <div className="grid grid-cols-[160px_1fr] items-start gap-4">
                    <Label className="text-right pt-2">Описание:</Label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1 border rounded-t-md p-1 bg-muted/30">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500">
                          <TypeIcon className="h-4 w-4" />
                        </Button>
                        <div className="w-px h-6 bg-border mx-1" />
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <BoldIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <ItalicIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <UnderlineIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <HighlighterIcon className="h-4 w-4" />
                        </Button>
                        <div className="w-px h-6 bg-border mx-1" />
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <ListIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <ListOrderedIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <IndentDecreaseIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <IndentIncreaseIcon className="h-4 w-4" />
                        </Button>
                        <div className="w-px h-6 bg-border mx-1" />
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Redo2Icon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <TableIcon className="h-4 w-4" />
                        </Button>
                      </div>
                      <Textarea
                        placeholder=""
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        rows={8}
                        maxLength={15000}
                        className="rounded-t-none"
                      />
                      <div className="text-sm text-muted-foreground">
                        {formDescription.length} / 15000
                      </div>
                    </div>
                  </div>

                  {/* Active From - Calendar + Time */}
                  <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                    <Label className="text-right">Активна от:</Label>
                    <div className="flex gap-2">
                      <Popover open={activeFromCalendarOpen} onOpenChange={setActiveFromCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-[200px] justify-start text-left font-normal",
                              !activeFromDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {activeFromDate ? format(activeFromDate, "dd.MM.yyyy", { locale: bg }) : "Изберете дата"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={activeFromDate}
                            onSelect={(date) => {
                              setActiveFromDate(date);
                              setActiveFromCalendarOpen(false);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <Input
                        type="time"
                        value={activeFromTime}
                        onChange={(e) => setActiveFromTime(e.target.value)}
                        className="w-[120px]"
                        placeholder="ЧЧ:ММ"
                      />
                    </div>
                  </div>

                  {/* Active To - Calendar + Time */}
                  <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                    <Label className="text-right">Активна до:</Label>
                    <div className="flex gap-2">
                      <Popover open={activeToCalendarOpen} onOpenChange={setActiveToCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-[200px] justify-start text-left font-normal",
                              !activeToDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {activeToDate ? format(activeToDate, "dd.MM.yyyy", { locale: bg }) : "Изберете дата"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={activeToDate}
                            onSelect={(date) => {
                              setActiveToDate(date);
                              setActiveToCalendarOpen(false);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <Input
                        type="time"
                        value={activeToTime}
                        onChange={(e) => setActiveToTime(e.target.value)}
                        className="w-[120px]"
                        placeholder="ЧЧ:ММ"
                      />
                    </div>
                  </div>

                  {/* Class Grade Selection */}
                  <div className="grid grid-cols-[160px_1fr] items-start gap-4">
                    <Label className="text-right pt-2">
                      Клас: <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {CLASS_GRADES.map((grade) => (
                        <button
                          key={grade}
                          type="button"
                          onClick={() => setSelectedClassGrade(grade === selectedClassGrade ? "" : grade)}
                          className={cn(
                            "px-3 py-1.5 text-sm border rounded transition-colors min-w-[40px]",
                            selectedClassGrade === grade
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background hover:bg-muted border-border"
                          )}
                        >
                          {grade}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Subject Field */}
                  <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                    <Label className="text-right">
                      Предмет: <span className="text-destructive">*</span>
                    </Label>
                    <Select value={formSubjectId} onValueChange={setFormSubjectId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Изберете" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects?.map((subject) => (
                          <SelectItem key={subject._id} value={subject._id}>
                            {subject.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Group Task Toggle */}
                  <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                    <Label className="text-right flex items-center gap-1 justify-end">
                      Групова задача:
                      <span className="text-blue-500 cursor-help" title="Информация">ℹ</span>
                    </Label>
                    <div className="flex">
                      <div className="inline-flex rounded-md overflow-hidden border">
                        <button
                          type="button"
                          onClick={() => setIsGroupTask(false)}
                          className={cn(
                            "px-4 py-1.5 text-sm font-medium transition-colors",
                            !isGroupTask
                              ? "bg-red-500 text-white"
                              : "bg-background text-muted-foreground hover:bg-muted"
                          )}
                        >
                          НЕ
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsGroupTask(true)}
                          className={cn(
                            "px-4 py-1.5 text-sm font-medium transition-colors",
                            isGroupTask
                              ? "bg-green-500 text-white"
                              : "bg-background text-muted-foreground hover:bg-muted"
                          )}
                        >
                          ДА
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Participants Tab
              <div className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <Select value={participantsClassFilter} onValueChange={setParticipantsClassFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Клас" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Клас</SelectItem>
                        {CLASS_GRADES.map((grade) => (
                          <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={participantsParalelkaFilter} onValueChange={setParticipantsParalelkaFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Паралелка" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Паралелка</SelectItem>
                        {classes?.map((cls) => (
                          <SelectItem key={cls._id} value={cls._id}>{cls.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={participantsGroupFilter} onValueChange={setParticipantsGroupFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Потребителска група" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Потребителска група</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={showStudents} onCheckedChange={(c) => setShowStudents(!!c)} />
                      <span className="text-sm">Ученици</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={showParents} onCheckedChange={(c) => setShowParents(!!c)} />
                      <span className="text-sm">Родители</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={showTeachers} onCheckedChange={(c) => setShowTeachers(!!c)} />
                      <span className="text-sm">Учители</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={showStaff} onCheckedChange={(c) => setShowStaff(!!c)} />
                      <span className="text-sm">Училищен персонал</span>
                    </label>
                    <div className="flex-1" />
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={handleClearParticipantsFilters}
                    >
                      <XIcon className="h-4 w-4 mr-1" />
                      Изчисти
                    </Button>
                  </div>

                  <div className="flex justify-end items-center gap-2">
                    <span className="text-sm text-muted-foreground">Търсене по име:</span>
                    <Input
                      value={participantsNameSearch}
                      onChange={(e) => {
                        setParticipantsNameSearch(e.target.value);
                        setParticipantsPage(1);
                      }}
                      className="w-48"
                    />
                  </div>

                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox 
                              checked={paginatedParticipants.length > 0 && selectedParticipants.size === paginatedParticipants.length}
                              onCheckedChange={toggleAllParticipants}
                            />
                          </TableHead>
                          <TableHead>
                            <button className="flex items-center gap-1">
                              Име
                              <span className="text-xs">▲</span>
                            </button>
                          </TableHead>
                          <TableHead>Роля</TableHead>
                          <TableHead>Паралелка</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedParticipants.map((user) => {
                          const fullName = [user.firstName, user.middleName?.charAt(0) ? user.middleName.charAt(0) + "." : "", user.lastName].filter(Boolean).join(" ");
                          return (
                            <TableRow key={user._id}>
                              <TableCell>
                                <Checkbox 
                                  checked={selectedParticipants.has(user._id)}
                                  onCheckedChange={() => toggleParticipant(user._id)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                <span className="text-blue-600">👤</span> {fullName || user.name || "Неизвестен"}
                              </TableCell>
                              <TableCell>{getRoleDisplay(user)}</TableCell>
                              <TableCell>{getClassName(user)}</TableCell>
                            </TableRow>
                          );
                        })}
                        {paginatedParticipants.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                              Няма намерени потребители
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex justify-end items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setParticipantsPage(1)}
                        disabled={participantsPage === 1}
                      >
                        Първа
                      </Button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const page = participantsPage <= 3 
                          ? i + 1 
                          : participantsPage >= totalPages - 2 
                            ? totalPages - 4 + i 
                            : participantsPage - 2 + i;
                        if (page < 1 || page > totalPages) return null;
                        return (
                          <Button
                            key={page}
                            variant={participantsPage === page ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setParticipantsPage(page)}
                            className={participantsPage === page ? "bg-cyan-500 hover:bg-cyan-600" : ""}
                          >
                            {page}
                          </Button>
                        );
                      })}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setParticipantsPage(totalPages)}
                        disabled={participantsPage === totalPages}
                      >
                        Последна
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            // Simple Mode Form
            <div className="max-w-3xl mx-auto p-6">
              <div className="space-y-6">
                <div className="flex justify-end">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-muted-foreground"
                    onClick={() => setIsExtendedMode(true)}
                  >
                    <SettingsIcon className="h-4 w-4 mr-1" />
                    Разширен
                  </Button>
                </div>

                {/* Type Field */}
                <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                  <Label className="text-right">
                    Тип: <span className="text-destructive">*</span>
                  </Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Домашно" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Домашна">Домашна</SelectItem>
                      <SelectItem value="Проект">Проект</SelectItem>
                      <SelectItem value="Административна задача">Административна задача</SelectItem>
                      <SelectItem value="Друго">Друго</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Description Field */}
                <div className="grid grid-cols-[140px_1fr] items-start gap-4">
                  <Label className="text-right pt-2">
                    Описание: <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    placeholder="Кратко описание"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={4}
                  />
                </div>

                {/* Target Type Toggle */}
                <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                  <Label className="text-right">
                    Участници: <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex">
                    <div className="inline-flex rounded-md overflow-hidden border">
                      <button
                        type="button"
                        onClick={() => setTargetType("class")}
                        className={cn(
                          "px-4 py-2 text-sm font-medium transition-colors",
                          targetType === "class"
                            ? "bg-emerald-500 text-white"
                            : "bg-background text-muted-foreground hover:bg-muted"
                        )}
                      >
                        ПАРАЛЕЛКА
                      </button>
                      <button
                        type="button"
                        onClick={() => setTargetType("activity")}
                        className={cn(
                          "px-4 py-2 text-sm font-medium transition-colors",
                          targetType === "activity"
                            ? "bg-teal-600 text-white"
                            : "bg-background text-muted-foreground hover:bg-muted"
                        )}
                      >
                        ДЕЙНОСТ
                      </button>
                    </div>
                  </div>
                </div>

                {/* Conditional Fields */}
                {targetType === "class" ? (
                  <>
                    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                      <Label className="text-right">
                        Паралелка <span className="text-destructive">*</span>
                      </Label>
                      <Select value={formClassId} onValueChange={setFormClassId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Изберете паралелка" />
                        </SelectTrigger>
                        <SelectContent>
                          {classes?.map((cls) => (
                            <SelectItem key={cls._id} value={cls._id}>
                              {cls.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                      <Label className="text-right">
                        Предмет <span className="text-destructive">*</span>
                      </Label>
                      <Select value={formSubjectId} onValueChange={setFormSubjectId}>
                        <SelectTrigger>
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
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                    <Label className="text-right">
                      Извънкласна дейност <span className="text-destructive">*</span>
                    </Label>
                    <Select value={formActivityId} onValueChange={setFormActivityId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Изберете извънкласна дейност" />
                      </SelectTrigger>
                      <SelectContent>
                        {activities?.map((activity) => (
                          <SelectItem key={activity._id} value={activity._id}>
                            {activity.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // Main task list view
  return (
    <Layout>
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Мои задачи</CardTitle>
              <Button onClick={() => setShowAddForm(true)}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Добави
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <FilterIcon className="h-4 w-4 mr-2" />
                Филтри
              </Button>
            </div>

            {showFilters && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Input
                    placeholder="Име"
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                  />
                  <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Изберете (предмет)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Изберете (предмет)</SelectItem>
                      {subjects?.map((subject) => (
                        <SelectItem key={subject._id} value={subject.name}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={classFilter} onValueChange={setClassFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Изберете (клас)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Изберете (клас)</SelectItem>
                      {classes?.map((cls) => (
                        <SelectItem key={cls._id} value={cls.name}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Изберете (статус)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Изберете (статус)</SelectItem>
                      <SelectItem value="pending">Чакаща</SelectItem>
                      <SelectItem value="in_progress">В процес</SelectItem>
                      <SelectItem value="completed">Завършена</SelectItem>
                      <SelectItem value="not_completed">Неизпълнена</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Button variant="destructive" size="sm" onClick={handleClearFilters}>
                    <XIcon className="h-4 w-4 mr-2" />
                    Изчисти
                  </Button>
                </div>
              </>
            )}

            {/* Custom Table with Clickable Names */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Име</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Предмет</TableHead>
                    <TableHead>Клас</TableHead>
                    <TableHead>Добавена на</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments?.map((assignment) => (
                    <TableRow key={assignment._id}>
                      <TableCell>
                        <button
                          onClick={() => handleTaskClick(assignment._id)}
                          className="text-cyan-600 hover:underline font-medium text-left"
                        >
                          {assignment.title}
                        </button>
                      </TableCell>
                      <TableCell>{assignment.type}</TableCell>
                      <TableCell>
                        {assignment.status === "pending" ? "Чакаща" :
                         assignment.status === "in_progress" ? "В процес" :
                         assignment.status === "completed" ? "Завършена" : "Неизпълнена"}
                      </TableCell>
                      <TableCell>{assignment.subjectName}</TableCell>
                      <TableCell>{assignment.className}</TableCell>
                      <TableCell>
                        {new Date(assignment.assignedDate).toLocaleDateString("bg-BG")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!filteredAssignments || filteredAssignments.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Няма намерени задачи
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default function MyTasks() {
  return (
    <>
      <Unauthenticated>
        <Layout>
          <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <p className="text-muted-foreground">Моля, влезте в профила си</p>
            <SignInButton />
          </div>
        </Layout>
      </Unauthenticated>
      <AuthLoading>
        <Layout>
          <div className="flex items-center justify-center min-h-screen">
            <Skeleton className="h-96 w-full max-w-md" />
          </div>
        </Layout>
      </AuthLoading>
      <Authenticated>
        <MyTasksInner />
      </Authenticated>
    </>
  );
}
