import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import DataTable from "@/components/DataTable.tsx";
import { Plus, AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import AddWeeklySchedule from "./AddWeeklySchedule.tsx";
import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";

function WeeklySchedulesInner() {
  const schedules = useQuery(api.weeklySchedules.list, {});
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  
  // Check if user is admin
  const isAdmin = currentUser?.roles?.includes("director") ||
                  currentUser?.roles?.includes("vice_director") ||
                  currentUser?.roles?.includes("system_admin") ||
                  currentUser?.role === "director" ||
                  currentUser?.role === "vice_director" ||
                  currentUser?.role === "system_admin";

  if (schedules === undefined || currentUser === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  
  // Only admins can access this page
  if (!isAdmin) {
    return (
      <Layout>
        <div className="p-6 flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <AlertTriangleIcon className="h-16 w-16 text-destructive" />
          <h1 className="text-2xl font-bold">Нямате достъп</h1>
          <p className="text-muted-foreground text-center">
            Само директори, зам.-директори и системни администратори могат да управляват разписанията.
          </p>
        </div>
      </Layout>
    );
  }

  const columns = [
    {
      header: "Паралелка",
      accessorKey: "className",
    },
    {
      header: "Тип",
      accessorKey: "classType",
    },
    {
      header: "Срок",
      accessorKey: "termNumber",
      cell: (row: { termNumber: number }) => `Срок ${row.termNumber}`,
    },
    {
      header: "Разписания",
      accessorKey: "scheduleCount",
    },
    {
      header: "Седмици",
      accessorKey: "weekCount",
    },
    {
      header: "Дневен режим",
      accessorKey: "dayRegimeName",
      cell: (row: { dayRegimeName: string | null }) =>
        row.dayRegimeName ?? "—",
    },
  ];

  const data = schedules.map((schedule) => ({
    id: schedule._id,
    className: schedule.className,
    classType: schedule.classType,
    termNumber: schedule.termNumber,
    scheduleCount: schedule.scheduleCount,
    weekCount: schedule.weekCount,
    dayRegimeName: schedule.dayRegimeName,
  }));

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Всички седмични разписания
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Управление на седмични разписания по паралелка и срок
            </p>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Добави
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={data}
          searchPlaceholder="Търсене по паралелка..."
        />
      </div>

      <AddWeeklySchedule
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={() => setAddDialogOpen(false)}
      />
    </Layout>
  );
}

export default function WeeklySchedules() {
  return (
    <>
      <Unauthenticated>
        <Layout>
          <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-4">
            <p className="text-muted-foreground">
              Моля, влезте в акаунта си, за да видите седмичните разписания.
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
        <WeeklySchedulesInner />
      </Authenticated>
    </>
  );
}
