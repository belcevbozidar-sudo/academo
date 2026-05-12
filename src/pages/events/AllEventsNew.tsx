import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  Calendar,
  GraduationCap,
  Umbrella,
  PartyPopper,
  BookOpen,
  Search,
  PlusIcon,
  Users,
  FileText,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

// Unified row type for all event sources
type UnifiedEvent = {
  id: string;
  name: string;
  startDate: number;
  endDate: number;
  category: string;
  classNames: string;
  type: "nonSchoolDay" | "event" | "assignment" | "parentMeeting";
  organizerName?: string;
  subjectName?: string;
};

// Helper function to calculate days between dates
function calculateDays(startDate: number, endDate: number): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

// Helper function to format date range
function formatDateRange(startDate: number, endDate: number): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startStr = start.toLocaleDateString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const endStr = end.toLocaleDateString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  if (startStr === endStr) {
    return startStr;
  }
  return `${startStr} - ${endStr}`;
}

// Get type label in Bulgarian
function getTypeLabel(type: UnifiedEvent["type"]): string {
  switch (type) {
    case "nonSchoolDay":
      return "Неучебен ден";
    case "event":
      return "Събитие";
    case "assignment":
      return "Контролна";
    case "parentMeeting":
      return "Род. среща";
  }
}

// Get type styling
function getTypeStyle(type: UnifiedEvent["type"]): { icon: React.ReactNode; color: string; bgColor: string } {
  switch (type) {
    case "nonSchoolDay":
      return {
        icon: <Umbrella className="h-4 w-4" />,
        color: "text-green-700 dark:text-green-400",
        bgColor: "bg-green-100 dark:bg-green-900/30",
      };
    case "event":
      return {
        icon: <Calendar className="h-4 w-4" />,
        color: "text-blue-700 dark:text-blue-400",
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
      };
    case "assignment":
      return {
        icon: <FileText className="h-4 w-4" />,
        color: "text-orange-700 dark:text-orange-400",
        bgColor: "bg-orange-100 dark:bg-orange-900/30",
      };
    case "parentMeeting":
      return {
        icon: <Users className="h-4 w-4" />,
        color: "text-purple-700 dark:text-purple-400",
        bgColor: "bg-purple-100 dark:bg-purple-900/30",
      };
  }
}

// Get category style
function getCategoryStyle(category: string): { icon: React.ReactNode; color: string; bgColor: string } {
  switch (category.toLowerCase()) {
    case "ваканция":
      return {
        icon: <Umbrella className="h-4 w-4" />,
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
      };
    case "празник":
      return {
        icon: <PartyPopper className="h-4 w-4" />,
        color: "text-purple-600 dark:text-purple-400",
        bgColor: "bg-purple-100 dark:bg-purple-900/30",
      };
    case "изпити":
      return {
        icon: <BookOpen className="h-4 w-4" />,
        color: "text-orange-600 dark:text-orange-400",
        bgColor: "bg-orange-100 dark:bg-orange-900/30",
      };
    case "обучение":
      return {
        icon: <GraduationCap className="h-4 w-4" />,
        color: "text-green-600 dark:text-green-400",
        bgColor: "bg-green-100 dark:bg-green-900/30",
      };
    default:
      return {
        icon: <Calendar className="h-4 w-4" />,
        color: "text-gray-600 dark:text-gray-400",
        bgColor: "bg-gray-100 dark:bg-gray-900/30",
      };
  }
}

