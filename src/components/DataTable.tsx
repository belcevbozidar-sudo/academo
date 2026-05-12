import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ColumnsIcon,
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  MoreVerticalIcon,
  PrinterIcon,
  SearchIcon,
} from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile.ts";
import { cn } from "@/lib/utils.ts";

export interface DataTableColumn<T = Record<string, unknown>> {
  header: string;
  accessorKey: keyof T | string;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T = Record<string, unknown>> {
  data: T[];
  columns: DataTableColumn<T>[];
  searchPlaceholder?: string;
  onAdd?: () => void;
  addButtonLabel?: string;
  isLoading?: boolean;
  showExport?: boolean;
  compact?: boolean;
}

export default function DataTable<T = Record<string, unknown>>({
  data,
  columns,
  searchPlaceholder = "Търсене...",
  onAdd,
  addButtonLabel = "Добави",
  isLoading,
  showExport = true,
  compact = false,
}: DataTableProps<T>) {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(columns.map((col) => String(col.accessorKey)))
  );

  // Filter data based on search
  const filteredData = data.filter((row) => {
    if (!searchQuery) return true;
    return Object.values(row as Record<string, unknown>).some((value) =>
      String(value).toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  const handleColumnToggle = (columnKey: string) => {
    const newColumns = new Set(visibleColumns);
    if (newColumns.has(columnKey)) {
      newColumns.delete(columnKey);
    } else {
      newColumns.add(columnKey);
    }
    setVisibleColumns(newColumns);
  };

  const visibleColumnsList = columns.filter((col) =>
    visibleColumns.has(String(col.accessorKey))
  );

  // Get cell value as string
  const getCellValue = (row: T, column: DataTableColumn<T>): string => {
    if (column.cell) {
      const cellContent = column.cell(row);
      if (typeof cellContent === "string") return cellContent;
      if (typeof cellContent === "number") return String(cellContent);
      // Extract text from React elements
      return String(row[column.accessorKey as keyof T] || "");
    }
    return String(row[column.accessorKey as keyof T] || "");
  };

  // Print handler
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const tableHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Принтиране</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; font-weight: bold; }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <table>
            <thead>
              <tr>
                ${visibleColumnsList.map((col) => `<th>${col.header}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${filteredData
                .map(
                  (row) =>
                    `<tr>${visibleColumnsList.map((col) => `<td>${getCellValue(row, col)}</td>`).join("")}</tr>`
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(tableHTML);
    printWindow.document.close();
    printWindow.print();
  };

  // Copy to clipboard handler
  const handleCopy = () => {
    const headers = visibleColumnsList.map((col) => col.header).join("\t");
    const rows = filteredData
      .map((row) => visibleColumnsList.map((col) => getCellValue(row, col)).join("\t"))
      .join("\n");
    const text = `${headers}\n${rows}`;

    navigator.clipboard.writeText(text).then(() => {
      toast.success("Копирано в клипборда");
    });
  };

  // PDF export handler
  const handlePDFExport = async () => {
    try {
      // Create a temporary container for the table
      const tableElement = document.createElement("div");
      tableElement.style.position = "absolute";
      tableElement.style.left = "-9999px";
      tableElement.style.background = "white";
      tableElement.style.padding = "20px";
      
      // Create table HTML with proper UTF-8 encoding
      let tableHTML = `
        <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;">
          <thead>
            <tr style="background-color: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
              ${visibleColumnsList.map((col) => 
                `<th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb; font-weight: bold;">${col.header}</th>`
              ).join("")}
            </tr>
          </thead>
          <tbody>
            ${filteredData.map((row) => `
              <tr style="border-bottom: 1px solid #e5e7eb;">
                ${visibleColumnsList.map((col) => {
                  const value = getCellValue(row, col);
                  return `<td style="padding: 8px; border: 1px solid #e5e7eb;">${value}</td>`;
                }).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
      
      tableElement.innerHTML = tableHTML;
      document.body.appendChild(tableElement);
      
      // Convert to canvas
      const canvas = await html2canvas(tableElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      
      // Remove temporary element
      document.body.removeChild(tableElement);
      
      // Create PDF
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "mm",
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;
      
      pdf.addImage(
        imgData,
        "PNG",
        imgX,
        imgY,
        imgWidth * ratio,
        imgHeight * ratio
      );
      
      pdf.save("export.pdf");
      toast.success("PDF файлът е изтеглен");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Грешка при генериране на PDF файл");
    }
  };

  // Excel export handler
  const handleExcelExport = () => {
    const headers = visibleColumnsList.map((col) => col.header);
    const rows = filteredData.map((row) =>
      visibleColumnsList.map((col) => getCellValue(row, col))
    );

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Данни");
    XLSX.writeFile(workbook, "export.xlsx");
    toast.success("Excel файлът е изтеглен");
  };

  // CSV export handler
  const handleCSVExport = () => {
    const headers = visibleColumnsList.map((col) => col.header).join(",");
    const rows = filteredData
      .map((row) =>
        visibleColumnsList
          .map((col) => {
            const value = getCellValue(row, col);
            // Escape commas and quotes
            return value.includes(",") || value.includes('"')
              ? `"${value.replace(/"/g, '""')}"`
              : value;
          })
          .join(",")
      )
      .join("\n");

    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "export.csv";
    link.click();
    toast.success("CSV файлът е изтеглен");
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      {showExport && (
        <div className={cn(
          "flex items-center gap-4",
          isMobile ? "flex-col items-stretch" : "justify-between"
        )}>
          {isMobile ? (
            // Mobile: Single "Действия" button with dropdown
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <MoreVerticalIcon className="h-4 w-4" />
                    Действия
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56">
                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                  Покажи реда
                </div>
                <div className="px-2 pb-2 flex items-center gap-2">
                  <Select
                    value={String(rowsPerPage)}
                    onValueChange={(value) => {
                      setRowsPerPage(Number(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 реда</SelectItem>
                      <SelectItem value="25">25 реда</SelectItem>
                      <SelectItem value="50">50 реда</SelectItem>
                      <SelectItem value="100">100 реда</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handlePrint}>
                  <PrinterIcon className="h-4 w-4 mr-2" />
                  Принтирай
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopy}>
                  <CopyIcon className="h-4 w-4 mr-2" />
                  Копирай
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePDFExport}>
                  <FileTextIcon className="h-4 w-4 mr-2" />
                  Експортирай PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExcelExport}>
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  Експортирай Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCSVExport}>
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  Експортирай CSV
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                  Покажи колони
                </div>
                {columns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={String(column.accessorKey)}
                    checked={visibleColumns.has(String(column.accessorKey))}
                    onCheckedChange={() =>
                      handleColumnToggle(String(column.accessorKey))
                    }
                  >
                    {column.header}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            // Desktop: Individual buttons
            <>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <PrinterIcon className="h-4 w-4 mr-2" />
                  Принтирай
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <CopyIcon className="h-4 w-4 mr-2" />
                  Копирай
                </Button>
                <Button variant="outline" size="sm" onClick={handlePDFExport}>
                  <FileTextIcon className="h-4 w-4 mr-2" />
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handleExcelExport}>
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" onClick={handleCSVExport}>
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  CSV
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <ColumnsIcon className="h-4 w-4 mr-2" />
                      Колони
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {columns.map((column) => (
                      <DropdownMenuCheckboxItem
                        key={String(column.accessorKey)}
                        checked={visibleColumns.has(String(column.accessorKey))}
                        onCheckedChange={() =>
                          handleColumnToggle(String(column.accessorKey))
                        }
                      >
                        {column.header}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-2">
                {onAdd && (
                  <Button onClick={onAdd} size="sm">
                    {addButtonLabel}
                  </Button>
                )}
              </div>
            </>
          )}
          
          {/* Mobile: "Add" button below the actions */}
          {isMobile && onAdd && (
            <Button onClick={onAdd} size="sm" className="w-full">
              {addButtonLabel}
            </Button>
          )}
        </div>
      )}

      <div className={cn(
        "flex items-center gap-4",
        isMobile ? "flex-col items-stretch" : "justify-between"
      )}>
        {!isMobile && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Покажи</span>
            <Select
              value={String(rowsPerPage)}
              onValueChange={(value) => {
                setRowsPerPage(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">реда</span>
          </div>
        )}

        <div className={cn(
          "relative",
          isMobile ? "w-full" : "flex-1 max-w-sm"
        )}>
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className={cn("rounded-md border", compact ? "overflow-hidden" : "overflow-x-auto")}>
        <Table className={cn(compact && "table-fixed w-full")}>
          <TableHeader>
            <TableRow>
              {visibleColumnsList.map((column) => (
                <TableHead 
                  key={String(column.accessorKey)}
                  className={cn(
                    isMobile && "text-xs",
                    compact && "p-2 text-xs"
                  )}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumnsList.length}
                  className="h-24 text-center"
                >
                  Зареждане...
                </TableCell>
              </TableRow>
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumnsList.length}
                  className="h-24 text-center"
                >
                  Няма намерени резултати
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {visibleColumnsList.map((column) => (
                    <TableCell 
                      key={String(column.accessorKey)}
                      className={cn(
                        isMobile && "text-xs p-2",
                        compact && "overflow-hidden text-ellipsis whitespace-nowrap max-w-0 p-2 text-sm"
                      )}
                    >
                      {column.cell
                        ? column.cell(row)
                        : String(row[column.accessorKey as keyof T] || "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className={cn(
        "flex items-center",
        isMobile ? "flex-col gap-3" : "justify-between"
      )}>
        <div className="text-sm text-muted-foreground">
          Показване на {startIndex + 1} до{" "}
          {Math.min(endIndex, filteredData.length)} от {filteredData.length}{" "}
          записа
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Страница {currentPage} от {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
