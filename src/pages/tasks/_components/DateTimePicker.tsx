import { useState, useCallback } from "react";
import { Calendar } from "@/components/ui/calendar.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

type PickerStep = "calendar" | "hours" | "minutes";

const BG_MONTHS = [
  "Януари", "Февруари", "Март", "Април", "Май", "Юни",
  "Юли", "Август", "Септември", "Октомври", "Ноември", "Декември",
];

function formatDateTimeBG(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

type DateTimePickerProps = {
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
};

export default function DateTimePicker({ value, onChange, placeholder = "Изберете дата и час" }: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<PickerStep>("calendar");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  // Navigation for hours/minutes view
  const [viewingMonth, setViewingMonth] = useState<Date>(() => value ?? new Date());

  const handleOpen = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // Reset to calendar step on open
      setStep("calendar");
      setSelectedDate(null);
      setSelectedHour(null);
      if (value) {
        setViewingMonth(value);
      }
    }
  }, [value]);

  const handleDateSelect = useCallback((date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    setStep("hours");
  }, []);

  const handleHourSelect = useCallback((hour: number) => {
    setSelectedHour(hour);
    setStep("minutes");
  }, []);

  const handleMinuteSelect = useCallback((minute: number) => {
    if (!selectedDate) return;
    const finalDate = new Date(selectedDate);
    finalDate.setHours(selectedHour ?? 0, minute, 0, 0);
    onChange(finalDate);
    setOpen(false);
  }, [selectedDate, selectedHour, onChange]);

  const handleBackToCalendar = useCallback(() => {
    setStep("calendar");
    setSelectedDate(null);
    setSelectedHour(null);
  }, []);

  const handleBackToHours = useCallback(() => {
    setStep("hours");
    setSelectedHour(null);
  }, []);

  // Navigate month in calendar header (for hours/minutes step, navigate day)
  const navigateDatePrev = useCallback(() => {
    if (!selectedDate) return;
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
    // Reset hour if we go back
    if (step === "minutes") {
      setStep("hours");
      setSelectedHour(null);
    }
  }, [selectedDate, step]);

  const navigateDateNext = useCallback(() => {
    if (!selectedDate) return;
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
    if (step === "minutes") {
      setStep("hours");
      setSelectedHour(null);
    }
  }, [selectedDate, step]);

  // Generate hours array: 0..23
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Generate 5-minute intervals for selected hour: 0, 5, 10, ..., 55
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  const formatHour = (h: number) => `${String(h).padStart(2, "0")}:00`;
  const formatMinute = (m: number) => {
    const h = selectedHour ?? 0;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const dateHeaderLabel = selectedDate
    ? `${selectedDate.getDate()} ${BG_MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
    : "";

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "w-full justify-start text-left font-normal border border-input bg-background hover:bg-background h-9 px-3",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {value ? formatDateTimeBG(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {/* Step 1: Calendar */}
        {step === "calendar" && (
          <Calendar
            mode="single"
            selected={value ?? undefined}
            onSelect={handleDateSelect}
            defaultMonth={viewingMonth}
          />
        )}

        {/* Step 2: Hours grid */}
        {step === "hours" && selectedDate && (
          <div className="p-3 w-[280px]">
            {/* Date header with navigation */}
            <div className="flex items-center justify-between mb-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={navigateDatePrev}
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
              <button
                type="button"
                className="text-sm font-medium hover:underline cursor-pointer bg-transparent border-none"
                onClick={handleBackToCalendar}
              >
                {dateHeaderLabel}
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={navigateDateNext}
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </div>

            {/* Hours grid */}
            <div className="grid grid-cols-4 gap-1">
              {hours.map((h) => (
                <Button
                  key={h}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "text-sm h-9",
                    value &&
                      selectedDate.toDateString() === value.toDateString() &&
                      value.getHours() === h &&
                      "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  )}
                  onClick={() => handleHourSelect(h)}
                >
                  {formatHour(h)}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Minutes grid (5-min intervals) */}
        {step === "minutes" && selectedDate && selectedHour !== null && (
          <div className="p-3 w-[280px]">
            {/* Date header with navigation */}
            <div className="flex items-center justify-between mb-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={navigateDatePrev}
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
              <button
                type="button"
                className="text-sm font-medium hover:underline cursor-pointer bg-transparent border-none"
                onClick={handleBackToCalendar}
              >
                {dateHeaderLabel}
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={navigateDateNext}
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </div>

            {/* Back to hours link */}
            <button
              type="button"
              className="text-xs text-muted-foreground hover:underline cursor-pointer mb-2 block bg-transparent border-none"
              onClick={handleBackToHours}
            >
              {"<"} Обратно към часовете
            </button>

            {/* Minutes grid */}
            <div className="grid grid-cols-4 gap-1">
              {minutes.map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "text-sm h-9",
                    value &&
                      selectedDate.toDateString() === value.toDateString() &&
                      value.getHours() === selectedHour &&
                      value.getMinutes() === m &&
                      "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  )}
                  onClick={() => handleMinuteSelect(m)}
                >
                  {formatMinute(m)}
                </Button>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
