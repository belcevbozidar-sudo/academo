import { useState } from "react";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { useParams, useNavigate } from "react-router-dom";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Authenticated, AuthLoading } from "@/lib/convex-preview";
import { DiaryAccessGuard } from "@/components/DiaryAccessGuard.tsx";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { Calendar } from "@/components/ui/calendar.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { CalendarIcon, ArrowLeftIcon } from "lucide-react";
import { format } from "date-fns";
import { bg } from "date-fns/locale";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";

function AddParentMeetingPageInner() {
  const navigate = useNavigate();
  const { classId, lng } = useParams<{ classId: string; lng: string }>();
  
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState("14:00");
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [endTime, setEndTime] = useState("15:00");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [startDatePickerOpen, setStartDatePickerOpen] = useState(false);
  const [endDatePickerOpen, setEndDatePickerOpen] = useState(false);

  const classData = useQuery(
    api.admin.getClassById,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  const createMeeting = useMutation(api.parentMeetings.create);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Моля, въведете заглавие");
      return;
    }
    if (!startDate) {
      toast.error("Моля, изберете дата за начало");
      return;
    }
    if (!endDate) {
      toast.error("Моля, изберете дата за край");
      return;
    }

    // Combine date and time
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const startDateTime = new Date(startDate);
    startDateTime.setHours(startHour, startMinute, 0, 0);

    const [endHour, endMinute] = endTime.split(":").map(Number);
    const endDateTime = new Date(endDate);
    endDateTime.setHours(endHour, endMinute, 0, 0);

    if (endDateTime <= startDateTime) {
      toast.error("Крайната дата/час трябва да е след началната");
      return;
    }

    try {
      await createMeeting({
        classId: classId as Id<"classes">,
        title: title.trim(),
        startDate: startDateTime.getTime(),
        endDate: endDateTime.getTime(),
        location: location.trim() || undefined,
        description: description.trim() || undefined,
      });

      toast.success("Родителската среща е добавена успешно");
      navigate(`/${lng || "bg"}/diary/class/${classId}/parent-meetings`);
    } catch (error) {
      toast.error("Възникна грешка при добавянето");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/${lng || "bg"}/diary/class/${classId}/parent-meetings`)}
          className="shrink-0"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Добави родителска среща
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            {classData?.name || "Зареждане..."}
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Данни за срещата</CardTitle>
          <CardDescription>Полетата с * са задължителни</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Заглавие *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Родителска среща - I срок"
            />
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Начална дата *</Label>
              <Popover open={startDatePickerOpen} onOpenChange={setStartDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd.MM.yyyy", { locale: bg }) : "Изберете дата"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      setStartDate(date);
                      if (!endDate && date) {
                        setEndDate(date);
                      }
                      setStartDatePickerOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="startTime">Начален час *</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Крайна дата *</Label>
              <Popover open={endDatePickerOpen} onOpenChange={setEndDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd.MM.yyyy", { locale: bg }) : "Изберете дата"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      setEndDate(date);
                      setEndDatePickerOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endTime">Краен час *</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="location">Място (опционално)</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Например: Стая 201"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Описание (опционално)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Допълнителна информация..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => navigate(`/${lng || "bg"}/diary/class/${classId}/parent-meetings`)}
        >
          Откажи
        </Button>
        <Button onClick={handleSave}>
          Запази
        </Button>
      </div>
    </div>
  );
}

export default function AddParentMeetingPage() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
      </AuthLoading>
      <Authenticated>
        <DiaryAccessGuard>
          <Layout>
            <AddParentMeetingPageInner />
          </Layout>
        </DiaryAccessGuard>
      </Authenticated>
    </>
  );
}
