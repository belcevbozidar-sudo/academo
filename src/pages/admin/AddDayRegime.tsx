import Layout from "@/components/Layout.tsx";
import { Authenticated, AuthLoading } from "@/lib/convex-preview";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { useState, useEffect, useMemo } from "react";
import { MinusIcon, ClockIcon } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { useNavigate, useParams } from "react-router-dom";

interface PeriodSlot {
  periodNumber: number;
  startTime: string;
  duration: number; // minutes
  endTime: string;
}

// Helper to add minutes to time string
function addMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const totalMins = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMins / 60) % 24;
  const newMins = totalMins % 60;
  return `${String(newHours).padStart(2, "0")}:${String(newMins).padStart(2, "0")}`;
}

function AddDayRegimeInner() {
  const navigate = useNavigate();
  const { lng, id } = useParams<{ lng: string; id?: string }>();
  const isEdit = !!id;
  
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const existingRegime = useQuery(
    api.dayRegimes.getById,
    id ? { id: id as Id<"dayRegimes"> } : "skip"
  );
  const createRegime = useMutation(api.dayRegimes.create);
  const updateRegime = useMutation(api.dayRegimes.update);

  // Form state
  const [name, setName] = useState("");
  const [hasDifferentRegimes, setHasDifferentRegimes] = useState(false);
  const [periods, setPeriods] = useState<PeriodSlot[]>([
    { periodNumber: 1, startTime: "07:30", duration: 40, endTime: "08:10" },
    { periodNumber: 2, startTime: "08:20", duration: 40, endTime: "09:00" },
    { periodNumber: 3, startTime: "09:10", duration: 40, endTime: "09:50" },
    { periodNumber: 4, startTime: "10:00", duration: 40, endTime: "10:40" },
    { periodNumber: 5, startTime: "10:50", duration: 40, endTime: "11:30" },
    { periodNumber: 6, startTime: "11:40", duration: 40, endTime: "12:20" },
    { periodNumber: 7, startTime: "12:30", duration: 40, endTime: "13:10" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check permissions
  const isAdmin = currentUser?.role === "system_admin" || 
                  currentUser?.role === "director" || 
                  currentUser?.role === "vice_director";

  // Load existing data for edit mode
  useEffect(() => {
    if (isEdit && existingRegime) {
      setName(existingRegime.name);
      setHasDifferentRegimes(existingRegime.hasDifferentRegimes ?? false);
      if (existingRegime.periods && existingRegime.periods.length > 0) {
        setPeriods(existingRegime.periods);
      }
    }
  }, [isEdit, existingRegime]);

  // Calculate start/end time from periods
  const startTime = useMemo(() => periods[0]?.startTime || "07:30", [periods]);
  const endTime = useMemo(() => periods[periods.length - 1]?.endTime || "13:10", [periods]);

  // Duration options
  const durationOptions = [
    { value: 30, label: "30 мин" },
    { value: 35, label: "35 мин" },
    { value: 40, label: "40 мин" },
    { value: 45, label: "45 мин" },
    { value: 50, label: "50 мин" },
    { value: 55, label: "55 мин" },
    { value: 60, label: "60 мин" },
  ];

  // Update period start time
  const updatePeriodStartTime = (index: number, newStartTime: string) => {
    setPeriods(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        startTime: newStartTime,
        endTime: addMinutes(newStartTime, updated[index].duration),
      };
      return updated;
    });
  };

  // Update period duration
  const updatePeriodDuration = (index: number, newDuration: number) => {
    setPeriods(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        duration: newDuration,
        endTime: addMinutes(updated[index].startTime, newDuration),
      };
      return updated;
    });
  };

  // Add new period
  const addPeriod = () => {
    const lastPeriod = periods[periods.length - 1];
    const newStartTime = addMinutes(lastPeriod.endTime, 10); // 10 min break
    const newPeriod: PeriodSlot = {
      periodNumber: periods.length + 1,
      startTime: newStartTime,
      duration: 40,
      endTime: addMinutes(newStartTime, 40),
    };
    setPeriods(prev => [...prev, newPeriod]);
  };

  // Remove period
  const removePeriod = (index: number) => {
    if (periods.length <= 1) return;
    setPeriods(prev => {
      const updated = prev.filter((_, i) => i !== index);
      // Renumber periods
      return updated.map((p, i) => ({ ...p, periodNumber: i + 1 }));
    });
  };

  // Handle save
  const handleSave = async (andAdd: boolean = false) => {
    if (!name.trim()) {
      toast.error("Моля, въведете име на дневния режим");
      return;
    }

    if (!currentUser?.schoolId) {
      toast.error("Не е намерено училище");
      return;
    }

    setIsSubmitting(true);
    try {
      const currentYear = new Date().getFullYear();
      const academicYear = `${currentYear}/${currentYear + 1}`;

      if (isEdit && id) {
        await updateRegime({
          id: id as Id<"dayRegimes">,
          name,
          startTime,
          endTime,
          periodCount: periods.length,
          periods,
          hasDifferentRegimes,
        });
        toast.success("Дневният режим е обновен успешно");
        navigate(`/${lng}/admin/day-regimes`);
      } else {
        await createRegime({
          name,
          shift: "none",
          startTime,
          endTime,
          periodCount: periods.length,
          schoolId: currentUser.schoolId,
          academicYear,
          periods,
          hasDifferentRegimes,
        });
        toast.success("Дневният режим е създаден успешно");
        if (andAdd) {
          // Reset form for new entry
          setName("");
          setPeriods([
            { periodNumber: 1, startTime: "07:30", duration: 40, endTime: "08:10" },
            { periodNumber: 2, startTime: "08:20", duration: 40, endTime: "09:00" },
            { periodNumber: 3, startTime: "09:10", duration: 40, endTime: "09:50" },
            { periodNumber: 4, startTime: "10:00", duration: 40, endTime: "10:40" },
            { periodNumber: 5, startTime: "10:50", duration: 40, endTime: "11:30" },
            { periodNumber: 6, startTime: "11:40", duration: 40, endTime: "12:20" },
            { periodNumber: 7, startTime: "12:30", duration: 40, endTime: "13:10" },
          ]);
        } else {
          navigate(`/${lng}/admin/day-regimes`);
        }
      }
    } catch (error) {
      toast.error(isEdit ? "Грешка при обновяване" : "Грешка при създаване");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Нямате права за достъп до тази страница.</p>
      </div>
    );
  }

  if (isEdit && existingRegime === undefined) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <span className="text-sky-600">🕐</span> 
          {isEdit ? "Редактиране на дневен режим" : "Добавяне на дневен режим"}
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/${lng}/admin/day-regimes`)}
          >
            {"< Назад"}
          </Button>
          <Button
            className="bg-teal-500 hover:bg-teal-600 text-white"
            onClick={() => handleSave(false)}
            disabled={isSubmitting}
          >
            ✓ Запази
          </Button>
          {!isEdit && (
            <Button
              className="bg-teal-500 hover:bg-teal-600 text-white"
              onClick={() => handleSave(true)}
              disabled={isSubmitting}
            >
              ✓ Запази и добави
            </Button>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="bg-card border rounded-lg p-6 space-y-6">
        {/* Name field */}
        <div className="flex items-center gap-4">
          <Label className="w-40 text-right">
            Име: <span className="text-red-500">*</span>
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Смяна 3"
            className="max-w-md"
          />
        </div>

        {/* Different regimes toggle */}
        <div className="flex items-center gap-4">
          <Label className="w-40 text-right flex items-center gap-1">
            Различни режими:
            <span className="text-sky-500 cursor-help" title="Включете ако искате различни времена за всеки час">ⓘ</span>
          </Label>
          <div className="flex items-center gap-2">
            <Switch
              checked={hasDifferentRegimes}
              onCheckedChange={setHasDifferentRegimes}
            />
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              hasDifferentRegimes 
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" 
                : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
            }`}>
              {hasDifferentRegimes ? "ДА" : "НЕ"}
            </span>
          </div>
        </div>

        {/* Periods table */}
        <div className="flex items-start gap-4">
          <Label className="w-40 text-right pt-2">Дневен режим:</Label>
          <div className="flex-1">
            <div className="border rounded-lg overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-5 gap-4 bg-muted/50 px-4 py-2 border-b text-sm font-medium">
                <div>Час</div>
                <div>Начало</div>
                <div>Продължителност</div>
                <div>Край</div>
                <div></div>
              </div>
              
              {/* Table rows */}
              {periods.map((period, index) => (
                <div key={period.periodNumber} className="grid grid-cols-5 gap-4 px-4 py-3 border-b last:border-b-0 items-center">
                  <div className="flex items-center gap-2">
                    <Input
                      value={period.periodNumber}
                      readOnly
                      className="w-16 text-center bg-muted"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={period.startTime}
                      onChange={(e) => updatePeriodStartTime(index, e.target.value)}
                      className="w-28"
                    />
                    <ClockIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <Select
                      value={String(period.duration)}
                      onValueChange={(val) => updatePeriodDuration(index, Number(val))}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {durationOptions.map((opt) => (
                          <SelectItem key={opt.value} value={String(opt.value)}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-muted-foreground">
                    {period.endTime}
                  </div>
                  <div>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removePeriod(index)}
                      disabled={periods.length <= 1}
                    >
                      <MinusIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add period button */}
            <Button
              variant="default"
              className="mt-4 bg-sky-500 hover:bg-sky-600"
              onClick={addPeriod}
            >
              + Добави час
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AddDayRegime() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
      </AuthLoading>

      <Authenticated>
        <Layout>
          <AddDayRegimeInner />
        </Layout>
      </Authenticated>
    </>
  );
}
