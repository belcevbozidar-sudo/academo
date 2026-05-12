import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import DataTable from "@/components/DataTable.tsx";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";

function AllEventsInner() {
  const events = useQuery(api.events.listEventsWithStats, {});

  if (events === undefined) {
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
      header: "Събитие",
      accessorKey: "title",
      cell: (row: { title: string }) => (
        <div className="font-medium">{row.title}</div>
      ),
    },
    {
      header: "Паралелка",
      accessorKey: "classNames",
      cell: (row: { classNames: string[] }) => {
        if (row.classNames.length === 0) return "—";
        if (row.classNames.length === 1) return row.classNames[0];
        return `${row.classNames[0]} +${row.classNames.length - 1}`;
      },
    },
    {
      header: "Създадено от",
      accessorKey: "organizerName",
    },
    {
      header: "Начало",
      accessorKey: "startDate",
      cell: (row: { startDate: number }) =>
        new Date(row.startDate).toLocaleDateString("bg-BG", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
    },
    {
      header: "Категория",
      accessorKey: "category",
      cell: (row: { category: string }) => (
        <Badge variant="secondary">{row.category}</Badge>
      ),
    },
    {
      header: "Видяно",
      accessorKey: "seenCount",
      cell: (row: { seenCount: number }) => (
        <div className="text-center">{row.seenCount}</div>
      ),
    },
    {
      header: "Потвърдено",
      accessorKey: "confirmedCount",
      cell: (row: { confirmedCount: number; seenCount: number }) => (
        <div className="flex items-center gap-2">
          <span>{row.confirmedCount}</span>
          {row.confirmedCount > 0 && row.confirmedCount === row.seenCount && (
            <Badge variant="default" className="text-xs">
              100%
            </Badge>
          )}
        </div>
      ),
    },
  ];

  const data = events.map((event) => ({
    id: event._id,
    title: event.title,
    classNames: event.classNames,
    organizerName: event.organizerName,
    startDate: event.startDate,
    category: event.category,
    seenCount: event.seenCount,
    confirmedCount: event.confirmedCount,
  }));

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Всички събития
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Преглед на събития с видяно и потвърдено статус
          </p>
        </div>

        <Alert
          variant="default"
          className="border-amber-200 bg-amber-50 dark:bg-amber-950/20"
        >
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            <strong>Правило:</strong> Не може да добавяте и редактирате събития
            от предходни години.
          </AlertDescription>
        </Alert>

        <DataTable
          columns={columns}
          data={data}
          searchPlaceholder="Търсене по събитие..."
        />
      </div>
    </Layout>
  );
}

export default function AllEventsPage() {
  return (
    <>
      <Unauthenticated>
        <Layout>
          <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-4">
            <p className="text-muted-foreground">
              Моля, влезте в акаунта си, за да видите събитията.
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
        <AllEventsInner />
      </Authenticated>
    </>
  );
}
