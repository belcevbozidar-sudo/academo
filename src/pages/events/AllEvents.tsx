import Layout from "@/components/Layout.tsx";
import { Authenticated, AuthLoading } from "@/lib/convex-preview";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import DataTable, { type DataTableColumn } from "@/components/DataTable.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useNavigate, useParams } from "react-router-dom";
import { PlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";

interface EventRow {
  _id: string;
  title: string;
  startDate: number;
  endDate?: number;
  location?: string;
  organizerName?: string;
  category: string;
  classNames?: string[];
  type?: "event" | "assignment" | "parentMeeting";
  subjectName?: string;
}

function EventsInner() {
  const navigate = useNavigate();
  const { lng } = useParams();
  const events = useQuery(api.events.listEventsWithStats, {
    includeAssignments: true,
    includeParentMeetings: true,
  });
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const deleteEvent = useMutation(api.events.deleteEvent);

  const [deleteId, setDeleteId] = useState<Id<"events"> | null>(null);

  // Check if current user is admin/director/vice_director
  const isAdminRole =
    currentUser &&
    (currentUser.role === "director" ||
      currentUser.role === "vice_director" ||
      currentUser.role === "system_admin" ||
      currentUser.roles?.includes("director") ||
      currentUser.roles?.includes("vice_director") ||
      currentUser.roles?.includes("system_admin"));

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteEvent({ id: deleteId });
      toast.success("Събитието е изтрито успешно");
    } catch {
      toast.error("Грешка при изтриване");
    } finally {
      setDeleteId(null);
    }
  };

  if (events === undefined || currentUser === undefined) {
    return <Skeleton className="h-96 w-full" />;
  }

  const columns: DataTableColumn<EventRow>[] = [
    {
      header: "Заглавие",
      accessorKey: "title",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.title}</span>
          {row.type === "assignment" && (
            <Badge variant="secondary" className="text-xs">
              Контролна
            </Badge>
          )}
          {row.type === "parentMeeting" && (
            <Badge variant="default" className="text-xs bg-purple-600">
              Род. среща
            </Badge>
          )}
        </div>
      ),
    },
    {
      header: "Дата",
      accessorKey: "startDate",
      cell: (row) =>
        new Date(row.startDate).toLocaleDateString("bg-BG", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
    },
    {
      header: "Паралелка",
      accessorKey: "classNames",
      cell: (row) => row.classNames?.join(", ") || "—",
    },
    {
      header: "Предмет",
      accessorKey: "subjectName",
      cell: (row) => row.subjectName || "—",
    },
    {
      header: "Организатор",
      accessorKey: "organizerName",
      cell: (row) => row.organizerName || "—",
    },
    {
      header: "Категория",
      accessorKey: "category",
    },
  ];

  // Add actions column for admin roles
  if (isAdminRole) {
    columns.push({
      header: "Действия",
      accessorKey: "_id",
      cell: (row) => {
        // Only show actions for event type (not assignments or parent meetings)
        if (row.type !== "event") return null;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/${lng}/events/edit/${row._id}`);
              }}
            >
              <PencilIcon className="h-4 w-4 text-primary" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteId(row._id as Id<"events">);
              }}
            >
              <Trash2Icon className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Всички събития
          </h1>
          <p className="text-muted-foreground mt-2">
            Управление на училищни събития, контролни работи и родителски срещи
          </p>
        </div>
        {isAdminRole && (
          <Button onClick={() => navigate(`/${lng}/events/add`)}>
            <PlusIcon className="h-4 w-4 mr-1" />
            Добави събитие
          </Button>
        )}
      </div>

      <DataTable
        data={events}
        columns={columns}
        searchPlaceholder="Търси събития..."
      />

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Изтриване на събитие</AlertDialogTitle>
            <AlertDialogDescription>
              Сигурни ли сте, че искате да изтриете това събитие? Действието е
              необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отказ</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Изтрий
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AllEvents() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
      </AuthLoading>

      <Authenticated>
        <Layout>
          <EventsInner />
        </Layout>
      </Authenticated>
    </>
  );
}
