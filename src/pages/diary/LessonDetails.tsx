import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader } from "@/components/ui/card.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { ArrowLeftIcon } from "lucide-react";
import { format } from "date-fns";
import { bg } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { formatUserName } from "@/lib/utils.ts";
import { UserNameLink } from "@/components/ui/user-name-link.tsx";

export default function LessonDetails() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { i18n } = useTranslation("common");
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("basic");

  const lessonDetails = useQuery(
    api.lessons.getLessonDetails,
    lessonId ? { lessonId: lessonId as Id<"lessons"> } : "skip"
  );

  // Get current user to check if student
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const isCurrentUserStudent = currentUser && (
    currentUser.role === "student" || currentUser.roles?.includes("student")
  );

  if (lessonDetails === undefined) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  if (!lessonDetails) {
    return (
      <Layout>
        <div className="text-center text-muted-foreground">
          Занятието не е намерено
        </div>
      </Layout>
    );
  }

  const { lesson, class: classDoc, subject, students, teacher, teacherUser, allTeacherUsers } = lessonDetails;

  // Handle back navigation - go back to previous page (supports both diary and inspection)
  const handleGoBack = () => {
    // Use browser history to go back to the exact page the user came from
    // This preserves state like selected date and period in Inspection page
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      // Fallback: go to class grades page
      navigate(`/${i18n.language}/diary/class/${classDoc._id}/grades`);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleGoBack}
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Занятие #{lessonId?.slice(-5)}</h1>
              <p className="text-sm text-muted-foreground">
                {format(new Date(lesson.date), "dd.MM.yyyy", { locale: bg })}
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader className="border-b">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full justify-start h-auto flex-wrap">
                <TabsTrigger value="basic">Основни данни</TabsTrigger>
                <TabsTrigger value="students">
                  Ученици <span className="ml-1 text-xs">({students.length})</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsContent value="basic" className="space-y-4 mt-0">
                <div className="grid gap-4">
                  <div className="grid grid-cols-[180px_1fr] gap-4 items-center border-b pb-2">
                    <div className="font-medium text-muted-foreground">Паралелка:</div>
                    <div>
                      {isCurrentUserStudent ? (
                        classDoc.name
                      ) : (
                        <Link
                          to={`/${i18n.language}/admin/classes/${classDoc._id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {classDoc.name}
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-[180px_1fr] gap-4 items-center border-b pb-2">
                    <div className="font-medium text-muted-foreground">Предмет:</div>
                    <div>
                      {isCurrentUserStudent ? (
                        subject.name
                      ) : (
                        <Link
                          to={`/${i18n.language}/admin/subjects/${subject._id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {subject.name}
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-[180px_1fr] gap-4 items-center border-b pb-2">
                    <div className="font-medium text-muted-foreground">Учител:</div>
                    <div className="space-y-1">
                      {allTeacherUsers && allTeacherUsers.length > 0 ? (
                        allTeacherUsers.map((tu) => (
                          <div key={tu._id}>
                            <UserNameLink
                              userId={tu._id}
                              firstName={tu.firstName}
                              middleName={tu.middleName}
                              lastName={tu.lastName}
                            />
                          </div>
                        ))
                      ) : teacherUser ? (
                        <UserNameLink
                          userId={teacherUser._id}
                          firstName={teacherUser.firstName}
                          middleName={teacherUser.middleName}
                          lastName={teacherUser.lastName}
                        />
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-[180px_1fr] gap-4 items-center border-b pb-2">
                    <div className="font-medium text-muted-foreground">Група:</div>
                    <div>
                      {lessonDetails.groupInfo ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                            {lessonDetails.groupInfo.name}
                          </span>
                          <span className="text-muted-foreground">
                            — {lessonDetails.groupInfo.studentCount} ученици
                          </span>
                        </span>
                      ) : (
                        `Обща група за цялата паралелка - ${students.length} ученици`
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-[180px_1fr] gap-4 items-center border-b pb-2">
                    <div className="font-medium text-muted-foreground">Дата и час на провеждане:</div>
                    <div>
                      {format(new Date(lesson.date), "dd.MM.yyyy", { locale: bg })} / {lesson.periodIndex} час
                    </div>
                  </div>

                  <div className="grid grid-cols-[180px_1fr] gap-4 items-center border-b pb-2">
                    <div className="font-medium text-muted-foreground">Вид обучение:</div>
                    <div>
                      {lesson.isTaken ? (
                        lesson.educationType === "inPerson"
                          ? "Присъствено обучение"
                          : lesson.educationType === "online"
                          ? "Дистанционно обучение"
                          : "Самостоятелна работа"
                      ) : "—"}
                    </div>
                  </div>

                  <div className="grid grid-cols-[180px_1fr] gap-4 items-center border-b pb-2">
                    <div className="font-medium text-muted-foreground">Маркиран като взет:</div>
                    <div>{lesson.isTaken ? "Да" : "Не"}</div>
                  </div>

                  <div className="grid grid-cols-[180px_1fr] gap-4 items-center border-b pb-2">
                    <div className="font-medium text-muted-foreground">Създаден на:</div>
                    <div>
                      {format(new Date(lesson._creationTime), "dd.MM.yyyy HH:mm:ss", { locale: bg })}
                    </div>
                  </div>

                  {lesson.topic && (
                    <div className="grid grid-cols-[180px_1fr] gap-4 items-start border-b pb-2">
                      <div className="font-medium text-muted-foreground">Тема:</div>
                      <div>{lesson.topic}</div>
                    </div>
                  )}

                  {lesson.homework && (
                    <div className="grid grid-cols-[180px_1fr] gap-4 items-start border-b pb-2">
                      <div className="font-medium text-muted-foreground">Домашна работа:</div>
                      <div>{lesson.homework}</div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="students" className="space-y-4 mt-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border border-border bg-muted p-2 text-sm font-medium text-left">Ученик</th>
                        <th className="border border-border bg-muted p-2 text-sm font-medium text-left">Отсъствие</th>
                        <th className="border border-border bg-muted p-2 text-sm font-medium text-left">Оценка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((studentData, idx) => (
                        <tr key={studentData.student._id}>
                          <td className="border border-border p-2 text-sm">
                            {idx + 1}{" "}
                            <UserNameLink
                              userId={studentData.user._id}
                              firstName={studentData.user.firstName}
                              middleName={studentData.user.middleName}
                              lastName={studentData.user.lastName}
                            />
                          </td>
                          <td className="border border-border p-2 text-sm">
                            {studentData.attendance
                              ? studentData.attendance.status === "present"
                                ? ""
                                : studentData.attendance.status === "absent"
                                ? "Отсъствие"
                                : studentData.attendance.status === "late"
                                ? "Закъснение"
                                : "Извинено"
                              : ""}
                          </td>
                          <td className="border border-border p-2 text-sm">
                            {studentData.grades.map((grade) => (
                              <span key={grade._id} className="mr-2">
                                {grade.value}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
