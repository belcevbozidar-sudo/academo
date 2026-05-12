import Layout from "@/components/Layout.tsx";
import { Authenticated, AuthLoading, Unauthenticated } from "@/lib/convex-preview";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { 
  FileTextIcon, 
  ChevronLeftIcon,
  CheckIcon,
  BookOpenIcon,
  ClipboardListIcon,
  ActivityIcon,
  UsersIcon,
  CreditCardIcon,
  TrophyIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Label } from "@/components/ui/label.tsx";
import jsPDF from "jspdf";

// Report types organized by category
const REPORT_CATEGORIES = [
  {
    id: "diary",
    name: "Дневник",
    icon: BookOpenIcon,
    reports: [
      { id: "average-grade", name: "Среден успех" },
      { id: "average-grade-breakdown", name: "Среден успех (разбивка по оценки)" },
      { id: "low-grades", name: "Слаби оценки" },
      { id: "ungraded-students", name: "Неоформени ученици" },
      { id: "grading-rhythm", name: "Ритмичност на оценяване" },
      { id: "term-grades-absences", name: "Срочни/годишни оценки и отсъствия" },
      { id: "absent-students", name: "Отсъстващи ученици" },
      { id: "absences-total", name: "Отсъствия (общ брой)" },
      { id: "absent-students-reasons", name: "Отсъстващи ученици (по причини)" },
      { id: "absences-average", name: "Отсъствия (средно на ученик)" },
      { id: "absences-25-percent", name: "Отсъствия (25% от хорариум)" },
      { id: "absences-neispuo", name: "Отсъствия (за НЕИСПУО)" },
      { id: "health-insurance-18", name: "Здравно осигуряване на ученици, навършили 18 години" },
      { id: "praises-count", name: "Похвали (общ брой)" },
      { id: "remarks-count", name: "Забележки (общ брой)" },
      { id: "education-results", name: "Резултати от обучението" },
      { id: "students-doctors", name: "Ученици и лични лекари" },
      { id: "student-movement", name: "Движение на ученици" },
      { id: "student-book", name: "Ученическа книжка" },
      { id: "student-support", name: "Ученическа подкрепа" },
      { id: "tests-schedule", name: "График за контролни и класни работи" },
      { id: "past-years-grades", name: "Оценки от минали години" },
      { id: "students-count", name: "Ученици (общ брой)" },
      { id: "sfo-students-grades", name: "Оценки (СФО ученици)" },
    ],
  },
  {
    id: "lessons",
    name: "Занятия",
    icon: ClipboardListIcon,
    reports: [
      { id: "untaken-lessons", name: "Невзети занятия" },
      { id: "lessons-no-topic", name: "Взети занятия без тема" },
      { id: "lessons-lecturer", name: "Взети занятия (лекторски и по норматив)" },
      { id: "lessons-ores", name: "Взети занятия ОРЕС" },
      { id: "absent-teachers", name: "Отсъстващи учители" },
      { id: "lessons-ifo", name: "Занятия ИФО" },
      { id: "lessons-sop", name: "Занятия СОП" },
      { id: "second-class-hour", name: "Втори час на класа" },
    ],
  },
  {
    id: "activity",
    name: "Активност",
    icon: ActivityIcon,
    reports: [
      { id: "teacher-activity", name: "Учителска активност" },
      { id: "parent-activity", name: "Родителска активност" },
    ],
  },
  {
    id: "extracurricular",
    name: "Извънкласни дейности",
    icon: UsersIcon,
    reports: [
      { id: "extracurricular-activities", name: "Извънкласни дейности" },
    ],
  },
  {
    id: "fees",
    name: "Такси и задължения",
    icon: CreditCardIcon,
    reports: [
      { id: "payments", name: "Плащания" },
    ],
  },
  {
    id: "competitions",
    name: "Състезания",
    icon: TrophyIcon,
    reports: [
      { id: "competition-results", name: "Резултати от състезания" },
    ],
  },
];

