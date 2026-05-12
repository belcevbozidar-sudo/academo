import Layout from "@/components/Layout.tsx";
import { Authenticated, AuthLoading } from "@/lib/convex-preview";
import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import DataTable, { type DataTableColumn } from "@/components/DataTable.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useNavigate, useParams } from "react-router-dom";
import { PencilIcon } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useTranslation } from "react-i18next";

interface ClassRow {
  _id: Id<"classes">;
  name: string;
  classTeacher?: { name?: string; hasLeft: boolean; userId?: Id<"users"> } | null;
  diaryType: string;
  studentCount: number;
  teacherCount: number;
  subjectCount: number;
}

function ClassesInner() {
  const { t } = useTranslation();
  const classes = useQuery(api.admin.listClasses, {});
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();

  // Check if current user is a student
  const isStudent = currentUser && (
    currentUser.role === "student" || currentUser.roles?.includes("student")
  );

  // If student, redirect to home page
  if (isStudent) {
    navigate(`/${lng}`);
    return null;
  }

  if (classes === undefined) {
    return <Skeleton className="h-96 w-full" />;
  }

  const columns: DataTableColumn<ClassRow>[] = [
    {
      header: t("classes.table.class"),
      accessorKey: "name",
      cell: (row) => (
        <button
          onClick={() => navigate(`/${lng}/admin/classes/${row._id}`)}
          className="font-medium text-primary hover:underline text-left"
        >
          {row.name}
        </button>
      ),
    },
    {
      header: t("classes.table.classTeacher"),
      accessorKey: "classTeacher",
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.classTeacher?.userId ? (
            <button
              onClick={() => navigate(`/${lng}/admin/user/${row.classTeacher?.userId}`)}
              className="text-primary hover:underline"
            >
              {row.classTeacher?.name || "—"}
            </button>
          ) : (
            <span>{row.classTeacher?.name || "—"}</span>
          )}
          {row.classTeacher?.hasLeft && (
            <Badge variant="destructive" className="text-xs">
              {t("classes.status.hasLeft")}
            </Badge>
          )}
        </div>
      ),
    },
    {
      header: t("classes.table.diaryType"),
      accessorKey: "diaryType",
    },
    {
      header: t("classes.table.students"),
      accessorKey: "studentCount",
    },
    {
      header: t("classes.table.teachers"),
      accessorKey: "teacherCount",
    },
    {
      header: t("classes.table.subjects"),
      accessorKey: "subjectCount",
    },
    {
      header: t("classes.table.actions"),
      accessorKey: "_id",
      cell: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/${lng}/admin/classes/edit/${row._id}`)}
        >
          <PencilIcon className="h-4 w-4 mr-1" />
          {t("buttons.edit")}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("classes.title")}</h1>
        <p className="text-muted-foreground mt-2">
          {t("classes.description")}
        </p>
      </div>

      <DataTable
        data={classes}
        columns={columns}
        searchPlaceholder={t("classes.searchPlaceholder")}
        addButtonLabel={t("classes.addButton")}
        onAdd={() => navigate(`/${lng}/admin/classes/add`)}
      />
    </div>
  );
}

export default function Classes() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
      </AuthLoading>

      <Authenticated>
        <Layout>
          <ClassesInner />
        </Layout>
      </Authenticated>
    </>
  );
}
