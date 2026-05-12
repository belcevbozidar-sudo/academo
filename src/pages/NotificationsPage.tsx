import { useState } from "react";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import Layout from "@/components/Layout.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { CheckCheckIcon, BellIcon } from "lucide-react";
import { format } from "date-fns";
import { bg } from "date-fns/locale";
import { useNavigate, useParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  
  const notifications = useQuery(api.notifications.getMyNotifications, { limit: 100 });
  const unreadCount = useQuery(api.notifications.getUnreadCount, {});
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

  const handleNotificationClick = async (notificationId: string, actionUrl?: string) => {
    await markAsRead({ notificationId: notificationId as never });
    if (actionUrl) {
      navigate(actionUrl);
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead({});
  };

  const filteredNotifications =
    filter === "unread"
      ? notifications?.filter((n) => !n.isRead)
      : notifications;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Известия</h1>
          {unreadCount && unreadCount > 0 ? (
            <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
              <CheckCheckIcon className="h-4 w-4 mr-2" />
              Маркирай всички като прочетени
            </Button>
          ) : null}
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "unread")}>
          <TabsList>
            <TabsTrigger value="all">
              Всички
              {notifications && notifications.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {notifications.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="unread">
              Непрочетени
              {unreadCount && unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-6">
            {filteredNotifications === undefined ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : filteredNotifications && filteredNotifications.length > 0 ? (
              <div className="space-y-3">
                {filteredNotifications.map((notification) => (
                  <Card
                    key={notification._id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      !notification.isRead
                        ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900"
                        : ""
                    }`}
                    onClick={() =>
                      handleNotificationClick(notification._id, notification.actionUrl)
                    }
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div
                            className={`rounded-full p-2 ${
                              !notification.isRead
                                ? "bg-blue-100 dark:bg-blue-900"
                                : "bg-muted"
                            }`}
                          >
                            <BellIcon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base">
                              {notification.title}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {format(
                                new Date(notification._creationTime),
                                "dd.MM.yyyy HH:mm",
                                { locale: bg }
                              )}
                            </p>
                          </div>
                        </div>
                        {!notification.isRead && (
                          <div className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BellIcon className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Няма известия</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {filter === "unread"
                      ? "Всички известия са прочетени"
                      : "Все още няmate известия"}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
