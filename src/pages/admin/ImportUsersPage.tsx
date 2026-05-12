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
import { ArrowLeftIcon, UploadIcon, FileSpreadsheetIcon, CheckCircleIcon, AlertCircleIcon, XIcon, ArrowRightIcon } from "lucide-react";
import * as XLSX from "xlsx";

// System field definitions with Bulgarian labels and aliases
const SYSTEM_FIELDS = [
  { 
    key: "firstName", 
    label: "Име", 
    required: false,
    aliases: ["име", "first name", "firstname", "first_name", "собствено име", "name"]
  },
  { 
    key: "middleName", 
    label: "Презиме", 
    required: false,
    aliases: ["презиме", "middle name", "middlename", "middle_name", "бащино име"]
  },
  { 
    key: "lastName", 
    label: "Фамилия", 
    required: false,
    aliases: ["фамилия", "last name", "lastname", "last_name", "фамилно име", "surname"]
  },
  { 
    key: "identifier", 
    label: "ЕГН/ЛНЧ", 
    required: false,
    aliases: ["егн", "лнч", "identifier", "egn", "id", "идентификатор", "лич.№", "личен номер"]
  },
  { 
    key: "birthDate", 
    label: "Дата на раждане", 
    required: false,
    aliases: ["дата на раждане", "birth date", "birthdate", "birth_date", "роден на", "дата раждане"]
  },
  { 
    key: "birthPlace", 
    label: "Място на раждане", 
    required: false,
    aliases: ["място на раждане", "birth place", "birthplace", "birth_place", "роден в"]
  },
  { 
    key: "citizenship", 
    label: "Гражданство", 
    required: false,
    aliases: ["гражданство", "citizenship", "nationality", "националност"]
  },
  { 
    key: "gender", 
    label: "Пол", 
    required: false,
    aliases: ["пол", "gender", "sex"]
  },
  { 
    key: "phone", 
    label: "Телефон", 
    required: false,
    aliases: ["телефон", "phone", "tel", "тел", "mobile", "мобилен"]
  },
  { 
    key: "email", 
    label: "Имейл", 
    required: false,
    aliases: ["имейл", "email", "e-mail", "електронна поща", "поща"]
  },
  { 
    key: "username", 
    label: "Потребителско име", 
    required: false,
    aliases: ["потребителско име", "username", "user", "login", "потребител"]
  },
  { 
    key: "password", 
    label: "Парола", 
    required: false,
    aliases: ["парола", "password", "pass"]
  },
  { 
    key: "role", 
    label: "Роля", 
    required: false,
    aliases: ["роля", "role", "тип", "type"]
  },
  { 
    key: "className", 
    label: "Клас (за ученици)", 
    required: false,
    aliases: ["клас", "class", "паралелка", "class name"]
  },
  { 
    key: "studentNumber", 
    label: "Номер в клас", 
    required: false,
    aliases: ["номер", "student number", "№", "номер в клас", "number"]
  },
  { 
    key: "parent1Name", 
    label: "Родител 1 (име)", 
    required: false,
    aliases: ["родител 1", "parent 1", "майка", "mother", "баща", "father", "родител"]
  },
  { 
    key: "parent2Name", 
    label: "Родител 2 (име)", 
    required: false,
    aliases: ["родител 2", "parent 2", "втори родител"]
  },
  { 
    key: "personalDoctor", 
    label: "Личен лекар", 
    required: false,
    aliases: ["личен лекар", "doctor", "gp", "лекар"]
  },
  { 
    key: "address", 
    label: "Адрес", 
    required: false,
    aliases: ["адрес", "address", "местожителство"]
  },
  { 
    key: "parentOfStudent", 
    label: "Родител на (ученик)", 
    required: false,
    aliases: ["родител на", "parent of", "parentof", "родител на ученик"]
  },
  { 
    key: "doctorOfStudent", 
    label: "Личен лекар на (ученик)", 
    required: false,
    aliases: ["личен лекар на", "doctor of", "лекар на", "лекар на ученик"]
  },
];

type MappingState = Record<string, string>; // Excel column -> system field

function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/[_\-\s]+/g, " ");
}

