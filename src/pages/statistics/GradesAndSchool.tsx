import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, Award, BarChart3 } from "lucide-react";

function StatisticsInner() {
  const [period, setPeriod] = useState<"1m" | "3m" | "6m" | "1y">("3m");

  const schoolStats = useQuery(api.statistics.getSchoolStats, { period });
  const gradeStats = useQuery(api.statistics.getGradeStats, { period });

  if (schoolStats === undefined || gradeStats === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Статистики → Оценки и Училище
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              KPI и графики с филтри и периоди
            </p>
          </div>
          <Select
            value={period}
            onValueChange={(value) =>
              setPeriod(value as "1m" | "3m" | "6m" | "1y")
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Период" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1m">1 месец</SelectItem>
              <SelectItem value="3m">3 месеца</SelectItem>
              <SelectItem value="6m">6 месеца</SelectItem>
              <SelectItem value="1y">1 година</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Отлични паралелки
              </CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {schoolStats.excellentClassesCount}
              </div>
              <p className="text-xs text-muted-foreground">
                Среден успех {'>'} 5.50
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Най-висок успех
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {schoolStats.highestAverage.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                {schoolStats.topClasses[0]?.className ?? "—"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Най-много оценки
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {schoolStats.totalGradesCount}
              </div>
              <p className="text-xs text-muted-foreground">
                Среден успех: {schoolStats.averageGrade.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Top Classes */}
        <Card>
          <CardHeader>
            <CardTitle>Топ 5 паралелки по успех</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {schoolStats.topClasses.map((cls, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">
                      {index + 1}
                    </div>
                    <span className="font-medium">{cls.className}</span>
                  </div>
                  <span className="text-lg font-bold">
                    {cls.average.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Weekly New Grades Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Нови оценки (по седмици)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={gradeStats.weeklyNewGrades}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="week"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString("bg-BG", {
                      month: "short",
                      day: "numeric",
                    })
                  }
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) =>
                    new Date(value as string).toLocaleDateString("bg-BG")
                  }
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#8884d8"
                  name="Брой оценки"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Average by Subject Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Среден успех по предмети</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={gradeStats.averageBySubject.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="subjectName"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis domain={[2, 6]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="average" fill="#82ca9d" name="Среден успех" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Average Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Тренд на среден успех (месечно)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={gradeStats.averageTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tickFormatter={(value) => {
                    const [year, month] = value.split("-");
                    return `${month}/${year.slice(2)}`;
                  }}
                />
                <YAxis domain={[2, 6]} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="average"
                  stroke="#ff7300"
                  name="Среден успех"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default function Statistics() {
  return (
    <>
      <Unauthenticated>
        <Layout>
          <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-4">
            <p className="text-muted-foreground">
              Моля, влезте в акаунта си, за да видите статистиките.
            </p>
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
        <StatisticsInner />
      </Authenticated>
    </>
  );
}
