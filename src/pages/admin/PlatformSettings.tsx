import Layout from "@/components/Layout.tsx";
import { Authenticated, AuthLoading, Unauthenticated } from "@/lib/convex-preview";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { SettingsIcon, ChevronLeft, Save, Info, Pencil, Grid3x3Icon } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";

type SettingsState = {
  // Модул "Дневник"
  eDiaryEnabled: boolean;
  lessonTopicRequired: boolean;
  minutesBeforeLessonCanMarkTaken: number;
  minutesAfterLessonCanMarkTaken: number;
  minutesAfterSaveToLock: number;
  checkMissingAbsences: boolean;
  lockDiaryPastMonths: boolean;
  lockDayOfMonth: number;
  warnUntakenLessonsAfterDays: number;
  // Автоматично уважаване на отсъствия
  autoExcuseWithMedicalNote: boolean;
  autoExcuseWithParentNote: boolean;
  autoExcuseWithOtherNote: boolean;
  // Известяване на администратори
  notifyAdminsOnGradeDelete: boolean;
  notifyAdminsOnAbsenceDelete: boolean;
  notifyAdminsOnReviewDelete: boolean;
  strictModeGradeDelete: boolean;
  strictModeAbsenceDelete: boolean;
  strictModeReviewDelete: boolean;
  includeWeekends: boolean;
  classTeachersCanEditDayRegime: boolean;
  classTeachersCanEditSchedules: boolean;
  classTeachersCanMoveStudents: boolean;
  studentsParentsSeeTopics: boolean;
  showSecondClassHour: boolean;
  schoolYearStartDay: number;

  // Модул "Учителски отсъствия"
  teachersCanEnterSubstitution: boolean;
  absentTeachersCanBeSubstitutes: boolean;
  substitutesAccessDays: number;

  // Модул "Статистики и справки"
  includeGrades1to3InRankings: boolean;

  // Модул "Администрация"
  studentsSeeTeachersPhones: boolean;
  studentsSeeTeachersEmails: boolean;
  parentsSeeTeachersPhones: boolean;
  parentsSeeTeachersEmails: boolean;
  parentsSeeClassmatesParents: boolean;
  parentsAndStudentsSeeClassmates: boolean;
  parentsCannotSendMessages: boolean;
  studentsCannotSendMessages: boolean;
  enableLessonTimeWindow: boolean;
  studentIdentifierRequired: boolean;
  teacherIdentifierRequired: boolean;
};

// Setting item component with toggle (read-only when disabled)
function SettingToggle({
  label,
  value,
  onChange,
  tooltip,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  tooltip?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 flex-1 min-w-0 pr-4">
        <span className="text-sm">{label}</span>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            !value
              ? "bg-rose-500 text-white hover:bg-rose-600 disabled:bg-rose-500 disabled:opacity-100"
              : "bg-transparent text-muted-foreground hover:bg-muted disabled:opacity-50"
          }`}
          onClick={() => !disabled && onChange(false)}
        >
          НЕ
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            value
              ? "bg-emerald-500 text-white hover:bg-emerald-600 disabled:bg-emerald-500 disabled:opacity-100"
              : "bg-transparent text-muted-foreground hover:bg-muted disabled:opacity-50"
          }`}
          onClick={() => !disabled && onChange(true)}
        >
          ДА
        </Button>
      </div>
    </div>
  );
}

// Setting item component with number input (read-only when disabled)
function SettingNumber({
  label,
  value,
  onChange,
  tooltip,
  min,
  max,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  tooltip?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 flex-1 min-w-0 pr-4">
        <span className="text-sm">{label}</span>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        min={min}
        max={max}
        disabled={disabled}
        className="w-20 text-center bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 disabled:opacity-70"
      />
    </div>
  );
}

