import Layout from "@/components/Layout.tsx";
import { Authenticated, AuthLoading } from "@/lib/convex-preview";
import { useQuery, useMutation } from "@/lib/convex-preview";
import React from "react";
import { api } from "@/convex/_generated/api.js";
import DataTable, { type DataTableColumn } from "@/components/DataTable.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { PlusIcon, PencilIcon, TrashIcon } from "lucide-react";
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
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { useNavigate, useParams } from "react-router-dom";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useTranslation } from "react-i18next";

interface SubjectRow {
  _id: string;
  name: string;
  shortName: string;
  group?: string;
  isPrimary: boolean;
  teacherCount: number;
  classCount: number;
}

function SubjectsInner() {
  const { t } = useTranslation();
  const subjects = useQuery(api.admin.listSubjects, {});
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [subjectToDelete, setSubjectToDelete] = React.useState<Id<"subjects"> | null>(null);
  const deleteSubject = useMutation(api.admin.deleteSubject);

  if (subjects === undefined) {
    return <Skeleton className="h-96 w-full" />;
  }

  const handleEditSubject = (subjectId: Id<"subjects">) => {
    navigate(`/${lng}/admin/subjects/edit/${subjectId}`);
  };

  const handleDeleteClick = (subjectId: Id<"subjects">) => {
    setSubjectToDelete(subjectId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!subjectToDelete) return;
    
    try {
      await deleteSubject({ id: subjectToDelete });
      toast.success(t("subjects.toast.deleteSuccess"));
      setDeleteDialogOpen(false);
      setSubjectToDelete(null);
    } catch (error) {
      toast.error(t("subjects.toast.deleteError"));
      console.error(error);
    }
  };

  const columns: DataTableColumn<SubjectRow>[] = [
    {
      header: t("subjects.table.subject"),
      accessorKey: "name",
      cell: (row) => (
        <button
          onClick={() => navigate(`/${lng}/admin/subjects/${row._id}`)}
          className="font-medium text-primary hover:underline text-left"
        >
          {row.name}
        </button>
      ),
    },
    {
      header: t("subjects.table.shortName"),
      accessorKey: "shortName",
    },
    {
      header: t("subjects.table.group"),
      accessorKey: "group",
      cell: (row) => row.group || "—",
    },
    {
      header: t("subjects.table.primary"),
      accessorKey: "isPrimary",
      cell: (row) =>
        row.isPrimary ? (
          <Badge variant="default">{t("subjects.table.primaryBadge")}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      header: t("subjects.table.teachers"),
      accessorKey: "teacherCount",
    },
    {
      header: t("subjects.table.classes"),
      accessorKey: "classCount",
    },
    {
      header: t("subjects.table.actions"),
      accessorKey: "_id",
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleEditSubject(row._id as Id<"subjects">);
            }}
            title={t("buttons.edit")}
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(row._id as Id<"subjects">);
            }}
            title={t("buttons.delete")}
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("subjects.title")}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t("subjects.description")}
          </p>
        </div>
        <Button onClick={() => navigate(`/${lng}/admin/subjects/add`)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          {t("subjects.addButton")}
        </Button>
      </div>

      <DataTable
        data={subjects}
        columns={columns}
        searchPlaceholder={t("subjects.searchPlaceholder")}
        compact
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("subjects.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("subjects.deleteDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("subjects.deleteDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
              {t("subjects.deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Subjects() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
      </AuthLoading>

      <Authenticated>
        <Layout>
          <SubjectsInner />
        </Layout>
      </Authenticated>
    </>
  );
}
