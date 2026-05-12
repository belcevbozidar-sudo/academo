import { useState } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import { DiaryAccessGuard } from "@/components/DiaryAccessGuard.tsx";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { 
  UserIcon, 
  Plus,
  PencilIcon,
  TrashIcon,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";

function ClassTestsInner() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const returnUrl = location.pathname + location.search;
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [testToDelete, setTestToDelete] = useState<Id<"assignments"> | null>(null);
  
  const currentUser = useQuery(api.users.getCurrentUser, {});
  
  const classData = useQuery(
    api.admin.getClassById,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  const classSubjectsData = useQuery(
    api.admin.getClassSubjectsTeachers,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  const subjects = classSubjectsData ? 
    Array.from(
      new Map(classSubjectsData.map(cs => [cs.subjectId, { _id: cs.subjectId, name: cs.subjectName }])).values()
    ) : [];
  
  const allTests = useQuery(
    api.assignments.getAssignmentsByClass,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  const deleteAssignment = useMutation(api.assignments.deleteAssignment);
  
  const teachers = useQuery(api.admin.listTeachersWithNames, {});
  
  // Current user's teacher record
  const currentTeacherRecord = currentUser && teachers 
    ? teachers.find(t => t.userId === currentUser._id)
    : undefined;

  const isTeacherOrAdmin = currentUser?.roles?.includes("teacher") || 
                           currentUser?.roles?.includes("director") || 
                           currentUser?.roles?.includes("vice_director") ||
                           currentUser?.roles?.includes("system_admin");
  
  const isAdmin = currentUser?.roles?.includes("director") || 
                  currentUser?.roles?.includes("vice_director") ||
                  currentUser?.roles?.includes("system_admin");

  // Check if user can edit a specific test
  // Admins/directors can edit all; teachers can only edit their own
  const canEditTest = (testTeacherId: string): boolean => {
    if (isAdmin) return true;
    if (!currentTeacherRecord) return false;
    return currentTeacherRecord._id === testTeacherId;
  };
  
  // Sort all tests by date (most recent first)
  const sortedTests = allTests?.slice().sort((a, b) => {
    const dateA = a.dueDate || 0;
    const dateB = b.dueDate || 0;
    return dateB - dateA;
  }) || [];

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

  const handleDeleteTest = async () => {
    if (!testToDelete) return;
    try {
      await deleteAssignment({ assignmentId: testToDelete });
      toast.success("Контролната работа е изтрита успешно");
      setDeleteDialogOpen(false);
      setTestToDelete(null);
    } catch (error) {
      console.error(error);
      toast.error("Грешка при изтриване");
    }
  };

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
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-muted-foreground" />
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
                <Link 
                  to={`/bg/admin/user/${classTeacher._id}`}
                  state={{ returnUrl }}
                  className="text-primary hover:underline"
                >
                  {classTeacher.firstName} {classTeacher.lastName} (класен)
                </Link>
              ) : (
                "Без класен ръководител"
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isTeacherOrAdmin && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => navigate(`/bg/diary/class/${classId}/tests/add`)}
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
                stat.link === `/bg/diary/class/${classId}/tests`
                  ? "bg-accent text-accent-foreground"
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
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Контролни работи
            </h2>
            <div className="text-sm text-muted-foreground">
              {sortedTests.length} {sortedTests.length === 1 ? "контролна работа" : "контролни работи"}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left py-3 px-4 text-sm font-medium border">
                    Контролна работа
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium border">
                    Предмет
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium border">
                    Тип
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium border">
                    Дата
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium border">
                    Учител
                  </th>
                  {isTeacherOrAdmin && (
                    <th className="text-center py-3 px-4 text-sm font-medium border w-28">
                      Операции
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedTests.length > 0 ? (
                  sortedTests.map((test) => {
                    const subjectData = subjects?.find(s => s._id === test.subjectId);
                    const teacherInfo = teachers?.find(t => t._id === test.teacherId);
                    const isPast = test.dueDate && test.dueDate <= Date.now();
                    const canEdit = canEditTest(test.teacherId);
                    
                    return (
                      <tr key={test._id} className={cn("border-b hover:bg-muted/50", isPast && "opacity-60")}>
                        <td className="py-3 px-4 border">
                          <div>
                            <div className="font-medium">{test.title}</div>
                            {test.description && (
                              <div className="text-sm text-muted-foreground mt-1">
                                {test.description}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm border">
                          {subjectData?.name || "Неизвестен"}
                        </td>
                        <td className="py-3 px-4 text-sm border">
                          {test.type}
                        </td>
                        <td className="py-3 px-4 text-sm border">
                          {test.dueDate ? new Date(test.dueDate).toLocaleDateString("bg-BG", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          }) : "-"}
                        </td>
                        <td className="py-3 px-4 text-sm border">
                          {teacherInfo?.userId ? (
                            <Link 
                              to={`/bg/admin/user/${teacherInfo.userId}`}
                              state={{ returnUrl }}
                              className="text-primary hover:underline"
                            >
                              {teacherInfo.name || "Неизвестен"}
                            </Link>
                          ) : (
                            <span>{teacherInfo?.name || "Неизвестен"}</span>
                          )}
                        </td>
                        {isTeacherOrAdmin && (
                          <td className="py-3 px-4 text-sm border text-center">
                            <div className="flex items-center justify-center gap-1">
                              {canEdit && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => navigate(`/bg/diary/class/${classId}/tests/edit/${test._id}`)}
                                    title="Редактирай"
                                  >
                                    <PencilIcon className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                    onClick={() => {
                                      setTestToDelete(test._id);
                                      setDeleteDialogOpen(true);
                                    }}
                                    title="Изтрий"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={isTeacherOrAdmin ? 6 : 5} className="py-12 text-center text-muted-foreground">
                      Все още няма контролни работи.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Изтриване на контролна работа</DialogTitle>
            <DialogDescription>
              Сигурни ли сте, че искате да изтриете тази контролна работа? Това действие е необратимо.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>
              Отказ
            </Button>
            <Button variant="destructive" onClick={handleDeleteTest}>
              Изтрий
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ClassTests() {
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
          <ClassTestsInner />
        </DiaryAccessGuard>
      </Authenticated>
    </Layout>
  );
}
