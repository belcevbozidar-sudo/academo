import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import DataTable from "@/components/DataTable.tsx";
import { Badge } from "@/components/ui/badge.tsx";

function ClassesListInner() {
  const classes = useQuery(api.admin.listClasses, {});

  if (classes === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const columns = [
    {
      header: "Клас",
      accessorKey: "name",
    },
    {
      header: "Класен ръководител",
      accessorKey: "classTeacherName",
      cell: (row: {
        classTeacherName: string | null;
        classTeacherHasLeft: boolean;
      }) => {
        if (!row.classTeacherName) return "—";
        return (
          <div className="flex items-center gap-2">
            <span>{row.classTeacherName}</span>
            {row.classTeacherHasLeft && (
              <Badge variant="destructive" className="text-xs">
                НАПУСНАЛ
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      header: "Дневник",
      accessorKey: "diaryType",
    },
    {
      header: "Групи",
      accessorKey: "groups",
      cell: () => "—", // Groups functionality not yet implemented
    },
    {
      header: "Ученици",
      accessorKey: "studentCount",
    },
    {
      header: "Учители",
      accessorKey: "teacherCount",
    },
    {
      header: "Предмети",
      accessorKey: "subjectCount",
    },
  ];

  const data = classes.map((cls) => ({
    id: cls._id,
    name: cls.name,
    classTeacherName: cls.classTeacher?.name ?? null,
    classTeacherHasLeft: cls.classTeacher?.hasLeft ?? false,
    diaryType: cls.diaryType,
    groups: 0, // Placeholder
    studentCount: cls.studentCount,
    teacherCount: cls.teacherCount,
    subjectCount: cls.subjectCount,
  }));

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Администрация → Паралелки
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Преглед на всички паралелки с агрегирана статистика
          </p>
        </div>

        <DataTable
          columns={columns}
          data={data}
          searchPlaceholder="Търсене по клас..."
        />
      </div>
    </Layout>
  );
}

export default function ClassesList() {
  return (
    <>
      <Unauthenticated>
        <Layout>
          <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-4">
            <p className="text-muted-foreground">
              Моля, влезте в акаунта си, за да видите паралелките.
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
        <ClassesListInner />
      </Authenticated>
    </>
  );
}