function findBestMatch(excelColumn: string): string | null {
  const normalized = normalizeText(excelColumn);
  
  for (const field of SYSTEM_FIELDS) {
    // Check exact match with label
    if (normalizeText(field.label) === normalized) {
      return field.key;
    }
    // Check aliases
    for (const alias of field.aliases) {
      if (normalizeText(alias) === normalized) {
        return field.key;
      }
      // Check if alias is contained in column name or vice versa
      if (normalized.includes(normalizeText(alias)) || normalizeText(alias).includes(normalized)) {
        return field.key;
      }
    }
  }
  
  return null;
}

interface ParsedRow {
  [key: string]: string | number | boolean | null;
}

function ImportUsersPageInner() {
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();
  const classes = useQuery(api.admin.listClasses, {});
  const defaultSchool = useQuery(api.admin.getDefaultSchool, {});
  const bulkCreateUsers = useAction(api.usersActions.bulkCreateUsersAction);
  
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "importing" | "done">("upload");
  const [fileName, setFileName] = useState<string>("");
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<MappingState>({});
  const [defaultRole, setDefaultRole] = useState<string>("student");
  const [defaultClassId, setDefaultClassId] = useState<string>("");
  const [importResults, setImportResults] = useState<{ success: number; failed: number; errors: string[] }>({ success: 0, failed: 0, errors: [] });
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
        const jsonData = XLSX.utils.sheet_to_json<ParsedRow>(worksheet, { defval: "" });
        
        if (jsonData.length === 0) {
          toast.error("Файлът е празен или няма данни");
          return;
        }
        
        // Get column headers
        const headers = Object.keys(jsonData[0]);
        setExcelColumns(headers);
        setParsedData(jsonData);
        
        // Auto-map columns
        const autoMapping: MappingState = {};
        for (const header of headers) {
          const match = findBestMatch(header);
          if (match) {
            autoMapping[header] = match;
          }
        }
        setMapping(autoMapping);
        
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
    setMapping(prev => {
      const newMapping = { ...prev };
      if (systemField === "__skip__") {
        delete newMapping[excelColumn];
      } else {
        newMapping[excelColumn] = systemField;
      }
      return newMapping;
    });
  };

  const transformDataForImport = (): Array<Record<string, unknown>> => {
    return parsedData.map((row) => {
      const transformed: Record<string, unknown> = {};
      
      // Apply mappings
      for (const [excelCol, systemField] of Object.entries(mapping)) {
        const value = row[excelCol];
        if (value !== null && value !== undefined && value !== "") {
          // Handle special transformations
          if (systemField === "gender") {
            const genderValue = String(value).toLowerCase();
            if (genderValue === "м" || genderValue === "мъж" || genderValue === "male" || genderValue === "m") {
              transformed.gender = "male";
            } else if (genderValue === "ж" || genderValue === "жена" || genderValue === "female" || genderValue === "f") {
              transformed.gender = "female";
            } else {
              transformed.gender = "other";
            }
          } else if (systemField === "birthDate") {
            // Try to parse date
            const dateValue = value;
            if (typeof dateValue === "number") {
              // Excel serial date
              const date = XLSX.SSF.parse_date_code(dateValue);
              if (date) {
                transformed.birthDate = `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
              }
            } else if (typeof dateValue === "string") {
              // Try to parse string date
              const parsed = new Date(dateValue);
              if (!isNaN(parsed.getTime())) {
                transformed.birthDate = parsed.toISOString().split("T")[0];
              } else {
                transformed.birthDate = dateValue;
              }
            }
          } else if (systemField === "role") {
            // Map role values
            const roleValue = String(value).toLowerCase();
            if (roleValue.includes("учител") || roleValue === "teacher") {
              transformed.role = "teacher";
            } else if (roleValue.includes("ученик") || roleValue === "student") {
              transformed.role = "student";
            } else if (roleValue.includes("родител") || roleValue === "parent") {
              transformed.role = "parent";
            } else if (roleValue.includes("директор") || roleValue === "director") {
              transformed.role = "director";
            } else {
              transformed.role = defaultRole;
            }
          } else {
            transformed[systemField] = String(value);
          }
        }
      }
      
      // Apply defaults if not set
      if (!transformed.role) {
        transformed.role = defaultRole;
      }
      
      // If student and no class mapped, try to match by className
      if (transformed.role === "student" && !transformed.classId) {
        if (transformed.className && classes) {
          const classMatch = classes.find(c => 
            c.name.toLowerCase() === String(transformed.className).toLowerCase() ||
            c.name.toLowerCase().includes(String(transformed.className).toLowerCase())
          );
          if (classMatch) {
            transformed.classId = classMatch._id;
          }
        }
        // Fallback to default class
        if (!transformed.classId && defaultClassId) {
          transformed.classId = defaultClassId;
        }
      }
      
      // Generate username and password if not provided
      if (!transformed.username) {
        const firstName = String(transformed.firstName || "").toLowerCase().replace(/\s+/g, "");
        const lastName = String(transformed.lastName || "").toLowerCase().replace(/\s+/g, "");
        const identifier = String(transformed.identifier || "").slice(-4);
        transformed.username = `${firstName}${lastName}${identifier}`.replace(/[^a-z0-9]/gi, "") || `user${Date.now()}`;
      }
      if (!transformed.password) {
        transformed.password = `Pass${String(transformed.identifier || "").slice(-4) || Math.random().toString(36).slice(-4)}!`;
      }
      
      // Generate email if not provided
      if (!transformed.email) {
        transformed.email = `${transformed.username}@temp.local`;
      }
      
      // Generate phone if not provided
      if (!transformed.phone) {
        transformed.phone = "+359000000000";
      }
      
      // Generate identifier if not provided
      if (!transformed.identifier) {
        transformed.identifier = `TEMP${Date.now()}${Math.random().toString(36).slice(-4)}`.toUpperCase();
      }
      
      return transformed;
    });
  };

  const handleStartImport = async () => {
    setIsImporting(true);
    setStep("importing");
    
    const transformedData = transformDataForImport();
    const schoolId = defaultSchool?.schoolId;
    
    const results = { success: 0, failed: 0, errors: [] as string[] };
    
    // Import in batches of 10
    const batchSize = 10;
    for (let i = 0; i < transformedData.length; i += batchSize) {
      const batch = transformedData.slice(i, i + batchSize);
      
      try {
        const batchResult = await bulkCreateUsers({
          users: batch.map(user => ({
            firstName: String(user.firstName || ""),
            middleName: user.middleName ? String(user.middleName) : undefined,
            lastName: String(user.lastName || ""),
            identifier: String(user.identifier || ""),
            identifierType: "egn" as const,
            birthDate: user.birthDate ? String(user.birthDate) : undefined,
            birthPlace: user.birthPlace ? String(user.birthPlace) : undefined,
            citizenship: user.citizenship ? String(user.citizenship) : undefined,
            gender: (user.gender as "male" | "female" | "other") || "male",
            phone: String(user.phone || "+359000000000"),
            email: String(user.email || ""),
            username: String(user.username || ""),
            password: String(user.password || ""),
            role: (user.role as "teacher" | "student" | "parent" | "director" | "vice_director" | "system_admin" | "secretary" | "pedagogical_counselor" | "housekeeper") || "student",
            roles: [user.role as "teacher" | "student" | "parent" | "director" | "vice_director" | "system_admin" | "secretary" | "pedagogical_counselor" | "housekeeper" || "student"],
            classId: user.classId ? (user.classId as Id<"classes">) : undefined,
            studentNumber: user.studentNumber ? parseInt(String(user.studentNumber)) : undefined,
            parent1Name: user.parent1Name ? String(user.parent1Name) : undefined,
            parent2Name: user.parent2Name ? String(user.parent2Name) : undefined,
            personalDoctor: user.personalDoctor ? String(user.personalDoctor) : undefined,
            address: user.address ? String(user.address) : undefined,
            schoolId: schoolId || undefined,
            isActive: true,
            // New fields for parent/doctor linking
            parentOfStudent: user.parentOfStudent ? String(user.parentOfStudent) : undefined,
            doctorOfStudent: user.doctorOfStudent ? String(user.doctorOfStudent) : undefined,
          })),
          skipValidation: true, // Allow missing required fields
        });
        
        results.success += batchResult.success;
        results.failed += batchResult.failed;
        results.errors.push(...batchResult.errors);
      } catch (error) {
        console.error("Batch import error:", error);
        results.failed += batch.length;
        results.errors.push(`Грешка при импорт на партида ${Math.floor(i / batchSize) + 1}: ${error instanceof Error ? error.message : "Неизвестна грешка"}`);
      }
    }
    
    setImportResults(results);
    setIsImporting(false);
    setStep("done");
    
    if (results.success > 0) {
      toast.success(`Успешно импортирани: ${results.success} потребителя`);
    }
    if (results.failed > 0) {
      toast.error(`Неуспешни: ${results.failed} потребителя`);
    }
  };

  const previewData = transformDataForImport().slice(0, 5);

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
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Импорт от Excel</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Качете Excel файл с данни за потребители
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
              Изберете Excel файл (.xlsx, .xls) с данни за потребители
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircleIcon className="h-4 w-4" />
              <AlertDescription>
                <strong>Важно:</strong> Системата автоматично ще разпознае колоните по име. 
                Дори имената да не съвпадат точно или да липсват задължителни полета, 
                импортът ще продължи успешно.
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
                Файл: {fileName} • {parsedData.length} реда • {excelColumns.length} колони
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Роля по подразбиране</Label>
                  <Select value={defaultRole} onValueChange={setDefaultRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Ученик</SelectItem>
                      <SelectItem value="teacher">Учител</SelectItem>
                      <SelectItem value="parent">Родител</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {defaultRole === "student" && (
                  <div className="space-y-2">
                    <Label>Клас по подразбиране (за ученици)</Label>
                    <Select value={defaultClassId} onValueChange={setDefaultClassId}>
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
                )}
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
                        <td className="p-3 font-medium">{col}</td>
                        <td className="p-3 text-muted-foreground text-sm">
                          {String(parsedData[0]?.[col] || "-").slice(0, 30)}
                        </td>
                        <td className="p-3">
                          <Select 
                            value={mapping[col] || "__skip__"} 
                            onValueChange={(v) => handleMappingChange(col, v)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__skip__">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                  <XIcon className="h-3 w-3" /> Пропусни
                                </span>
                              </SelectItem>
                              {SYSTEM_FIELDS.map(field => (
                                <SelectItem key={field.key} value={field.key}>
                                  {field.label}
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
            <Button onClick={() => setStep("preview")}>
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
                Показване на първите 5 реда за проверка
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-left whitespace-nowrap">Име</th>
                      <th className="p-2 text-left whitespace-nowrap">Фамилия</th>
                      <th className="p-2 text-left whitespace-nowrap">ЕГН</th>
                      <th className="p-2 text-left whitespace-nowrap">Имейл</th>
                      <th className="p-2 text-left whitespace-nowrap">Роля</th>
                      <th className="p-2 text-left whitespace-nowrap">Потр. име</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{String(row.firstName || "-")}</td>
                        <td className="p-2">{String(row.lastName || "-")}</td>
                        <td className="p-2">{String(row.identifier || "-")}</td>
                        <td className="p-2">{String(row.email || "-")}</td>
                        <td className="p-2">{String(row.role || "-")}</td>
                        <td className="p-2">{String(row.username || "-")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <Alert className="mt-4">
                <AlertCircleIcon className="h-4 w-4" />
                <AlertDescription>
                  Ще бъдат импортирани <strong>{parsedData.length}</strong> потребителя.
                  Липсващите задължителни полета ще бъдат генерирани автоматично.
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
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {importResults.success}
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-300">
                    Успешно импортирани
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
              setParsedData([]);
              setMapping({});
              setImportResults({ success: 0, failed: 0, errors: [] });
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

export default function ImportUsersPage() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
      </AuthLoading>

      <Authenticated>
        <Layout>
          <ImportUsersPageInner />
        </Layout>
      </Authenticated>
    </>
  );
}