// Setting item component with hours and minutes input
function SettingTimeWindow({
  label,
  totalMinutes,
  onChange,
  tooltip,
  disabled,
}: {
  label: string;
  totalMinutes: number;
  onChange: (totalMinutes: number) => void;
  tooltip?: string;
  disabled?: boolean;
}) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const handleHoursChange = (newHours: number) => {
    const validHours = Math.max(0, Math.min(23, newHours || 0));
    onChange(validHours * 60 + minutes);
  };

  const handleMinutesChange = (newMinutes: number) => {
    const validMinutes = Math.max(0, Math.min(59, newMinutes || 0));
    onChange(hours * 60 + validMinutes);
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 flex-1 min-w-0 pr-4">
        <span className="text-sm">{label}</span>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={hours}
            onChange={(e) => handleHoursChange(parseInt(e.target.value))}
            min={0}
            max={23}
            disabled={disabled}
            className="w-16 text-center bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 disabled:opacity-70"
            placeholder="0"
          />
          <span className="text-sm text-muted-foreground">ч</span>
        </div>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={minutes}
            onChange={(e) => handleMinutesChange(parseInt(e.target.value))}
            min={0}
            max={59}
            disabled={disabled}
            className="w-16 text-center bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 disabled:opacity-70"
            placeholder="0"
          />
          <span className="text-sm text-muted-foreground">мин</span>
        </div>
      </div>
    </div>
  );
}

