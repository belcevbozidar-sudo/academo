import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useState } from "react";
import { Authenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { ArrowLeftIcon, UserIcon, BookOpenIcon, UsersIcon, Users2Icon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";
import { UserNameLink } from "@/components/ui/user-name-link.tsx";
import { toast } from "sonner";

function ClassDetailsInner() {
  const { classId, lng } = useParams<{ classId: string; lng: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"groups" | "basic" | "teachers" | "students">("groups");
  
  const currentUser = useQuery(api.users.getCurrentUser, {});
  
  const classData = useQuery(
    api.admin.getClassById,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  const students = useQuery(
    api.admin.getStudentsByClass,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  // Get the actual subjects and teachers assigned to this class
  const classSubjectsTeachers = useQuery(
    api.admin.getClassSubjectsTeachers,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  // Get class groups
  const classGroups = useQuery(
    api.classGroups.listByClass,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  const removeGroup = useMutation(api.classGroups.remove);

  // Check if user has admin/director/vice_director role
  const isAdminUser = currentUser && (
    currentUser.role === "system_admin" ||
    currentUser.role === "director" ||
    currentUser.role === "vice_director" ||
    currentUser.roles?.includes("system_admin") ||
    currentUser.roles?.includes("director") ||
    currentUser.roles?.includes("vice_director")
  );

  const handleDeleteGroup = async (groupId: Id<"classGroups">) => {
    if (!confirm("Сигурни ли сте, че искате да изтриете тази група?")) return;
    try {
      await removeGroup({ id: groupId });
      toast.success("Групата е изтрита успешно");
    } catch {
      toast.error("Грешка при изтриване");
    }
  };

  const getGroupTypeDisplay = (groupType: string): string => {
    switch (groupType) {
      case "full_class":
        return "Обща";
      case "partial":
        return "Частична";
      case "ifo":
        return "ИФО";
      default:
        return groupType;
    }
  };

  if (!classData || !students) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const classTeacher = classData.classTeacher;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/${lng || 'bg'}/admin/classes`)}>
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Назад
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{classData.name} ({classData.academicYear || "2023 - 2023"})</h1>
            <p className="text-muted-foreground mt-1">
              {classTeacher ? (
                <>
                  <UserNameLink
                    userId={classTeacher._id}
                    firstName={classTeacher.firstName}
                    lastName={classTeacher.lastName}
                  /> (класен ръководител)
                </>
              ) : "Без класен ръководител"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isAdminUser && (
            <Button variant="outline" onClick={() => navigate(`/${lng || 'bg'}/admin/classes/edit/${classId}`)}>
              <PencilIcon className="h-4 w-4 mr-2" />
              Редактирай
            </Button>
          )}
          <Button onClick={() => navigate(`/${lng || 'bg'}/diary/class/${classId}/grades`)}>
            Виж в дневника
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("groups")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "groups"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2">
              <Users2Icon className="h-4 w-4" />
              Групи
              <Badge variant="secondary" className="ml-2">
                {classGroups?.length || 0}
              </Badge>
            </div>
          </button>
          <button
            onClick={() => setActiveTab("basic")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "basic"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2">
              <BookOpenIcon className="h-4 w-4" />
              Основни данни
            </div>
          </button>
          <button
            onClick={() => setActiveTab("teachers")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "teachers"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              Предмети и учители
              <Badge variant="secondary" className="ml-2">
                {classSubjectsTeachers?.length || 0}
              </Badge>
            </div>
          </button>
          <button
            onClick={() => setActiveTab("students")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "students"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4" />
              Ученици
              <Badge variant="secondary" className="ml-2">
                {students?.length || 0}
              </Badge>
            </div>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "basic" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Паралелка</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">
                {classData.name} (
                <Link to={`/bg/diary/class/${classId}/grades`} className="text-primary hover:underline">
                  виж Дневник
                </Link>
                )
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Тип дневник</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{classData.diaryType || "Дневник V – XII клас (3-87)"}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Класен ръководител</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">
                {classTeacher ? (
                  <>
                    <UserIcon className="inline h-4 w-4 mr-2" />
                    <UserNameLink
                      userId={classTeacher._id}
                      firstName={classTeacher.firstName}
                      lastName={classTeacher.lastName}
                    />
                  </>
                ) : (
                  "Не"
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Организационна форма</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">Паралелка</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Форма на обучение</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">—</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Финансира се от</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">—</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Слята паралелка</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">Не</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Специална паралелка/група (за деца със СОП)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">Не</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Вид подготовка</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">Непрофилирана</div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "teachers" && (
        <Card>
          <CardHeader>
            <CardTitle>Предмети и учители</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">№</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Предмет</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Учител</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Вид подготовка</th>
                  </tr>
                </thead>
                <tbody>
                  {classSubjectsTeachers?.map((entry, index) => (
                    <tr key={entry._id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 text-sm">{index + 1}</td>
                      <td className="py-3 px-4 text-sm">
                        <div className="flex items-center gap-2 text-primary">
                          <BookOpenIcon className="h-4 w-4" />
                          {entry.subjectName}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {entry.userId ? (
                          <UserNameLink
                            userId={entry.userId}
                            fullName={entry.teacherName}
                          />
                        ) : entry.teacherName}
                      </td>
                      <td className="py-3 px-4 text-sm">{entry.preparationType}</td>
                    </tr>
                  ))}
                  {(!classSubjectsTeachers || classSubjectsTeachers.length === 0) && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground">
                        Няма добавени предмети
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "students" && (
        <Card>
          <CardHeader>
            <CardTitle>Ученици</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">№</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Ученик</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Родители</th>
                  </tr>
                </thead>
                <tbody>
                  {students?.map((student, index) => (
                    <tr key={student._id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 text-sm">{index + 1}</td>
                      <td className="py-3 px-4 text-sm">
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4 text-primary" />
                          <UserNameLink
                            userId={student.userId}
                            fullName={student.name}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">—</td>
                    </tr>
                  ))}
                  {(!students || students.length === 0) && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-muted-foreground">
                        Няма добавени ученици
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "groups" && (
        <div className="space-y-4">
          {/* Header with add button */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Групи по предмети</h2>
            {isAdminUser && (
              <Button 
                size="sm" 
                onClick={() => navigate(`/${lng || 'bg'}/admin/classes/edit/${classId}?tab=groups`)}
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Добави група
              </Button>
            )}
          </div>

          {/* Groups table */}
          {classGroups && classGroups.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Име</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Тип</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Предмет</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Ученици</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Норматив</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Адрес на обучение</th>
                        {isAdminUser && (
                          <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Действия</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {classGroups.map((group) => (
                        <tr key={group._id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4 text-sm font-medium">{group.name}</td>
                          <td className="py-3 px-4 text-sm">
                            <Badge variant="secondary">
                              {getGroupTypeDisplay(group.groupType)}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-sm">{group.subjectName}</td>
                          <td className="py-3 px-4 text-sm">{group.studentCount}</td>
                          <td className="py-3 px-4 text-sm">{group.normativ || "—"}</td>
                          <td className="py-3 px-4 text-sm">{group.educationAddress || "—"}</td>
                          {isAdminUser && (
                            <td className="py-3 px-4 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteGroup(group._id)}
                              >
                                <Trash2Icon className="h-4 w-4" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Users2Icon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">Няма създадени групи за тази паралелка</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Групите позволяват разделяне на ученици по предмети за различни учители
                </p>
                {isAdminUser && (
                  <Button 
                    size="sm" 
                    onClick={() => navigate(`/${lng || 'bg'}/admin/classes/edit/${classId}?tab=groups`)}
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Добави група
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClassDetails() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
      </AuthLoading>

      <Authenticated>
        <Layout>
          <ClassDetailsInner />
        </Layout>
      </Authenticated>
    </>
  );
}
