import { useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAction, useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Authenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import { toast } from "sonner";
import { ArrowLeftIcon, UploadIcon, FileSpreadsheetIcon, CheckCircleIcon, AlertCircleIcon, ArrowRightIcon, UsersIcon } from "lucide-react";
import * as XLSX from "xlsx";

// Expected column structure from the Excel file
const EXPECTED_COLUMNS = {
  studentNumber: ["№ ученик", "номер", "№", "number"],
  studentName: ["ученик", "име на ученик", "student", "name"],
  parent1FirstName: ["родител 1 (баща) - име", "родител 1 - име", "име на баща", "баща име"],
  parent1MiddleName: ["родител 1 - презиме", "презиме на баща", "баща презиме"],
  parent1LastName: ["родител 1 - фамилия", "фамилия на баща", "баща фамилия"],
  parent1Phone: ["телефон 1", "тел. 1", "телефон баща"],
  parent1Email: ["имейл 1", "email 1", "имейл баща"],
  parent2FirstName: ["родител 2 (майка) - име", "родител 2 - име", "име на майка", "майка име"],
  parent2MiddleName: ["родител 2 - презиме", "презиме на майка", "майка презиме"],
  parent2LastName: ["родител 2 - фамилия", "фамилия на майка", "майка фамилия"],
  parent2Phone: ["телефон 2", "тел. 2", "телефон майка"],
  parent2Email: ["имейл 2", "email 2", "имейл майка"],
  address: ["адрес", "address"],
};

function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/[_\-\s]+/g, " ");
}

function findColumnMatch(excelColumn: string, expectedColumns: string[]): boolean {
  const normalized = normalizeText(excelColumn);
  for (const expected of expectedColumns) {
    if (normalized.includes(normalizeText(expected)) || normalizeText(expected).includes(normalized)) {
      return true;
    }
  }
  return false;
}

interface ParsedRow {
  studentNumber?: number;
  studentName: string;
  parent1FirstName?: string;
  parent1MiddleName?: string;
  parent1LastName?: string;
  parent1Phone?: string;
  parent1Email?: string;
  parent2FirstName?: string;
  parent2MiddleName?: string;
  parent2LastName?: string;
  parent2Phone?: string;
  parent2Email?: string;
  address?: string;
}

