import { useParams } from "react-router-dom";
import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import { SignInButton } from "@/components/ui/signin.tsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useState } from "react";
import { cn } from "@/lib/utils.ts";
import { BarChartIcon, TrendingUpIcon, FrownIcon, AlertCircleIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table.tsx";

type Tab = "grades" | "absences" | "reviews";
type Period = "1m" | "3m" | "6m" | "1y";

function StudentStatisticsInner({ userId }: { userId: Id<"users"> }) {
  const [activeTab, setActiveTab] = useState<Tab>("grades");
  const [period, setPeriod] = useState<Period>("1y");

  // Get user data
  const user = useQuery(api.users.getUserById, { userId });
  
  // Get student record
  const students = useQuery(api.admin.listStudents, {});
  const studentRecord = students?.find((s: { userId: Id<"users"> }) => s.userId === userId);
  
  // Get class data
  const classes = useQuery(api.admin.listClasses, {});
  const studentClass = classes?.find(c => c._id === studentRecord?.classId);

  // Get real statistics from backend
  const stats = useQuery(
    api.statistics.getStudentStats,
    studentRecord ? { studentId: studentRecord._id, period } : "skip"
  );

  const fullName = [user?.firstName, user?.middleName, user?.lastName].filter(Boolean).join(" ");

  if (!user || !studentRecord) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Grade count data from real stats
  const gradeCountData = stats ? [
    { name: "Отл 6", value: stats.gradeDistribution.grade6 },
    { name: "Мн добър 5", value: stats.gradeDistribution.grade5 },
    { name: "Добър 4", value: stats.gradeDistribution.grade4 },
    { name: "Сред 3", value: stats.gradeDistribution.grade3 },
    { name: "Слаб 2", value: stats.gradeDistribution.grade2 },
  ] : [];

  // Period selector component
  const PeriodSelector = ({ currentPeriod, color }: { currentPeriod: Period; color: string }) => (
    <div className="flex gap-2">
      {(["1m", "3m", "6m", "1y"] as const).map((p) => (
        <button
          key={p}
          onClick={() => setPeriod(p)}
          className={cn(
            "px-3 py-1 text-sm rounded transition-colors",
            currentPeriod === p
              ? `bg-${color}-600 text-white`
              : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
          )}
          style={currentPeriod === p ? { backgroundColor: color === "blue" ? "#2563eb" : color === "red" ? "#dc2626" : "#9333ea" } : {}}
        >
          {p}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChartIcon className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Статистики - {fullName}</h1>
          {studentClass && (
            <p className="text-muted-foreground">Клас: {studentClass.name}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("grades")}
          className={cn(
            "px-6 py-3 font-medium transition-colors border-b-2",
            activeTab === "grades"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          Оценки
        </button>
        <button
          onClick={() => setActiveTab("absences")}
          className={cn(
            "px-6 py-3 font-medium transition-colors border-b-2",
            activeTab === "absences"
              ? "border-red-600 text-red-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          Отсъствия
        </button>
        <button
          onClick={() => setActiveTab("reviews")}
          className={cn(
            "px-6 py-3 font-medium transition-colors border-b-2",
            activeTab === "reviews"
              ? "border-purple-600 text-purple-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          Забележки
        </button>
      </div>

      {/* Loading state */}
      {stats === undefined && (
        <div className="flex items-center justify-center py-12">
          <Skeleton className="h-96 w-full" />
        </div>
      )}

      {/* GRADES TAB */}
      {stats && activeTab === "grades" && (
        <div className="space-y-6">
          {/* КЛАСАЦИЯ Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUpIcon className="h-6 w-6" />
              <h2 className="text-2xl font-bold text-blue-600">КЛАСАЦИЯ</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-center text-sm font-medium text-muted-foreground">
                    МЯСТО В ПАРАЛЕЛКАТА
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-5xl font-bold text-blue-600">
                      {stats.rankInClass}/{stats.totalInClass}
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">
                      *Подредени по най-висок успех
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-center text-sm font-medium text-muted-foreground">
                    СРЕДЕН УСПЕХ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-5xl font-bold text-blue-600">{stats.averageGrade.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground mt-2">
                      За избрания период
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-center text-sm font-medium text-muted-foreground">
                    НАЙ-ВИСОКА ОЦЕНКА
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-5xl font-bold text-blue-600">{stats.highestGrade.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground mt-2">
                      За избрания период
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* СРЕДЕН УСПЕХ Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-bold text-blue-600">СРЕДЕН УСПЕХ ПО МЕСЕЦИ</CardTitle>
                <PeriodSelector currentPeriod={period} color="blue" />
              </div>
            </CardHeader>
            <CardContent>
              {stats.averageGradeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.averageGradeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 6]} />
                    <Tooltip formatter={(value: number) => value.toFixed(2)} />
                    <Bar dataKey="value" fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground">
                  <AlertCircleIcon className="h-5 w-5 mr-2" />
                  Няма данни за избрания период
                </div>
              )}
            </CardContent>
          </Card>

          {/* ОБЩ БРОЙ ОЦЕНКИ Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-bold text-blue-600">РАЗПРЕДЕЛЕНИЕ НА ОЦЕНКИТЕ</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {stats.totalGrades > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={gradeCountData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value">
                        {gradeCountData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={
                            entry.name.startsWith("Отл") ? "#10b981" :
                            entry.name.startsWith("Мн") ? "#3b82f6" :
                            entry.name.startsWith("Добър") ? "#f59e0b" :
                            entry.name.startsWith("Сред") ? "#ef4444" :
                            "#991b1b"
                          } />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="text-center mt-4">
                    <span className="text-sm text-muted-foreground">
                      Общ брой оценки: {stats.totalGrades}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground">
                  <AlertCircleIcon className="h-5 w-5 mr-2" />
                  Няма оценки за избрания период
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ABSENCES TAB */}
      {stats && activeTab === "absences" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-center text-sm font-medium text-muted-foreground">
                  ОБЩО ОТСЪСТВИЯ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-5xl font-bold text-red-600">{stats.totalAbsences}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-center text-sm font-medium text-muted-foreground">
                  ИЗВИНЕНИ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-5xl font-bold text-green-600">{stats.excusedAbsences}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-center text-sm font-medium text-muted-foreground">
                  НЕИЗВИНЕНИ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-5xl font-bold text-red-600">{stats.unexcusedAbsences}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-center text-sm font-medium text-muted-foreground">
                  ЗАКЪСНЕНИЯ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-5xl font-bold text-amber-600">{stats.lateCount}</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ОБЩ БРОЙ ОТСЪСТВИЯ Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-bold text-red-600">ОТСЪСТВИЯ ПО МЕСЕЦИ</CardTitle>
                <PeriodSelector currentPeriod={period} color="red" />
              </div>
            </CardHeader>
            <CardContent>
              {stats.absenceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.absenceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#dc2626" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground">
                  <AlertCircleIcon className="h-5 w-5 mr-2" />
                  Няма отсъствия за избрания период
                </div>
              )}
            </CardContent>
          </Card>

          {/* НАЙ-МНОГО ОТСЪСТВИЯ Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-red-600">НАЙ-МНОГО ОТСЪСТВИЯ ПО ПРЕДМЕТ</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.mostAbsencesData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.mostAbsencesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#dc2626" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground">
                  <AlertCircleIcon className="h-5 w-5 mr-2" />
                  Няма данни за отсъствия по предмет
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* REVIEWS TAB */}
      {stats && activeTab === "reviews" && (
        <div className="space-y-6">
          {/* Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-center text-sm font-medium text-muted-foreground">
                ОБЩО ЗАБЕЛЕЖКИ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-5xl font-bold text-red-600">{stats.totalRemarks}</div>
              </div>
            </CardContent>
          </Card>

          {/* ЗАБЕЛЕЖКИ Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FrownIcon className="h-6 w-6 text-red-600" />
                <CardTitle className="text-2xl font-bold text-red-600">ЗАБЕЛЕЖКИ ПО ТИП</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {stats.remarksData.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Тип</TableHead>
                      <TableHead className="text-right">Брой</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.remarksData.map((remark, index) => (
                      <TableRow key={index}>
                        <TableCell>{remark.badge}</TableCell>
                        <TableCell className="text-right font-medium">{remark.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground">
                  <AlertCircleIcon className="h-5 w-5 mr-2" />
                  Няма забележки за избрания период
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function StudentStatisticsPage() {
  const { userId } = useParams<{ userId: string }>();

  return (
    <Layout>
      <Authenticated>
        {userId ? (
          <StudentStatisticsInner userId={userId as Id<"users">} />
        ) : (
          <div className="flex h-96 items-center justify-center">
            <p>Invalid user ID</p>
          </div>
        )}
      </Authenticated>
      <Unauthenticated>
        <div className="flex h-96 flex-col items-center justify-center gap-4">
          <p>Моля влезте, за да видите статистиките</p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="flex h-96 items-center justify-center">
          <Skeleton className="h-96 w-full" />
        </div>
      </AuthLoading>
    </Layout>
  );
}
