import { useMutation, useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { toast } from "sonner";
import { useState } from "react";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel";

interface AddWeeklyScheduleProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function AddWeeklySchedule({
  open,
  onOpenChange,
  onSuccess,
}: AddWeeklyScheduleProps) {
  const ensureDefaultSchool = useMutation(api.admin.ensureDefaultSchool);
  const createWeeklySchedule = useMutation(api.weeklySchedules.create);
  const classes = useQuery(api.admin.listClasses, {});
  const dayRegimes = useQuery(api.dayRegimes.list, {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [classId, setClassId] = useState("");
  const [termNumber, setTermNumber] = useState("1");
  const [dayRegimeId, setDayRegimeId] = useState("");
  const [weekCount, setWeekCount] = useState("1");

  // Get current academic year
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const academicYear =
    currentMonth >= 8
      ? `${currentYear}/${currentYear + 1}`
      : `${currentYear - 1}/${currentYear}`;

  // Get terms for current academic year
  const terms = useQuery(api.schedules.listTerms, { academicYear });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const schoolId = await ensureDefaultSchool();

      // Find the appropriate term
      const selectedTerm = terms?.find((t) =>
        termNumber === "1"
          ? t.name.includes("Първи")
          : t.name.includes("Втори")
      );

      if (!selectedTerm) {
        toast.error(`Срок ${termNumber} не е намерен. Моля, първо създайте срокове в Администрация > Учебни срокове.`);
        setIsSubmitting(false);
        return;
      }

      await createWeeklySchedule({
        classId: classId as Id<"classes">,
        termId: selectedTerm._id,
        dayRegimeId: dayRegimeId && dayRegimeId !== "none"
          ? (dayRegimeId as Id<"dayRegimes">)
          : undefined,
        weekCount: parseInt(weekCount, 10),
        academicYear,
        schoolId,
        entries: [], // Empty initially, can be edited later
      });

      toast.success("Седмичното разписание е създадено успешно!");
      setClassId("");
      setTermNumber("1");
      setDayRegimeId("");
      setWeekCount("1");
      onSuccess();
    } catch (error) {
      console.error("Error creating weekly schedule:", error);
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else if (error instanceof Error) {
        toast.error(`Грешка: ${error.message}`);
      } else {
        toast.error("Грешка при създаване на седмичното разписание");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Добавяне на седмично разписание</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="classId">
              Паралелка <span className="text-destructive">*</span>
            </Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger id="classId">
                <SelectValue placeholder="Избери паралелка" />
              </SelectTrigger>
              <SelectContent>
                {classes?.map((cls) => (
                  <SelectItem key={cls._id} value={cls._id}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {classId === "" && (
              <p className="text-sm text-muted-foreground">
                Изберете паралелка
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="termNumber">
              Срок <span className="text-destructive">*</span>
            </Label>
            <Select value={termNumber} onValueChange={setTermNumber}>
              <SelectTrigger id="termNumber">
                <SelectValue placeholder="Избери срок" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Първи срок</SelectItem>
                <SelectItem value="2">Втори срок</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dayRegimeId">Дневен режим (опционално)</Label>
            <Select value={dayRegimeId} onValueChange={setDayRegimeId}>
              <SelectTrigger id="dayRegimeId">
                <SelectValue placeholder="Избери дневен режим" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Без дневен режим</SelectItem>
                {dayRegimes?.map((regime) => (
                  <SelectItem key={regime._id} value={regime._id}>
                    {regime.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="weekCount">
              Брой седмици <span className="text-destructive">*</span>
            </Label>
            <Select value={weekCount} onValueChange={setWeekCount}>
              <SelectTrigger id="weekCount">
                <SelectValue placeholder="Избери брой седмици" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 седмица</SelectItem>
                <SelectItem value="2">2 седмици</SelectItem>
                <SelectItem value="3">3 седмици</SelectItem>
                <SelectItem value="4">4 седмици</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Отказ
            </Button>
            <Button type="submit" disabled={isSubmitting || !classId}>
              {isSubmitting ? "Създаване..." : "Създай"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
