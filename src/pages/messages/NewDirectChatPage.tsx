import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { useNavigate } from "react-router-dom";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { UserIcon, SearchIcon, XIcon } from "lucide-react";

// Staff roles that can receive messages from secretary/housekeeper
const STAFF_ROLES = [
  "director",
  "vice_director",
  "system_admin",
  "teacher",
  "class_teacher",
  "secretary",
  "pedagogical_counselor",
  "housekeeper",
];

const ROLE_LABELS: Record<string, string> = {
  all: "Всички роли",
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

export default function NewDirectChatPage() {
  const navigate = useNavigate();
  const allUsers = useQuery(api.admin.listUsers, {});
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const getOrCreateDirectChat = useMutation(api.chats.getOrCreateDirectChat);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");

  // Check if current user is secretary or housekeeper
  const isSecretaryOrHousekeeper =
    currentUser?.role === "secretary" ||
    currentUser?.role === "housekeeper" ||
    currentUser?.roles?.includes("secretary") ||
    currentUser?.roles?.includes("housekeeper");

  // Available roles for the filter dropdown
  const availableRoles = useMemo(() => {
    if (isSecretaryOrHousekeeper) {
      return STAFF_ROLES;
    }
    return Object.keys(ROLE_LABELS).filter((r) => r !== "all");
  }, [isSecretaryOrHousekeeper]);

  // Filter users based on current user's role, search query, and role filter
  const filteredUsers = useMemo(() => {
    if (!allUsers) return [];

    let users = allUsers.filter((u) => {
      if (u.isDeleted) return false;

      // Secretary and housekeeper can only message staff
      if (isSecretaryOrHousekeeper) {
        return (
          STAFF_ROLES.includes(u.role) ||
          (u.roles && u.roles.some((r: string) => STAFF_ROLES.includes(r)))
        );
      }

      return true;
    });

    // Filter by selected role
    if (selectedRole !== "all") {
      users = users.filter(
        (u) =>
          u.role === selectedRole ||
          (u.roles && u.roles.some((r: string) => r === selectedRole)),
      );
    }

    // Filter by search query (name or email)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      users = users.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(query)) ||
          (u.email && u.email.toLowerCase().includes(query)),
      );
    }

    return users;
  }, [allUsers, isSecretaryOrHousekeeper, selectedRole, searchQuery]);

  const handleStartDirectChat = async (userId: Id<"users">) => {
    await getOrCreateDirectChat({ otherUserId: userId });
    navigate("/bg/messages");
  };

  const getUserRoleLabel = (user: { role: string; roles?: string[] }) => {
    const roles = user.roles || [user.role];
    return roles
      .map((r: string) => ROLE_LABELS[r] || r)
      .filter(Boolean)
      .join(", ");
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Нов чат</h1>
            <p className="text-sm text-muted-foreground">
              {isSecretaryOrHousekeeper
                ? "Избери от персонала за да започнеш директен чат"
                : "Избери потребител за да започнеш директен чат"}
            </p>
          </div>
          <Button variant="ghost" onClick={() => navigate("/bg/messages")}>
            Отказ
          </Button>
        </div>

        {/* Search and filter */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Търсене по име или имейл..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Филтър по роля" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всички роли</SelectItem>
              {availableRoles.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role] || role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Results count */}
        <p className="text-xs text-muted-foreground">
          {filteredUsers.length}{" "}
          {filteredUsers.length === 1 ? "потребител" : "потребители"}
        </p>

        <ScrollArea className="h-[540px] border rounded-lg">
          <div className="p-2 space-y-1">
            {filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <SearchIcon className="h-10 w-10 mb-3 opacity-40" />
                <p className="font-medium">Няма намерени потребители</p>
                <p className="text-sm">Опитайте с друго търсене или филтър</p>
              </div>
            ) : (
              filteredUsers.map((user) => (
                <button
                  key={user._id}
                  onClick={() => handleStartDirectChat(user._id)}
                  className="w-full p-3 rounded-lg hover:bg-accent flex items-center gap-3 transition-colors"
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={user.avatarUrl || undefined} />
                    <AvatarFallback>
                      <UserIcon className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left min-w-0">
                    <p className="font-semibold truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {getUserRoleLabel(user)}
                      {user.email ? ` · ${user.email}` : ""}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </Layout>
  );
}
