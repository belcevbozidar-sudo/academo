import Layout from "@/components/Layout.tsx";
import { Authenticated, AuthLoading, Unauthenticated } from "@/lib/convex-preview";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import {
  Grid3x3Icon,
  ChevronLeft,
  Save,
  Pencil,
  HomeIcon,
  BookOpenIcon,
  ListTodoIcon,
  BarChartIcon,
  UsersIcon,
  CalendarIcon,
  TrophyIcon,
  SettingsIcon,
  ClockIcon,
  CreditCardIcon,
  FileTextIcon,
  MessageCircleIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useNavigate, Link, useParams } from "react-router-dom";
import { cn } from "@/lib/utils.ts";

type ModuleKey =
  | "moduleHomeEnabled"
  | "moduleDiaryEnabled"
  | "moduleTasksEnabled"
  | "moduleStatisticsEnabled"
  | "moduleExtracurricularEnabled"
  | "moduleEventsEnabled"
  | "moduleCompetitionsEnabled"
  | "moduleAdminEnabled"
  | "moduleLectureHoursEnabled"
  | "moduleFeesEnabled"
  | "moduleReportsEnabled"
  | "moduleMessagesEnabled";

type ModulesState = Record<ModuleKey, boolean>;

interface ModuleConfig {
  key: ModuleKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isAdmin?: boolean; // Special handling for admin module
}

const MODULES: ModuleConfig[] = [
  {
    key: "moduleHomeEnabled",
    label: "Начало",
    description: "Началната страница с обобщена информация",
    icon: HomeIcon,
  },
  {
    key: "moduleDiaryEnabled",
    label: "Дневник",
    description: "Електронен дневник - оценки, отсъствия, отзиви",
    icon: BookOpenIcon,
  },
  {
    key: "moduleTasksEnabled",
    label: "Задачи",
    description: "Задачи и проекти за ученици и учители",
    icon: ListTodoIcon,
  },
  {
    key: "moduleStatisticsEnabled",
    label: "Статистики",
    description: "Статистики, проверка и контрол",
    icon: BarChartIcon,
  },
  {
    key: "moduleExtracurricularEnabled",
    label: "Извънкласни дейности",
    description: "Извънкласни занимания и дейности",
    icon: UsersIcon,
  },
  {
    key: "moduleEventsEnabled",
    label: "Събития",
    description: "Събития, покани и календар",
    icon: CalendarIcon,
  },
  {
    key: "moduleCompetitionsEnabled",
    label: "Състезания",
    description: "Състезания и олимпиади",
    icon: TrophyIcon,
  },
  {
    key: "moduleAdminEnabled",
    label: "Администрация",
    description: "Управление на потребители, класове, предмети",
    icon: SettingsIcon,
    isAdmin: true,
  },
  {
    key: "moduleLectureHoursEnabled",
    label: "Учебни часове",
    description: "Отсъствия и заместващи учители",
    icon: ClockIcon,
  },
  {
    key: "moduleFeesEnabled",
    label: "Такси",
    description: "Управление на такси и плащания",
    icon: CreditCardIcon,
  },
  {
    key: "moduleReportsEnabled",
    label: "Справки",
    description: "Генериране на справки и доклади",
    icon: FileTextIcon,
  },
  {
    key: "moduleMessagesEnabled",
    label: "Съобщения",
    description: "Вътрешна комуникация и чат",
    icon: MessageCircleIcon,
  },
];

