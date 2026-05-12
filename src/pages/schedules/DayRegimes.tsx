import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import DataTable from "@/components/DataTable.tsx";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";

function DayRegimesInner() {
  const dayRegimes = useQuery(api.dayRegimes.list, {});

  if (dayRegimes === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const columns = [
    {
      header: "Дневен режим",
      accessorKey: "name",
    },
    {
      header: "Паралелки",
      accessorKey: "assignedClassesCount",
    },
    {
      header: "Паралелка",
      accessorKey: "exampleClassName",
    },
    {
      header: "Начало",
      accessorKey: "startTime",
    },
    {
      header: "Край",
      accessorKey: "endTime",
    },
    {
      header: "Брой часове",
      accessorKey: "periodCount",
    },
  ];

  const data = dayRegimes.map((regime) => ({
    id: regime._id,
    name: regime.name,
    assignedClassesCount: regime.assignedClassesCount,
    exampleClassName: regime.exampleClassName ?? "—",
    startTime: regime.startTime,
    endTime: regime.endTime,
    periodCount: regime.periodCount,
  }));

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Всички дневни режими
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Управление на дневните режими и обвързването им към паралелки
          </p>
        </div>

        <Alert variant="default" className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            <strong>Правило:</strong> Не може да добавяте и редактирате дневни
            режими от предходни години.
          </AlertDescription>
        </Alert>

        <DataTable
          columns={columns}
          data={data}
          searchPlaceholder="Търсене по име на режим..."
        />
      </div>
    </Layout>
  );
}

export default function DayRegimes() {
  return (
    <>
      <Unauthenticated>
        <Layout>
          <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-4">
            <p className="text-muted-foreground">
              Моля, влезте в акаунта си, за да видите дневните режими.
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
        <DayRegimesInner />
      </Authenticated>
    </>
  );
}
