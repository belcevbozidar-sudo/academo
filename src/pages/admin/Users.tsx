import Layout from "@/components/Layout.tsx";
import { Authenticated, AuthLoading } from "@/lib/convex-preview";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import DataTable, { type DataTableColumn } from "@/components/DataTable.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { PlusIcon, EditIcon, TrashIcon, UndoIcon, FilterIcon, XIcon, FileSpreadsheetIcon, UsersIcon, ChevronDownIcon, AlertTriangleIcon } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar.tsx";
import { UserIcon } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useIsMobile } from "@/hooks/use-mobile.ts";
import { formatFullName } from "@/lib/utils.ts";
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
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";

interface UserRow {
  _id: Id<"users">;
  name?: string;
  email?: string;
  role: string;
  roles?: string[]; // Допълнителни роли
  status: string;
  isActive: boolean;
  avatarUrl?: string | null;
  isDeleted?: boolean;
}

const roleLabels: Record<string, string> = {
  director: "Директор",
  vice_director: "Зам.-директор",
  system_admin: "Системен администратор",
  teacher: "Учител",
  parent: "Родител",
  student: "Ученик",
  secretary: "Секретар",
  pedagogical_counselor: "Педагогически съветник",
  housekeeper: "Домакин",
};

const statusLabels: Record<string, string> = {
  new_inactive: "Нов (неактивен)",
  inactive_entering_data: "Неактивен (въвежда данни)",
  active_awaiting_parent_approval: "Активен (изчаква одобрение от родител)",
  active_unconfirmed_email: "Активен (непотвърден имейл)",
  active: "Активен",
};

