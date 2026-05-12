import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { FolderOpenIcon, ChevronLeftIcon } from "lucide-react";
import DateTimePicker from "./_components/DateTimePicker.tsx";

type ProjectType = "national_partnership" | "international_partnership" | "no_partner";
type ProgramType = "mon_national" | "mon_esf" | "other_national" | "npo_cooperation" | "eu_lifelong_learning" | "eu_erasmus" | "eu_other" | "other_international";

type ExistingActivity = {
  name: string;
  startDate: number;
  endDate: number;
  projectType?: ProjectType;
  programType?: ProgramType;
  website?: string;
  shortDescription?: string;
  mainResults?: string;
};

// Separate form component that receives initial data as props
// Using key={activityId} on this component forces remount with fresh state
function ProjectActivityForm({ initialData, isEditing, activityId }: {
  initialData?: ExistingActivity;
  isEditing: boolean;
  activityId?: string;
}) {
  const { lng } = useParams();
  const navigate = useNavigate();

  const createActivity = useMutation(api.projectActivities.create);
  const updateActivity = useMutation(api.projectActivities.update);

  // Initialize state directly from props - works because component remounts via key
  const [name, setName] = useState(initialData?.name ?? "");
  const [startDate, setStartDate] = useState<Date | null>(
    initialData ? new Date(initialData.startDate) : null
  );
  const [endDate, setEndDate] = useState<Date | null>(
    initialData ? new Date(initialData.endDate) : null
  );
  const [projectType, setProjectType] = useState<string>(
    initialData?.projectType ?? "none"
  );
  const [programType, setProgramType] = useState<string>(
    initialData?.programType ?? "none"
  );
  const [website, setWebsite] = useState(initialData?.website ?? "");
  const [shortDescription, setShortDescription] = useState(initialData?.shortDescription ?? "");
  const [mainResults, setMainResults] = useState(initialData?.mainResults ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // When start date changes, auto-set end date to +1 hour (only for new activities)
  const handleStartDateChange = useCallback((date: Date) => {
    setStartDate(date);
    if (!isEditing) {
      const autoEnd = new Date(date.getTime() + 60 * 60 * 1000);
      setEndDate(autoEnd);
    }
  }, [isEditing]);

  const handleEndDateChange = useCallback((date: Date) => {
    setEndDate(date);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Моля, въведете име на проектната дейност");
      return;
    }
    if (!startDate) {
      toast.error("Моля, въведете начална дата");
      return;
    }
    if (!endDate) {
      toast.error("Моля, въведете крайна дата");
      return;
    }

    if (endDate.getTime() < startDate.getTime()) {
      toast.error("Крайната дата не може да е преди началната дата");
      return;
    }

    if (shortDescription.length > 500) {
      toast.error("Краткото описание не може да бъде по-дълго от 500 символа");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        startDate: startDate.getTime(),
        endDate: endDate.getTime(),
        projectType: projectType !== "none" ? (projectType as ProjectType) : undefined,
        programType: programType !== "none" ? (programType as ProgramType) : undefined,
        website: website.trim() || undefined,
        shortDescription: shortDescription.trim() || undefined,
        mainResults: mainResults.trim() || undefined,
      };

      if (isEditing && activityId) {
        await updateActivity({
          id: activityId as Id<"projectActivities">,
          ...payload,
        });
        toast.success("Проектната дейност е обновена успешно");
      } else {
        await createActivity(payload);
        toast.success("Проектната дейност е добавена успешно");
      }

      navigate(`/${lng}/tasks/project-activities`);
    } catch {
      toast.error(isEditing ? "Грешка при обновяване" : "Грешка при добавяне");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FolderOpenIcon className="h-5 w-5" />
                {isEditing ? "Редактиране на Проектни дейности" : "Добавяне на Проектни дейности"}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/${lng}/tasks/project-activities`)}
                >
                  <ChevronLeftIcon className="h-4 w-4 mr-1" />
                  Назад
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Запазване..." : "Запази"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tab-like header */}
              <div className="border-b">
                <div className="inline-block px-4 py-2 text-sm font-medium border border-b-0 rounded-t-md bg-muted">
                  Основни данни
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-y-6 gap-x-8 items-start">
                {/* Име */}
                <Label className="text-right pt-2 font-semibold">
                  Име: <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Въведете име на проектната дейност"
                  required
                />

                {/* Начална дата */}
                <Label className="text-right pt-2 font-semibold">
                  Начална дата: <span className="text-destructive">*</span>
                </Label>
                <DateTimePicker
                  value={startDate}
                  onChange={handleStartDateChange}
                  placeholder="Изберете начална дата и час"
                />

                {/* Крайна дата */}
                <Label className="text-right pt-2 font-semibold">
                  Крайна дата: <span className="text-destructive">*</span>
                </Label>
                <DateTimePicker
                  value={endDate}
                  onChange={handleEndDateChange}
                  placeholder="Изберете крайна дата и час"
                />

                {/* Вид на проекта */}
                <Label className="text-right pt-2 font-semibold">
                  Вид на проекта:
                </Label>
                <Select value={projectType} onValueChange={setProjectType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Изберете" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Изберете</SelectItem>
                    <SelectItem value="national_partnership">Национално партньорство</SelectItem>
                    <SelectItem value="international_partnership">Международно партньорство</SelectItem>
                    <SelectItem value="no_partner">Няма партньор</SelectItem>
                  </SelectContent>
                </Select>

                {/* Вид на програмата */}
                <Label className="text-right pt-2 font-semibold">
                  Вид на програмата:
                </Label>
                <Select value={programType} onValueChange={setProgramType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Изберете" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Изберете</SelectItem>
                    <SelectItem value="mon_national">По национална програма на МОН</SelectItem>
                    <SelectItem value="mon_esf">По програма на МОН/ЕСФ</SelectItem>
                    <SelectItem value="other_national">Друга национална програма</SelectItem>
                    <SelectItem value="npo_cooperation">В сътрудничество с НПО</SelectItem>
                    <SelectItem value="eu_lifelong_learning">Програма на ЕС – Учене през целия живот</SelectItem>
                    <SelectItem value="eu_erasmus">Програма на ЕС – Еразъм</SelectItem>
                    <SelectItem value="eu_other">Програма на ЕС – друга</SelectItem>
                    <SelectItem value="other_international">Друга международна програма</SelectItem>
                  </SelectContent>
                </Select>

                {/* Интернет страница */}
                <Label className="text-right pt-2 font-semibold">
                  Интернет страница:
                </Label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://"
                />

                {/* Кратко описание */}
                <Label className="text-right pt-2 font-semibold">
                  Кратко описание:
                </Label>
                <div className="space-y-1">
                  <Textarea
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    placeholder="Въведете кратко описание на проектната дейност"
                    rows={5}
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {shortDescription.length} / 500
                  </p>
                </div>

                {/* Основни резултати */}
                <Label className="text-right pt-2 font-semibold">
                  Основни резултати:
                </Label>
                <Textarea
                  value={mainResults}
                  onChange={(e) => setMainResults(e.target.value)}
                  placeholder="Въведете основните резултати"
                  rows={5}
                />
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function AddProjectActivityInner() {
  const { activityId } = useParams();
  const isEditing = !!activityId;

  const existingActivity = useQuery(
    api.projectActivities.get,
    activityId ? { id: activityId as Id<"projectActivities"> } : "skip"
  );

  // Show loading while fetching existing activity in edit mode
  if (isEditing && existingActivity === undefined) {
    return (
      <Layout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  // key={activityId} forces full remount of form when editing different activities
  // This guarantees useState initializes with the correct values from existingActivity
  return (
    <ProjectActivityForm
      key={activityId ?? "new"}
      initialData={isEditing ? existingActivity ?? undefined : undefined}
      isEditing={isEditing}
      activityId={activityId}
    />
  );
}

export default function AddProjectActivity() {
  return (
    <>
      <Unauthenticated>
        <Layout>
          <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <p className="text-muted-foreground">Моля, влезте в профила си</p>
            <SignInButton />
          </div>
        </Layout>
      </Unauthenticated>
      <AuthLoading>
        <Layout>
          <div className="flex items-center justify-center min-h-screen">
            <Skeleton className="h-96 w-full max-w-md" />
          </div>
        </Layout>
      </AuthLoading>
      <Authenticated>
        <AddProjectActivityInner />
      </Authenticated>
    </>
  );
}
