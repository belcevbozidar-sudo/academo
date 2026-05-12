import { useState, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs.tsx";
import {
  CalendarIcon,
  ChevronLeft,
  MapPinIcon,
  SaveIcon,
  SearchIcon,
  UsersIcon,
  XIcon,
  FileIcon,
  UploadIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const EVENT_CATEGORIES = [
  "Родителска среща",
  "Училищно събитие",
  "Административно събитие",
  "Държавен зрелостен изпит",
  "Национално външно оценяване",
  "Официален празник",
  "Домашна работа",
  "Контролна работа",
  "Класна работа",
  "Състезание",
  "ДКИ по теория и практика на професията",
];

const BG_CITIES = [
  "София", "Пловдив", "Варна", "Бургас", "Русе", "Стара Загора",
  "Плевен", "Добрич", "Сливен", "Шумен", "Перник", "Хасково",
  "Ямбол", "Пазарджик", "Благоевград", "Велико Търново", "Враца",
  "Габрово", "Кърджали", "Кюстендил", "Ловеч", "Монтана", "Разград",
  "Силистра", "Смолян", "Търговище", "Видин",
];

function AddEventInner() {
  const navigate = useNavigate();
  const { lng } = useParams();
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const school = useQuery(api.admin.getDefaultSchool, {});
  const classes = useQuery(api.admin.listClasses, {});
  const createEvent = useMutation(api.events.createEvent);
  const generateUploadUrl = useMutation(api.events.generateUploadUrl);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [isSchoolCalendar, setIsSchoolCalendar] = useState(false);
  const [category, setCategory] = useState("Училищно събитие");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [registrationDeadline, setRegistrationDeadline] = useState("");
  const [minRegistrants, setMinRegistrants] = useState("");
  const [maxRegistrants, setMaxRegistrants] = useState("");
  const [activeTab, setActiveTab] = useState("basic");

  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{ storageId: Id<"_storage">; name: string }>
  >([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Invitation state
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [inviteClassFilter, setInviteClassFilter] = useState<string>("all");
  const [inviteSearch, setInviteSearch] = useState("");
  const [roleFilters, setRoleFilters] = useState<Set<string>>(new Set());

  // Location state
  const [locationAddress, setLocationAddress] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationDescription, setLocationDescription] = useState("");

  const [isSaving, setIsSaving] = useState(false);

  // Build role filter array
  const roleFilterArray = useMemo(() => {
    if (roleFilters.size === 0) return undefined;
    const mapping: Record<string, string[]> = {
      students: ["student"],
      parents: ["parent"],
      teachers: ["teacher", "class_teacher"],
      staff: ["director", "vice_director", "system_admin", "secretary", "pedagogical_counselor", "housekeeper"],
    };
    const roles: string[] = [];
    for (const key of roleFilters) {
      if (mapping[key]) roles.push(...mapping[key]);
    }
    return roles.length > 0 ? roles : undefined;
  }, [roleFilters]);

  const usersForInvite = useQuery(api.events.listUsersForInvite, {
    classId: inviteClassFilter !== "all" ? (inviteClassFilter as Id<"classes">) : undefined,
    roleFilter: roleFilterArray,
    searchQuery: inviteSearch || undefined,
  });

  const toggleRoleFilter = (role: string) => {
    setRoleFilters((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const selectAllVisible = () => {
    if (!usersForInvite) return;
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      for (const u of usersForInvite) {
        next.add(u._id);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setInviteClassFilter("all");
    setInviteSearch("");
    setRoleFilters(new Set());
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const postUrl = await generateUploadUrl();
        const result = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await result.json();
        setUploadedFiles((prev) => [...prev, { storageId, name: file.name }]);
      }
      toast.success("Файловете са качени успешно");
    } catch {
      toast.error("Грешка при качване на файл");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Заглавието е задължително");
      setActiveTab("basic");
      return;
    }
    if (!startDate) {
      toast.error("Началото на събитието е задължително");
      setActiveTab("basic");
      return;
    }
    if (!endDate) {
      toast.error("Краят на събитието е задължителен");
      setActiveTab("basic");
      return;
    }
    if (!currentUser || !school?.schoolId) {
      toast.error("Грешка при зареждане на данни");
      return;
    }

    setIsSaving(true);
    try {
      await createEvent({
        title: title.trim(),
        description: description.trim() || undefined,
        startDate: new Date(startDate).getTime(),
        endDate: new Date(endDate).getTime(),
        organizerId: currentUser._id,
        schoolId: school.schoolId,
        invitedUserIds: Array.from(selectedUsers) as Id<"users">[],
        category,
        isPaid,
        isSchoolCalendar,
        registrationDeadline: registrationDeadline
          ? new Date(registrationDeadline).getTime()
          : undefined,
        minRegistrants: minRegistrants ? parseInt(minRegistrants) : undefined,
        maxRegistrants: maxRegistrants ? parseInt(maxRegistrants) : undefined,
        fileIds:
          uploadedFiles.length > 0
            ? uploadedFiles.map((f) => f.storageId)
            : undefined,
        locationAddress: locationAddress.trim() || undefined,
        locationCity: locationCity || undefined,
        locationDescription: locationDescription.trim() || undefined,
      });
      toast.success("Събитието е създадено успешно");
      navigate(`/${lng}/events/all-events`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Грешка при запис";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentUser || !school || !classes) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">Добавяне на събитие</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => navigate(`/${lng}/events/all-events`)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Назад
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <SaveIcon className="h-4 w-4 mr-1" />
            {isSaving ? "Запазване..." : "Запази"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="basic" className="gap-2">
            <CalendarIcon className="h-4 w-4" />
            Основни данни
          </TabsTrigger>
          <TabsTrigger value="invitations" className="gap-2">
            <UsersIcon className="h-4 w-4" />
            Покани
            {selectedUsers.size > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {selectedUsers.size}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="location" className="gap-2">
            <MapPinIcon className="h-4 w-4" />
            Локация
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Basic Data */}
        <TabsContent value="basic" className="mt-6">
          <div className="max-w-2xl space-y-6">
            {/* Title */}
            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-right font-semibold">
                Заглавие:<span className="text-destructive ml-0.5">*</span>
              </Label>
              <Input
                placeholder="Заглавие на събитието"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="grid grid-cols-[200px_1fr] items-start gap-4">
              <Label className="text-right font-semibold pt-2">Описание:</Label>
              <div>
                <Textarea
                  placeholder="Описание на събитието..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  className="resize-y"
                  maxLength={15000}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {description.length} / 15000
                </p>
              </div>
            </div>

            {/* Paid event toggle */}
            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-right font-semibold">
                Платено събитие:
              </Label>
              <div className="flex items-center gap-3">
                <Switch checked={isPaid} onCheckedChange={setIsPaid} />
                <Badge variant={isPaid ? "default" : "destructive"}>
                  {isPaid ? "ДА" : "НЕ"}
                </Badge>
              </div>
            </div>

            {/* School calendar toggle */}
            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-right font-semibold">
                Училищен календар:
              </Label>
              <div className="flex items-center gap-3">
                <Switch
                  checked={isSchoolCalendar}
                  onCheckedChange={setIsSchoolCalendar}
                />
                <Badge variant={isSchoolCalendar ? "default" : "destructive"}>
                  {isSchoolCalendar ? "ДА" : "НЕ"}
                </Badge>
              </div>
            </div>

            {/* Category */}
            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-right font-semibold">Категория:</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start date */}
            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-right font-semibold">
                Начало на събитието:
                <span className="text-destructive ml-0.5">*</span>
              </Label>
              <Input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* End date */}
            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-right font-semibold">
                Край на събитието:
                <span className="text-destructive ml-0.5">*</span>
              </Label>
              <Input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* Registration deadline */}
            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-right font-semibold">
                Краен срок за записване:
              </Label>
              <Input
                type="datetime-local"
                value={registrationDeadline}
                onChange={(e) => setRegistrationDeadline(e.target.value)}
              />
            </div>

            {/* Min registrants */}
            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-right font-semibold">
                Минимален брой записани:
              </Label>
              <Input
                type="number"
                min={0}
                className="w-24"
                value={minRegistrants}
                onChange={(e) => setMinRegistrants(e.target.value)}
              />
            </div>

            {/* Max registrants */}
            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-right font-semibold">
                Максимален брой записани:
              </Label>
              <Input
                type="number"
                min={0}
                className="w-24"
                value={maxRegistrants}
                onChange={(e) => setMaxRegistrants(e.target.value)}
              />
            </div>

            {/* File upload */}
            <div className="grid grid-cols-[200px_1fr] items-start gap-4">
              <Label className="text-right font-semibold pt-2">Файлове:</Label>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadIcon className="h-4 w-4 mr-1" />
                    {isUploading ? "Качване..." : "Избери файлове"}
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    onChange={handleFileUpload}
                  />
                  {uploadedFiles.length === 0 && (
                    <span className="text-sm text-muted-foreground">
                      Няма избрани файлове
                    </span>
                  )}
                </div>
                {uploadedFiles.length > 0 && (
                  <div className="space-y-1">
                    {uploadedFiles.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm bg-muted/50 rounded px-3 py-1.5"
                      >
                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 truncate">{file.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => removeFile(i)}
                        >
                          <Trash2Icon className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: Invitations */}
        <TabsContent value="invitations" className="mt-6">
          <div className="space-y-4">
            {/* Filters row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Class filter */}
              <Select
                value={inviteClassFilter}
                onValueChange={setInviteClassFilter}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Клас" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Всички класове</SelectItem>
                  {classes
                    .sort((a, b) => a.grade - b.grade || a.letter.localeCompare(b.letter))
                    .map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              {/* Role filter checkboxes */}
              <div className="flex items-center gap-4">
                {[
                  { key: "students", label: "Ученици" },
                  { key: "parents", label: "Родители" },
                  { key: "teachers", label: "Учители" },
                  { key: "staff", label: "Училищен персонал" },
                ].map((r) => (
                  <label
                    key={r.key}
                    className="flex items-center gap-1.5 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={roleFilters.has(r.key)}
                      onCheckedChange={() => toggleRoleFilter(r.key)}
                    />
                    {r.label}
                  </label>
                ))}
              </div>

              <Button
                variant="destructive"
                size="sm"
                onClick={clearFilters}
              >
                <XIcon className="h-3.5 w-3.5 mr-1" />
                Изчисти
              </Button>
            </div>

            {/* Search + select all */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={selectAllVisible}>
                  Избери всички
                </Button>
                {selectedUsers.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedUsers(new Set())}
                  >
                    Премахни всички ({selectedUsers.size})
                  </Button>
                )}
              </div>
              <div className="relative w-64">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Търсене по име:"
                  value={inviteSearch}
                  onChange={(e) => setInviteSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Users table */}
            <div className="border rounded-lg max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="font-semibold">Име</TableHead>
                    <TableHead className="font-semibold">Роля</TableHead>
                    <TableHead className="font-semibold">Паралелка</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersForInvite === undefined ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        <Skeleton className="h-6 w-40 mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : usersForInvite.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Няма намерени потребители
                      </TableCell>
                    </TableRow>
                  ) : (
                    usersForInvite.map((user) => (
                      <TableRow
                        key={user._id}
                        className={
                          selectedUsers.has(user._id)
                            ? "bg-primary/5"
                            : "cursor-pointer hover:bg-muted/30"
                        }
                        onClick={() => toggleUserSelection(user._id)}
                      >
                        <TableCell className="text-center">
                          <Checkbox
                            checked={selectedUsers.has(user._id)}
                            onCheckedChange={() =>
                              toggleUserSelection(user._id)
                            }
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {user.name}
                        </TableCell>
                        <TableCell>{user.role}</TableCell>
                        <TableCell>{user.className || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {usersForInvite && (
              <div className="text-sm text-muted-foreground">
                Показване на {usersForInvite.length} потребителя
                {selectedUsers.size > 0 && ` | Избрани: ${selectedUsers.size}`}
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 3: Location */}
        <TabsContent value="location" className="mt-6">
          <div className="max-w-2xl space-y-6">
            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-right font-semibold">Адрес:</Label>
              <Input
                placeholder="Адрес"
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <Label className="text-right font-semibold">
                Населено място:
              </Label>
              <Select value={locationCity} onValueChange={setLocationCity}>
                <SelectTrigger>
                  <SelectValue placeholder="Изберете населено място" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Не е избрано —</SelectItem>
                  {BG_CITIES.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-[200px_1fr] items-start gap-4">
              <Label className="text-right font-semibold pt-2">
                Описание:
              </Label>
              <Textarea
                placeholder="Допълнително описание на локацията..."
                value={locationDescription}
                onChange={(e) => setLocationDescription(e.target.value)}
                rows={4}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AddEventPage() {
  return (
    <>
      <AuthLoading>
        <Layout>
          <div className="p-6">
            <Skeleton className="h-96 w-full" />
          </div>
        </Layout>
      </AuthLoading>
      <Authenticated>
        <Layout>
          <AddEventInner />
        </Layout>
      </Authenticated>
    </>
  );
}
