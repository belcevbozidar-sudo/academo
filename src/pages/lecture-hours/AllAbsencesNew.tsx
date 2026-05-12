import { useState } from "react";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import DataTable from "@/components/DataTable.tsx";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { useIsMobile } from "@/hooks/use-mobile.ts";
import { cn } from "@/lib/utils.ts";

function AllAbsencesNewInner() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const absences = useQuery(api.teacherAbsences.getAllAbsences, {});
  const deleteAbsence = useMutation(api.teacherAbsences.deleteAbsence);

  const handleDelete = async (absenceId: Id<"absences">) => {
    if (!confirm("Сигурни ли сте, че искате да изтриете това отсъствие?")) return;
    
    try {
      await deleteAbsence({ absenceId });
      toast.success("Отсъствието е изтрито успешно");
    } catch (error) {
      toast.error("Грешка при изтриване на отсъствието");
    }
  };

  const columns = [
    { 
      header: "Заглавие", 
      accessorKey: "title",
      cell: (row: { title: string; _id: string }) => (
        <button
          onClick={() => navigate(`/bg/lecture-hours/absence-schedule/${row._id}`)}
          className={cn(
            "text-blue-600 hover:text-blue-800 hover:underline font-medium text-left",
            isMobile && "text-xs"
          )}
        >
          {row.title}
        </button>
      ),
    },
    { 
      header: "Отсъстващ", 
      accessorKey: "absentTeacher",
      cell: (row: { absentTeacher: string; teacherUserId?: string }) => (
        <button
          onClick={() => row.teacherUserId && navigate(`/bg/admin/user/${row.teacherUserId}`)}
          className={cn(
            "text-blue-600 hover:text-blue-800 hover:underline",
            isMobile && "text-xs"
          )}
        >
          {row.absentTeacher}
        </button>
      ),
    },
    { header: "Период", accessorKey: "period" },
    { header: "Заместници", accessorKey: "substitutes" },
    { header: "Причина", accessorKey: "reason" },
    {
      header: "Операции",
      accessorKey: "_id",
      cell: (row: { _id: string }) => (
        <Button
          variant="destructive"
          size={isMobile ? "sm" : "default"}
          onClick={() => handleDelete(row._id as Id<"absences">)}
        >
          <X className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <Layout>
      <div className={cn("space-y-4", isMobile ? "p-3" : "p-6")}>
        <Card>
          <CardHeader className={cn(
            "flex flex-row items-center justify-between flex-wrap gap-3",
            isMobile && "p-3"
          )}>
            <CardTitle className={cn(isMobile && "text-base")}>
              Всички учителски отсъствия
            </CardTitle>
            <Button 
              className="bg-teal-500 hover:bg-teal-600"
              onClick={() => navigate("/bg/lecture-hours/add-absence")}
              size={isMobile ? "sm" : "default"}
            >
              Добави +
            </Button>
          </CardHeader>
          <CardContent className={cn(isMobile && "p-3")}>
            <DataTable
              data={absences || []}
              columns={columns}
              compact
            />
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default function AllAbsencesNew() {
  return (
    <>
      <Unauthenticated>
        <Layout>
          <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <p className="text-muted-foreground">Моля, влезте в профила си</p>
            <SignInButton />
          </div>
        </Layout>
      </Unauthenticated>
      <AuthLoading>
        <Layout>
          <div className="flex items-center justify-center min-h-screen">
            <Skeleton className="h-96 w-full max-w-md" />
          </div>
        </Layout>
      </AuthLoading>
      <Authenticated>
        <AllAbsencesNewInner />
      </Authenticated>
    </>
  );
}
