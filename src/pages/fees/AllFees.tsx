import Layout from "@/components/Layout.tsx";
import { Authenticated, AuthLoading, Unauthenticated } from "@/lib/convex-preview";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import DataTable, { type DataTableColumn } from "@/components/DataTable.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Plus, Edit, Copy, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

type FeeRow = Doc<"fees"> & {
  assignmentCount: number;
  paidCount: number;
  readCount: number;
  totalCollected: number;
};

function FeesInner() {
  const fees = useQuery(api.fees.list, {});
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();
  const deleteFee = useMutation(api.fees.remove);

  if (fees === undefined) {
    return <Skeleton className="h-96 w-full" />;
  }

  const handleEdit = (feeId: Id<"fees">) => {
    toast.info("Редакцията на такси ще бъде добавена скоро");
  };

  const handleCopy = (feeId: Id<"fees">) => {
    toast.info("Копирането на такси ще бъде добавено скоро");
  };

  const handleDelete = async (feeId: Id<"fees">) => {
    if (!confirm("Сигурни ли сте, че искате да изтриете тази такса?")) {
      return;
    }
    
    try {
      await deleteFee({ id: feeId });
      toast.success("Таксата е изтрита успешно");
    } catch (error) {
      toast.error("Грешка при изтриване на таксата");
    }
  };

  const columns: DataTableColumn<FeeRow>[] = [
    {
      header: "Такса",
      accessorKey: "title",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="font-medium text-blue-600 hover:underline cursor-pointer">
            {row.title}
          </div>
        </div>
      ),
    },
    {
      header: "Ед. сума",
      accessorKey: "amount",
      cell: (row) => `${row.amount.toFixed(2)}лв.`,
    },
    {
      header: "Събрани",
      accessorKey: "totalCollected",
      cell: (row) => (
        <div>
          <div className="font-medium">Общо</div>
          <div className="text-sm">{row.totalCollected.toFixed(2)}лв.</div>
        </div>
      ),
    },
    {
      header: "Потребители",
      accessorKey: "paidCount",
      cell: (row) => (
        <div>
          <div className="font-medium">Платили</div>
          <div className="text-sm">{row.paidCount}/{row.assignmentCount}</div>
        </div>
      ),
    },
    {
      header: "",
      accessorKey: "readCount",
      cell: (row) => (
        <div>
          <div className="font-medium">Прочели</div>
          <div className="text-sm">{row.readCount}/{row.assignmentCount}</div>
        </div>
      ),
    },
    {
      header: "Дата на създаване",
      accessorKey: "createdDate",
      cell: (row) =>
        new Date(row.createdDate).toLocaleDateString("bg-BG", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
    },
    {
      header: "Краен срок",
      accessorKey: "dueDate",
      cell: (row) =>
        new Date(row.dueDate).toLocaleDateString("bg-BG", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
    },
    {
      header: "Операции",
      accessorKey: "_id",
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 bg-blue-500 hover:bg-blue-600 text-white"
            onClick={() => handleEdit(row._id)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 bg-cyan-500 hover:bg-cyan-600 text-white"
            onClick={() => handleCopy(row._id)}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 bg-red-500 hover:bg-red-600 text-white"
            onClick={() => handleDelete(row._id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Всички такси</h1>
        </div>
        <Button 
          onClick={() => navigate(`/${lng}/fees/add`)}
          className="bg-cyan-500 hover:bg-cyan-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          Добави
        </Button>
      </div>

      <DataTable
        data={fees}
        columns={columns}
        searchPlaceholder="Търси такси..."
      />
    </div>
  );
}

export default function AllFees() {
  return (
    <>
      <Unauthenticated>
        <Layout>
          <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-4">
            <p className="text-muted-foreground">
              Моля, влезте в акаунта си.
            </p>
            <SignInButton />
          </div>
        </Layout>
      </Unauthenticated>

      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
      </AuthLoading>

      <Authenticated>
        <Layout>
          <FeesInner />
        </Layout>
      </Authenticated>
    </>
  );
}
