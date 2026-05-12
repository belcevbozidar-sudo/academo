import Layout from "@/components/Layout.tsx";
import { Authenticated, AuthLoading } from "@/lib/convex-preview";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import DataTable, { type DataTableColumn } from "@/components/DataTable.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog.tsx";
import { PencilIcon, Trash2Icon, AlertTriangleIcon } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { useNavigate, useParams, Link } from "react-router-dom";

interface DayRegimeRow {
  _id: Id<"dayRegimes">;
  name: string;
  assignedClassesCount: number;
  exampleClassName: string | null;
  startTime: string;
  endTime: string;
  periodCount: number;
}

function DayRegimesInner() {
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const regimes = useQuery(api.dayRegimes.list, {});
  const removeRegime = useMutation(api.dayRegimes.remove);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [regimeToDelete, setRegimeToDelete] = useState<DayRegimeRow | null>(null);

  // Check permissions - only admin, director, vice_director
  const isAdmin = currentUser?.role === "system_admin" || 
                  currentUser?.role === "director" || 
                  currentUser?.role === "vice_director";

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Нямате права за достъп до тази страница.</p>
      </div>
    );
  }

  if (regimes === undefined) {
    return <Skeleton className="h-96 w-full" />;
  }

  const handleDelete = async () => {
    if (!regimeToDelete) return;
    try {
      await removeRegime({ id: regimeToDelete._id });
      toast.success("Дневният режим е изтрит успешно");
      setDeleteDialogOpen(false);
      setRegimeToDelete(null);
    } catch (error) {
      toast.error("Грешка при изтриване на дневния режим");
    }
  };

  const columns: DataTableColumn<DayRegimeRow>[] = [
    {
      header: "Дневен режим",
      accessorKey: "name",
      cell: (row) => (
        <Link
          to={`/${lng}/admin/day-regimes/edit/${row._id}`}
          className="text-sky-600 hover:text-sky-800 hover:underline dark:text-sky-400 dark:hover:text-sky-300"
        >
          {row.name}
        </Link>
      ),
    },
    {
      header: "Паралелки (бр.)",
      accessorKey: "assignedClassesCount",
    },
    {
      header: "Паралелка",
      accessorKey: "exampleClassName",
      cell: (row) => row.exampleClassName || "-",
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
    {
      header: "Операции",
      accessorKey: "_id",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="icon"
            className="h-8 w-8 bg-sky-500 hover:bg-sky-600"
            onClick={() => navigate(`/${lng}/admin/day-regimes/edit/${row._id}`)}
          >
            <PencilIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setRegimeToDelete(row);
              setDeleteDialogOpen(true);
            }}
          >
            <Trash2Icon className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <span className="text-sky-600">🕐</span> Всички дневни режими
        </h1>
      </div>

      <DataTable
        data={regimes}
        columns={columns}
        searchPlaceholder="Търсене..."
        addButtonLabel="+ Добави"
        onAdd={() => navigate(`/${lng}/admin/day-regimes/add`)}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="h-5 w-5 text-red-500" />
              Изтриване на дневен режим
            </DialogTitle>
            <DialogDescription>
              Сигурни ли сте, че искате да изтриете дневния режим "{regimeToDelete?.name}"?
              Това действие не може да бъде отменено.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Отказ
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Изтрий
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DayRegimes() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
      </AuthLoading>

      <Authenticated>
        <Layout>
          <DayRegimesInner />
        </Layout>
      </Authenticated>
    </>
  );
}
