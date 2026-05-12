import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useState } from "react";
import { Authenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { ArrowLeftIcon, UserIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";
import { cn } from "@/lib/utils.ts";

function SubjectDetailsInner() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"basic" | "teachers">("basic");
  
  const subject = useQuery(
    api.admin.getSubjectById,
    subjectId ? { subjectId: subjectId as Id<"subjects"> } : "skip"
  );

  const teachers = useQuery(api.admin.listTeachersWithNames, {});
  
  // Filter teachers who teach this subject
  const subjectTeachers = teachers?.filter((teacher) =>
    teacher.subjectIds?.includes(subjectId as Id<"subjects">)
  );

  if (!subject) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/bg/admin/subjects")}>
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Назад
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{subject.name}</h1>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("basic")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "basic"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Основни данни
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
              Учители
              <Badge variant="secondary" className="ml-2">
                {subjectTeachers?.length || 0}
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Име</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{subject.name}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Съкратено име</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{subject.shortName || "—"}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Група</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">{subject.group || "—"}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "teachers" && (
        <Card>
          <CardHeader>
            <CardTitle>Учители</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">№</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Учител</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Паралелки</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectTeachers?.map((teacher, index) => (
                    <tr key={teacher._id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 text-sm">{index + 1}</td>
                      <td className="py-3 px-4 text-sm">
                        <Link 
                          to={`/bg/admin/user/${teacher.userId}`}
                          className="text-primary hover:underline flex items-center gap-2"
                        >
                          <UserIcon className="h-4 w-4" />
                          {teacher.name}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-sm">—</td>
                    </tr>
                  ))}
                  {(!subjectTeachers || subjectTeachers.length === 0) && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-muted-foreground">
                        Няма преподаватели на този предмет
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function SubjectDetails() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
      </AuthLoading>

      <Authenticated>
        <Layout>
          <SubjectDetailsInner />
        </Layout>
      </Authenticated>
    </>
  );
}
