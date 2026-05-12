import { useState } from "react";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Badge } from "@/components/ui/badge.tsx";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { 
  ChevronLeftIcon, 
  PencilIcon, 
  TrashIcon,
  HashIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";

type ParticipantStatus = "assigned" | "in_progress" | "completed" | "not_completed";
type AssignmentStatus = "pending" | "in_progress" | "completed" | "not_completed";

const STATUS_LABELS: Record<ParticipantStatus, string> = {
  assigned: "Възложена",
  in_progress: "Изпълнява се",
  completed: "Завършена",
  not_completed: "Неизпълнена",
};

const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  pending: "Възложена",
  in_progress: "Изпълнява се",
  completed: "Завършена",
  not_completed: "Неизпълнена",
};

const STATUS_COLORS: Record<ParticipantStatus, string> = {
  assigned: "bg-amber-500",
  in_progress: "bg-blue-500",
  completed: "bg-green-500",
  not_completed: "bg-red-500",
};

function TaskDetailInner() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"basic" | "participants">("basic");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<ParticipantStatus>("assigned");

  const assignment = useQuery(
    api.assignments.getAssignmentById,
    taskId ? { assignmentId: taskId as Id<"assignments"> } : "skip"
  );
  
  const updateStatus = useMutation(api.assignments.updateAssignmentStatus);
  const updateParticipantStatus = useMutation(api.assignments.updateParticipantStatus);
  const updateAllParticipantsStatus = useMutation(api.assignments.updateAllParticipantsStatus);
  const deleteAssignment = useMutation(api.assignments.deleteAssignment);

  if (!assignment) {
    return (
      <Layout>
        <div className="p-6">
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  const handleBack = () => {
    navigate("/bg/tasks/my-tasks");
  };

  const handleEdit = () => {
    // Navigate to edit form with assignment data
    navigate(`/bg/tasks/my-tasks?edit=${taskId}`);
  };

  const handleDelete = async () => {
    try {
      await deleteAssignment({ assignmentId: taskId as Id<"assignments"> });
      toast.success("Задачата е изтрита успешно");
      navigate("/bg/tasks/my-tasks");
    } catch (error) {
      toast.error("Грешка при изтриване на задача");
    }
  };

  const handleStatusChange = async (newStatus: AssignmentStatus) => {
    try {
      await updateStatus({
        assignmentId: taskId as Id<"assignments">,
        status: newStatus,
      });
      toast.success("Статусът е актуализиран");
    } catch (error) {
      toast.error("Грешка при актуализиране на статус");
    }
  };

  const handleParticipantStatusChange = async (participantId: string, newStatus: ParticipantStatus) => {
    try {
      await updateParticipantStatus({
        assignmentId: taskId as Id<"assignments">,
        participantId,
        status: newStatus,
      });
      toast.success("Статусът е актуализиран");
    } catch (error) {
      toast.error("Грешка при актуализиране на статус");
    }
  };

  const handleBulkStatusChange = async () => {
    try {
      await updateAllParticipantsStatus({
        assignmentId: taskId as Id<"assignments">,
        status: bulkStatus,
      });
      toast.success("Статусът на всички участници е актуализиран");
    } catch (error) {
      toast.error("Грешка при актуализиране на статус");
    }
  };

  // Format title based on extended or simple mode
  const displayTitle = assignment.isExtended
    ? assignment.title
    : `(${assignment.className}) ${assignment.type} по ${assignment.subjectName} от ${new Date(assignment.assignedDate).toLocaleDateString("bg-BG")}`;

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-card">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="text-xl font-semibold text-foreground">
                ☰ {displayTitle}
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
                onClick={handleEdit}
                className="bg-cyan-500 hover:bg-cyan-600"
              >
                <PencilIcon className="h-4 w-4 mr-1" />
                Редактирай
              </Button>
              <Button 
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <TrashIcon className="h-4 w-4 mr-1" />
                Изтрий
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
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
                {assignment.participants?.length || 0}
              </span>
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === "basic" ? (
          <div className="max-w-4xl mx-auto p-6">
            <div className="space-y-6">
              {/* Type */}
              <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                <span className="text-right font-medium">Тип:</span>
                <span>{assignment.type}</span>
              </div>

              {/* Subject */}
              <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                <span className="text-right font-medium">Предмет:</span>
                <span>{assignment.subjectName || "-"}</span>
              </div>

              {/* Description */}
              <div className="grid grid-cols-[160px_1fr] items-start gap-4">
                <span className="text-right font-medium">Описание:</span>
                <span>{assignment.description || "-"}</span>
              </div>

              {/* Class or Paralelka */}
              <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                <span className="text-right font-medium">
                  {assignment.isExtended ? "Клас:" : "Паралелка:"}
                </span>
                <span>
                  {assignment.isExtended ? (
                    assignment.className?.replace(/[а-яА-Я]/g, "") || "-"
                  ) : assignment.classId ? (
                    <button
                      onClick={() => navigate(`/bg/diary/class/${assignment.classId}/students`)}
                      className="text-cyan-600 hover:underline cursor-pointer"
                    >
                      {assignment.className || "-"}
                    </button>
                  ) : (
                    assignment.className || "-"
                  )}
                </span>
              </div>

              {/* Added by */}
              <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                <span className="text-right font-medium">Добавена от:</span>
                <span>
                  {assignment.teacherUserId ? (
                    <button
                      onClick={() => navigate(`/bg/profile/${assignment.teacherUserId}`)}
                      className="text-cyan-600 hover:underline cursor-pointer"
                    >
                      {assignment.teacherName}
                    </button>
                  ) : (
                    assignment.teacherName
                  )}
                </span>
              </div>

              {/* Status */}
              <div className="grid grid-cols-[160px_1fr] items-center gap-4">
                <span className="text-right font-medium">Статус:</span>
                <Badge className={cn(
                  "w-fit",
                  assignment.status === "pending" ? "bg-amber-500" :
                  assignment.status === "in_progress" ? "bg-blue-500" :
                  assignment.status === "completed" ? "bg-green-500" : "bg-red-500"
                )}>
                  {ASSIGNMENT_STATUS_LABELS[assignment.status as AssignmentStatus] || assignment.status}
                </Badge>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6">
            {/* Bulk Status Change */}
            <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg mb-4 flex items-center justify-between">
              <span className="font-medium">Промени статуса за всички</span>
              <div className="flex items-center gap-2">
                <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as ParticipantStatus)}>
                  <SelectTrigger className={cn("w-40", STATUS_COLORS[bulkStatus], "text-white border-0")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assigned">Възложена</SelectItem>
                    <SelectItem value="in_progress">Изпълнява се</SelectItem>
                    <SelectItem value="completed">Завършена</SelectItem>
                    <SelectItem value="not_completed">Неизпълнена</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleBulkStatusChange}>
                  Приложи
                </Button>
              </div>
            </div>

            {/* Participants Table */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button className="flex items-center gap-1">
                        Име
                        <span className="text-xs">▼</span>
                      </button>
                    </TableHead>
                    <TableHead>Роля</TableHead>
                    <TableHead>Клас</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Видяна на</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignment.participants?.map((participant) => (
                    <TableRow key={participant.participantId}>
                      <TableCell className="font-medium">
                        {participant.userId ? (
                          <button
                            onClick={() => navigate(`/bg/profile/${participant.userId}`)}
                            className="text-cyan-600 hover:underline cursor-pointer"
                          >
                            👤 {participant.name}
                          </button>
                        ) : (
                          <span className="text-cyan-600">👤 {participant.name}</span>
                        )}
                      </TableCell>
                      <TableCell>{participant.role}</TableCell>
                      <TableCell>
                        {participant.classId ? (
                          <button
                            onClick={() => navigate(`/bg/diary/class/${participant.classId}/students`)}
                            className="text-cyan-600 hover:underline cursor-pointer"
                          >
                            {participant.className}
                          </button>
                        ) : (
                          participant.className
                        )}
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={participant.status} 
                          onValueChange={(v) => handleParticipantStatusChange(participant.participantId, v as ParticipantStatus)}
                        >
                          <SelectTrigger className={cn(
                            "w-36 border-0 text-white",
                            STATUS_COLORS[participant.status as ParticipantStatus] || "bg-amber-500"
                          )}>
                            <SelectValue>
                              {STATUS_LABELS[participant.status as ParticipantStatus] || participant.status}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="assigned">Възложена</SelectItem>
                            <SelectItem value="in_progress">Изпълнява се</SelectItem>
                            <SelectItem value="completed">Завършена</SelectItem>
                            <SelectItem value="not_completed">Неизпълнена</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {participant.seenAt 
                          ? new Date(participant.seenAt).toLocaleDateString("bg-BG")
                          : "-"
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!assignment.participants || assignment.participants.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Няма участници
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <span className="text-sm text-muted-foreground">
                  Показване на резултати от 1 до {assignment.participants?.length || 0} от общо {assignment.participants?.length || 0}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" disabled>{"<"}</Button>
                  <Button variant="default" size="sm" className="bg-cyan-500">1</Button>
                  <Button variant="ghost" size="sm" disabled>{">"}</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Изтриване на задача</AlertDialogTitle>
            <AlertDialogDescription>
              Сигурни ли сте, че искате да изтриете тази задача? Това действие не може да бъде отменено.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отказ</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Изтрий
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

export default function TaskDetail() {
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
        <TaskDetailInner />
      </Authenticated>
    </>
  );
}