function AllEventsNewInner() {
  const navigate = useNavigate();
  const { lng } = useParams();
  const nonSchoolDays = useQuery(api.nonSchoolDays.listNonSchoolDays, {});
  const events = useQuery(api.events.listEventsWithStats, {
    includeAssignments: true,
    includeParentMeetings: true,
    includePastEvents: true,
  });
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const deleteEvent = useMutation(api.events.deleteEvent);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if current user is admin/director/vice_director
  const isAdminRole =
    currentUser &&
    (currentUser.role === "director" ||
      currentUser.role === "vice_director" ||
      currentUser.role === "system_admin" ||
      currentUser.roles?.includes("director") ||
      currentUser.roles?.includes("vice_director") ||
      currentUser.roles?.includes("system_admin"));

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;
    setIsDeleting(true);
    try {
      await deleteEvent({ id: eventToDelete.id as Id<"events"> });
      toast.success(`Събитието „${eventToDelete.name}" е изтрито`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Грешка при изтриване";
      toast.error(message);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setEventToDelete(null);
    }
  };

  // Merge all event sources into a unified list
  const { filteredEvents, stats } = useMemo(() => {
    if (!nonSchoolDays || !events) {
      return { filteredEvents: [], stats: { total: 0, upcoming: 0, past: 0, totalDays: 0 } };
    }

    const unified: UnifiedEvent[] = [];

    // Add non-school days
    for (const day of nonSchoolDays) {
      unified.push({
        id: day._id,
        name: day.name,
        startDate: day.startDate,
        endDate: day.endDate,
        category: day.category,
        classNames: day.classNames,
        type: "nonSchoolDay",
      });
    }

    // Add events, assignments, parent meetings
    for (const ev of events) {
      unified.push({
        id: ev._id,
        name: ev.title,
        startDate: ev.startDate,
        endDate: ev.endDate ?? ev.startDate,
        category: ev.category,
        classNames: ev.classNames.length > 0 ? ev.classNames.join(", ") : "—",
        type: ev.type,
        organizerName: ev.organizerName,
        subjectName: ev.subjectName,
      });
    }

    const now = Date.now();
    const upcoming = unified.filter((e) => e.endDate >= now);
    const past = unified.filter((e) => e.endDate < now);
    const totalDays = nonSchoolDays.reduce(
      (sum, day) => sum + calculateDays(day.startDate, day.endDate),
      0
    );

    // Apply search + tab filter
    const searchLower = searchQuery.toLowerCase();
    const applySearch = (items: UnifiedEvent[]) => {
      if (!searchQuery) return items;
      return items.filter(
        (e) =>
          e.name.toLowerCase().includes(searchLower) ||
          e.category.toLowerCase().includes(searchLower) ||
          e.classNames.toLowerCase().includes(searchLower) ||
          (e.organizerName && e.organizerName.toLowerCase().includes(searchLower)) ||
          (e.subjectName && e.subjectName.toLowerCase().includes(searchLower)) ||
          getTypeLabel(e.type).toLowerCase().includes(searchLower)
      );
    };

    let filtered: UnifiedEvent[];
    switch (activeTab) {
      case "upcoming":
        filtered = applySearch(upcoming);
        break;
      case "past":
        filtered = applySearch(past);
        break;
      default:
        filtered = applySearch(unified);
    }

    // Sort by start date ascending
    filtered = [...filtered].sort((a, b) => a.startDate - b.startDate);

    return {
      filteredEvents: filtered,
      stats: {
        total: unified.length,
        upcoming: upcoming.length,
        past: past.length,
        totalDays,
      },
    };
  }, [nonSchoolDays, events, searchQuery, activeTab]);

  if (nonSchoolDays === undefined || events === undefined) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <CalendarDays className="h-8 w-8 text-primary" />
            Всички събития
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Неучебни дни, ваканции, събития, контролни работи и родителски срещи
          </p>
        </div>
        {isAdminRole && (
          <Button onClick={() => navigate(`/${lng}/events/add`)}>
            <PlusIcon className="h-4 w-4 mr-1" />
            Добави събитие
          </Button>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Общо събития</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.upcoming}</p>
                <p className="text-xs text-muted-foreground">Предстоящи</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.past}</p>
                <p className="text-xs text-muted-foreground">Минали</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <CalendarDays className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalDays}</p>
                <p className="text-xs text-muted-foreground">Неучебни дни</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs and Search */}
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <TabsList>
              <TabsTrigger value="all" className="gap-2">
                <Calendar className="h-4 w-4" />
                Всички ({stats.total})
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="gap-2">
                <Clock className="h-4 w-4" />
                Предстоящи ({stats.upcoming})
              </TabsTrigger>
              <TabsTrigger value="past" className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Минали ({stats.past})
              </TabsTrigger>
            </TabsList>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Търси събития..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <TabsContent value={activeTab} className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-12 text-center font-semibold">№</TableHead>
                        <TableHead className="font-semibold">Събитие</TableHead>
                        <TableHead className="font-semibold">Тип</TableHead>
                        <TableHead className="font-semibold">Период</TableHead>
                        <TableHead className="w-20 text-center font-semibold">Дни</TableHead>
                        <TableHead className="font-semibold">Категория</TableHead>
                        <TableHead className="font-semibold">Паралелки</TableHead>
                        <TableHead className="w-28 text-center font-semibold">Статус</TableHead>
                        {isAdminRole && (
                          <TableHead className="w-24 text-center font-semibold">Действия</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEvents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={isAdminRole ? 9 : 8} className="text-center py-12">
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                              <CalendarDays className="h-10 w-10 opacity-50" />
                              <p>Няма намерени събития</p>
                              {searchQuery && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSearchQuery("")}
                                >
                                  Изчисти търсенето
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredEvents.map((ev, index) => {
                          const categoryStyle = getCategoryStyle(ev.category);
                          const typeStyle = getTypeStyle(ev.type);
                          const isPast = ev.endDate < Date.now();
                          const isOngoing = ev.startDate <= Date.now() && ev.endDate >= Date.now();
                          const days = calculateDays(ev.startDate, ev.endDate);

                          return (
                            <TableRow
                              key={ev.id}
                              className={isPast ? "opacity-60" : ""}
                            >
                              <TableCell className="text-center font-medium text-muted-foreground">
                                {index + 1}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className={`p-1.5 rounded-md ${categoryStyle.bgColor}`}>
                                    <span className={categoryStyle.color}>{categoryStyle.icon}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium">{ev.name}</span>
                                    {ev.subjectName && (
                                      <p className="text-xs text-muted-foreground">{ev.subjectName}</p>
                                    )}
                                    {ev.organizerName && (
                                      <p className="text-xs text-muted-foreground">{ev.organizerName}</p>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="secondary"
                                  className={`${typeStyle.bgColor} ${typeStyle.color} border-0 gap-1`}
                                >
                                  {typeStyle.icon}
                                  {getTypeLabel(ev.type)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">
                                  {formatDateRange(ev.startDate, ev.endDate)}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary" className="font-mono">
                                  {days}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="secondary"
                                  className={`${categoryStyle.bgColor} ${categoryStyle.color} border-0`}
                                >
                                  {ev.category}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">
                                  {ev.classNames}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                {isOngoing ? (
                                  <Badge className="bg-blue-600 hover:bg-blue-700">
                                    В момента
                                  </Badge>
                                ) : isPast ? (
                                  <Badge variant="secondary" className="text-muted-foreground">
                                    Минало
                                  </Badge>
                                ) : (
                                  <Badge className="bg-green-600 hover:bg-green-700">
                                    Предстои
                                  </Badge>
                                )}
                              </TableCell>
                              {isAdminRole && (
                                <TableCell className="text-center">
                                  {ev.type === "event" && (
                                    <div className="flex items-center justify-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(`/${lng}/events/edit/${ev.id}`);
                                        }}
                                        title="Редактирай"
                                      >
                                        <PencilIcon className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEventToDelete({ id: ev.id, name: ev.name });
                                          setDeleteDialogOpen(true);
                                        }}
                                        title="Изтрий"
                                      >
                                        <Trash2Icon className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
                  <div className="text-sm text-muted-foreground">
                    Показване на {filteredEvents.length} от общо {stats.total} събития
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Изтриване на събитие</AlertDialogTitle>
            <AlertDialogDescription>
              Сигурни ли сте, че искате да изтриете събитието „{eventToDelete?.name}"?
              Това действие е необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Отказ</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEvent}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? "Изтриване..." : "Изтрий"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AllEventsNew() {
  return (
    <Layout>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-4">
          <p className="text-muted-foreground">
            Моля, влезте в акаунта си, за да видите събитията.
          </p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="p-6">
          <Skeleton className="h-96 w-full" />
        </div>
      </AuthLoading>
      <Authenticated>
        <AllEventsNewInner />
      </Authenticated>
    </Layout>
  );
}
