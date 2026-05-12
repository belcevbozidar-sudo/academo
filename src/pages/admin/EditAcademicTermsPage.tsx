import Layout from "@/components/Layout.tsx";
import { Authenticated, AuthLoading } from "@/lib/convex-preview";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeftIcon, CheckIcon } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils.ts";

interface TermData {
  termNumber: number;
  startDate: string;
  endDate: string;
}

function EditAcademicTermsInner() {
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const classesByGrade = useQuery(api.terms.getClassesForTermEdit, {});
  const currentConfig = useQuery(api.terms.getCurrentTermConfig, {});
  const saveConfig = useMutation(api.terms.saveTermConfigurations);
  
  const [step, setStep] = useState(1);
  const [termCount, setTermCount] = useState(2);
  const [terms, setTerms] = useState<TermData[]>([
    { termNumber: 1, startDate: "2024-09-16", endDate: "2025-02-04" },
    { termNumber: 2, startDate: "2025-02-06", endDate: "2025-06-30" },
  ]);
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set());
  const [academicYear, setAcademicYear] = useState("2025/2026");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Generate academic year options
  const academicYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: string[] = [];
    for (let y = currentYear - 2; y <= currentYear + 2; y++) {
      years.push(`${y}/${y + 1}`);
    }
    return years;
  }, []);

  // Load current config
  useEffect(() => {
    if (currentConfig && !isLoaded) {
      setTermCount(currentConfig.termCount);
      setTerms(currentConfig.terms);
      if (currentConfig.academicYear) {
        setAcademicYear(currentConfig.academicYear);
      }
      setIsLoaded(true);
    }
  }, [currentConfig, isLoaded]);

  // Update terms array when termCount changes
  useEffect(() => {
    const newTerms: TermData[] = [];
    for (let i = 1; i <= termCount; i++) {
      const existing = terms.find(t => t.termNumber === i);
      if (existing) {
        newTerms.push(existing);
      } else {
        // Generate reasonable defaults
        newTerms.push({
          termNumber: i,
          startDate: "",
          endDate: "",
        });
      }
    }
    setTerms(newTerms);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termCount]);

  // Check permissions
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

  if (classesByGrade === undefined || currentConfig === undefined) {
    return <Skeleton className="h-96 w-full" />;
  }

  const toggleClass = (classId: string) => {
    const newSet = new Set(selectedClassIds);
    if (newSet.has(classId)) {
      newSet.delete(classId);
    } else {
      newSet.add(classId);
    }
    setSelectedClassIds(newSet);
  };

  const selectAll = () => {
    const allIds = new Set<string>();
    Object.values(classesByGrade).forEach(classes => {
      classes.forEach(cls => allIds.add(cls._id));
    });
    setSelectedClassIds(allIds);
  };

  const clearSelection = () => {
    setSelectedClassIds(new Set());
  };

  const updateTermDate = (termNumber: number, field: "startDate" | "endDate", value: string) => {
    setTerms(prev => prev.map(t => 
      t.termNumber === termNumber ? { ...t, [field]: value } : t
    ));
  };

  const handleSubmit = async () => {
    // Validate
    for (const term of terms) {
      if (!term.startDate || !term.endDate) {
        toast.error(`Моля, въведете дати за срок ${term.termNumber}`);
        return;
      }
    }

    if (selectedClassIds.size === 0) {
      toast.error("Моля, изберете поне една паралелка");
      return;
    }

    setIsSubmitting(true);
    try {
      await saveConfig({
        termCount,
        terms,
        classIds: Array.from(selectedClassIds) as Id<"classes">[],
        academicYear,
      });
      toast.success(`Успешно актуализирани ${selectedClassIds.size} паралелки`);
      navigate(`/${lng}/admin/academic-terms`);
    } catch (error) {
      toast.error("Грешка при запазване");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sort grades
  const sortedGrades = Object.keys(classesByGrade)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <span className="text-muted-foreground">📝</span> Редакция на учебни срокове
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/${lng}/admin/academic-terms`)}
          >
            <ChevronLeftIcon className="h-4 w-4 mr-1" />
            Назад
          </Button>
          <Button
            onClick={step === 1 ? () => setStep(2) : handleSubmit}
            disabled={isSubmitting}
            className="bg-teal-500 hover:bg-teal-600"
          >
            <CheckIcon className="h-4 w-4 mr-1" />
            {step === 1 ? "Продължи" : (isSubmitting ? "Запазване..." : "Запази и премени")}
          </Button>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex">
        <button
          onClick={() => setStep(1)}
          className={cn(
            "flex-1 py-3 px-6 font-medium rounded-l-lg flex items-center justify-center gap-2 transition-colors",
            step === 1
              ? "bg-teal-500 text-white"
              : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
          )}
        >
          <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm">1</span>
          УЧЕБНИ СРОКОВЕ
        </button>
        <button
          onClick={() => setStep(2)}
          className={cn(
            "flex-1 py-3 px-6 font-medium rounded-r-lg flex items-center justify-center gap-2 transition-colors",
            step === 2
              ? "bg-teal-500 text-white"
              : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
          )}
        >
          <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm">2</span>
          ПОТВЪРЖДЕНИЕ
        </button>
      </div>

      {/* Step 1: Term Configuration */}
      {step === 1 && (
        <div className="bg-card rounded-lg border p-6 space-y-6">
          {/* Term Count and Dates */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Брой срокове:*</Label>
                <Select
                  value={String(termCount)}
                  onValueChange={(val) => setTermCount(Number(val))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {terms.map((term) => (
                <div key={term.termNumber} className="space-y-2">
                  <Label>Начало срок {term.termNumber}:*</Label>
                  <Input
                    type="date"
                    value={term.startDate}
                    onChange={(e) => updateTermDate(term.termNumber, "startDate", e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Учебна година:*</Label>
                <Select
                  value={academicYear}
                  onValueChange={setAcademicYear}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYearOptions.map((year) => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {terms.map((term) => (
                <div key={term.termNumber} className="space-y-2">
                  <Label>Край на срок {term.termNumber}:*</Label>
                  <Input
                    type="date"
                    value={term.endDate}
                    onChange={(e) => updateTermDate(term.termNumber, "endDate", e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Class Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Паралелки:*</Label>
            </div>

            <div className="border rounded-lg overflow-hidden">
              {/* Header */}
              <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 flex items-center justify-between">
                <span className="font-medium">Основни</span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className="text-pink-600 hover:bg-pink-50"
                  >
                    Изчисти
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAll}
                    className="text-teal-600 hover:bg-teal-50"
                  >
                    Всички
                  </Button>
                </div>
              </div>

              {/* Class Grid */}
              <div className="divide-y dark:divide-gray-700">
                {sortedGrades.map((grade) => {
                  const classes = classesByGrade[grade] || [];
                  return (
                    <div key={grade} className="flex items-center">
                      <div className="w-24 px-4 py-3 bg-teal-500 text-white font-medium text-center">
                        {grade} клас
                      </div>
                      <div className="flex-1 flex flex-wrap gap-2 px-4 py-3">
                        {classes.map((cls) => (
                          <button
                            key={cls._id}
                            onClick={() => toggleClass(cls._id)}
                            className={cn(
                              "px-4 py-2 rounded border transition-colors min-w-[60px]",
                              selectedClassIds.has(cls._id)
                                ? "bg-teal-500 text-white border-teal-500"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600"
                            )}
                          >
                            {cls.letter}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Confirmation */}
      {step === 2 && (
        <div className="bg-card rounded-lg border p-6 space-y-6">
          <p className="text-center text-muted-foreground">
            Преглед на данните, които ще бъдат прехвърлени
          </p>

          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-medium">Тип данни</th>
                <th className="text-left py-3 px-4 font-medium">Стойност</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-3 px-4">Паралелки</td>
                <td className="py-3 px-4">{selectedClassIds.size}</td>
              </tr>
              <tr className="border-b">
                <td className="py-3 px-4">Учебна година</td>
                <td className="py-3 px-4 font-semibold text-teal-600">{academicYear}</td>
              </tr>
              <tr className="border-b">
                <td className="py-3 px-4">Брой срокове</td>
                <td className="py-3 px-4">{termCount}</td>
              </tr>
              {terms.map((term) => (
                <tr key={term.termNumber} className="border-b">
                  <td className="py-3 px-4">Срок {term.termNumber}</td>
                  <td className="py-3 px-4">
                    {term.startDate ? new Date(term.startDate).toLocaleDateString("bg-BG") : "-"} - {term.endDate ? new Date(term.endDate).toLocaleDateString("bg-BG") : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-center gap-4 pt-4">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
            >
              Назад към редакция
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-teal-500 hover:bg-teal-600"
            >
              <CheckIcon className="h-4 w-4 mr-1" />
              {isSubmitting ? "Запазване..." : "Запази и премени"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EditAcademicTermsPage() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
      </AuthLoading>

      <Authenticated>
        <Layout>
          <EditAcademicTermsInner />
        </Layout>
      </Authenticated>
    </>
  );
}
