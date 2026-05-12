import Layout from "@/components/Layout.tsx";
import { Authenticated, AuthLoading, Unauthenticated } from "@/lib/convex-preview";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { 
  FileTextIcon, 
  PlusIcon, 
  XIcon, 
  RefreshCwIcon, 
  Trash2Icon 
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

function ReportsPageInner() {
  const { lng } = useParams();
  const navigate = useNavigate();
  const reports = useQuery(api.reports.getAllReports, {});
  const deleteReport = useMutation(api.reports.deleteReport);
  const deleteMultipleReports = useMutation(api.reports.deleteMultipleReports);
  const refreshReport = useMutation(api.reports.refreshReport);
  
  const [selectedReports, setSelectedReports] = useState<Set<Id<"reports">>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshingId, setRefreshingId] = useState<Id<"reports"> | null>(null);

  const handleSelectAll = (checked: boolean) => {
    if (checked && reports) {
      setSelectedReports(new Set(reports.map(r => r._id)));
    } else {
      setSelectedReports(new Set());
    }
  };

  const handleSelectReport = (reportId: Id<"reports">, checked: boolean) => {
    const newSelected = new Set(selectedReports);
    if (checked) {
      newSelected.add(reportId);
    } else {
      newSelected.delete(reportId);
    }
    setSelectedReports(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedReports.size === 0) return;
    
    setIsDeleting(true);
    try {
      await deleteMultipleReports({ reportIds: Array.from(selectedReports) });
      toast.success(`${selectedReports.size} справки бяха изтрити`);
      setSelectedReports(new Set());
    } catch {
      toast.error("Грешка при изтриване на справки");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSingle = async (reportId: Id<"reports">) => {
    try {
      await deleteReport({ reportId });
      toast.success("Справката беше изтрита");
      setSelectedReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(reportId);
        return newSet;
      });
    } catch {
      toast.error("Грешка при изтриване на справката");
    }
  };

  const handleRefresh = async (reportId: Id<"reports">) => {
    setRefreshingId(reportId);
    try {
      await refreshReport({ reportId });
      toast.success("Справката беше обновена");
    } catch {
      toast.error("Грешка при обновяване на справката");
    } finally {
      setRefreshingId(null);
    }
  };

  if (reports === undefined) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <FileTextIcon className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Всички справки</h1>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-4">
        <Button 
          onClick={() => navigate(`/${lng}/reports/new`)}
          className="bg-emerald-500 hover:bg-emerald-600 text-white"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Нова справка
        </Button>

        <Button
          variant="destructive"
          onClick={handleDeleteSelected}
          disabled={selectedReports.size === 0 || isDeleting}
          className="bg-red-400 hover:bg-red-500"
        >
          <XIcon className="h-4 w-4 mr-2" />
          Изтрий избраните справки
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr className="border-b">
              <th className="p-3 w-10">
                <Checkbox
                  checked={reports.length > 0 && selectedReports.size === reports.length}
                  onCheckedChange={handleSelectAll}
                />
              </th>
              <th className="p-3 text-left font-medium text-muted-foreground">Справка</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Елементи</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Клас</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Срок</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Период</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Дата</th>
              <th className="p-3 text-left font-medium text-muted-foreground">Операции</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  Няма създадени справки
                </td>
              </tr>
            ) : (
              reports.map((report) => (
                <tr key={report._id} className="border-b hover:bg-muted/30">
                  <td className="p-3">
                    <Checkbox
                      checked={selectedReports.has(report._id)}
                      onCheckedChange={(checked) => handleSelectReport(report._id, checked as boolean)}
                    />
                  </td>
                  <td className="p-3">
                    <Link 
                      to={`/${lng}/reports/${report._id}`}
                      className="text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-2"
                    >
                      <FileTextIcon className="h-4 w-4" />
                      {report.name}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">{report.elements}</td>
                  <td className="p-3 text-muted-foreground">{report.class || ""}</td>
                  <td className="p-3 text-muted-foreground">{report.term || "Цялата година"}</td>
                  <td className="p-3 text-muted-foreground">{report.period || ""}</td>
                  <td className="p-3 text-muted-foreground">{report.date}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 bg-emerald-100 hover:bg-emerald-200 text-emerald-600"
                        onClick={() => handleRefresh(report._id)}
                        disabled={refreshingId === report._id}
                      >
                        <RefreshCwIcon className={`h-4 w-4 ${refreshingId === report._id ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 bg-red-100 hover:bg-red-200 text-red-600"
                        onClick={() => handleDeleteSingle(report._id)}
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <>
      <AuthLoading>
        <Layout>
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-96 w-full" />
          </div>
        </Layout>
      </AuthLoading>

      <Unauthenticated>
        <Layout>
          <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <p className="text-muted-foreground">Моля, влезте в профила си</p>
            <SignInButton />
          </div>
        </Layout>
      </Unauthenticated>

      <Authenticated>
        <Layout>
          <ReportsPageInner />
        </Layout>
      </Authenticated>
    </>
  );
}