function ImportStudentsParentsPageInner() {
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();
  const classes = useQuery(api.admin.listClasses, {});
  const defaultSchool = useQuery(api.admin.getDefaultSchool, {});
  const importStudentsWithParents = useAction(api.usersActions.importStudentsWithParentsAction);
  
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "importing" | "done">("upload");
  const [fileName, setFileName] = useState<string>("");
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [importResults, setImportResults] = useState<{ 
    success: number; 
    failed: number; 
    errors: string[];
    studentsCreated: number;
    parentsCreated: number;
  }>({ success: 0, failed: 0, errors: [], studentsCreated: 0, parentsCreated: 0 });
  const [isImporting, setIsImporting] = useState(false);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Get JSON data with header row
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });
        
        if (jsonData.length === 0) {
          toast.error("Файлът е празен или няма данни");
          return;
        }
        
        // Get column headers
        const headers = Object.keys(jsonData[0]);
        setExcelColumns(headers);
        setRawData(jsonData);
        
        // Auto-map columns
        const autoMapping: Record<string, string> = {};
        for (const header of headers) {
          for (const [fieldKey, aliases] of Object.entries(EXPECTED_COLUMNS)) {
            if (findColumnMatch(header, aliases)) {
              autoMapping[header] = fieldKey;
              break;
            }
          }
        }
        setColumnMapping(autoMapping);
        
        setStep("mapping");
        toast.success(`Заредени ${jsonData.length} реда от файла`);
      } catch (error) {
        console.error("Error parsing Excel file:", error);
        toast.error("Грешка при четене на файла. Уверете се, че е валиден Excel файл.");
      }
    };
    
    reader.readAsBinaryString(file);
  }, []);

  const handleMappingChange = (excelColumn: string, systemField: string) => {
    setColumnMapping(prev => {
      const newMapping = { ...prev };
      if (systemField === "__skip__") {
        delete newMapping[excelColumn];
      } else {
        newMapping[excelColumn] = systemField;
      }
      return newMapping;
    });
  };

  const transformData = (): ParsedRow[] => {
    return rawData.map((row) => {
      const transformed: ParsedRow = { studentName: "" };
      
      for (const [excelCol, fieldKey] of Object.entries(columnMapping)) {
        const value = row[excelCol];
        if (value !== null && value !== undefined && value !== "") {
          if (fieldKey === "studentNumber") {
            transformed.studentNumber = parseInt(String(value)) || undefined;
          } else if (fieldKey === "studentName") {
            transformed.studentName = String(value).trim();
          } else if (fieldKey === "parent1FirstName") {
            transformed.parent1FirstName = String(value).trim();
          } else if (fieldKey === "parent1MiddleName") {
            transformed.parent1MiddleName = String(value).trim();
          } else if (fieldKey === "parent1LastName") {
            transformed.parent1LastName = String(value).trim();
          } else if (fieldKey === "parent1Phone") {
            transformed.parent1Phone = String(value).trim();
          } else if (fieldKey === "parent1Email") {
            transformed.parent1Email = String(value).trim();
          } else if (fieldKey === "parent2FirstName") {
            transformed.parent2FirstName = String(value).trim();
          } else if (fieldKey === "parent2MiddleName") {
            transformed.parent2MiddleName = String(value).trim();
          } else if (fieldKey === "parent2LastName") {
            transformed.parent2LastName = String(value).trim();
          } else if (fieldKey === "parent2Phone") {
            transformed.parent2Phone = String(value).trim();
          } else if (fieldKey === "parent2Email") {
            transformed.parent2Email = String(value).trim();
          } else if (fieldKey === "address") {
            transformed.address = String(value).trim();
          }
        }
      }
      
      return transformed;
    }).filter(row => row.studentName && row.studentName.trim().length > 0);
  };

  const handleGoToPreview = () => {
    if (!selectedClassId) {
      toast.error("Моля изберете клас за учениците");
      return;
    }
    const data = transformData();
    setParsedData(data);
    setStep("preview");
  };

  const handleStartImport = async () => {
    if (!selectedClassId || !defaultSchool?.schoolId) {
      toast.error("Моля изберете клас и училище");
      return;
    }
    
    setIsImporting(true);
    setStep("importing");
    
    try {
      const result = await importStudentsWithParents({
        rows: parsedData,
        classId: selectedClassId as Id<"classes">,
        schoolId: defaultSchool.schoolId,
      });
      
      setImportResults(result);
      setStep("done");
      
      if (result.success > 0) {
        toast.success(`Успешно импортирани: ${result.studentsCreated} ученици и ${result.parentsCreated} родители`);
      }
      if (result.failed > 0) {
        toast.error(`Неуспешни: ${result.failed} реда`);
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Грешка при импорта");
      setStep("preview");
    } finally {
      setIsImporting(false);
    }
  };

  const fieldLabels: Record<string, string> = {
    studentNumber: "№ ученик",
    studentName: "Име на ученик",
    parent1FirstName: "Родител 1 - Име",
    parent1MiddleName: "Родител 1 - Презиме",
    parent1LastName: "Родител 1 - Фамилия",
    parent1Phone: "Родител 1 - Телефон",
    parent1Email: "Родител 1 - Имейл",
    parent2FirstName: "Родител 2 - Име",
    parent2MiddleName: "Родител 2 - Презиме",
    parent2LastName: "Родител 2 - Фамилия",
    parent2Phone: "Родител 2 - Телефон",
    parent2Email: "Родител 2 - Имейл",
    address: "Адрес",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/${lng}/admin/users`)}
          className="shrink-0"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <UsersIcon className="h-7 w-7" />
            Импорт на ученици с родители
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Качете Excel файл с ученици и техните родители
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {[
          { key: "upload", label: "Качване" },
          { key: "mapping", label: "Съпоставяне" },
          { key: "preview", label: "Преглед" },
          { key: "importing", label: "Импорт" },
          { key: "done", label: "Готово" },
        ].map((s, idx) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
              step === s.key 
                ? "bg-primary text-primary-foreground" 
                : ["upload", "mapping", "preview", "importing", "done"].indexOf(step) > idx
                  ? "bg-green-500 text-white"
                  : "bg-muted text-muted-foreground"
            }`}>
              {["upload", "mapping", "preview", "importing", "done"].indexOf(step) > idx ? (
                <CheckCircleIcon className="h-4 w-4" />
              ) : (
                idx + 1
              )}
            </div>
            <span className={`text-sm ${step === s.key ? "font-medium" : "text-muted-foreground"}`}>
              {s.label}
            </span>
            {idx < 4 && <ArrowRightIcon className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step: Upload */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadIcon className="h-5 w-5" />
              Качване на файл
            </CardTitle>
            <CardDescription>
              Изберете Excel файл (.xlsx, .xls) с данни за ученици и родители
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircleIcon className="h-4 w-4" />
              <AlertDescription>
                <strong>Очакван формат:</strong> Всеки ред съдържа един ученик с неговите двама родители.
                <br />
                Колони: № ученик, Ученик, Родител 1 (баща) - Име/Презиме/Фамилия/Телефон/Имейл, 
                Родител 2 (майка) - Име/Презиме/Фамилия/Телефон/Имейл, Адрес
              </AlertDescription>
            </Alert>
            
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="excel-upload"
              />
              <label htmlFor="excel-upload" className="cursor-pointer">
                <FileSpreadsheetIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Кликнете или плъзнете файл тук</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Поддържани формати: .xlsx, .xls
                </p>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Mapping */}
      {step === "mapping" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Съпоставяне на колони</CardTitle>
              <CardDescription>
                Файл: {fileName} • {rawData.length} реда • {excelColumns.length} колони
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Клас за учениците *</Label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Изберете клас" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes?.map(cls => (
                      <SelectItem key={cls._id} value={cls._id}>{cls.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-left text-sm font-medium">Колона в Excel</th>
                      <th className="p-3 text-left text-sm font-medium">Примерна стойност</th>
                      <th className="p-3 text-left text-sm font-medium">Поле в системата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excelColumns.map(col => (
                      <tr key={col} className="border-t">
                        <td className="p-3 font-medium text-sm">{col}</td>
                        <td className="p-3 text-muted-foreground text-sm">
                          {String(rawData[0]?.[col] || "-").slice(0, 40)}
                        </td>
                        <td className="p-3">
                          <Select 
                            value={columnMapping[col] || "__skip__"} 
                            onValueChange={(v) => handleMappingChange(col, v)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__skip__">
                                <span className="text-muted-foreground">Пропусни</span>
                              </SelectItem>
                              {Object.entries(fieldLabels).map(([key, label]) => (
                                <SelectItem key={key} value={key}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("upload")}>
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Назад
            </Button>
            <Button onClick={handleGoToPreview} disabled={!selectedClassId}>
              Преглед
              <ArrowRightIcon className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === "preview" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Преглед на данните</CardTitle>
              <CardDescription>
                {parsedData.length} ученици ще бъдат импортирани с техните родители
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left whitespace-nowrap">№</th>
                      <th className="p-2 text-left whitespace-nowrap">Ученик</th>
                      <th className="p-2 text-left whitespace-nowrap">Родител 1 (баща)</th>
                      <th className="p-2 text-left whitespace-nowrap">Тел. 1</th>
                      <th className="p-2 text-left whitespace-nowrap">Родител 2 (майка)</th>
                      <th className="p-2 text-left whitespace-nowrap">Тел. 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{row.studentNumber || idx + 1}</td>
                        <td className="p-2 font-medium">{row.studentName}</td>
                        <td className="p-2">
                          {[row.parent1FirstName, row.parent1MiddleName, row.parent1LastName].filter(Boolean).join(" ") || "-"}
                        </td>
                        <td className="p-2 text-muted-foreground">{row.parent1Phone || "-"}</td>
                        <td className="p-2">
                          {[row.parent2FirstName, row.parent2MiddleName, row.parent2LastName].filter(Boolean).join(" ") || "-"}
                        </td>
                        <td className="p-2 text-muted-foreground">{row.parent2Phone || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {parsedData.length > 10 && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  ... и още {parsedData.length - 10} реда
                </p>
              )}
              
              <Alert className="mt-4">
                <AlertCircleIcon className="h-4 w-4" />
                <AlertDescription>
                  <strong>Ще бъдат създадени:</strong>
                  <ul className="list-disc ml-4 mt-1">
                    <li>{parsedData.length} ученици</li>
                    <li>До {parsedData.filter(r => r.parent1FirstName && r.parent1LastName).length} родители (баща)</li>
                    <li>До {parsedData.filter(r => r.parent2FirstName && r.parent2LastName).length} родители (майка)</li>
                  </ul>
                  Всеки родител ще бъде автоматично свързан с детето си.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
          
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("mapping")}>
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Назад
            </Button>
            <Button onClick={handleStartImport}>
              Стартирай импорт
              <ArrowRightIcon className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Importing */}
      {step === "importing" && (
        <Card>
          <CardHeader>
            <CardTitle>Импортиране...</CardTitle>
            <CardDescription>
              Моля, изчакайте докато данните се импортират
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </CardContent>
        </Card>
      )}

      {/* Step: Done */}
      {step === "done" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
                Импортът завърши
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {importResults.studentsCreated}
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-300">
                    Ученици създадени
                  </div>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {importResults.parentsCreated}
                  </div>
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    Родители създадени
                  </div>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {importResults.failed}
                  </div>
                  <div className="text-sm text-red-700 dark:text-red-300">
                    Неуспешни
                  </div>
                </div>
              </div>
              
              {importResults.errors.length > 0 && (
                <div className="mt-4">
                  <Label className="text-sm font-medium">Грешки:</Label>
                  <div className="mt-2 max-h-40 overflow-y-auto bg-muted p-3 rounded-lg text-sm">
                    {importResults.errors.slice(0, 10).map((err, idx) => (
                      <div key={idx} className="text-red-600 dark:text-red-400">{err}</div>
                    ))}
                    {importResults.errors.length > 10 && (
                      <div className="text-muted-foreground mt-2">
                        ... и още {importResults.errors.length - 10} грешки
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => {
              setStep("upload");
              setFileName("");
              setExcelColumns([]);
              setRawData([]);
              setParsedData([]);
              setColumnMapping({});
              setImportResults({ success: 0, failed: 0, errors: [], studentsCreated: 0, parentsCreated: 0 });
            }}>
              Нов импорт
            </Button>
            <Button onClick={() => navigate(`/${lng}/admin/users`)}>
              Към потребители
              <ArrowRightIcon className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ImportStudentsParentsPage() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
      </AuthLoading>

      <Authenticated>
        <Layout>
          <ImportStudentsParentsPageInner />
        </Layout>
      </Authenticated>
    </>
  );
}
