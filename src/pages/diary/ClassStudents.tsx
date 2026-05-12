import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useState, useMemo } from "react";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { ArrowLeftIcon, FilterIcon, UserIcon, EditIcon, UsersIcon, HeartPulseIcon, AlertTriangleIcon } from "lucide-react";
import { cn, formatFullName } from "@/lib/utils.ts";
import { UserNameLink } from "@/components/ui/user-name-link.tsx";

// Validate if string looks like a valid Convex ID (basic check)
function isValidConvexId(id: string | undefined): boolean {
  if (!id) return false;
  // Convex IDs are typically 32 characters of alphanumeric
  return /^[a-z0-9]{32}$/i.test(id);
}

function ClassStudentsInner() {
  const { classId } = useParams<{ classId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  
  // Validate class ID before making query
  const isValidId = useMemo(() => isValidConvexId(classId), [classId]);
  
  // Build return URL for profile links
  const returnUrl = location.pathname + location.search;

  const classData = useQuery(
    api.admin.getClassById,
    isValidId && classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  const currentUser = useQuery(api.users.getCurrentUser, {});
  
  // Check if current user is a PURE parent (not staff or admin)
  const isCurrentUserParent = currentUser?.roles?.includes("parent") && 
    !currentUser?.roles?.includes("director") && 
    !currentUser?.roles?.includes("vice_director") && 
    !currentUser?.roles?.includes("system_admin") &&
    !currentUser?.roles?.includes("teacher") &&
    !currentUser?.roles?.includes("class_teacher") &&
    !currentUser?.roles?.includes("secretary");
  
  // Get parent's children if user is a parent
  const parentChildren = useQuery(
    api.users.getParentChildren,
    isCurrentUserParent && currentUser ? { userId: currentUser._id } : "skip"
  );

  const allStudents = useQuery(
    api.admin.getStudentsByClass,
    isValidId && classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  // Check if current user is a student
  const isCurrentUserStudent = currentUser?.roles?.includes("student");
  
  // Get current user's student record if they are a student
  const currentUserStudent = allStudents?.find(s => s.userId === currentUser?._id);
  
  // Get IDs of parent's children in this class
  const parentChildrenInClass = parentChildren?.filter(c => c.classId === classId);
  const parentChildStudentIds = parentChildrenInClass?.map(c => c._id) || [];
  
  // Filter students - show only current student if they are a student,
  // show only parent's children if they are a parent, otherwise show all
  const students = isCurrentUserStudent && currentUserStudent
    ? [currentUserStudent]
    : isCurrentUserParent && parentChildStudentIds.length > 0
    ? allStudents?.filter(s => parentChildStudentIds.includes(s._id))
    : allStudents;

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
    { label: "Уч.", link: `/bg/diary/class/${classId}/students`, active: true },
  ];

  // Handle invalid class ID
  if (!isValidId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangleIcon className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Невалиден идентификатор на клас</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Класът, който търсите, не съществува или линкът е грешен.
            </p>
            <Button onClick={() => navigate("/bg")}>
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Към началната страница
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle class not found (valid ID but doesn't exist)
  if (classData === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertTriangleIcon className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Класът не е намерен</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Класът, който търсите, не съществува или е бил изтрит.
            </p>
            <Button onClick={() => navigate("/bg")}>
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Към началната страница
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!classData || !students) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="flex items-center gap-4 px-6 py-3">
          <Link to={`/bg/diary/class/${classId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">
            Ученици - {classData.name}
          </h1>
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <FilterIcon className="h-4 w-4 mr-2" />
              Филтри
            </Button>
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
                stat.active
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
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      #
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Ученик
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Дата на раждане
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Място на раждане
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Родители
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Личен лекар
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, index) => (
                    <tr key={student._id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 text-sm">{index + 1}</td>
                      <td className="py-3 px-4 text-sm">
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4 text-primary" />
                          {/* Only show link if user is not a student viewing their own profile */}
                          {isCurrentUserStudent && student.userId === currentUser?._id ? (
                            <span>{formatFullName(student.name)}</span>
                          ) : (
                            <UserNameLink
                              userId={student.userId}
                              fullName={student.name}
                            />
                          )}
                          {/* Hide edit button for students - they should not edit their own profile */}
                          {!isCurrentUserStudent && (
                            <Link 
                              to={`/bg/admin/user/${student.userId}`}
                              state={{ returnUrl }}
                            >
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <EditIcon className="h-3.5 w-3.5 text-primary" />
                              </Button>
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {student.user?.birthDate 
                          ? new Date(student.user.birthDate).toLocaleDateString("bg-BG")
                          : "-"}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {student.user?.birthPlace || "-"}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {student.parents && student.parents.length > 0 ? (
                          <div className="space-y-1">
                            {student.parents.map((parent) => (
                              <div key={parent._id} className="flex items-center gap-1.5">
                                <UsersIcon className="h-3.5 w-3.5 text-primary" />
                                <UserNameLink
                                  userId={parent._id}
                                  fullName={parent.name}
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          // Fallback to parent1Name/parent2Name if no linked parents
                          student.user?.parent1Name || student.user?.parent2Name ? (
                            <div className="space-y-1">
                              {student.user?.parent1Name && (
                                <div className="flex items-center gap-1.5">
                                  <UsersIcon className="h-3.5 w-3.5 text-primary" />
                                  <span>{student.user.parent1Name}</span>
                                </div>
                              )}
                              {student.user?.parent2Name && (
                                <div className="flex items-center gap-1.5">
                                  <UsersIcon className="h-3.5 w-3.5 text-primary" />
                                  <span>{student.user.parent2Name}</span>
                                </div>
                              )}
                            </div>
                          ) : "-"
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {student.user?.personalDoctor ? (
                          <div className="flex items-center gap-1.5">
                            <HeartPulseIcon className="h-3.5 w-3.5 text-primary" />
                            <span>{student.user.personalDoctor}</span>
                          </div>
                        ) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ClassStudents() {
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
        <ClassStudentsInner />
      </Authenticated>
    </Layout>
  );
}