// Secretary-specific allowed reports
const SECRETARY_ALLOWED_REPORTS = [
  // Дневник
  "absent-students",
  "absences-neispuo", 
  "students-doctors",
  "tests-schedule",
  "past-years-grades",
  "sfo-students-grades",
  // Занятия
  "lessons-lecturer",
  "lessons-ores",
  "second-class-hour",
  // Извънкласни дейности
  "extracurricular-activities",
  // Такси и задължения
  "payments",
];

// Element types
const ELEMENT_TYPES = [
  { id: "students", name: "Ученици", countKey: "studentsCount", goesToStep3: true },
  { id: "classes", name: "Паралелки", countKey: "classesCount", goesToStep3: true },
  { id: "grades", name: "Класове", countKey: "gradesCount", goesToStep3: true },
  { id: "school", name: "Училище", countKey: "schoolCount", goesToStep3: true },
];

// Grade types for the dropdown
const GRADE_TYPES = [
  { id: "all", name: "Всички текущи оценки" },
  { id: "classwork", name: "Класна работа" },
  { id: "test", name: "Контролна работа" },
  { id: "homework", name: "Домашна работа" },
  { id: "oral", name: "Устно изпитване" },
  { id: "term", name: "Срочна" },
  { id: "annual", name: "Годишна" },
  { id: "quiz", name: "Тест" },
  { id: "self-work", name: "Самостоятелна работа" },
  { id: "project", name: "Проект" },
  { id: "active-participation", name: "Активно участие" },
  { id: "practical", name: "Практическо изпитване" },
  { id: "entry-level", name: "Входно ниво" },
  { id: "exit-level", name: "Изходно ниво" },
  { id: "written", name: "Писмено изпитване" },
  { id: "intermediate-level", name: "Междинно ниво" },
  { id: "from-other-school", name: "От друго училище" },
  { id: "from-other-class", name: "От друга паралелка" },
];

// Subject groups to exclude
const SUBJECT_GROUPS = [
  { id: "fuch", name: "ФУЧ (факултативни учебни часове)" },
  { id: "iuch", name: "ИУЧ (избираеми учебни часове)" },
  { id: "sip", name: "СИП (свободноизбираема подготовка)" },
  { id: "zip", name: "ЗИП (задължителноизбираема подготовка)" },
  { id: "zpp", name: "ЗПП (задължителна професионална подготовка)" },
  { id: "oplr", name: "ОПЛР (обща подкрепа за личностно развитие)" },
  { id: "dplr", name: "ДПЛР (допълнителна подкрепа за личностно развитие)" },
  { id: "ofpv", name: "ОФПВ (основни форми на педагогическо взаимодействие)" },
  { id: "dco", name: "ДЦО (дейности в целодневна организация)" },
  { id: "extra", name: "...(часове извън учебния план)" },
];

