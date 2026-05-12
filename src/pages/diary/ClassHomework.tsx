import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import { DiaryAccessGuard } from "@/components/DiaryAccessGuard.tsx";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils.ts";
import { ChevronLeft, BookOpen, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog.tsx";
import type { Id } from "@/convex/_generated/dataModel";

function ClassHomeworkInner() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [homeworkToDelete, setHomeworkToDelete] = useState<Id<"homework"> | null>(null);

  // Get current user and check permissions
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const classData = useQuery(
    api.admin.getClassById,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  // Get subjects with homework count
  const subjectsWithCount = useQuery(
    api.homework.getSubjectsWithHomeworkCount,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  // Get homework for selected subject
  const homeworkForSubject = useQuery(
    api.homework.getHomeworkByClassAndSubject,
    classId && selectedSubjectId 
      ? { 
          classId: classId as Id<"classes">, 
          subjectId: selectedSubjectId as Id<"subjects"> 
        } 
      : "skip"
  );

  const deleteHomework = useMutation(api.homework.deleteHomework);

  // Check permissions
  const isAdmin = currentUser?.roles?.includes("system_admin") || currentUser?.roles?.includes("director") || currentUser?.roles?.includes("vice_director");
  const isClassTeacher = classData?.classTeacherId === currentUser?._id;
  const isTeacher = currentUser?.roles?.includes("teacher");
  const canEdit = isAdmin || isClassTeacher || isTeacher;

  const handleDeleteConfirm = async () => {
    if (!homeworkToDelete) return;
    try {
      await deleteHomework({ id: homeworkToDelete });
      toast.success("Домашната работа е изтрита");
      setDeleteDialogOpen(false);
      setHomeworkToDelete(null);
    } catch {
      toast.error("Грешка при изтриване");
    }
  };

  // Get selected subject data
  const selectedSubject = subjectsWithCount?.find(s => s.subject._id === selectedSubjectId);

  // Navigation stats
  const stats = [
    { label: "Оц.", href: `/bg/diary/class/${classId}/grades` },
    { label: "Отс.", href: `/bg/diary/class/${classId}/absences` },
    { label: "Отз.", href: `/bg/diary/class/${classId}/reviews` },
    { label: "Раз.", href: `/bg/diary/class/${classId}/schedule` },
    { label: "Тем.", href: `/bg/diary/class/${classId}/topics` },
    { label: "Кон.", href: `/bg/diary/class/${classId}/tests` },
    { label: "Дом.", href: `/bg/diary/class/${classId}/homework`, active: true },
    { label: "ВЧК", href: `/bg/diary/class/${classId}/internal-commission` },
    { label: "Род.", href: `/bg/diary/class/${classId}/parent-meetings` },
    { label: "Поп.", href: `/bg/diary/class/${classId}/remedial-exams` },
    { label: "Под.", href: `/bg/diary/class/${classId}/student-support` },
    { label: "Сан.", href: `/bg/diary/class/${classId}/sanctions` },
    { label: "Год.", href: `/bg/diary/class/${classId}/annual-results` },
    { label: "Уч.", href: `/bg/diary/class/${classId}/students` },
  ];

  if (!classData || !subjectsWithCount) {
    return (
      <Layout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/bg/diary/class/${classId}`)}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Назад
            </Button>
            <h1 className="text-2xl font-bold">Домашни работи - {classData.name}</h1>
          </div>
        </div>

        {/* Navigation tabs */}
        <div className="flex flex-wrap gap-2 border-b pb-4">
          {stats.map((stat) => (
            <Link key={stat.label} to={stat.href}>
              <Button
                variant={stat.active ? "default" : "ghost"}
                size="sm"
                className={stat.active ? "bg-primary" : ""}
              >
                {stat.label}
              </Button>
            </Link>
          ))}
        </div>

        {/* Main content - Two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left sidebar - Subjects list */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Предмети</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {subjectsWithCount.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">
                      Няма налични предмети
                    </div>
                  ) : (
                    subjectsWithCount.map((item) => (
                      <button
                        key={item.subject._id}
                        onClick={() => setSelectedSubjectId(item.subject._id)}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors",
                          selectedSubjectId === item.subject._id && "bg-blue-50 dark:bg-blue-950/30 border-l-4 border-l-blue-500"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{item.subject.name}</span>
                        </div>
                        {item.count > 0 && (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                            {item.count}
                          </Badge>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right content - Homework table */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="py-3 border-b">
                <CardTitle className="text-lg">
                  {selectedSubject ? (
                    <>
                      {selectedSubject.subject.name}
                      {selectedSubject.preparationType && (
                        <span className="text-muted-foreground ml-2">
                          ({selectedSubject.preparationType})
                        </span>
                      )}
                    </>
                  ) : (
                    "Изберете предмет"
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!selectedSubjectId ? (
                  <div className="p-8">
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <BookOpen />
                        </EmptyMedia>
                        <EmptyTitle>Изберете предмет</EmptyTitle>
                        <EmptyDescription>
                          Изберете предмет от списъка вляво, за да видите домашните работи
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </div>
                ) : homeworkForSubject === undefined ? (
                  <div className="p-6">
                    <Skeleton className="h-40 w-full" />
                  </div>
                ) : homeworkForSubject.length === 0 ? (
                  <div className="p-8">
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <BookOpen />
                        </EmptyMedia>
                        <EmptyTitle>Няма домашни работи</EmptyTitle>
                        <EmptyDescription>
                          Все още няма добавени домашни работи по този предмет.
                          Домашни се добавят през "Моят час".
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left py-3 px-4 font-semibold text-sm w-12">№</th>
                          <th className="text-left py-3 px-4 font-semibold text-sm w-32">Дата</th>
                          <th className="text-left py-3 px-4 font-semibold text-sm">Домашна работа</th>
                          <th className="text-left py-3 px-4 font-semibold text-sm w-32">Срок</th>
                          {canEdit && (
                            <th className="text-right py-3 px-4 font-semibold text-sm w-20">Действия</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {homeworkForSubject.map((hw, index) => {
                          const assignedDate = new Date(hw.assignedDate);
                          const dueDate = new Date(hw.dueDate);
                          const formattedAssignedDate = `${assignedDate.getUTCDate().toString().padStart(2, '0')}.${(assignedDate.getUTCMonth() + 1).toString().padStart(2, '0')}.${assignedDate.getUTCFullYear()}`;
                          const formattedDueDate = `${dueDate.getUTCDate().toString().padStart(2, '0')}.${(dueDate.getUTCMonth() + 1).toString().padStart(2, '0')}.${dueDate.getUTCFullYear()}`;
                          const isOverdue = dueDate < new Date();

                          return (
                            <tr key={hw._id} className="border-t hover:bg-muted/30">
                              <td className="py-3 px-4 text-sm font-medium">{index + 1}</td>
                              <td className="py-3 px-4 text-sm">{formattedAssignedDate}</td>
                              <td className="py-3 px-4 text-sm">{hw.title}</td>
                              <td className="py-3 px-4">
                                <span className={cn(
                                  "text-sm",
                                  isOverdue ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                                )}>
                                  {formattedDueDate}
                                </span>
                              </td>
                              {canEdit && (
                                <td className="py-3 px-4 text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setHomeworkToDelete(hw._id);
                                      setDeleteDialogOpen(true);
                                    }}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Изтриване на домашна работа</DialogTitle>
            <DialogDescription>
              Сигурни ли сте, че искате да изтриете тази домашна работа? Това действие е необратимо.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Отказ
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Изтрий
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

export default function ClassHomework() {
  return (
    <>
      <Unauthenticated>
        <Layout>
          <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-4">
            <p className="text-muted-foreground">Моля, влезте в акаунта си.</p>
            <SignInButton />
          </div>
        </Layout>
      </Unauthenticated>
      <AuthLoading>
        <Layout>
          <div className="p-6">
            <Skeleton className="h-96 w-full" />
          </div>
        </Layout>
      </AuthLoading>
      <Authenticated>
        <DiaryAccessGuard>
          <ClassHomeworkInner />
        </DiaryAccessGuard>
      </Authenticated>
    </>
  );
}
