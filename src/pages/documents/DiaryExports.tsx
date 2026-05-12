import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import { AlertCircle, Download, Lock, Unlock, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import DataTable, { type DataTableColumn } from "@/components/DataTable.tsx";
import type { Doc } from "@/convex/_generated/dataModel";

type DiaryExportRow = Doc<"classDiaryExports"> & {
  className: string;
  classTeacherName: string;
};

function DiaryExportsInner() {
  const exports = useQuery(api.diaryExports.list, {});
  const uploadToNEISPUO = useMutation(api.diaryExports.uploadToNEISPUO);
  const unlock = useMutation(api.diaryExports.unlock);
  const remove = useMutation(api.diaryExports.remove);

  if (exports === undefined) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const handleUploadToNEISPUO = async (id: Id<"classDiaryExports">) => {
    try {
      await uploadToNEISPUO({ id });
      toast.success("Дневникът е маркиран като качен в НЕИСПУО и заключен");
    } catch (error) {
      const err = error as Error;
      toast.error(`Грешка: ${err.message}`);
    }
  };

  const handleUnlock = async (id: Id<"classDiaryExports">) => {
    try {
      await unlock({ id });
      toast.success("Дневникът е отключен успешно");
    } catch (error) {
      const err = error as Error;
      toast.error(`Грешка: ${err.message}`);
    }
  };

  const handleDelete = async (id: Id<"classDiaryExports">) => {
    if (!window.confirm("Сигурни ли сте, че искате да изтриете този дневник?")) {
      return;
    }

    try {
      await remove({ id });
      toast.success("Дневникът е изтрит успешно");
    } catch (error) {
      const err = error as Error;
      toast.error(`Грешка: ${err.message}`);
    }
  };

  const handleDownloadAll = () => {
    toast.info("Функцията за изтегляне на всички дневници ще бъде добавена скоро");
  };

  const columns: DataTableColumn<DiaryExportRow>[] = [
    {
      header: "Клас",
      accessorKey: "className",
      cell: (row) => <div className="font-medium">{row.className}</div>,
    },
    {
      header: "Класен ръководител",
      accessorKey: "classTeacherName",
      cell: (row) => row.classTeacherName,
    },
    {
      header: "Дата на генериране",
      accessorKey: "generatedAt",
      cell: (row) => new Date(row.generatedAt).toLocaleDateString("bg-BG"),
    },
    {
      header: "Статус",
      accessorKey: "locked",
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.locked ? (
            <span className="inline-flex items-center gap-1 text-sm text-red-600">
              <Lock className="h-4 w-4" />
              Заключен
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm text-green-600">
              <Unlock className="h-4 w-4" />
              Отключен
            </span>
          )}
          {row.uploadedToNEISPUO && (
            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
              Качен в НЕИСПУО
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Действия",
      accessorKey: "_id",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              toast.info("Функцията за изтегляне ще бъде добавена скоро");
            }}
          >
            <Download className="h-4 w-4 mr-1" />
            Изтегли
          </Button>
          {!row.locked && !row.uploadedToNEISPUO && (
            <Button
              size="sm"
              variant="default"
              onClick={() => handleUploadToNEISPUO(row._id)}
            >
              <FileText className="h-4 w-4 mr-1" />
              Качи в НЕИСПУО
            </Button>
          )}
          {row.locked && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleUnlock(row._id)}
            >
              <Unlock className="h-4 w-4 mr-1" />
              Отключи
            </Button>
          )}
          {!row.locked && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleDelete(row._id)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Изтрий
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Дневници в училище
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Генериране, експорт и заключване при качване към НЕИСПУО
            </p>
          </div>
          <Button onClick={handleDownloadAll}>
            <Download className="h-4 w-4 mr-2" />
            Изтегли всички
          </Button>
        </div>

        <Alert variant="default" className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertDescription className="text-yellow-800 dark:text-yellow-300">
            <strong>Внимание:</strong> След качване към НЕИСПУО дневникът ще бъде автоматично заключен. 
            Само администраторите могат да отключат заключени дневници.
          </AlertDescription>
        </Alert>

        <DataTable
          data={exports}
          columns={columns}
          searchPlaceholder="Търсене в дневниците..."
        />
      </div>
    </Layout>
  );
}

export default function DiaryExports() {
  return (
    <>
      <Unauthenticated>
        <Layout>
          <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-4">
            <p className="text-muted-foreground">
              Моля, влезте в акаунта си, за да видите дневниците.
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
        <DiaryExportsInner />
      </Authenticated>
    </>
  );
}
