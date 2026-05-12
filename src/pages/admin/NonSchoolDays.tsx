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
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface NonSchoolDayRow {
  _id: string;
  name: string;
  startDate: number;
  endDate: number;
  category: string;
  classNames: string;
}

function NonSchoolDaysInner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const days = useQuery(api.nonSchoolDays.listNonSchoolDays, {});
  const deleteDay = useMutation(api.nonSchoolDays.deleteNonSchoolDay);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dayToDelete, setDayToDelete] = useState<NonSchoolDayRow | null>(null);

  // Check permissions - only admin, director, vice_director can edit/delete
  const isAdmin = currentUser?.role === "system_admin" || 
                  currentUser?.role === "director" || 
                  currentUser?.role === "vice_director";

  if (days === undefined) {
    return <Skeleton className="h-96 w-full" />;
  }

  const handleDelete = async () => {
    if (!dayToDelete) return;
    try {
      await deleteDay({ id: dayToDelete._id as Id<"nonSchoolDays"> });
      toast.success("Събитието е изтрито успешно");
      setDeleteDialogOpen(false);
      setDayToDelete(null);
    } catch (error) {
      toast.error("Грешка при изтриване на събитието");
    }
  };

  const columns: DataTableColumn<NonSchoolDayRow>[] = [
    {
      header: t("nonSchoolDays.table.event"),
      accessorKey: "name",
    },
    {
      header: t("nonSchoolDays.table.start"),
      accessorKey: "startDate",
      cell: (row) =>
        new Date(row.startDate).toLocaleDateString("bg-BG", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }),
    },
    {
      header: t("nonSchoolDays.table.end"),
      accessorKey: "endDate",
      cell: (row) =>
        new Date(row.endDate).toLocaleDateString("bg-BG", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }),
    },
    {
      header: t("nonSchoolDays.table.category"),
      accessorKey: "category",
    },
    {
      header: t("nonSchoolDays.table.classes"),
      accessorKey: "classNames",
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
            onClick={() => navigate(`/${lng}/admin/non-school-days/edit/${row._id}`)}
          >
            <PencilIcon className="h-4 w-4" />
          </Button>
          {isAdmin && (
            <Button
              variant="destructive"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setDayToDelete(row);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2Icon className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("nonSchoolDays.title")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("nonSchoolDays.description")}
        </p>
      </div>

      <DataTable
        data={days}
        columns={columns}
        searchPlaceholder={t("nonSchoolDays.searchPlaceholder")}
        addButtonLabel={t("nonSchoolDays.addButton")}
        onAdd={() => navigate(`/${lng}/admin/non-school-days/add`)}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="h-5 w-5 text-red-500" />
              Изтриване на събитие
            </DialogTitle>
            <DialogDescription>
              Сигурни ли сте, че искате да изтриете събитието "{dayToDelete?.name}"?
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

export default function NonSchoolDays() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
      </AuthLoading>

      <Authenticated>
        <Layout>
          <NonSchoolDaysInner />
        </Layout>
      </Authenticated>
    </>
  );
}