function ModuleToggle({
  module,
  enabled,
  onChange,
  disabled,
}: {
  module: ModuleConfig;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}) {
  const Icon = module.icon;

  return (
    <Card
      className={cn(
        "transition-all",
        enabled ? "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-border",
        disabled && "opacity-60"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
              enabled ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium text-sm">{module.label}</h3>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  className={cn(
                    "px-2 py-1 h-7 rounded-full text-xs font-medium transition-colors",
                    !enabled
                      ? "bg-rose-500 text-white hover:bg-rose-600 disabled:bg-rose-500 disabled:opacity-100"
                      : "bg-transparent text-muted-foreground hover:bg-muted disabled:opacity-50"
                  )}
                  onClick={() => !disabled && onChange(false)}
                >
                  ИЗКЛ
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  className={cn(
                    "px-2 py-1 h-7 rounded-full text-xs font-medium transition-colors",
                    enabled
                      ? "bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-emerald-500 disabled:opacity-100"
                      : "bg-transparent text-muted-foreground hover:bg-muted disabled:opacity-50"
                  )}
                  onClick={() => !disabled && onChange(true)}
                >
                  ВКЛ
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{module.description}</p>
            {module.isAdmin && !enabled && (
              <div className="flex items-center gap-1 mt-2 text-xs text-amber-600 dark:text-amber-500">
                <AlertTriangleIcon className="h-3 w-3" />
                <span>Администраторите ще виждат само Настройки</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ModuleSettingsInner() {
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();
  const settings = useQuery(api.platformSettings.getPlatformSettings, {});
  const canAccess = useQuery(api.platformSettings.canAccessSettings, {});
  const updateSettings = useMutation(api.platformSettings.updatePlatformSettings);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Local state for module settings
  const [localModules, setLocalModules] = useState<ModulesState | null>(null);

  // Initialize local modules from query
  useEffect(() => {
    if (settings) {
      setLocalModules({
        moduleHomeEnabled: settings.moduleHomeEnabled ?? true,
        moduleDiaryEnabled: settings.moduleDiaryEnabled ?? true,
        moduleTasksEnabled: settings.moduleTasksEnabled ?? true,
        moduleStatisticsEnabled: settings.moduleStatisticsEnabled ?? true,
        moduleExtracurricularEnabled: settings.moduleExtracurricularEnabled ?? true,
        moduleEventsEnabled: settings.moduleEventsEnabled ?? true,
        moduleCompetitionsEnabled: settings.moduleCompetitionsEnabled ?? true,
        moduleAdminEnabled: settings.moduleAdminEnabled ?? true,
        moduleLectureHoursEnabled: settings.moduleLectureHoursEnabled ?? true,
        moduleFeesEnabled: settings.moduleFeesEnabled ?? true,
        moduleReportsEnabled: settings.moduleReportsEnabled ?? true,
        moduleMessagesEnabled: settings.moduleMessagesEnabled ?? true,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    if (!localModules) return;

    setIsSaving(true);
    try {
      await updateSettings(localModules);
      toast.success("Настройките за модули са запазени успешно");
      setIsEditing(false);
    } catch (error) {
      toast.error("Грешка при запазване на настройките");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original settings
    if (settings) {
      setLocalModules({
        moduleHomeEnabled: settings.moduleHomeEnabled ?? true,
        moduleDiaryEnabled: settings.moduleDiaryEnabled ?? true,
        moduleTasksEnabled: settings.moduleTasksEnabled ?? true,
        moduleStatisticsEnabled: settings.moduleStatisticsEnabled ?? true,
        moduleExtracurricularEnabled: settings.moduleExtracurricularEnabled ?? true,
        moduleEventsEnabled: settings.moduleEventsEnabled ?? true,
        moduleCompetitionsEnabled: settings.moduleCompetitionsEnabled ?? true,
        moduleAdminEnabled: settings.moduleAdminEnabled ?? true,
        moduleLectureHoursEnabled: settings.moduleLectureHoursEnabled ?? true,
        moduleFeesEnabled: settings.moduleFeesEnabled ?? true,
        moduleReportsEnabled: settings.moduleReportsEnabled ?? true,
        moduleMessagesEnabled: settings.moduleMessagesEnabled ?? true,
      });
    }
    setIsEditing(false);
  };

  const updateModule = (key: ModuleKey, value: boolean) => {
    if (!localModules || !isEditing) return;
    setLocalModules({ ...localModules, [key]: value });
  };

  // Show access denied
  if (canAccess === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Grid3x3Icon className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Достъпът е ограничен</h1>
        <p className="text-muted-foreground">
          Само администратори, директори и заместник-директори имат достъп до настройките на модулите.
        </p>
        <Button onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Назад
        </Button>
      </div>
    );
  }

  // Loading state
  if (settings === undefined || localModules === null) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Назад
            </Button>
            <div className="flex items-center gap-4">
              <Link
                to={`/${lng}/admin/settings`}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <SettingsIcon className="h-5 w-5" />
                <span className="text-lg font-semibold">Настройки</span>
              </Link>
              <div className="flex items-center gap-2">
                <Grid3x3Icon className="h-5 w-5 text-primary" />
                <h1 className="text-lg font-semibold">Модули</h1>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="ghost" onClick={handleCancel}>
                  Отказ
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-teal-500 hover:bg-teal-600 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Запазване..." : "Запази"}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setIsEditing(true)}
                className="bg-teal-500 hover:bg-teal-600 text-white"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Редактирай
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Видимост на модули</CardTitle>
            <CardDescription>
              Включете или изключете отделни модули от страничното меню. Изключените модули няма да
              се показват на потребителите.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MODULES.map((module) => (
            <ModuleToggle
              key={module.key}
              module={module}
              enabled={localModules[module.key]}
              onChange={(value) => updateModule(module.key, value)}
              disabled={!isEditing}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ModuleSettings() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
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
          <ModuleSettingsInner />
        </Layout>
      </Authenticated>
    </>
  );
}
