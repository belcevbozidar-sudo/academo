import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";

function MyInvitationsInner() {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const invitations = useQuery(
    api.events.listAllInvitations,
    currentUser ? { userId: currentUser._id } : "skip"
  );

  if (!invitations) {
    return (
      <div className="p-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Helper to get category display name and variant
  const getCategoryDisplay = (category: string, type: string) => {
    // For assignments (tests)
    if (type === "assignment") {
      const assignmentMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
        "Контролна работа": { label: "Контролна работа", variant: "destructive" },
        "Класна работа": { label: "Класна работа", variant: "destructive" },
        "Тест": { label: "Тест", variant: "destructive" },
        "Изпит": { label: "Изпит", variant: "destructive" },
        "Проект": { label: "Проект", variant: "secondary" },
        "Домашно": { label: "Домашно", variant: "outline" },
      };
      return assignmentMap[category] || { label: category, variant: "outline" as const };
    }
    
    // For parent meetings
    if (type === "parentMeeting") {
      return { label: "Родителска среща", variant: "default" as const };
    }
    
    // For events
    const categoryMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      "Контролна работа": { label: "Контролна работа", variant: "destructive" },
      "Класна работа": { label: "Класна работа", variant: "destructive" },
      "Изпит": { label: "Изпит", variant: "destructive" },
      "Родителска среща": { label: "Родителска среща", variant: "default" },
      "Екскурзия": { label: "Екскурзия", variant: "secondary" },
      "Състезание": { label: "Състезание", variant: "secondary" },
      "Празник": { label: "Празник", variant: "secondary" },
    };
    return categoryMap[category] || { label: category, variant: "outline" as const };
  };

  // Helper to get type icon/label
  const getTypeLabel = (type: string) => {
    switch (type) {
      case "assignment":
        return "📝";
      case "parentMeeting":
        return "👨‍👩‍👧";
      case "event":
        return "📅";
      default:
        return "";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Мои покани</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Събития, контролни работи и покани за вас или вашия клас
        </p>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Събитие</TableHead>
              <TableHead>Дата</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead>Клас</TableHead>
              <TableHead>Предмет</TableHead>
              <TableHead>От</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Нямате предстоящи събития или покани
                </TableCell>
              </TableRow>
            ) : (
              invitations.map((item) => {
                const categoryInfo = getCategoryDisplay(item.category, item.type);
                const eventDate = new Date(item.startDate);
                const isPast = eventDate < new Date();
                
                return (
                  <TableRow key={`${item.type}-${item._id}`} className={isPast ? "opacity-60" : ""}>
                    <TableCell className="text-center">
                      <span title={item.type === "assignment" ? "Контролна работа" : item.type === "parentMeeting" ? "Родителска среща" : "Събитие"}>
                        {getTypeLabel(item.type)}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{item.title}</span>
                        {item.description && (
                          <span className="text-xs text-muted-foreground line-clamp-1">
                            {item.description}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{eventDate.toLocaleDateString("bg-BG")}</span>
                        <span className="text-xs text-muted-foreground">
                          {eventDate.toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={categoryInfo.variant}>{categoryInfo.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {item.classNames && item.classNames.length > 0 ? (
                        <span className="text-sm">{item.classNames.join(", ")}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.subjectShortName ? (
                        <span className="text-sm font-medium">{item.subjectShortName}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.organizerName || "-"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        {invitations.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-muted-foreground">
              Показване на {invitations.length} {invitations.length === 1 ? "покана" : "покани"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyInvitations() {
  return (
    <Layout>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-4">
          <p className="text-muted-foreground">
            Моля, влезте в акаунта си, за да видите поканите.
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
        <MyInvitationsInner />
      </Authenticated>
    </Layout>
  );
}
