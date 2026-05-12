import Layout from "@/components/Layout.tsx";
import { Authenticated, AuthLoading } from "@/lib/convex-preview";
import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import DataTable, { type DataTableColumn } from "@/components/DataTable.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { PencilIcon } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { useNavigate, useParams, Link } from "react-router-dom";

interface ClassTermRow {
  _id: Id<"classes">;
  name: string;
  classTeacherName: string;
  termCount: number;
  startDate: string;
  endDate: string;
  academicYear: string;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("bg-BG");
}

function AcademicTermsInner() {
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const classesWithTerms = useQuery(api.terms.listClassesWithTerms, {});

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

  if (classesWithTerms === undefined) {
    return <Skeleton className="h-96 w-full" />;
  }

  const columns: DataTableColumn<ClassTermRow>[] = [
    {
      header: "Клас",
      accessorKey: "name",
      cell: (row) => (
        <Link
          to={`/${lng}/diary/class/${row._id}/grades`}
          className="text-sky-600 hover:text-sky-800 hover:underline dark:text-sky-400 dark:hover:text-sky-300"
        >
          {row.name}
        </Link>
      ),
    },
    {
      header: "Класен ръководител",
      accessorKey: "classTeacherName",
      cell: (row) => row.classTeacherName || "-",
    },
    {
      header: "Брой срокове",
      accessorKey: "termCount",
      cell: (row) => row.termCount || "-",
    },
    {
      header: "Начало",
      accessorKey: "startDate",
      cell: (row) => formatDate(row.startDate),
    },
    {
      header: "Край",
      accessorKey: "endDate",
      cell: (row) => formatDate(row.endDate),
    },
    {
      header: "Уч. година",
      accessorKey: "academicYear",
    },
    {
      header: "Операции",
      accessorKey: "_id",
      cell: () => (
        <Button
          variant="default"
          size="icon"
          className="h-8 w-8 bg-sky-500 hover:bg-sky-600"
          onClick={() => navigate(`/${lng}/admin/academic-terms/edit`)}
        >
          <PencilIcon className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <span className="text-sky-600">📅</span> Учебни срокове
        </h1>
        <Button
          onClick={() => navigate(`/${lng}/admin/academic-terms/edit`)}
          className="bg-sky-500 hover:bg-sky-600"
        >
          <PencilIcon className="h-4 w-4 mr-2" />
          Редактирай
        </Button>
      </div>

      <DataTable
        data={classesWithTerms}
        columns={columns}
        searchPlaceholder="Търсене..."
      />
    </div>
  );
}

export default function AcademicTerms() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
      </AuthLoading>

      <Authenticated>
        <Layout>
          <AcademicTermsInner />
        </Layout>
      </Authenticated>
    </>
  );
}
