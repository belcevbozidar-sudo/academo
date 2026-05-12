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
import { useState, useEffect } from "react";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel";

interface EditWeeklyScheduleProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  scheduleId: Id<"weeklySchedules"> | null;
}

export default function EditWeeklySchedule({
  open,
  onOpenChange,
  onSuccess,
  scheduleId,
}: EditWeeklyScheduleProps) {
  const updateWeeklySchedule = useMutation(api.weeklySchedules.update);
  const schedule = useQuery(
    api.weeklySchedules.getById,
    scheduleId ? { id: scheduleId } : "skip"
  );
  const dayRegimes = useQuery(api.dayRegimes.list, {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dayRegimeId, setDayRegimeId] = useState("");
  const [weekCount, setWeekCount] = useState("1");

  // Pre-fill form when schedule loads
  useEffect(() => {
    if (schedule) {
      setDayRegimeId(schedule.dayRegimeId ?? "none");
      setWeekCount(schedule.weekCount.toString());
    }
  }, [schedule]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !scheduleId) return;
    setIsSubmitting(true);

    try {
      await updateWeeklySchedule({
        id: scheduleId,
        dayRegimeId:
          dayRegimeId && dayRegimeId !== "none"
            ? (dayRegimeId as Id<"dayRegimes">)
            : undefined,
        weekCount: parseInt(weekCount, 10),
      });

      toast.success("Седмичното разписание е актуализирано успешно!");
      onSuccess();
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Грешка при актуализиране на седмичното разписание");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Редактиране на седмично разписание</DialogTitle>
        </DialogHeader>

        {schedule ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Паралелка</Label>
              <div className="px-3 py-2 bg-muted text-muted-foreground rounded-md">
                {schedule.className}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Срок</Label>
              <div className="px-3 py-2 bg-muted text-muted-foreground rounded-md">
                {schedule.termName}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dayRegimeId">
                Дневен режим (опционално)
              </Label>
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
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Запазване..." : "Запази"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Зареждане...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