function NewReportPageInner() {
  const { lng } = useParams();
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedReportType, setSelectedReportType] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<string>("students");
  
  // Step 3 state
  const [scopeSchool, setScopeSchool] = useState("whole-school");
  const [scopeYear, setScopeYear] = useState("whole-year");
  const [scopeGrades, setScopeGrades] = useState("all");
  const [excludedGroups, setExcludedGroups] = useState<string[]>([]);
  
  // Report generation state
  const [generatedReport, setGeneratedReport] = useState<{
    name: string;
    data: Array<{
      subject: string;
      testedStudents: number;
      grade2: number;
      grade3: number;
      grade4: number;
      grade5: number;
      grade6: number;
      averageGrade: string;
    }>;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Get current user for role-based filtering
  const currentUser = useQuery(api.users.getCurrentUser, {});
  
  // Get counts for elements
  const students = useQuery(api.users.getAllStudents, {});
  const classes = useQuery(api.admin.listClasses, {});
  const termConfig = useQuery(api.terms.getCurrentTermConfig, {});
  
  // Create report mutation
  const createReport = useMutation(api.reports.createReport);
  
  // Filter report categories based on user role
  const filteredReportCategories = useMemo(() => {
    const isSecretary = currentUser?.role === "secretary" || currentUser?.roles?.includes("secretary");
    const isAdmin = currentUser?.role === "system_admin" || 
                    currentUser?.role === "director" || 
                    currentUser?.role === "vice_director" ||
                    currentUser?.roles?.includes("system_admin") ||
                    currentUser?.roles?.includes("director") ||
                    currentUser?.roles?.includes("vice_director");
    
    // Admin roles see all reports
    if (isAdmin) {
      return REPORT_CATEGORIES;
    }
    
    // Secretary sees only specific reports
    if (isSecretary) {
      return REPORT_CATEGORIES
        .map(category => ({
          ...category,
          reports: category.reports.filter(report => 
            SECRETARY_ALLOWED_REPORTS.includes(report.id)
          )
        }))
        .filter(category => category.reports.length > 0);
    }
    
    // Other roles see all reports (teachers, etc.)
    return REPORT_CATEGORIES;
  }, [currentUser]);
  
  const studentsCount = students?.length ?? 0;
  const classesCount = classes?.length ?? 0;
  // Calculate unique grade numbers (1-12)
  const gradesCount = classes ? new Set(classes.map((c: { grade: number }) => c.grade)).size : 0;
  const schoolCount = 1;

  // Build class options for dropdown
  const classOptions = classes ? 
    classes
      .slice()
      .sort((a, b) => {
        if (a.grade !== b.grade) return a.grade - b.grade;
        return (a.letter || "").localeCompare(b.letter || "");
      })
      .map((c) => ({
        id: c._id,
        name: `${c.grade}${c.letter || ""}`,
      }))
    : [];

  // Build year/term options
  const yearOptions = [
    { id: "whole-year", name: "Цялата година" },
    { id: "term-1", name: "Срок 1" },
    { id: "term-2", name: "Срок 2" },
    { id: "custom", name: "Изберете период" },
  ];

  const getCounts = (elementId: string) => {
    switch (elementId) {
      case "students": return studentsCount;
      case "classes": return classesCount;
      case "grades": return gradesCount;
      case "school": return schoolCount;
      default: return 0;
    }
  };

  const getSelectedReportName = () => {
    for (const category of REPORT_CATEGORIES) {
      const report = category.reports.find(r => r.id === selectedReportType);
      if (report) return report.name;
    }
    return "";
  };

  const handleSelectReport = (reportId: string) => {
    setSelectedReportType(reportId);
    // Auto-navigate to step 2
    setCurrentStep(2);
  };

  const handleSelectElement = (elementId: string) => {
    setSelectedElement(elementId);
    const element = ELEMENT_TYPES.find(e => e.id === elementId);
    // Auto-navigate to step 3 if it's Паралелки or Ученици
    if (element?.goesToStep3) {
      setCurrentStep(3);
    }
  };

  const handleNext = () => {
    if (currentStep === 1 && !selectedReportType) {
      toast.error("Моля, изберете тип справка");
      return;
    }
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (generatedReport) {
      setGeneratedReport(null);
      return;
    }
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigate(`/${lng}/reports`);
    }
  };

  const toggleExcludedGroup = (groupId: string) => {
    setExcludedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleGenerateReport = async () => {
    if (!selectedReportType) {
      toast.error("Моля, изберете тип справка");
      return;
    }

    setIsGenerating(true);
    try {
      const reportId = await createReport({
        name: getSelectedReportName(),
        type: selectedReportType,
        elements: [selectedElement],
        scopeSchool,
        scopeYear,
        scopeGrades,
        excludedGroups,
      });

      toast.success("Справката е генерирана успешно!");
      // Директно навигиране към справката
      navigate(`/${lng}/reports/${reportId}`);
    } catch (error) {
      toast.error("Грешка при генериране на справката");
    } finally {
      setIsGenerating(false);
    }
  };

  const exportToPDF = () => {
    if (!generatedReport) return;
    
    const doc = new jsPDF();
    doc.setFont("helvetica");
    doc.setFontSize(16);
    doc.text(generatedReport.name, 20, 20);
    
    doc.setFontSize(10);
    let y = 40;
    
    // Headers
    doc.text("Предмет", 20, y);
    doc.text("Бр.", 80, y);
    doc.text("2", 95, y);
    doc.text("3", 105, y);
    doc.text("4", 115, y);
    doc.text("5", 125, y);
    doc.text("6", 135, y);
    doc.text("Ср.", 150, y);
    
    y += 10;
    
    for (const row of generatedReport.data) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(row.subject.substring(0, 30), 20, y);
      doc.text(String(row.testedStudents), 80, y);
      doc.text(String(row.grade2), 95, y);
      doc.text(String(row.grade3), 105, y);
      doc.text(String(row.grade4), 115, y);
      doc.text(String(row.grade5), 125, y);
      doc.text(String(row.grade6), 135, y);
      doc.text(row.averageGrade, 150, y);
      y += 8;
    }
    
    doc.save(`${generatedReport.name}.pdf`);
    toast.success("PDF файлът е изтеглен");
  };

  const exportToExcel = () => {
    if (!generatedReport) return;
    
    // Create CSV content
    const headers = ["Предмет", "Изпитани", "2", "3", "4", "5", "6", "Среден успех"];
    const rows = generatedReport.data.map(row => [
      row.subject,
      row.testedStudents,
      row.grade2,
      row.grade3,
      row.grade4,
      row.grade5,
      row.grade6,
      row.averageGrade,
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(",")),
    ].join("\n");
    
    // Add BOM for Excel UTF-8 support
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${generatedReport.name}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success("Excel файлът е изтеглен");
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <FileTextIcon className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">
            Нова справка {selectedReportType && getSelectedReportName()}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleBack}>
            <ChevronLeftIcon className="h-4 w-4 mr-1" />
            Назад
          </Button>
          {currentStep === 3 && !generatedReport && (
            <Button 
              onClick={handleGenerateReport}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              disabled={isGenerating}
            >
              <CheckIcon className="h-4 w-4 mr-1" />
              {isGenerating ? "Генериране..." : "ГЕНЕРИРАЙ СПРАВКА"}
            </Button>
          )}
          {currentStep < 3 && (
            <Button 
              onClick={handleNext}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <CheckIcon className="h-4 w-4 mr-1" />
              Запази и премини
            </Button>
          )}
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex mb-6">
        <div 
          className={`flex-1 py-4 px-6 text-center font-medium text-white rounded-l-lg cursor-pointer ${
            currentStep === 1 ? 'bg-emerald-500' : 'bg-emerald-400'
          }`}
          onClick={() => setCurrentStep(1)}
        >
          <div className="flex items-center justify-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 text-lg">1</span>
            <span>ТИП СПРАВКА</span>
            {currentStep > 1 && <CheckIcon className="h-5 w-5 ml-2" />}
          </div>
          {currentStep > 1 && <span className="text-sm opacity-80">OK</span>}
        </div>
        <div 
          className={`flex-1 py-4 px-6 text-center font-medium cursor-pointer ${
            currentStep === 2 ? 'bg-emerald-500 text-white' : currentStep > 2 ? 'bg-emerald-400 text-white' : 'bg-gray-200 text-gray-600'
          }`}
          onClick={() => currentStep > 1 && setCurrentStep(2)}
        >
          <div className="flex items-center justify-center gap-2">
            <span className={`flex items-center justify-center w-8 h-8 rounded-full text-lg ${
              currentStep >= 2 ? 'bg-white/20' : 'bg-gray-300'
            }`}>2</span>
            <span>ЕЛЕМЕНТИ</span>
            {currentStep > 2 && <CheckIcon className="h-5 w-5 ml-2" />}
          </div>
          {currentStep > 2 && <span className="text-sm opacity-80">OK</span>}
        </div>
        <div 
          className={`flex-1 py-4 px-6 text-center font-medium rounded-r-lg cursor-pointer ${
            currentStep === 3 ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-600'
          }`}
          onClick={() => currentStep > 2 && setCurrentStep(3)}
        >
          <div className="flex items-center justify-center gap-2">
            <span className={`flex items-center justify-center w-8 h-8 rounded-full text-lg ${
              currentStep === 3 ? 'bg-white/20' : 'bg-gray-300'
            }`}>3</span>
            <span>ОБХВАТ</span>
          </div>
        </div>
      </div>

      {/* Step content */}
      <Card>
        <CardContent className="p-6">
          {currentStep === 1 && (
            <div>
              <p className="text-lg mb-6">Изберете типа справка, която желаете да генерирате:</p>
              
              <div className="space-y-6">
                {filteredReportCategories.map((category) => (
                  <div key={category.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <category.icon className="h-5 w-5 text-emerald-600" />
                      <span className="font-medium text-lg">{category.name}</span>
                    </div>
                    <div className="ml-7 space-y-2">
                      {category.reports.map((report) => (
                        <label 
                          key={report.id}
                          className={`flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded-md transition-colors ${
                            selectedReportType === report.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
                          }`}
                          onClick={() => handleSelectReport(report.id)}
                        >
                          <input
                            type="radio"
                            name="reportType"
                            value={report.id}
                            checked={selectedReportType === report.id}
                            onChange={() => {}}
                            className="w-4 h-4 text-emerald-500 border-gray-300 focus:ring-emerald-500"
                          />
                          <span className="text-muted-foreground">{report.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <p className="text-lg mb-6">Изберете типа елементи, които желаете да присъстват в справката:</p>
              
              <div className="space-y-3">
                {ELEMENT_TYPES.map((element) => (
                  <label 
                    key={element.id}
                    className={`flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-3 rounded-md transition-colors ${
                      selectedElement === element.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
                    }`}
                    onClick={() => handleSelectElement(element.id)}
                  >
                    <input
                      type="radio"
                      name="elementType"
                      value={element.id}
                      checked={selectedElement === element.id}
                      onChange={() => {}}
                      className="w-4 h-4 text-emerald-500 border-gray-300 focus:ring-emerald-500"
                    />
                    <span className="text-muted-foreground">
                      {element.name} - {getCounts(element.id)} {element.id === "school" ? "брой" : "броя"}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="max-w-2xl mx-auto">
              <p className="text-lg mb-6">
                Изберете обхват на справката, в случай че желаете да ограничите крайния резултат:
              </p>
              
              <div className="space-y-4">
                {/* School/Class scope */}
                <Select value={scopeSchool} onValueChange={setScopeSchool}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Цялото училище" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whole-school">Цялото училище</SelectItem>
                    {classOptions.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Year/Term scope */}
                <Select value={scopeYear} onValueChange={setScopeYear}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Цялата година" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Grade types scope */}
                <Select value={scopeGrades} onValueChange={setScopeGrades}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Всички текущи оценки" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADE_TYPES.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject groups to exclude */}
              <div className="mt-8">
                <p className="text-lg mb-4">Изключи от справката следните групи предмети:</p>
                <div className="space-y-3">
                  {SUBJECT_GROUPS.map((group) => (
                    <div key={group.id} className="flex items-center gap-3">
                      <Checkbox
                        id={group.id}
                        checked={excludedGroups.includes(group.id)}
                        onCheckedChange={() => toggleExcludedGroup(group.id)}
                      />
                      <Label htmlFor={group.id} className="cursor-pointer text-muted-foreground">
                        {group.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Generated Report View */}
          {generatedReport && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">{generatedReport.name}</h2>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={exportToPDF}>
                    <DownloadIcon className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button variant="outline" onClick={exportToExcel}>
                    <FileSpreadsheetIcon className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted">
                      <th className="border p-2 text-left">Предмет</th>
                      <th className="border p-2 text-center">Изпитани</th>
                      <th className="border p-2 text-center">2</th>
                      <th className="border p-2 text-center">3</th>
                      <th className="border p-2 text-center">4</th>
                      <th className="border p-2 text-center">5</th>
                      <th className="border p-2 text-center">6</th>
                      <th className="border p-2 text-center">Ср. успех</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generatedReport.data.map((row, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "" : "bg-muted/30"}>
                        <td className="border p-2">{row.subject}</td>
                        <td className="border p-2 text-center">{row.testedStudents}</td>
                        <td className="border p-2 text-center">{row.grade2}</td>
                        <td className="border p-2 text-center">{row.grade3}</td>
                        <td className="border p-2 text-center">{row.grade4}</td>
                        <td className="border p-2 text-center">{row.grade5}</td>
                        <td className="border p-2 text-center">{row.grade6}</td>
                        <td className="border p-2 text-center font-semibold">{row.averageGrade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewReportPage() {
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
          <NewReportPageInner />
        </Layout>
      </Authenticated>
    </>
  );
}