function PlatformSettingsInner() {
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();
  const settings = useQuery(api.platformSettings.getPlatformSettings, {});
  const canAccess = useQuery(api.platformSettings.canAccessSettings, {});
  const updateSettings = useMutation(api.platformSettings.updatePlatformSettings);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Local state for settings
  const [localSettings, setLocalSettings] = useState<SettingsState | null>(null);

  // Initialize local settings from query
  useEffect(() => {
    if (settings) {
      setLocalSettings({
        eDiaryEnabled: settings.eDiaryEnabled ?? true,
        lessonTopicRequired: settings.lessonTopicRequired ?? false,
        minutesBeforeLessonCanMarkTaken: settings.minutesBeforeLessonCanMarkTaken ?? 5,
        minutesAfterLessonCanMarkTaken: settings.minutesAfterLessonCanMarkTaken ?? 5,
        minutesAfterSaveToLock: settings.minutesAfterSaveToLock ?? 0,
        checkMissingAbsences: settings.checkMissingAbsences ?? false,
        lockDiaryPastMonths: settings.lockDiaryPastMonths ?? false,
        lockDayOfMonth: settings.lockDayOfMonth ?? 3,
        warnUntakenLessonsAfterDays: settings.warnUntakenLessonsAfterDays ?? 1,
        // Автоматично уважаване на отсъствия
        autoExcuseWithMedicalNote: settings.autoExcuseWithMedicalNote ?? true,
        autoExcuseWithParentNote: settings.autoExcuseWithParentNote ?? false,
        autoExcuseWithOtherNote: settings.autoExcuseWithOtherNote ?? false,
        // Известяване на администратори
        notifyAdminsOnGradeDelete: settings.notifyAdminsOnGradeDelete ?? true,
        notifyAdminsOnAbsenceDelete: settings.notifyAdminsOnAbsenceDelete ?? true,
        notifyAdminsOnReviewDelete: settings.notifyAdminsOnReviewDelete ?? true,
        strictModeGradeDelete: settings.strictModeGradeDelete ?? false,
        strictModeAbsenceDelete: settings.strictModeAbsenceDelete ?? false,
        strictModeReviewDelete: settings.strictModeReviewDelete ?? false,
        includeWeekends: settings.includeWeekends ?? false,
        classTeachersCanEditDayRegime: settings.classTeachersCanEditDayRegime ?? true,
        classTeachersCanEditSchedules: settings.classTeachersCanEditSchedules ?? true,
        classTeachersCanMoveStudents: settings.classTeachersCanMoveStudents ?? true,
        studentsParentsSeeTopics: settings.studentsParentsSeeTopics ?? true,
        showSecondClassHour: settings.showSecondClassHour ?? true,
        schoolYearStartDay: settings.schoolYearStartDay ?? 15,
        teachersCanEnterSubstitution: settings.teachersCanEnterSubstitution ?? true,
        absentTeachersCanBeSubstitutes: settings.absentTeachersCanBeSubstitutes ?? true,
        substitutesAccessDays: settings.substitutesAccessDays ?? 10,
        includeGrades1to3InRankings: settings.includeGrades1to3InRankings ?? false,
        studentsSeeTeachersPhones: settings.studentsSeeTeachersPhones ?? false,
        studentsSeeTeachersEmails: settings.studentsSeeTeachersEmails ?? false,
        parentsSeeTeachersPhones: settings.parentsSeeTeachersPhones ?? false,
        parentsSeeTeachersEmails: settings.parentsSeeTeachersEmails ?? false,
        parentsSeeClassmatesParents: settings.parentsSeeClassmatesParents ?? false,
        parentsAndStudentsSeeClassmates: settings.parentsAndStudentsSeeClassmates ?? true,
        parentsCannotSendMessages: settings.parentsCannotSendMessages ?? false,
        studentsCannotSendMessages: settings.studentsCannotSendMessages ?? false,
        enableLessonTimeWindow: settings.enableLessonTimeWindow ?? true,
        studentIdentifierRequired: settings.studentIdentifierRequired ?? false,
        teacherIdentifierRequired: settings.teacherIdentifierRequired ?? false,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    if (!localSettings) return;
    
    setIsSaving(true);
    try {
      await updateSettings(localSettings);
      toast.success("Настройките са запазени успешно");
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
      setLocalSettings({
        eDiaryEnabled: settings.eDiaryEnabled ?? true,
        lessonTopicRequired: settings.lessonTopicRequired ?? false,
        minutesBeforeLessonCanMarkTaken: settings.minutesBeforeLessonCanMarkTaken ?? 5,
        minutesAfterLessonCanMarkTaken: settings.minutesAfterLessonCanMarkTaken ?? 5,
        minutesAfterSaveToLock: settings.minutesAfterSaveToLock ?? 0,
        checkMissingAbsences: settings.checkMissingAbsences ?? false,
        lockDiaryPastMonths: settings.lockDiaryPastMonths ?? false,
        lockDayOfMonth: settings.lockDayOfMonth ?? 3,
        warnUntakenLessonsAfterDays: settings.warnUntakenLessonsAfterDays ?? 1,
        autoExcuseWithMedicalNote: settings.autoExcuseWithMedicalNote ?? true,
        autoExcuseWithParentNote: settings.autoExcuseWithParentNote ?? false,
        autoExcuseWithOtherNote: settings.autoExcuseWithOtherNote ?? false,
        notifyAdminsOnGradeDelete: settings.notifyAdminsOnGradeDelete ?? true,
        notifyAdminsOnAbsenceDelete: settings.notifyAdminsOnAbsenceDelete ?? true,
        notifyAdminsOnReviewDelete: settings.notifyAdminsOnReviewDelete ?? true,
        strictModeGradeDelete: settings.strictModeGradeDelete ?? false,
        strictModeAbsenceDelete: settings.strictModeAbsenceDelete ?? false,
        strictModeReviewDelete: settings.strictModeReviewDelete ?? false,
        includeWeekends: settings.includeWeekends ?? false,
        classTeachersCanEditDayRegime: settings.classTeachersCanEditDayRegime ?? true,
        classTeachersCanEditSchedules: settings.classTeachersCanEditSchedules ?? true,
        classTeachersCanMoveStudents: settings.classTeachersCanMoveStudents ?? true,
        studentsParentsSeeTopics: settings.studentsParentsSeeTopics ?? true,
        showSecondClassHour: settings.showSecondClassHour ?? true,
        schoolYearStartDay: settings.schoolYearStartDay ?? 15,
        teachersCanEnterSubstitution: settings.teachersCanEnterSubstitution ?? true,
        absentTeachersCanBeSubstitutes: settings.absentTeachersCanBeSubstitutes ?? true,
        substitutesAccessDays: settings.substitutesAccessDays ?? 10,
        includeGrades1to3InRankings: settings.includeGrades1to3InRankings ?? false,
        studentsSeeTeachersPhones: settings.studentsSeeTeachersPhones ?? false,
        studentsSeeTeachersEmails: settings.studentsSeeTeachersEmails ?? false,
        parentsSeeTeachersPhones: settings.parentsSeeTeachersPhones ?? false,
        parentsSeeTeachersEmails: settings.parentsSeeTeachersEmails ?? false,
        parentsSeeClassmatesParents: settings.parentsSeeClassmatesParents ?? false,
        parentsAndStudentsSeeClassmates: settings.parentsAndStudentsSeeClassmates ?? true,
        parentsCannotSendMessages: settings.parentsCannotSendMessages ?? false,
        studentsCannotSendMessages: settings.studentsCannotSendMessages ?? false,
        enableLessonTimeWindow: settings.enableLessonTimeWindow ?? true,
        studentIdentifierRequired: settings.studentIdentifierRequired ?? false,
        teacherIdentifierRequired: settings.teacherIdentifierRequired ?? false,
      });
    }
    setIsEditing(false);
  };

  const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    if (!localSettings || !isEditing) return;
    setLocalSettings({ ...localSettings, [key]: value });
  };

  // Show access denied
  if (canAccess === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <SettingsIcon className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Достъпът е ограничен</h1>
        <p className="text-muted-foreground">
          Само администратори, директори и заместник-директори имат достъп до настройките.
        </p>
        <Button onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Назад
        </Button>
      </div>
    );
  }

  if (settings && settings.schoolId === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <SettingsIcon className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Липсват данни за училище</h1>
        <p className="text-muted-foreground max-w-xl">
          За да използвате настройките, първо трябва да има създадено училище в платформата.
        </p>
        <Button onClick={() => navigate(`/${lng}/admin/school`)}>
          Отвори "Училище"
        </Button>
      </div>
    );
  }

  // Loading state
  if (settings === undefined || localSettings === null) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
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
              <div className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5 text-muted-foreground" />
                <h1 className="text-lg font-semibold">Настройки</h1>
              </div>
              <Button
                variant="ghost"
                className="flex items-center gap-2"
                onClick={() => navigate(`/${lng}/admin/modules`)}
              >
                <Grid3x3Icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg font-semibold text-foreground">Модули</span>
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button 
                  variant="ghost"
                  onClick={handleCancel}
                >
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
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Модул "Дневник" */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Модул "Дневник"</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <SettingToggle
              label="100% е-дневник"
              value={localSettings.eDiaryEnabled}
              onChange={(v) => updateSetting("eDiaryEnabled", v)}
              tooltip="Когато е активирано, всички данни се въвеждат само в електронния дневник"
              disabled={!isEditing}
            />
            <SettingToggle
              label="[Моят час] Направи темата на часа задължително поле"
              value={localSettings.lessonTopicRequired}
              onChange={(v) => updateSetting("lessonTopicRequired", v)}
              disabled={!isEditing}
            />
            <SettingToggle
              label="[Моят час] Активирай времеви прозорец за отбелязване на часове"
              value={localSettings.enableLessonTimeWindow}
              onChange={(v) => updateSetting("enableLessonTimeWindow", v)}
              tooltip="Когато е изключено, учителите могат да отбелязват часове като взети по всяко време без ограничения"
              disabled={!isEditing}
            />
            {localSettings.enableLessonTimeWindow && (
              <>
                <SettingTimeWindow
                  label="[Моят час] Колко време преди занятие да може да се отбележи като взето"
                  totalMinutes={localSettings.minutesBeforeLessonCanMarkTaken}
                  onChange={(v) => updateSetting("minutesBeforeLessonCanMarkTaken", v)}
                  tooltip="Въведете часове и минути. Например: 1ч 30мин означава час и половина преди началото на часа"
                  disabled={!isEditing}
                />
                <SettingTimeWindow
                  label="[Моят час] Колко време след занятие да може да се отбележи като взето"
                  totalMinutes={localSettings.minutesAfterLessonCanMarkTaken}
                  onChange={(v) => updateSetting("minutesAfterLessonCanMarkTaken", v)}
                  tooltip="Въведете часове и минути. Например: 0ч 30мин означава половин час след края на часа"
                  disabled={!isEditing}
                />
              </>
            )}
            <SettingToggle
              label="[Моят час] Активирай проверка за липса на отсъстващи ученици"
              value={localSettings.checkMissingAbsences}
              onChange={(v) => updateSetting("checkMissingAbsences", v)}
              tooltip="Предупреждава учителя ако не е маркирал нито един ученик като отсъстващ"
              disabled={!isEditing}
            />
            <SettingNumber
              label="[Моят час] Заключване на часа след X минути от записването"
              value={localSettings.minutesAfterSaveToLock}
              onChange={(v) => updateSetting("minutesAfterSaveToLock", v)}
              min={0}
              max={1440}
              tooltip="След колко минути от запазването часът да се заключи за редакция. 0 = без заключване. Само администратори могат да редактират заключени часове."
              disabled={!isEditing}
            />
            <SettingToggle
              label="Заключвай дневника за отминали месеци"
              value={localSettings.lockDiaryPastMonths}
              onChange={(v) => updateSetting("lockDiaryPastMonths", v)}
              tooltip="Когато е активирано, учителите няма да могат да редактират оценки, отсъствия и отзиви за минали месеци след зададената дата"
              disabled={!isEditing}
            />
            {/* Show lockDayOfMonth only when lockDiaryPastMonths is enabled */}
            {localSettings.lockDiaryPastMonths && (
              <SettingNumber
                label="На кое число от всеки месец да се заключва въвеждането и редакцията на оценки/отсъствия?"
                value={localSettings.lockDayOfMonth}
                onChange={(v) => updateSetting("lockDayOfMonth", v)}
                min={1}
                max={28}
                tooltip="След това число учителите няма да могат да редактират данни за предходния месец"
                disabled={!isEditing}
              />
            )}
            <SettingNumber
              label="Предупреждавай учители за невзети занятия след X дни"
              value={localSettings.warnUntakenLessonsAfterDays}
              onChange={(v) => updateSetting("warnUntakenLessonsAfterDays", v)}
              min={1}
              max={30}
              tooltip="Изпраща известие на учителите, ако имат часове, които не са маркирани като взети"
              disabled={!isEditing}
            />
            
            {/* Автоматично уважаване на отсъствия */}
            <div className="pt-4 pb-2 text-sm font-medium text-muted-foreground">
              Автоматично уважаване на отсъствия
            </div>
            <SettingToggle
              label="Автоматично уважаване на отсъствия с дигитална медицинска бележка"
              value={localSettings.autoExcuseWithMedicalNote}
              onChange={(v) => updateSetting("autoExcuseWithMedicalNote", v)}
              disabled={!isEditing}
            />
            <SettingToggle
              label="Автоматично уважаване на отсъствия с родителска бележка"
              value={localSettings.autoExcuseWithParentNote}
              onChange={(v) => updateSetting("autoExcuseWithParentNote", v)}
              disabled={!isEditing}
            />
            <SettingToggle
              label="Автоматично уважаване на отсъствия с бележка по други причини"
              value={localSettings.autoExcuseWithOtherNote}
              onChange={(v) => updateSetting("autoExcuseWithOtherNote", v)}
              disabled={!isEditing}
            />
            
            {/* Известяване на администратори */}
            <div className="pt-4 pb-2 text-sm font-medium text-muted-foreground">
              Известяване на администратори
            </div>
            <SettingToggle
              label="Известявай администраторите при изтриване на оценки"
              value={localSettings.notifyAdminsOnGradeDelete}
              onChange={(v) => updateSetting("notifyAdminsOnGradeDelete", v)}
              disabled={!isEditing}
            />
            <SettingToggle
              label="Известявай администраторите при изтриване на отсъствия"
              value={localSettings.notifyAdminsOnAbsenceDelete}
              onChange={(v) => updateSetting("notifyAdminsOnAbsenceDelete", v)}
              disabled={!isEditing}
            />
            <SettingToggle
              label="Известявай администраторите при изтриване на отзиви"
              value={localSettings.notifyAdminsOnReviewDelete}
              onChange={(v) => updateSetting("notifyAdminsOnReviewDelete", v)}
              disabled={!isEditing}
            />
            
            {/* Стриктен режим */}
            <div className="pt-4 pb-2 text-sm font-medium text-muted-foreground">
              Стриктен режим
            </div>
            <SettingToggle
              label='[СТРИКТЕН РЕЖИМ] Забрана на редакция и верификация при изтриване на оценки'
              value={localSettings.strictModeGradeDelete}
              onChange={(v) => updateSetting("strictModeGradeDelete", v)}
              tooltip="При активиране, изтриването на оценки изисква допълнително одобрение"
              disabled={!isEditing}
            />
            <SettingToggle
              label="[СТРИКТЕН РЕЖИМ] Верификация при изтриване на отсъствия"
              value={localSettings.strictModeAbsenceDelete}
              onChange={(v) => updateSetting("strictModeAbsenceDelete", v)}
              tooltip="При активиране, изтриването на отсъствия изисква допълнително одобрение"
              disabled={!isEditing}
            />
            <SettingToggle
              label='[СТРИКТЕН РЕЖИМ] Забрана на редакция и верификация при изтриване на отзиви'
              value={localSettings.strictModeReviewDelete}
              onChange={(v) => updateSetting("strictModeReviewDelete", v)}
              tooltip="При активиране, изтриването на отзиви изисква допълнително одобрение"
              disabled={!isEditing}
            />
            
            {/* Други настройки */}
            <div className="pt-4 pb-2 text-sm font-medium text-muted-foreground">
              Други настройки
            </div>
            <SettingToggle
              label="Включи събота и неделя в седмичните разписания"
              value={localSettings.includeWeekends}
              onChange={(v) => updateSetting("includeWeekends", v)}
              disabled={!isEditing}
            />
            <SettingToggle
              label="Класните ръководители могат да редактират дневния режим на своя клас"
              value={localSettings.classTeachersCanEditDayRegime}
              onChange={(v) => updateSetting("classTeachersCanEditDayRegime", v)}
              disabled={!isEditing}
            />
            <SettingToggle
              label="Класните ръководители могат да добавят/редактират/изтриват разписания"
              value={localSettings.classTeachersCanEditSchedules}
              onChange={(v) => updateSetting("classTeachersCanEditSchedules", v)}
              disabled={!isEditing}
            />
            <SettingToggle
              label="Класните ръководители могат да преместват ученици"
              value={localSettings.classTeachersCanMoveStudents}
              onChange={(v) => updateSetting("classTeachersCanMoveStudents", v)}
              disabled={!isEditing}
            />
            <SettingToggle
              label="Учениците и родителите виждат темите на часа"
              value={localSettings.studentsParentsSeeTopics}
              onChange={(v) => updateSetting("studentsParentsSeeTopics", v)}
              disabled={!isEditing}
            />
            <SettingToggle
              label='Покажи секция "Втори час на класа" в дневника'
              value={localSettings.showSecondClassHour}
              onChange={(v) => updateSetting("showSecondClassHour", v)}
              disabled={!isEditing}
            />
            <SettingNumber
              label="На коя дата през Септември започва новата учебна година"
              value={localSettings.schoolYearStartDay}
              onChange={(v) => updateSetting("schoolYearStartDay", v)}
              min={1}
              max={30}
              tooltip="Тази дата определя началото на новата учебна година"
              disabled={!isEditing}
            />
          </CardContent>
        </Card>

        {/* Модул "Учителски отсъствия" */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Модул "Учителски отсъствия"</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <SettingToggle
              label="Учителите могат да въвеждат заместване"
              value={localSettings.teachersCanEnterSubstitution}
              onChange={(v) => updateSetting("teachersCanEnterSubstitution", v)}
              tooltip="Когато е активирано, учителите могат сами да въвеждат своите заместници"
              disabled={!isEditing}
            />
            <SettingToggle
              label="Отсъстващите учители могат да са заместници"
              value={localSettings.absentTeachersCanBeSubstitutes}
              onChange={(v) => updateSetting("absentTeachersCanBeSubstitutes", v)}
              tooltip="Когато е активирано, учител който отсъства може да бъде заместник на друг"
              disabled={!isEditing}
            />
            <SettingNumber
              label="Колко дни заместниците имат достъп до паралелките"
              value={localSettings.substitutesAccessDays}
              onChange={(v) => updateSetting("substitutesAccessDays", v)}
              min={1}
              max={365}
              tooltip="След изтичане на този срок, заместникът губи достъп до паралелката"
              disabled={!isEditing}
            />
          </CardContent>
        </Card>

        {/* Модул "Статистики и справки" */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Модул "Статистики и справки"</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <SettingToggle
              label="Включвай учениците от 1-3 клас в класациите за успех"
              value={localSettings.includeGrades1to3InRankings}
              onChange={(v) => updateSetting("includeGrades1to3InRankings", v)}
              tooltip="В 1-3 клас оценяването е по различна скала"
              disabled={!isEditing}
            />
          </CardContent>
        </Card>

        {/* Модул "Администрация" */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Модул "Администрация"</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <SettingToggle
              label="Учениците виждат телефоните на своите учители"
              value={localSettings.studentsSeeTeachersPhones}
              onChange={(v) => updateSetting("studentsSeeTeachersPhones", v)}
              disabled={!isEditing}
            />
            <SettingToggle
              label="Учениците виждат имейлите на своите учители"
              value={localSettings.studentsSeeTeachersEmails}
              onChange={(v) => updateSetting("studentsSeeTeachersEmails", v)}
              disabled={!isEditing}
            />
            <SettingToggle
              label="Родителите виждат телефоните на учителите на своите деца"
              value={localSettings.parentsSeeTeachersPhones}
              onChange={(v) => updateSetting("parentsSeeTeachersPhones", v)}
              disabled={!isEditing}
            />
            <SettingToggle
              label="Родителите виждат имейлите на учителите на своите деца"
              value={localSettings.parentsSeeTeachersEmails}
              onChange={(v) => updateSetting("parentsSeeTeachersEmails", v)}
              disabled={!isEditing}
            />
            <SettingToggle
              label="Родителите виждат родителите на съучениците"
              value={localSettings.parentsSeeClassmatesParents}
              onChange={(v) => updateSetting("parentsSeeClassmatesParents", v)}
              tooltip="Когато е активирано, родителите могат да виждат информация за родителите на съучениците на своето дете"
              disabled={!isEditing}
            />
            <SettingToggle
              label="Родителите и учениците виждат съучениците"
              value={localSettings.parentsAndStudentsSeeClassmates}
              onChange={(v) => updateSetting("parentsAndStudentsSeeClassmates", v)}
              tooltip="Когато е активирано, родителите и учениците могат да виждат списъка със съученици"
              disabled={!isEditing}
            />
            <SettingToggle
              label="Родителите не могат да изпращат съобщения"
              value={localSettings.parentsCannotSendMessages}
              onChange={(v) => updateSetting("parentsCannotSendMessages", v)}
              disabled={!isEditing}
            />
            <SettingToggle
              label="Учениците не могат да изпращат съобщения"
              value={localSettings.studentsCannotSendMessages}
              onChange={(v) => updateSetting("studentsCannotSendMessages", v)}
              disabled={!isEditing}
            />
            <SettingToggle
              label="Идентификаторът за ученик е задължителен"
              value={localSettings.studentIdentifierRequired}
              onChange={(v) => updateSetting("studentIdentifierRequired", v)}
              tooltip="Когато е активирано, при създаване на ученик се изисква въвеждане на ЕГН/ЛНЧ"
              disabled={!isEditing}
            />
            <SettingToggle
              label="Идентификаторът за учител е задължителен"
              value={localSettings.teacherIdentifierRequired}
              onChange={(v) => updateSetting("teacherIdentifierRequired", v)}
              tooltip="Когато е активирано, при създаване на учител се изисква въвеждане на ЕГН/ЛНЧ"
              disabled={!isEditing}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PlatformSettings() {
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
          <PlatformSettingsInner />
        </Layout>
      </Authenticated>
    </>
  );
}
