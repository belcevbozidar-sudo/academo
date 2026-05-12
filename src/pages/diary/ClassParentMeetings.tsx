import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import { DiaryAccessGuard } from "@/components/DiaryAccessGuard.tsx";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { 
  UserIcon, 
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";

function ClassParentMeetingsInner() {
  const { classId, lng } = useParams<{ classId: string; lng: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Build return URL for profile links
  const returnUrl = location.pathname + location.search;

  const currentUser = useQuery(api.users.getCurrentUser, {});

  const classData = useQuery(
    api.admin.getClassById,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  const meetings = useQuery(
    api.parentMeetings.listByClass,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  const deleteMeeting = useMutation(api.parentMeetings.remove);

  // Check if user can add meetings (admin, director, vice_director, class teacher)
  const isClassTeacher = classData?.classTeacherId === currentUser?._id;
  const isAdmin = currentUser?.roles?.includes("director") || 
                  currentUser?.roles?.includes("vice_director") ||
                  currentUser?.roles?.includes("system_admin") ||
                  currentUser?.role === "director" ||
                  currentUser?.role === "vice_director" ||
                  currentUser?.role === "system_admin";
  const canManage = isAdmin || isClassTeacher;

  const stats = [
    { label: "Оц.", link: `/${lng || "bg"}/diary/class/${classId}/grades` },
    { label: "Отс.", link: `/${lng || "bg"}/diary/class/${classId}/absences` },
    { label: "Отз.", link: `/${lng || "bg"}/diary/class/${classId}/reviews` },
    { label: "Раз.", link: `/${lng || "bg"}/diary/class/${classId}/schedule` },
    { label: "Тем.", link: `/${lng || "bg"}/diary/class/${classId}/topics` },
    { label: "Кон.", link: `/${lng || "bg"}/diary/class/${classId}/tests` },
    { label: "Дом.", link: `/${lng || "bg"}/diary/class/${classId}/homework` },
    { label: "ВЧК", link: `/${lng || "bg"}/diary/class/${classId}/internal-commission` },
    { label: "Род.", link: `/${lng || "bg"}/diary/class/${classId}/parent-meetings` },
    { label: "Поп.", link: `/${lng || "bg"}/diary/class/${classId}/remedial-exams` },
    { label: "Под.", link: `/${lng || "bg"}/diary/class/${classId}/student-support` },
    { label: "Сан.", link: `/${lng || "bg"}/diary/class/${classId}/sanctions` },
    { label: "Год.", link: `/${lng || "bg"}/diary/class/${classId}/annual-results` },
    { label: "Уч.", link: `/${lng || "bg"}/diary/class/${classId}/students` },
  ];

  const handleDeleteMeeting = async (id: Id<"parentMeetings">) => {
    if (!confirm("Сигурни ли сте, че искате да изтриете тази родителска среща?")) {
      return;
    }

    try {
      await deleteMeeting({ id });
      toast.success("Родителската среща е изтрита успешно");
    } catch (error) {
      toast.error("Възникна грешка при изтриването");
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
                  to={`/${lng || "bg"}/admin/classes/${classId}`}
                  className="text-primary hover:underline"
                >
                  {classData.name}
                </Link>
              ) : (
                classData.name
              )} -{" "}
              {classTeacher ? (
                <Link 
                  to={`/${lng || "bg"}/admin/user/${classTeacher._id}`}
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
            {canManage && (
              <Button 
                variant="default" 
                size="sm"
                onClick={() => navigate(`/${lng || "bg"}/diary/class/${classId}/parent-meetings/add`)}
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
                stat.link === `/${lng || "bg"}/diary/class/${classId}/parent-meetings`
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
        <Card>
          <CardContent className="p-6">
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Родителска среща
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Начало
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Край
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Добавена от
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Добавена на
                    </th>
                    {canManage && (
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Операции
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {!meetings || meetings.length === 0 ? (
                    <tr>
                      <td colSpan={canManage ? 6 : 5} className="py-8 text-center text-muted-foreground">
                        Все още не са въведени родителски срещи.
                      </td>
                    </tr>
                  ) : (
                    meetings.map((meeting) => {
                      const startDateObj = new Date(meeting.startDate);
                      const endDateObj = new Date(meeting.endDate);
                      const createdAtDate = new Date(meeting.createdAt);

                      return (
                        <tr key={meeting._id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4">
                            <div>
                              <div className="font-medium">{meeting.title}</div>
                              {meeting.location && (
                                <div className="text-sm text-muted-foreground">
                                  {meeting.location}
                                </div>
                              )}
                              {meeting.description && (
                                <div className="text-sm text-muted-foreground mt-1">
                                  {meeting.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm">
                            <div>{startDateObj.toLocaleDateString("bg-BG")}</div>
                            <div className="text-muted-foreground">
                              {startDateObj.toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm">
                            <div>{endDateObj.toLocaleDateString("bg-BG")}</div>
                            <div className="text-muted-foreground">
                              {endDateObj.toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {meeting.createdByName}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {createdAtDate.toLocaleDateString("bg-BG")}
                          </td>
                          {canManage && (
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigate(`/${lng || "bg"}/diary/class/${classId}/parent-meetings/edit/${meeting._id}`)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteMeeting(meeting._id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ClassParentMeetings() {
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
          <ClassParentMeetingsInner />
        </DiaryAccessGuard>
      </Authenticated>
    </Layout>
  );
}
