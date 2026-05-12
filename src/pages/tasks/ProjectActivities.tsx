import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import DataTable from "@/components/DataTable.tsx";
import type { DataTableColumn } from "@/components/DataTable.tsx";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { useState } from "react";
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon, FolderOpenIcon } from "lucide-react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";

// Maps for display labels
const PROJECT_TYPE_LABELS: Record<string, string> = {
  national_partnership: "Национално партньорство",
  international_partnership: "Международно партньорство",
  no_partner: "Няма партньор",
};

type ProjectActivity = {
  _id: Id<"projectActivities">;
  name: string;
  startDate: number;
  endDate: number;
  projectType?: string;
  programType?: string;
  website?: string;
  shortDescription?: string;
  mainResults?: string;
  creatorName: string;
  createdAt: number;
  _creationTime: number;
};

function ProjectActivitiesInner() {
  const { lng } = useParams();
  const navigate = useNavigate();
  const activities = useQuery(api.projectActivities.list, {});
  const removeActivity = useMutation(api.projectActivities.remove);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ProjectActivity | null>(null);

  const handleDelete = async () => {
    if (!selectedActivity) return;
    try {
      await removeActivity({ id: selectedActivity._id });
      toast.success("Проектната дейност е изтрита успешно");
      setDeleteDialogOpen(false);
      setSelectedActivity(null);
    } catch {
      toast.error("Грешка при изтриване на проектната дейност");
    }
  };

  const formatProjectType = (type?: string) => {
    if (!type) return "—";
    return PROJECT_TYPE_LABELS[type] || type;
  };

  const columns: DataTableColumn<ProjectActivity>[] = [
    {
      header: "Име",
      accessorKey: "name",
    },
    {
      header: "Вид",
      accessorKey: "projectType",
      cell: (row: ProjectActivity) => formatProjectType(row.projectType),
    },
    {
      header: "Добавена на",
      accessorKey: "createdAt",
      cell: (row: ProjectActivity) => {
        const date = new Date(row.createdAt);
        return `${date.toLocaleDateString("bg-BG")} ${date.toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" })}`;
      },
    },
    {
      header: "Добавена от",
      accessorKey: "creatorName",
    },
    {
      header: "Операции",
      accessorKey: "_id",
      cell: (row: ProjectActivity) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/${lng}/tasks/project-activities/view/${row._id}`)}
            title="Преглед"
          >
            <EyeIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/${lng}/tasks/project-activities/edit/${row._id}`)}
            title="Редактирай"
          >
            <PencilIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedActivity(row);
              setDeleteDialogOpen(true);
            }}
            title="Изтрий"
            className="text-destructive hover:text-destructive"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (activities === undefined) {
    return (
      <Layout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FolderOpenIcon className="h-5 w-5" />
                Всички проектни дейности
              </CardTitle>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => navigate(`/${lng}/tasks/project-activities/add`)}
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Добави
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FolderOpenIcon />
                  </EmptyMedia>
                  <EmptyTitle>Няма проектни дейности</EmptyTitle>
                  <EmptyDescription>Добавете първата проектна дейност</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => navigate(`/${lng}/tasks/project-activities/add`)}
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Добави
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <DataTable
                data={activities as ProjectActivity[]}
                columns={columns}
                searchPlaceholder="Търсене..."
              />
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Изтриване на проектна дейност</DialogTitle>
              <DialogDescription>
                Сигурни ли сте, че искате да изтриете &quot;{selectedActivity?.name}&quot;? Това действие е необратимо.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="secondary" onClick={() => setDeleteDialogOpen(false)}>
                Отказ
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Изтрий
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

export default function ProjectActivities() {
  return (
    <>
      <Unauthenticated>
        <Layout>
          <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <p className="text-muted-foreground">Моля, влезте в профила си</p>
            <SignInButton />
          </div>
        </Layout>
      </Unauthenticated>
      <AuthLoading>
        <Layout>
          <div className="flex items-center justify-center min-h-screen">
            <Skeleton className="h-96 w-full max-w-md" />
          </div>
        </Layout>
      </AuthLoading>
      <Authenticated>
        <ProjectActivitiesInner />
      </Authenticated>
    </>
  );
}
