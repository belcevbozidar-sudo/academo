import { Authenticated, Unauthenticated, AuthLoading, useQuery } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { api } from "@/convex/_generated/api.js";
import {
  Calendar,
  Users,
  User,
  Star,
  GraduationCap,
  BookOpen,
  ArrowLeft,
  Clock,
  CreditCard,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

// Category colors
function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    "Бойни изкуства": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    "Информационни Технологии": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    "Култура": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    "Музика": "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
    "Образование и наука": "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
    "Разни": "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
    "Спорт": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    "Танци": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    "Туризъм": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
    "Чужди езици": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  };
  return colors[category] || "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
}

// Day names in Bulgarian
const DAY_NAMES = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

// Activity Detail Page (Full Screen)
function ActivityDetailPage({ activityId }: { activityId: Id<"extracurricularActivities"> }) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const activity = useQuery(api.extracurricular.getActivityById, { id: activityId });

  if (activity === undefined) {
    return (
      <div className="p-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Дейността не е намерена.</p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => navigate(`/${i18n.language}/extracurricular/my-activities`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад към списъка
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/${i18n.language}/extracurricular/my-activities`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад
        </Button>
      </div>

      {/* Activity Title */}
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-primary" />
          {activity.name}
        </h1>
        {activity.category && (
          <Badge className={`mt-2 ${getCategoryColor(activity.category)}`}>
            <Star className="h-3 w-3 mr-1" />
            {activity.category}
          </Badge>
        )}
      </div>

      {/* Activity Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Детайли за дейността</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Description */}
          {activity.description && (
            <div>
              <h3 className="font-medium text-muted-foreground mb-2">Описание</h3>
              <p className="whitespace-pre-wrap">{activity.description}</p>
            </div>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Teacher */}
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Учител</p>
                <p className="font-medium">{activity.teacherName}</p>
              </div>
            </div>

            {/* Period */}
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Период</p>
                <p className="font-medium">
                  {activity.startDate && activity.endDate
                    ? `${new Date(activity.startDate).toLocaleDateString("bg-BG")} - ${new Date(activity.endDate).toLocaleDateString("bg-BG")}`
                    : "—"}
                </p>
              </div>
            </div>

            {/* Enrolled Students */}
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Записани участници</p>
                <p className="font-medium">
                  {activity.totalParticipants} ({activity.studentCount} уч. + {activity.parentCount} род.)
                </p>
              </div>
            </div>

            {/* Payment */}
            <div className="flex items-start gap-3">
              <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Заплащане</p>
                <p className="font-medium">
                  {activity.paymentType === "free" ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      Безплатно
                    </Badge>
                  ) : activity.paymentType === "paid" ? (
                    <span>
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        Платено
                      </Badge>
                      {activity.pricePerWeek && (
                        <span className="ml-2">
                          {activity.pricePerWeek} € / {activity.pricePeriod === "weekly" ? "седмица" : "месец"} за дете
                        </span>
                      )}
                    </span>
                  ) : "—"}
                </p>
              </div>
            </div>

            {/* Schedule */}
            {activity.scheduleDays && activity.scheduleDays.length > 0 && (
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">График</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {activity.scheduleDays.map((day) => (
                      <Badge key={day} variant="secondary" className="text-xs">
                        {DAY_NAMES[day]}
                      </Badge>
                    ))}
                    {activity.scheduleStartTime && activity.scheduleEndTime && (
                      <span className="ml-2 text-sm">
                        {activity.scheduleStartTime} - {activity.scheduleEndTime}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Classes */}
            {activity.classNames && activity.classNames.length > 0 && (
              <div className="flex items-start gap-3">
                <GraduationCap className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Класове</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {activity.classNames.map((name) => (
                      <Badge key={name} variant="secondary">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Participants Section */}
      {((activity.enrolledStudents && activity.enrolledStudents.length > 0) ||
        (activity.enrolledParents && activity.enrolledParents.length > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Участници ({activity.totalParticipants})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Students */}
            {activity.enrolledStudents && activity.enrolledStudents.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <GraduationCap className="h-4 w-4" />
                  Ученици ({activity.studentCount})
                </p>
                <div className="flex flex-wrap gap-2">
                  {activity.enrolledStudents.filter((s): s is NonNullable<typeof s> => s !== null).map((student) => (
                    <Badge key={student._id} variant="secondary">
                      {student.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Parents */}
            {activity.enrolledParents && activity.enrolledParents.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <User className="h-4 w-4" />
                  Родители ({activity.parentCount})
                </p>
                <div className="flex flex-wrap gap-2">
                  {activity.enrolledParents.filter((p): p is NonNullable<typeof p> => p !== null).map((parent) => (
                    <Badge key={parent._id} variant="outline" className="bg-blue-50 dark:bg-blue-950/30">
                      {parent.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Activities List Page
function ActivitiesListPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const activities = useQuery(api.extracurricular.listMyActivities, {});

  if (currentUser === undefined || activities === undefined) {
    return (
      <div className="p-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Check if user has any activities
  const hasActivities = activities.length > 0;

  // Separate activities by role
  const teacherActivities = activities.filter(a => a.isTeacher);
  const studentActivities = activities.filter(a => !a.isTeacher);

  const handleActivityClick = (activityId: Id<"extracurricularActivities">) => {
    navigate(`/${i18n.language}/extracurricular/my-activities/${activityId}`);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-primary" />
          Мои дейности
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Извънкласни дейности, в които участвам
        </p>
      </div>

      {!hasActivities ? (
        <Card>
          <CardContent className="p-8 text-center">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Все още не сте записан/а в никоя извънкласна дейност.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Teacher Activities Section */}
          {teacherActivities.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <User className="h-5 w-5" />
                Дейности, които водя
              </h2>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Заглавие</TableHead>
                      <TableHead>Начало</TableHead>
                      <TableHead>Край</TableHead>
                      <TableHead>Категория</TableHead>
                      <TableHead>Записани</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teacherActivities.map((activity) => (
                      <TableRow key={activity._id}>
                        <TableCell>
                          <button
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                            onClick={() => handleActivityClick(activity._id)}
                          >
                            {activity.name}
                          </button>
                        </TableCell>
                        <TableCell>
                          {activity.startDate
                            ? new Date(activity.startDate).toLocaleDateString("bg-BG")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {activity.endDate
                            ? new Date(activity.endDate).toLocaleDateString("bg-BG")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {activity.category ? (
                            <Badge className={getCategoryColor(activity.category)}>
                              <Star className="h-3 w-3 mr-1" />
                              {activity.category}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            <Users className="h-3 w-3 mr-1" />
                            {activity.totalParticipants}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Student Activities Section */}
          {studentActivities.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Дейности, в които участвам
              </h2>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Заглавие</TableHead>
                      <TableHead>Начало</TableHead>
                      <TableHead>Край</TableHead>
                      <TableHead>Категория</TableHead>
                      <TableHead>Учител</TableHead>
                      <TableHead>Участници</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentActivities.map((activity) => (
                      <TableRow key={activity._id}>
                        <TableCell>
                          <button
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                            onClick={() => handleActivityClick(activity._id)}
                          >
                            {activity.name}
                          </button>
                        </TableCell>
                        <TableCell>
                          {activity.startDate
                            ? new Date(activity.startDate).toLocaleDateString("bg-BG")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {activity.endDate
                            ? new Date(activity.endDate).toLocaleDateString("bg-BG")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {activity.category ? (
                            <Badge className={getCategoryColor(activity.category)}>
                              <Star className="h-3 w-3 mr-1" />
                              {activity.category}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell>{activity.teacherName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            <Users className="h-3 w-3 mr-1" />
                            {activity.totalParticipants}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MyActivitiesInner() {
  const { id } = useParams<{ id?: string }>();

  // If we have an ID, show the detail page
  if (id) {
    return <ActivityDetailPage activityId={id as Id<"extracurricularActivities">} />;
  }

  // Otherwise show the list
  return <ActivitiesListPage />;
}

export default function MyActivities() {
  return (
    <Layout>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-4">
          <p className="text-muted-foreground">
            Моля, влезте в акаунта си, за да видите извънкласните дейности.
          </p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="p-6">
          <Skeleton className="h-96 w-full" />
        </div>
      </AuthLoading>
      <Authenticated>
        <MyActivitiesInner />
      </Authenticated>
    </Layout>
  );
}