function UsersInner() {
  const users = useQuery(api.admin.listUsers, {});
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const { lng } = useParams<{ lng: string }>();

  const softDelete = useMutation(api.users.softDeleteUser);
  const restore = useMutation(api.users.restoreUser);
  const restoreAll = useMutation(api.users.restoreAllDeletedUsers);
  const [isRestoringAll, setIsRestoringAll] = useState(false);

  // Filter states
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  if (users === undefined || currentUser === undefined) {
    return <Skeleton className="h-96 w-full" />;
  }

  // Check if current user is a student
  const isStudent = currentUser?.role === "student";
  
  // Check if current user is an admin (can edit users)
  const isAdmin = currentUser?.roles?.includes("director") || 
                  currentUser?.roles?.includes("vice_director") ||
                  currentUser?.roles?.includes("system_admin");

  // Check if current user is secretary or housekeeper (can only see staff)
  const isSecretaryOrHousekeeper = (currentUser?.role === "secretary" || currentUser?.role === "housekeeper" ||
    currentUser?.roles?.includes("secretary") || currentUser?.roles?.includes("housekeeper")) && !isAdmin;

  // Staff roles for filtering
  const staffRoles = ["director", "vice_director", "system_admin", "teacher", "class_teacher", "secretary", "pedagogical_counselor", "housekeeper"];

  // Apply filters
  let filteredUsers = users;
  
  // For secretary/housekeeper, only show staff users by default
  if (isSecretaryOrHousekeeper) {
    filteredUsers = filteredUsers.filter((u) => 
      staffRoles.includes(u.role) || (u.roles && u.roles.some(r => staffRoles.includes(r)))
    );
  }
  
  if (filterType === "deleted") {
    filteredUsers = filteredUsers.filter((u) => u.isDeleted === true);
  } else if (filterType === "with_avatar") {
    filteredUsers = filteredUsers.filter((u) => u.avatarUrl);
  } else if (filterType === "without_avatar") {
    filteredUsers = filteredUsers.filter((u) => !u.avatarUrl);
  } else if (filterType === "without_role") {
    filteredUsers = filteredUsers.filter((u) => !u.role && (!u.roles || u.roles.length === 0));
  } else if (filterType === "staff") {
    filteredUsers = filteredUsers.filter((u) => 
      staffRoles.includes(u.role) || (u.roles && u.roles.some(r => staffRoles.includes(r)))
    );
  } else {
    // Regular filters (exclude deleted unless explicitly filtering for deleted)
    filteredUsers = filteredUsers.filter((u) => !u.isDeleted);
  }

  if (filterRole !== "all") {
    filteredUsers = filteredUsers.filter((u) => 
      u.role === filterRole || (u.roles && u.roles.some(r => r === filterRole))
    );
  }

  if (filterStatus !== "all") {
    filteredUsers = filteredUsers.filter((u) => u.status === filterStatus);
  }

  const handleEdit = (user: UserRow) => {
    navigate(`/${lng}/admin/users/edit/${user._id}`);
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    try {
      await softDelete({ userId: selectedUser._id });
      toast.success("Потребителят е изтрит");
      setShowDeleteConfirm(false);
      setSelectedUser(null);
    } catch (error) {
      toast.error("Грешка при изтриване");
    }
  };

  const confirmDelete = (user: UserRow) => {
    setSelectedUser(user);
    setShowDeleteConfirm(true);
  };

  const handleRestore = async (userId: Id<"users">) => {
    try {
      await restore({ userId });
      toast.success("Потребителят е възстановен");
    } catch (error) {
      toast.error("Грешка при възстановяване");
    }
  };

  const handleRestoreAll = async () => {
    setIsRestoringAll(true);
    try {
      const result = await restoreAll({});
      toast.success(`Възстановени са ${result.restored} потребители`);
    } catch (error) {
      toast.error("Грешка при масово възстановяване");
    } finally {
      setIsRestoringAll(false);
    }
  };

  // Count deleted users
  const deletedCount = users.filter(u => u.isDeleted === true).length;

  const columns: DataTableColumn<UserRow>[] = [
    {
      header: "Име",
      accessorKey: "name",
      cell: (row) => (
        <Link 
          to={`/${lng}/admin/user/${row._id}`}
          className="flex items-center gap-2 font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={row.avatarUrl || undefined} alt={row.name} />
            <AvatarFallback>
              <UserIcon className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          {formatFullName(row.name) || "Няма име"}
        </Link>
      ),
    },
    {
      header: "Имейл",
      accessorKey: "email",
      cell: (row) => row.email || "—",
    },
    {
      header: "Роля",
      accessorKey: "role",
      cell: (row) => {
        // Събираме всички роли (основна + допълнителни) без дублиране, като филтрираме class_teacher
        const allRoles = new Set<string>();
        if (row.role && row.role !== "class_teacher") allRoles.add(row.role);
        if (row.roles) row.roles.forEach((r: string) => {
          if (r !== "class_teacher") allRoles.add(r);
        });
        
        const rolesList = Array.from(allRoles).map((r: string) => roleLabels[r] || r);
        
        if (rolesList.length === 0) {
          return "—";
        }
        
        return (
          <div className="flex flex-col gap-1">
            {rolesList.map((role: string, idx: number) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {role}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      header: "Статус",
      accessorKey: "status",
      cell: (row) => (
        <Badge variant={row.status === "active" ? "default" : "secondary"}>
          {statusLabels[row.status] || row.status}
        </Badge>
      ),
    },
    {
      header: "Активен",
      accessorKey: "isActive",
      cell: (row) =>
        row.isActive ? (
          <Badge variant="default">Да</Badge>
        ) : (
          <Badge variant="destructive">Не</Badge>
        ),
    },
    // Only show actions column for admins
    ...(isAdmin ? [{
      header: "Действия",
      accessorKey: "_id" as const,
      cell: (row: UserRow) => (
        <div className="flex items-center gap-1">
          {filterType === "deleted" ? (
            <>
              <Button
                size="sm"
                variant="default"
                onClick={() => handleRestore(row._id)}
                title="Възстанови"
              >
                <UndoIcon className="h-3.5 w-3.5 mr-1" />
                <span className="hidden lg:inline">Възстанови</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="default"
                onClick={() => handleEdit(row)}
                title="Редактирай"
              >
                <EditIcon className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => confirmDelete(row)}
                title="Изтрий"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      ),
    }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Alert for mass-deleted users */}
      {isAdmin && deletedCount > 10 && (
        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
          <AlertTriangleIcon className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-amber-800 dark:text-amber-200 font-medium">
              {deletedCount} потребители са маркирани като изтрити. Искате ли да ги възстановите?
            </span>
            <Button
              size="sm"
              onClick={handleRestoreAll}
              disabled={isRestoringAll}
            >
              <UndoIcon className="h-3.5 w-3.5 mr-1" />
              {isRestoringAll ? "Възстановяване..." : `Възстанови всички (${deletedCount})`}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Потребители</h1>
          <p className="text-muted-foreground mt-2">
            Управление на потребители в системата
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <FileSpreadsheetIcon className="mr-2 h-4 w-4" />
                  Импорт от Excel
                  <ChevronDownIcon className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/${lng}/admin/users/import`)}>
                  <FileSpreadsheetIcon className="mr-2 h-4 w-4" />
                  Стандартен импорт
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/${lng}/admin/users/import-students-parents`)}>
                  <UsersIcon className="mr-2 h-4 w-4" />
                  Ученици с родители
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => navigate(`/${lng}/admin/users/add`)}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Добави потребител
            </Button>
          </div>
        )}
      </div>

      {/* Mobile Filter Toggle Button */}
      {isMobile && (
        <Button
          onClick={() => setShowFilters(!showFilters)}
          variant="outline"
          className="w-full"
        >
          {showFilters ? (
            <>
              <XIcon className="mr-2 h-4 w-4" />
              Скрий филтри
            </>
          ) : (
            <>
              <FilterIcon className="mr-2 h-4 w-4" />
              Покажи филтри
            </>
          )}
        </Button>
      )}

      {/* Filters - Hidden on mobile unless showFilters is true */}
      {(!isMobile || showFilters) && (
        <div className="flex flex-wrap gap-2">
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className={isMobile ? "w-full" : "w-[200px]"}>
              <SelectValue placeholder="Изберете (роля)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всички роли</SelectItem>
              <SelectItem value="director">Директор</SelectItem>
              <SelectItem value="vice_director">Зам.-директор</SelectItem>
              <SelectItem value="system_admin">Системен администратор</SelectItem>
              <SelectItem value="teacher">Учител</SelectItem>
              {/* Hide parent/student options for secretary/housekeeper */}
              {!isSecretaryOrHousekeeper && (
                <>
                  <SelectItem value="parent">Родител</SelectItem>
                  <SelectItem value="student">Ученик</SelectItem>
                </>
              )}
              <SelectItem value="secretary">Секретар</SelectItem>
              <SelectItem value="pedagogical_counselor">Педагогически съветник</SelectItem>
              <SelectItem value="housekeeper">Домакин</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className={isMobile ? "w-full" : "w-[200px]"}>
              <SelectValue placeholder="Изберете (статус)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всички статуси</SelectItem>
              <SelectItem value="new_inactive">Нов (неактивен)</SelectItem>
              <SelectItem value="inactive_entering_data">Неактивен (въвежда данни)</SelectItem>
              <SelectItem value="active_awaiting_parent_approval">Активен (изчаква одобрение от родител)</SelectItem>
              <SelectItem value="active_unconfirmed_email">Активен (непотвърден имейл)</SelectItem>
              <SelectItem value="active">Активен</SelectItem>
            </SelectContent>
          </Select>

          {/* Hide "Deleted users" filter for students and secretary/housekeeper */}
          {!isStudent && !isSecretaryOrHousekeeper && (
            <Button
              variant={filterType === "deleted" ? "default" : "secondary"}
              onClick={() => setFilterType(filterType === "deleted" ? "all" : "deleted")}
              className={isMobile ? "w-full" : ""}
            >
              Изтрити потребители
            </Button>
          )}

          <Button
            variant={filterType === "with_avatar" ? "default" : "secondary"}
            onClick={() => setFilterType(filterType === "with_avatar" ? "all" : "with_avatar")}
            className={isMobile ? "w-full" : ""}
          >
            Със снимка
          </Button>

          <Button
            variant={filterType === "without_avatar" ? "default" : "secondary"}
            onClick={() => setFilterType(filterType === "without_avatar" ? "all" : "without_avatar")}
            className={isMobile ? "w-full" : ""}
          >
            Без снимка
          </Button>

          {/* Hide "Без роля" and "Персонал" for secretary/housekeeper */}
          {!isSecretaryOrHousekeeper && (
            <>
              <Button
                variant={filterType === "without_role" ? "default" : "secondary"}
                onClick={() => setFilterType(filterType === "without_role" ? "all" : "without_role")}
                className={isMobile ? "w-full" : ""}
              >
                Без роля
              </Button>

              <Button
                variant={filterType === "staff" ? "default" : "secondary"}
                onClick={() => setFilterType(filterType === "staff" ? "all" : "staff")}
                className={isMobile ? "w-full" : ""}
              >
                Персонал
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            onClick={() => {
              setFilterRole("all");
              setFilterStatus("all");
              setFilterType("all");
            }}
            className={isMobile ? "w-full" : ""}
          >
            Изчисти
          </Button>
        </div>
      )}

      <DataTable
        data={filteredUsers}
        columns={columns}
        searchPlaceholder="Търси потребители..."
        showExport={false}
        compact
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Потвърдете изтриването</AlertDialogTitle>
            <AlertDialogDescription>
              Сигурни ли сте, че искате да изтриете потребителя <strong>{formatFullName(selectedUser?.name)}</strong> ({selectedUser?.email})?
              Потребителят ще бъде преместен в &quot;Изтрити потребители&quot; и може да бъде възстановен по-късно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отказ</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Изтрий
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Users() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
      </AuthLoading>

      <Authenticated>
        <Layout>
          <UsersInner />
        </Layout>
      </Authenticated>
    </>
  );
}
