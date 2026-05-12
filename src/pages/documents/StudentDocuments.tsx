import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import DataTable from "@/components/DataTable.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import { InfoIcon, PlusIcon, SettingsIcon, UploadIcon, TrashIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { bg } from "date-fns/locale";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

function StudentDocumentsInner() {
  const documents = useQuery(api.studentDocuments.list, {});
  const removeDocument = useMutation(api.studentDocuments.remove);
  const exportForNEISPUO = useMutation(api.studentDocuments.exportForNEISPUO);

  if (documents === undefined) {
    return (
      <Layout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  const handleDelete = async (id: Id<"studentDocuments">) => {
    try {
      await removeDocument({ id });
      toast.success("Документът е изтрит успешно");
    } catch (error) {
      toast.error("Грешка при изтриване на документа");
    }
  };

  const handleExportForNEISPUO = async () => {
    toast.info("Експорт за НЕИСПУО - функцията ще бъде добавена скоро");
  };

  const columns = [
    {
      header: "Документ",
      accessorKey: "type",
      sortable: true,
    },
    {
      header: "Ученик",
      accessorKey: "studentName",
      sortable: true,
    },
    {
      header: "Клас",
      accessorKey: "className",
      sortable: true,
    },
    {
      header: "Издаден от",
      accessorKey: "issuedByName",
      sortable: true,
    },
    {
      header: "Последна редакция",
      accessorKey: "lastEditedDate",
      sortable: true,
      cell: (row: { lastEditedDate?: number }) =>
        row.lastEditedDate
          ? format(new Date(row.lastEditedDate), "dd.MM.yyyy HH:mm", { locale: bg })
          : "-",
    },
    {
      header: "Добавен от",
      accessorKey: "createdByName",
      sortable: true,
    },
    {
      header: "Операции",
      accessorKey: "actions",
      cell: (row: { _id: Id<"studentDocuments"> }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleDelete(row._id)}
        >
          <TrashIcon className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">
            Ученически документи
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <SettingsIcon className="mr-2 h-4 w-4" />
              Стойности по подразбиране
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportForNEISPUO}
            >
              <UploadIcon className="mr-2 h-4 w-4" />
              Експорт за НЕИСПУО
            </Button>
            <Button size="sm">
              <PlusIcon className="mr-2 h-4 w-4" />
              Добави
            </Button>
          </div>
        </div>

        {/* Alert Rule */}
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            <strong>Правило:</strong> Документи от минали години могат да се
            преглеждат, но не могат да се редактират или изтриват.
          </AlertDescription>
        </Alert>

        {/* Data Table */}
        <DataTable
          data={documents}
          columns={columns}
          searchPlaceholder="Търси документи..."
        />
      </div>
    </Layout>
  );
}

export default function StudentDocuments() {
  return (
    <>
      <Unauthenticated>
        <Layout>
          <div className="flex h-96 items-center justify-center">
            <p className="text-muted-foreground">
              Моля, влезте в системата за да видите ученическите документи.
            </p>
          </div>
        </Layout>
      </Unauthenticated>
      <AuthLoading>
        <Layout>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </Layout>
      </AuthLoading>
      <Authenticated>
        <StudentDocumentsInner />
      </Authenticated>
    </>
  );
}
