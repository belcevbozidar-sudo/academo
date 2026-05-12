import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useState } from "react";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { 
  UserIcon, 
  ArrowLeftIcon,
  Plus,
  Trash2Icon,
  PencilIcon,
  HeartHandshakeIcon,
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
import { toast } from "sonner";
import { UserNameLink } from "@/components/ui/user-name-link.tsx";
import { format } from "date-fns";
import { bg } from "date-fns/locale";

function StudentSupportInner() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const classData = useQuery(
    api.admin.getClassById,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  const currentUser = useQuery(api.users.getCurrentUser, {});
  
  const supportRecords = useQuery(
    api.studentSupport.getStudentSupportByClass,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  const deleteSupport = useMutation(api.studentSupport.deleteStudentSupport);
  
  // Check if current user is a student or PURE parent (not staff)
  const isCurrentUserStudent = currentUser?.roles?.includes("student");
  const isCurrentUserParent = currentUser?.roles?.includes("parent") && 
    !currentUser?.roles?.includes("director") && 
    !currentUser?.roles?.includes("vice_director") && 
    !currentUser?.roles?.includes("system_admin") &&
    !currentUser?.roles?.includes("teacher") &&
    !currentUser?.roles?.includes("class_teacher") &&
    !currentUser?.roles?.includes("secretary");
  
  const canEdit = !isCurrentUserStudent && !isCurrentUserParent;
  
  // Check if current user is admin (can see class details link)
  const isAdmin = currentUser?.roles?.includes("director") || 
                  currentUser?.roles?.includes("vice_director") ||
                  currentUser?.roles?.includes("system_admin");

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
      await deleteSupport({ id: recordId as Id<"studentSupport"> });
      toast.success("Записът е изтрит успешно");
    } catch (error) {
      toast.error("Грешка при изтриване");
      console.error(error);
    }
  };

  const getStatusLabel = (s: string) => {
    switch (s) {
      case "active": return "Активна";
      case "completed": return "Приключена";
      case "cancelled": return "Отменена";
      default: return s;
    }
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case "active": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "completed": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "cancelled": return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
      default: return "";
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
          <div className="flex items-center gap-4">
            <Link to={`/bg/diary/class/${classId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Назад
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <HeartHandshakeIcon className="h-5 w-5 text-muted-foreground" />
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
                onClick={() => navigate(`/bg/diary/class/${classId}/student-support/add`)}
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
                stat.link === `/bg/diary/class/${classId}/student-support`
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
            <HeartHandshakeIcon className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Ученическа подкрепа</h2>
          </div>

          {supportRecords && supportRecords.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">№</TableHead>
                    <TableHead className="font-semibold">Ученик</TableHead>
                    <TableHead className="font-semibold">Основание</TableHead>
                    <TableHead className="font-semibold">Дейност</TableHead>
                    <TableHead className="font-semibold">Предмет</TableHead>
                    <TableHead className="font-semibold">Дата</TableHead>
                    <TableHead className="font-semibold">Учител</TableHead>
                    <TableHead className="font-semibold text-center">Статус</TableHead>
                    {canEdit && <TableHead className="font-semibold text-center">Действия</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supportRecords.map((record, index) => (
                    <TableRow key={record._id} className="hover:bg-muted/50">
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4 text-primary" />
                          {record.studentName}
                        </div>
                      </TableCell>
                      <TableCell>{record.reason || "-"}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={record.activity || record.supportType}>
                        {record.activity || record.supportType || "-"}
                      </TableCell>
                      <TableCell>{record.subjectName || "-"}</TableCell>
                      <TableCell>
                        {format(new Date(record.date || record.startDate || record.createdAt), "dd.MM.yyyy", { locale: bg })}
                      </TableCell>
                      <TableCell>{record.teacherName || "-"}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          getStatusColor(record.status)
                        )}>
                          {getStatusLabel(record.status)}
                        </span>
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => navigate(`/bg/diary/class/${classId}/student-support/add?edit=${record._id}`)}
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
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border rounded-lg">
              <HeartHandshakeIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Няма добавени записи за ученическа подкрепа</p>
              {canEdit && (
                <Button
                  variant="default"
                  size="sm"
                  className="mt-4"
                  onClick={() => navigate(`/bg/diary/class/${classId}/student-support/add`)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Добави първи запис
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function StudentSupportPage() {
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
        <StudentSupportInner />
      </Authenticated>
    </Layout>
  );
}
