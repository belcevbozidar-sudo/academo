import { SignInButton } from "@/components/ui/signin.tsx";
import { Authenticated, Unauthenticated } from "@/lib/convex-preview";
import { Button } from "@/components/ui/button.tsx";
import { useAuth } from "@/hooks/use-auth.ts";
import { BellIcon, UserIcon, MenuIcon, MessageCircleIcon, CheckCheckIcon } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { format } from "date-fns";
import { bg } from "date-fns/locale";

export default function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, signoutRedirect, isLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const { lng } = useParams<{ lng: string }>();
  const isPreviewMode = localStorage.getItem("academo.previewAuth") === "true";
  
  // Only query when authenticated
  const isAuthenticated = !isLoading && !!user;
  const shouldUseBackendAuth = isAuthenticated && !isPreviewMode;
  
  const avatarUrl = useQuery(api.users.getAvatarUrl, shouldUseBackendAuth ? {} : "skip");
  const unreadCount = useQuery(api.chats.getUnreadCount, shouldUseBackendAuth ? {} : "skip");
  const currentUser = useQuery(api.users.getCurrentUser, shouldUseBackendAuth ? {} : "skip");
  const schoolDetails = useQuery(api.admin.getSchoolDetails, shouldUseBackendAuth ? {} : "skip");
  
  // Notifications
  const notifications = useQuery(api.notifications.getMyNotifications, shouldUseBackendAuth ? { limit: 10 } : "skip");
  const unreadNotificationsCount = useQuery(api.notifications.getUnreadCount, shouldUseBackendAuth ? {} : "skip");
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

  return (
    <header className="fixed left-0 right-0 top-0 z-30 h-16 border-b border-border bg-card md:left-64">
      <div className="flex h-full items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onMenuClick}
          >
            <MenuIcon className="h-5 w-5" />
          </Button>
        </div>

        {/* School Name - Slightly Left of Center */}
        <div className="absolute left-[calc(50%-2rem)] -translate-x-1/2 hidden md:block">
          <span className="text-lg font-semibold text-foreground">
            {schoolDetails?.shortName || schoolDetails?.name || ""}
          </span>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {(isPreviewMode || isAuthenticated) && (
            <>
            {/* My Lesson Button */}
            <Button 
              variant="ghost" 
              size="icon"
              className="h-9 w-9"
              onClick={() => navigate(`/${lng}/diary/my-lesson`)}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </Button>

            {/* Notifications Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className={`relative h-9 w-9 ${
                    unreadNotificationsCount && unreadNotificationsCount > 0 
                      ? "animate-[wiggle_0.5s_ease-in-out]" 
                      : ""
                  }`}
                >
                  <BellIcon className="h-5 w-5" />
                  {unreadNotificationsCount && unreadNotificationsCount > 0 ? (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
                    </Badge>
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <DropdownMenuLabel className="p-0">Известия</DropdownMenuLabel>
                  {unreadNotificationsCount && unreadNotificationsCount > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-1 text-xs"
                      onClick={handleMarkAllAsRead}
                    >
                      <CheckCheckIcon className="h-3 w-3 mr-1" />
                      Маркирай всички
                    </Button>
                  ) : null}
                </div>
                <DropdownMenuSeparator />
                <ScrollArea className="h-96">
                  {notifications && notifications.length > 0 ? (
                    notifications.map((notification) => (
                      <DropdownMenuItem
                        key={notification._id}
                        className={`flex flex-col items-start p-3 cursor-pointer ${
                          !notification.isRead ? "bg-blue-50 dark:bg-blue-950/20" : ""
                        }`}
                        onClick={() =>
                          handleNotificationClick(notification._id, notification.actionUrl)
                        }
                      >
                        <div className="flex items-start justify-between w-full gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{notification.title}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {notification.message}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {format(new Date(notification._creationTime), "dd.MM.yyyy HH:mm", {
                                locale: bg,
                              })}
                            </div>
                          </div>
                          {!notification.isRead && (
                            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      Няма известия
                    </div>
                  )}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Messages Button */}
            <Button 
              variant="ghost" 
              size="icon"
              className="relative h-9 w-9"
              onClick={() => navigate(`/${lng}/messages`)}
            >
              <MessageCircleIcon className="h-5 w-5" />
              {unreadCount && unreadCount > 0 ? (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              ) : null}
            </Button>

            {/* User Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={avatarUrl || undefined} alt={currentUser?.firstName || user?.profile.name || "Demo Admin"} />
                    <AvatarFallback>
                      <UserIcon className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t("auth.myAccount")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(`/${lng}/profile`)}>
                  {t("auth.profile")}
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <span className="text-sm text-muted-foreground">
                    {isPreviewMode ? "demo.admin@academo.local" : user?.profile.email}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    if (isPreviewMode) {
                      localStorage.removeItem("academo.previewAuth");
                      window.location.href = `/${lng || "bg"}`;
                      return;
                    }
                    signoutRedirect();
                  }}
                >
                  {t("auth.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          )}

          {!isPreviewMode && !isAuthenticated && (
            <SignInButton />
          )}
        </div>
      </div>
    </header>
  );
}
