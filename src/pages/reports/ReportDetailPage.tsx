import Layout from "@/components/Layout.tsx";
import { Authenticated, AuthLoading, Unauthenticated } from "@/lib/convex-preview";
import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import { 
  FileTextIcon, 
  ChevronLeftIcon,
  TableIcon,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { format } from "date-fns";
import { bg } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";

type DynamicColumn = {
  key: string;
  label: string;
  type: "text" | "number" | "badge";
};

type DynamicRow = Record<string, string | number>;

function ReportDetailPageInner() {
  const { lng, reportId } = useParams<{ lng: string; reportId: string }>();
  const navigate = useNavigate();
  
  const report = useQuery(api.reports.getReportById, { 
    reportId: reportId as Id<"reports"> 
  });

  const exportToPDF = () => {
    if (!report) {
      toast.error("Няма данни за експорт");
      return;
    }
    
    const columns = report.dynamicColumns || [];
    const rows = (report.dynamicRows || []) as DynamicRow[];
    const summary = report.dynamicSummary as DynamicRow | undefined;
    
    if (columns.length === 0 || rows.length === 0) {
      toast.error("Няма данни за експорт");
      return;
    }
    
    // Create a printable HTML
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Моля, разрешете изскачащи прозорци");
      return;
    }

    const date = report.createdAt 
      ? format(new Date(report.createdAt), "dd.MM.yyyy", { locale: bg })
      : format(new Date(), "dd.MM.yyyy", { locale: bg });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${report.name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 18px; margin-bottom: 10px; }
          .info { font-size: 12px; color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; }
          .summary { font-weight: bold; background-color: #f0f0f0; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <h1>${report.name}</h1>
        <div class="info">
          <strong>Обхват:</strong> ${report.scopeYear}, ${report.scopeGrades} &nbsp;&nbsp;
          <strong>Дата на справка:</strong> ${date}
        </div>
        <table>
          <thead>
            <tr>
              ${columns.map((col: DynamicColumn) => `<th>${col.label}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row: DynamicRow) => `
              <tr>
                ${columns.map((col: DynamicColumn) => `<td>${row[col.key] ?? ""}</td>`).join("")}
              </tr>
            `).join("")}
            ${summary ? `
              <tr class="summary">
                ${columns.map((col: DynamicColumn) => `<td>${summary[col.key] ?? ""}</td>`).join("")}
              </tr>
            ` : ""}
          </tbody>
        </table>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    toast.success("PDF се генерира...");
  };

  const exportToExcel = () => {
    if (!report) {
      toast.error("Няма данни за експорт");
      return;
    }
    
    const columns = report.dynamicColumns || [];
    const rows = (report.dynamicRows || []) as DynamicRow[];
    const summary = report.dynamicSummary as DynamicRow | undefined;
    
    if (columns.length === 0 || rows.length === 0) {
      toast.error("Няма данни за експорт");
      return;
    }
    
    // Create CSV with proper UTF-8 encoding
    const headers = columns.map((col: DynamicColumn) => col.label);
    const csvRows = rows.map((row: DynamicRow) => 
      columns.map((col: DynamicColumn) => String(row[col.key] ?? ""))
    );
    
    // Add summary row if exists
    if (summary) {
      csvRows.push(columns.map((col: DynamicColumn) => String(summary[col.key] ?? "")));
    }
    
    // Escape fields that contain commas or quotes
    const escapeField = (field: string) => {
      if (field.includes(",") || field.includes('"') || field.includes("\n")) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csvContent = [
      headers.map(escapeField).join(","),
      ...csvRows.map(row => row.map(escapeField).join(",")),
    ].join("\r\n");
    
    // Create blob with BOM for Excel UTF-8 support
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.name}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success("Excel файлът е изтеглен");
  };

  if (report === undefined) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Справката не е намерена</p>
        <Button 
          variant="ghost" 
          onClick={() => navigate(`/${lng}/reports`)}
          className="mt-4"
        >
          <ChevronLeftIcon className="h-4 w-4 mr-1" />
          Назад към справките
        </Button>
      </div>
    );
  }

  const date = report.createdAt 
    ? format(new Date(report.createdAt), "dd.MM.yyyy", { locale: bg })
    : format(new Date(), "dd.MM.yyyy", { locale: bg });

  // Get dynamic data
  const columns = (report.dynamicColumns || []) as DynamicColumn[];
  const rows = (report.dynamicRows || []) as DynamicRow[];
  const summary = report.dynamicSummary as DynamicRow | undefined;

  return (
    <div className="p-4 bg-background min-h-screen">
      {/* Header with yellow background like screenshot */}
      <div className="flex items-center justify-between mb-4 bg-amber-100 dark:bg-amber-900/30 -mx-4 -mt-4 px-4 py-3 border-b border-amber-200 dark:border-amber-800">
        <div className="flex items-center gap-2">
          <FileTextIcon className="h-5 w-5 text-amber-700 dark:text-amber-400" />
          <h1 className="text-xl font-semibold text-amber-900 dark:text-amber-100">{report.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate(`/${lng}/reports`)}
          >
            <ChevronLeftIcon className="h-4 w-4 mr-1" />
            Назад
          </Button>
          <Button 
            size="sm"
            onClick={exportToExcel}
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            Excel
          </Button>
          <Button 
            size="sm"
            onClick={exportToPDF}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            PDF
          </Button>
        </div>
      </div>

      {/* Report Info Bar */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <span>
          <strong>Обхват:</strong> {report.scopeYear}, {report.scopeGrades}
        </span>
        <span>
          <strong>Дата на справка:</strong> {date}
        </span>
      </div>

      {/* Main Content - Dynamic Table */}
      <div className="border rounded-lg overflow-hidden bg-card">
        <ScrollArea className="h-[calc(100vh-220px)]">
          <table className="w-full">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="border-b">
                {columns.map((col) => (
                  <th 
                    key={col.key} 
                    className="p-3 text-left font-medium text-foreground"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td 
                    colSpan={columns.length || 1} 
                    className="p-8 text-center text-muted-foreground"
                  >
                    Няма данни за показване
                  </td>
                </tr>
              ) : (
                <>
                  {rows.map((row, idx) => (
                    <tr 
                      key={idx} 
                      className="border-b hover:bg-muted/20 transition-colors"
                    >
                      {columns.map((col) => (
                        <td key={col.key} className="p-3">
                          {col.key === "subject" ? (
                            <div className="flex items-center gap-2">
                              <TableIcon className="h-4 w-4 text-amber-600" />
                              <span>{row[col.key]}</span>
                            </div>
                          ) : col.type === "number" ? (
                            <span className="font-mono">{row[col.key]}</span>
                          ) : (
                            row[col.key]
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {summary && (
                    <tr className="border-t-2 border-primary bg-muted/50 font-semibold">
                      {columns.map((col) => (
                        <td key={col.key} className="p-3">
                          {col.type === "number" ? (
                            <span className="font-mono">{summary[col.key]}</span>
                          ) : (
                            summary[col.key]
                          )}
                        </td>
                      ))}
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </ScrollArea>
      </div>

      {/* Summary count */}
      {rows.length > 0 && (
        <div className="mt-4 text-sm text-muted-foreground">
          Общо редове: {rows.length}
        </div>
      )}
    </div>
  );
}

export default function ReportDetailPage() {
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
          <ReportDetailPageInner />
        </Layout>
      </Authenticated>
    </>
  );
}
