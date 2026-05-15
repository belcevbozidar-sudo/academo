import { SignInButton } from "@/components/ui/signin.tsx";
import { Authenticated, Unauthenticated } from "@/lib/convex-preview";
import { Button } from "@/components/ui/button.tsx";
import { useAuth } from "@/hooks/use-auth.ts";
import {
  BellIcon,
  UserIcon,
  MenuIcon,
  MessageCircleIcon,
  CheckCheckIcon,
  PencilLineIcon,
} from "lucide-react";
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
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar.tsx";
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

  const avatarUrl = useQuery(
    api.users.getAvatarUrl,
    shouldUseBackendAuth ? {} : "skip",
  );
  const unreadCount = useQuery(
    api.chats.getUnreadCount,
    shouldUseBackendAuth ? {} : "skip",
  );
  const currentUser = useQuery(
    api.users.getCurrentUser,
    shouldUseBackendAuth ? {} : "skip",
  );
  const schoolDetails = useQuery(
    api.admin.getSchoolDetails,
    shouldUseBackendAuth ? {} : "skip",
  );

  // Notifications
  const notifications = useQuery(
    api.notifications.getMyNotifications,
    shouldUseBackendAuth ? { limit: 10 } : "skip",
  );
  const unreadNotificationsCount = useQuery(
    api.notifications.getUnreadCount,
    shouldUseBackendAuth ? {} : "skip",
  );
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

  const handleNotificationClick = async (
    notificationId: string,
    actionUrl?: string,
  ) => {
    await markAsRead({ notificationId: notificationId as never });
    if (actionUrl) {
      navigate(actionUrl);
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead({});
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-30 h-20 border-b border-white/70 bg-white/82 backdrop-blur-xl md:left-72">
      <div className="flex h-full items-center justify-between px-4 md:px-7">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-2xl bg-[#f1f2f7] text-[#111] hover:bg-[#e7e8f1] md:hidden"
            onClick={onMenuClick}
          >
            <MenuIcon className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3 md:hidden">
            <img
              src="/academo-logo.png"
              alt={t("app.name")}
              className="h-8 w-auto"
            />
            <div>
              <p className="text-xs font-black uppercase text-[#8a8b92]">
                Платформа
              </p>
              <h1 className="text-xl font-black leading-none text-[#0e0e12]">
                {t("app.title")}
              </h1>
            </div>
          </div>
        </div>

        {/* School Name - Slightly Left of Center */}
        <div className="absolute left-[calc(50%-2rem)] -translate-x-1/2 hidden md:block">
          <span className="rounded-full bg-[#f5f6fb] px-5 py-2 text-sm font-black text-[#62636d]">
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
                className="hidden h-11 w-11 rounded-full bg-white text-[#111] shadow-[0_12px_30px_rgba(20,20,35,0.08)] hover:bg-[#f1f2f7] sm:flex"
                onClick={() => navigate(`/${lng}/diary/my-lesson`)}
              >
                <PencilLineIcon className="h-5 w-5" />
              </Button>

              {/* Notifications Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`relative h-11 w-11 rounded-full bg-white text-[#111] shadow-[0_12px_30px_rgba(20,20,35,0.08)] hover:bg-[#f1f2f7] ${
                      unreadNotificationsCount && unreadNotificationsCount > 0
                        ? "animate-[wiggle_0.5s_ease-in-out]"
                        : ""
                    }`}
                  >
                    <BellIcon className="h-5 w-5" />
                    {unreadNotificationsCount &&
                    unreadNotificationsCount > 0 ? (
                      <Badge
                        variant="destructive"
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs"
                      >
                        {unreadNotificationsCount > 9
                          ? "9+"
                          : unreadNotificationsCount}
                      </Badge>
                    ) : null}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-80 rounded-3xl border-[#ececf4] bg-white p-2 shadow-[0_24px_70px_rgba(20,20,35,0.14)]"
                >
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <DropdownMenuLabel className="p-0">
                      Известия
                    </DropdownMenuLabel>
                    {unreadNotificationsCount &&
                    unreadNotificationsCount > 0 ? (
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
                            !notification.isRead
                              ? "bg-blue-50 dark:bg-blue-950/20"
                              : ""
                          }`}
                          onClick={() =>
                            handleNotificationClick(
                              notification._id,
                              notification.actionUrl,
                            )
                          }
                        >
                          <div className="flex items-start justify-between w-full gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">
                                {notification.title}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {notification.message}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {format(
                                  new Date(notification._creationTime),
                                  "dd.MM.yyyy HH:mm",
                                  {
                                    locale: bg,
                                  },
                                )}
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
                className="relative h-11 w-11 rounded-full bg-white text-[#111] shadow-[0_12px_30px_rgba(20,20,35,0.08)] hover:bg-[#f1f2f7]"
                onClick={() => navigate(`/${lng}/messages`)}
              >
                <MessageCircleIcon className="h-5 w-5" />
                {unreadCount && unreadCount > 0 ? (
                  <Badge
                    variant="destructive"
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Badge>
                ) : null}
              </Button>

              {/* User Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-12 rounded-full bg-[#111] pl-2 pr-4 text-white shadow-[0_14px_34px_rgba(0,0,0,0.18)] hover:bg-[#222] hover:text-white"
                  >
                    <Avatar className="h-9 w-9 border border-white/20">
                      <AvatarImage
                        src={avatarUrl || undefined}
                        alt={
                          currentUser?.firstName ||
                          user?.profile.name ||
                          "Demo Admin"
                        }
                      />
                      <AvatarFallback className="bg-white text-[#111]">
                        <UserIcon className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-36 truncate text-sm font-extrabold sm:inline">
                      {currentUser?.firstName || user?.profile.name || "Demo"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-64 rounded-3xl border-[#ececf4] bg-white p-2 shadow-[0_24px_70px_rgba(20,20,35,0.14)]"
                >
                  <DropdownMenuLabel>{t("auth.myAccount")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate(`/${lng}/profile`)}>
                    {t("auth.profile")}
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <span className="text-sm text-muted-foreground">
                      {isPreviewMode
                        ? "demo.admin@academo.local"
                        : user?.profile.email}
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
            <div className="[&_button]:rounded-full [&_button]:bg-[#111] [&_button]:px-6 [&_button]:font-black [&_button]:shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
              <SignInButton />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
