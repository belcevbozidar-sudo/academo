import { Link, useLocation, useParams } from "react-router-dom";
import { cn } from "@/lib/utils.ts";
import {
  HomeIcon,
  BookOpenIcon,
  CalendarIcon,
  FileTextIcon,
  BarChartIcon,
  UsersIcon,
  TrophyIcon,
  CreditCardIcon,
  ClipboardCheckIcon,
  SettingsIcon,
  ChevronDownIcon,
  ListTodoIcon,
  ClipboardListIcon,
  GraduationCapIcon,
  MessageCircleIcon,
  SearchCheckIcon,
  InboxIcon,
} from "lucide-react";
import { useState, useEffect, createContext, useContext } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import { useAuth } from "@/hooks/use-auth.ts";

// Context for managing dropdown states
const DropdownContext = createContext<{
  openDropdown: string | null;
  setOpenDropdown: (id: string | null) => void;
}>({
  openDropdown: null,
  setOpenDropdown: () => {},
});

interface NavItem {
  labelKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }> | null;
  children?: NavItem[];
  roles?: string[];
  showBadge?: boolean; // For showing unread count
}

function getNavigationItems(lng: string): NavItem[] {
  return [
    {
      labelKey: "nav.home",
      href: `/${lng}`,
      icon: HomeIcon,
      roles: ["all"],
    },
    {
      labelKey: "nav.lectureHours",
      href: `/${lng}/lecture-hours`,
      icon: CalendarIcon,
      roles: [
        "teacher",
        "director",
        "vice_director",
        "class_teacher",
        "system_admin",
        "secretary",
        "pedagogical_counselor",
      ],
      children: [
        {
          labelKey: "nav.lectureHours.myAbsences",
          href: `/${lng}/lecture-hours/my-absences`,
          icon: CalendarIcon,
        },
        {
          labelKey: "nav.lectureHours.mySubstitutions",
          href: `/${lng}/lecture-hours/my-substitutions`,
          icon: CalendarIcon,
        },
        {
          labelKey: "nav.lectureHours.allAbsences",
          href: `/${lng}/lecture-hours/all-absences-new`,
          icon: CalendarIcon,
        },
        {
          labelKey: "nav.lectureHours.myExtra",
          href: `/${lng}/lecture-hours/my-extra`,
          icon: CalendarIcon,
        },
        {
          labelKey: "nav.lectureHours.allExtra",
          href: `/${lng}/lecture-hours/all-extra`,
          icon: CalendarIcon,
        },
      ],
    },
    {
      labelKey: "nav.events",
      href: `/${lng}/events`,
      icon: CalendarIcon,
      roles: ["all"],
      children: [
        {
          labelKey: "nav.events.myInvitations",
          href: `/${lng}/events/my-invitations`,
          icon: CalendarIcon,
        },
        {
          labelKey: "nav.events.allEvents",
          href: `/${lng}/events/all-events-new`,
          icon: CalendarIcon,
          roles: [
            "director",
            "vice_director",
            "system_admin",
            "pedagogical_counselor",
          ],
        },
        {
          labelKey: "nav.events.calendar",
          href: `/${lng}/events/calendar`,
          icon: CalendarIcon,
        },
      ],
    },
    {
      labelKey: "nav.competitions",
      href: `/${lng}/competitions/student`,
      icon: TrophyIcon,
      roles: [
        "teacher",
        "student",
        "director",
        "vice_director",
        "class_teacher",
        "system_admin",
        "pedagogical_counselor",
      ],
      children: [
        {
          labelKey: "nav.competitions.all",
          href: `/${lng}/competitions/all`,
          icon: TrophyIcon,
          roles: [
            "teacher",
            "director",
            "vice_director",
            "class_teacher",
            "system_admin",
            "pedagogical_counselor",
          ],
        },
        {
          labelKey: "nav.competitions.results",
          href: `/${lng}/competitions/results`,
          icon: TrophyIcon,
          roles: [
            "teacher",
            "director",
            "vice_director",
            "class_teacher",
            "system_admin",
            "pedagogical_counselor",
          ],
        },
      ],
    },

    {
      labelKey: "nav.fees",
      href: `/${lng}/fees`,
      icon: CreditCardIcon,
      roles: ["director", "vice_director", "system_admin", "housekeeper"],
      children: [
        {
          labelKey: "nav.fees.allFees",
          href: `/${lng}/fees/all-fees`,
          icon: CreditCardIcon,
        },
        {
          labelKey: "nav.fees.bankAccounts",
          href: `/${lng}/fees/bank-accounts`,
          icon: CreditCardIcon,
        },
      ],
    },

    {
      labelKey: "nav.evaluations",
      href: `/${lng}/evaluations`,
      icon: ClipboardCheckIcon,
      roles: [
        "teacher",
        "director",
        "vice_director",
        "class_teacher",
        "system_admin",
        "pedagogical_counselor",
      ],
      children: [
        {
          labelKey: "nav.evaluations.templates",
          href: `/${lng}/evaluations/templates`,
          icon: ClipboardCheckIcon,
        },
        {
          labelKey: "nav.evaluations.all",
          href: `/${lng}/evaluations/all`,
          icon: ClipboardCheckIcon,
        },
        {
          labelKey: "nav.evaluations.my",
          href: `/${lng}/evaluations/my`,
          icon: ClipboardCheckIcon,
        },
        {
          labelKey: "nav.evaluations.allDTV",
          href: `/${lng}/evaluations/all-dtv`,
          icon: ClipboardCheckIcon,
        },
        {
          labelKey: "nav.evaluations.myDTV",
          href: `/${lng}/evaluations/my-dtv`,
          icon: ClipboardCheckIcon,
        },
      ],
    },
    {
      labelKey: "nav.reports",
      href: `/${lng}/reports`,
      icon: FileTextIcon,
      roles: [
        "teacher",
        "director",
        "vice_director",
        "class_teacher",
        "system_admin",
        "secretary",
        "pedagogical_counselor",
      ],
    },
    {
      labelKey: "nav.admin",
      href: `/${lng}/admin`,
      icon: SettingsIcon,
      roles: ["all"],
      children: [
        {
          labelKey: "nav.admin.users",
          href: `/${lng}/admin/users`,
          icon: UsersIcon,
        },
        {
          labelKey: "nav.admin.classes",
          href: `/${lng}/admin/classes`,
          icon: UsersIcon,
        },
        {
          labelKey: "nav.admin.subjects",
          href: `/${lng}/admin/subjects`,
          icon: BookOpenIcon,
        },
        {
          labelKey: "nav.admin.curriculum",
          href: `/${lng}/admin/curriculum-plans`,
          icon: FileTextIcon,
        },
        {
          labelKey: "nav.admin.dayRegimes",
          href: `/${lng}/admin/day-regimes`,
          icon: CalendarIcon,
          roles: [
            "director",
            "vice_director",
            "system_admin",
            "pedagogical_counselor",
          ],
        },
        {
          labelKey: "nav.admin.nonSchoolDays",
          href: `/${lng}/admin/non-school-days`,
          icon: CalendarIcon,
        },
        {
          labelKey: "nav.admin.terms",
          href: `/${lng}/admin/academic-terms`,
          icon: CalendarIcon,
          roles: ["director", "vice_director", "system_admin"],
        },
        {
          labelKey: "nav.admin.requests",
          href: `/${lng}/admin/requests`,
          icon: InboxIcon,
          roles: ["director", "vice_director", "system_admin"],
        },
        {
          labelKey: "nav.admin.school",
          href: `/${lng}/admin/school`,
          icon: HomeIcon,
        },
        {
          labelKey: "nav.admin.settings",
          href: `/${lng}/admin/settings`,
          icon: SettingsIcon,
          roles: ["director", "vice_director", "system_admin"],
        },
      ],
    },
  ];
}

function NavItemComponent({
  item,
  level = 0,
  onNavigate,
  currentUserRole,
  isAuthenticated = false,
}: {
  item: NavItem;
  level?: number;
  onNavigate?: () => void;
  currentUserRole?: string;
  isAuthenticated?: boolean;
}) {
  const { t } = useTranslation("common");
  const location = useLocation();
  const unreadCount = useQuery(
    api.chats.getUnreadCount,
    isAuthenticated ? {} : "skip",
  );
  const { openDropdown, setOpenDropdown } = useContext(DropdownContext);

  // Use a unique identifier for this item
  const dropdownId = `nav-${item.labelKey}`;
  const isOpen = openDropdown === dropdownId;

  // Helper to check if user has admin role (secretary is NOT included - has limited access)
  const hasAdminRole = (role: string) => {
    return ["system_admin", "director", "vice_director"].includes(role);
  };

  // Filter admin children for non-admins
  let filteredChildren = item.children;
  if (item.labelKey === "nav.admin" && currentUserRole) {
    const isAdmin = hasAdminRole(currentUserRole);
    const isStudent = currentUserRole === "student";
    const isPedagogicalCounselor = currentUserRole === "pedagogical_counselor";

    if (isStudent) {
      // Students only see "Users" and "School"
      filteredChildren = item.children?.filter(
        (child) =>
          child.labelKey === "nav.admin.users" ||
          child.labelKey === "nav.admin.school",
      );
    } else if (isPedagogicalCounselor) {
      // Pedagogical counselor sees only: Users, Day regimes, School
      filteredChildren = item.children?.filter(
        (child) =>
          child.labelKey === "nav.admin.users" ||
          child.labelKey === "nav.admin.dayRegimes" ||
          child.labelKey === "nav.admin.school",
      );
    } else if (
      currentUserRole === "secretary" ||
      currentUserRole === "housekeeper"
    ) {
      // Secretary and Housekeeper see only: Users, School
      filteredChildren = item.children?.filter(
        (child) =>
          child.labelKey === "nav.admin.users" ||
          child.labelKey === "nav.admin.school",
      );
    } else if (!isAdmin) {
      // Non-admin, non-student users (teachers, parents, etc.) see "Users", "Classes", and "School"
      filteredChildren = item.children?.filter(
        (child) =>
          child.labelKey === "nav.admin.users" ||
          child.labelKey === "nav.admin.classes" ||
          child.labelKey === "nav.admin.school",
      );
    }
  } else if (item.labelKey === "nav.lectureHours" && currentUserRole) {
    // For Lecture Hours: teachers without admin role see only 3 items
    const isAdmin = hasAdminRole(currentUserRole);
    const isTeacher =
      currentUserRole === "teacher" || currentUserRole === "class_teacher";
    const isPedagogicalCounselor = currentUserRole === "pedagogical_counselor";

    if (isPedagogicalCounselor) {
      // Pedagogical counselor sees only view-only options (all absences, all extra)
      filteredChildren = item.children?.filter(
        (child) =>
          child.labelKey === "nav.lectureHours.allAbsences" ||
          child.labelKey === "nav.lectureHours.allExtra",
      );
    } else if (isTeacher && !isAdmin) {
      // Teachers without admin role see only these 3 options
      filteredChildren = item.children?.filter(
        (child) =>
          child.labelKey === "nav.lectureHours.myAbsences" ||
          child.labelKey === "nav.lectureHours.mySubstitutions" ||
          child.labelKey === "nav.lectureHours.myExtra",
      );
    }
  } else if (item.children && currentUserRole) {
    // Filter children based on roles (only for non-admin sections)
    filteredChildren = item.children?.filter((child) => {
      if (!child.roles) return true;
      return child.roles.includes(currentUserRole);
    });
  }

  // For students: hide dropdown menu if no visible children OR if this is competitions
  const isStudent = currentUserRole === "student";
  const hasChildren = filteredChildren && filteredChildren.length > 0;
  const shouldShowAsLink =
    isStudent && (item.labelKey === "nav.competitions" || !hasChildren);

  // Check if current path matches any child
  const isChildActive =
    hasChildren &&
    !shouldShowAsLink &&
    filteredChildren!.some((child) => location.pathname === child.href);

  const isActive = location.pathname === item.href;

  const Icon = item.icon;
  const hasIcon = Icon !== null;

  // Update isOpen when location changes and a child becomes active
  useEffect(() => {
    if (isChildActive && level === 0) {
      setOpenDropdown(dropdownId);
    }
  }, [isChildActive, level, dropdownId, setOpenDropdown]);

  // If student and should show as link (competitions or events with no children)
  if (shouldShowAsLink) {
    return (
      <div>
        <Link
          to={item.href}
          onClick={onNavigate}
          className={cn(
            "flex items-center justify-between px-4 py-3 text-sm transition-colors relative",
            level === 0 ? "font-medium" : "font-normal",
            isActive
              ? "bg-red-500 text-white"
              : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
            level > 0 && "pl-8",
          )}
        >
          <div className="flex items-center gap-3">
            {hasIcon && <Icon className="h-5 w-5 shrink-0" />}
            <span>{t(item.labelKey)}</span>
            {item.showBadge && unreadCount && unreadCount > 0 && (
              <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        to={item.href}
        onClick={(e) => {
          if (hasChildren && level === 0) {
            e.preventDefault();
            setOpenDropdown(isOpen ? null : dropdownId);
          } else if (level === 0) {
            // Only close sidebar on top-level links, not children
            onNavigate?.();
          }
          // If level > 0 (child item), don't prevent default and don't close dropdown
        }}
        className={cn(
          "flex items-center justify-between px-4 py-3 text-sm transition-colors relative",
          level === 0 ? "font-medium" : "font-normal",
          isActive
            ? "bg-red-500 text-white"
            : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
          level > 0 && "pl-8",
        )}
      >
        <div className="flex items-center gap-3">
          {hasIcon && <Icon className="h-5 w-5 shrink-0" />}
          <span>{t(item.labelKey)}</span>
          {item.showBadge && unreadCount && unreadCount > 0 && (
            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
        {hasChildren && level === 0 && (
          <ChevronDownIcon
            className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-180",
            )}
          />
        )}
      </Link>

      {hasChildren && isOpen && level === 0 && (
        <div className="bg-sky-100 dark:bg-sky-900/30">
          {filteredChildren!.map((child) => (
            <NavItemComponent
              key={child.href}
              item={child}
              level={level + 1}
              onNavigate={onNavigate}
              currentUserRole={currentUserRole}
              isAuthenticated={isAuthenticated}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Tasks section with teacher dropdown
function TasksSection({
  lng,
  onNavigate,
  isAuthenticated = false,
}: {
  lng: string;
  onNavigate?: () => void;
  isAuthenticated?: boolean;
}) {
  const { t } = useTranslation("common");
  const location = useLocation();
  const { openDropdown, setOpenDropdown } = useContext(DropdownContext);
  const dropdownId = "tasks";
  const isOpen = openDropdown === dropdownId;
  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );

  const isStudent = currentUser?.role === "student";

  // For students: show direct link to received tasks (no dropdown)
  if (isStudent) {
    return (
      <div>
        <Link
          to={`/${lng}/tasks/received-tasks`}
          onClick={onNavigate}
          className={cn(
            "flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors w-full",
            location.pathname === `/${lng}/tasks/received-tasks`
              ? "bg-red-500 text-white"
              : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
          )}
        >
          <div className="flex items-center gap-3">
            <ListTodoIcon className="h-5 w-5 shrink-0" />
            <span>{t("nav.tasks")}</span>
          </div>
        </Link>
      </div>
    );
  }

  // For non-students: show dropdown with all options
  return (
    <div>
      <button
        onClick={() => setOpenDropdown(isOpen ? null : dropdownId)}
        className="flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors w-full text-foreground hover:bg-accent/50 hover:text-accent-foreground"
      >
        <div className="flex items-center gap-3">
          <ListTodoIcon className="h-5 w-5 shrink-0" />
          <span>{t("nav.tasks")}</span>
        </div>
        <ChevronDownIcon
          className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div className="bg-sky-100 dark:bg-sky-900/30">
          {/* Teacher name display */}
          <div className="px-4 py-2 border-b border-border/50">
            <div className="flex items-center gap-2 text-sm text-black dark:text-white">
              <GraduationCapIcon className="h-4 w-4" />
              <span>
                {currentUser?.firstName} {currentUser?.lastName}
              </span>
            </div>
          </div>

          {/* Task links */}
          <Link
            to={`/${lng}/tasks/my-tasks`}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-sm transition-colors pl-8",
              location.pathname === `/${lng}/tasks/my-tasks`
                ? "bg-red-500 text-white"
                : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
            )}
          >
            <ClipboardCheckIcon className="h-5 w-5 shrink-0" />
            <span>{t("nav.tasks.myTasks")}</span>
          </Link>

          <Link
            to={`/${lng}/tasks/received-tasks`}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-sm transition-colors pl-8",
              location.pathname === `/${lng}/tasks/received-tasks`
                ? "bg-red-500 text-white"
                : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
            )}
          >
            <ListTodoIcon className="h-5 w-5 shrink-0" />
            <span>{t("nav.tasks.receivedTasks")}</span>
          </Link>

          <Link
            to={`/${lng}/tasks/all-tasks`}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-sm transition-colors pl-8",
              location.pathname === `/${lng}/tasks/all-tasks`
                ? "bg-red-500 text-white"
                : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
            )}
          >
            <FileTextIcon className="h-5 w-5 shrink-0" />
            <span>{t("nav.tasks.allTasks")}</span>
          </Link>

          <Link
            to={`/${lng}/tasks/project-activities`}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-sm transition-colors pl-8",
              location.pathname === `/${lng}/tasks/project-activities`
                ? "bg-red-500 text-white"
                : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
            )}
          >
            <UsersIcon className="h-5 w-5 shrink-0" />
            <span>{t("nav.tasks.projectActivities")}</span>
          </Link>
        </div>
      )}
    </div>
  );
}

// Student Statistics Section (direct link, no dropdown)
function StudentStatisticsSection({
  lng,
  onNavigate,
  isAuthenticated = false,
}: {
  lng: string;
  onNavigate?: () => void;
  isAuthenticated?: boolean;
}) {
  const { t } = useTranslation("common");
  const location = useLocation();
  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );

  if (!currentUser) {
    return null;
  }

  return (
    <div>
      <Link
        to={`/${lng}/statistics/student/${currentUser._id}`}
        onClick={onNavigate}
        className={cn(
          "flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors w-full",
          location.pathname === `/${lng}/statistics/student/${currentUser._id}`
            ? "bg-red-500 text-white"
            : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
        )}
      >
        <div className="flex items-center gap-3">
          <BarChartIcon className="h-5 w-5 shrink-0" />
          <span>{t("nav.statistics")}</span>
        </div>
      </Link>
    </div>
  );
}

// Parent Statistics Section (with children dropdown)
function ParentStatisticsSection({
  lng,
  onNavigate,
  isAuthenticated = false,
}: {
  lng: string;
  onNavigate?: () => void;
  isAuthenticated?: boolean;
}) {
  const { t } = useTranslation("common");
  const location = useLocation();
  const { openDropdown, setOpenDropdown } = useContext(DropdownContext);
  const dropdownId = "parent-statistics";
  const isOpen = openDropdown === dropdownId;
  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );

  // Get children via regular parent query
  const childrenStudents = useQuery(
    api.users.getParentChildren,
    currentUser?._id ? { userId: currentUser._id } : "skip",
  );

  // Also get staff parent info for staff in parent mode
  const staffParentInfo = useQuery(
    api.users.getStaffParentInfo,
    isAuthenticated ? {} : "skip",
  );

  // Use staffParentInfo children if available, otherwise use regular parent children
  const effectiveChildren = staffParentInfo?.children?.length
    ? staffParentInfo.children
    : childrenStudents;

  if (!currentUser || !effectiveChildren || effectiveChildren.length === 0) {
    return null;
  }

  return (
    <div>
      <button
        onClick={() => setOpenDropdown(isOpen ? null : dropdownId)}
        className="flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors w-full text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700"
      >
        <div className="flex items-center gap-3">
          <BarChartIcon className="h-5 w-5 shrink-0" />
          <span>{t("nav.statistics")}</span>
        </div>
        <ChevronDownIcon
          className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div className="bg-sky-100 dark:bg-sky-900/30">
          {effectiveChildren.map((student) => (
            <Link
              key={student._id}
              to={`/${lng}/statistics/student/${student.userId}`}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-sm transition-colors pl-8",
                location.pathname ===
                  `/${lng}/statistics/student/${student.userId}`
                  ? "bg-red-500 text-white"
                  : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
              )}
            >
              <GraduationCapIcon className="h-5 w-5 shrink-0" />
              <span>
                {student.name} ({student.className})
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function DiarySection({
  lng,
  onNavigate,
  isAuthenticated = false,
}: {
  lng: string;
  onNavigate?: () => void;
  isAuthenticated?: boolean;
}) {
  const { t } = useTranslation("common");
  const location = useLocation();
  const { openDropdown, setOpenDropdown } = useContext(DropdownContext);
  const dropdownId = "diary";
  const isOpen = openDropdown === dropdownId;
  const [isPrimaryOpen, setIsPrimaryOpen] = useState(false);
  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );
  const classes = useQuery(
    api.admin.listClasses,
    isAuthenticated ? {} : "skip",
  );

  // Get staff parent info - always check if staff has children
  const staffParentInfo = useQuery(
    api.users.getStaffParentInfo,
    isAuthenticated ? {} : "skip",
  );

  // Staff children to show in the diary menu
  const staffChildren = staffParentInfo?.children || [];

  // Close primary dropdown when diary dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setIsPrimaryOpen(false);
    }
  }, [isOpen]);

  const myClass = classes?.find((c) => c.classTeacherId === currentUser?._id);

  // Get student's class
  const students = useQuery(
    api.admin.listStudents,
    isAuthenticated ? {} : "skip",
  );
  const myStudent = students?.find(
    (s: { userId: Id<"users"> }) => s.userId === currentUser?._id,
  );
  const studentClass = classes?.find((c) => c._id === myStudent?.classId);

  const isStudent = currentUser?.role === "student";
  const isParent = currentUser?.role === "parent";

  // Helper to check if user is admin/director/vice_director
  const isAdminRole =
    currentUser &&
    (currentUser.role === "system_admin" ||
      currentUser.role === "director" ||
      currentUser.role === "vice_director" ||
      currentUser.roles?.includes("system_admin") ||
      currentUser.roles?.includes("director") ||
      currentUser.roles?.includes("vice_director"));

  // Get parent's children (for actual parent)
  const childrenStudents = useQuery(
    api.users.getParentChildren,
    isParent && currentUser?._id ? { userId: currentUser._id } : "skip",
  );

  // For parents: show their children's data
  if (isParent && !isAdminRole) {
    // Still loading children
    if (!childrenStudents) {
      return (
        <div>
          <div className="flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors w-full text-black dark:text-white opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-3">
              <BookOpenIcon className="h-5 w-5 shrink-0" />
              <span>{t("nav.diary")}</span>
            </div>
          </div>
        </div>
      );
    }

    // No children found
    if (childrenStudents.length === 0) {
      return (
        <div>
          <div className="flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors w-full text-black dark:text-white opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-3">
              <BookOpenIcon className="h-5 w-5 shrink-0" />
              <span>{t("nav.diary")}</span>
            </div>
          </div>
        </div>
      );
    }

    // Single child - direct link without dropdown
    if (childrenStudents.length === 1) {
      const child = childrenStudents[0];

      return (
        <div>
          <Link
            to={`/${lng}/diary/class/${child.classId}/grades`}
            onClick={onNavigate}
            className={cn(
              "flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors w-full",
              location.pathname.startsWith(
                `/${lng}/diary/class/${child.classId}`,
              )
                ? "bg-red-500 text-white"
                : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
            )}
          >
            <div className="flex items-center gap-3">
              <BookOpenIcon className="h-5 w-5 shrink-0" />
              <span>{t("nav.diary")}</span>
            </div>
          </Link>
        </div>
      );
    }

    // Multiple children - show dropdown to select
    return (
      <div>
        <button
          onClick={() => setOpenDropdown(isOpen ? null : dropdownId)}
          className="flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors w-full text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700"
        >
          <div className="flex items-center gap-3">
            <BookOpenIcon className="h-5 w-5 shrink-0" />
            <span>{t("nav.diary")}</span>
          </div>
          <ChevronDownIcon
            className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </button>

        {isOpen && (
          <div className="bg-sky-100 dark:bg-sky-900/30">
            {childrenStudents.map((child) => (
              <Link
                key={child._id}
                to={`/${lng}/diary/class/${child.classId}/grades`}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-sm transition-colors pl-8",
                  location.pathname.startsWith(
                    `/${lng}/diary/class/${child.classId}`,
                  )
                    ? "bg-red-500 text-white"
                    : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
                )}
              >
                <GraduationCapIcon className="h-5 w-5 shrink-0" />
                <span>
                  {child.name} ({child.className})
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // For students: direct link to their class (no dropdown)
  if (isStudent) {
    // If still loading or no class found, show disabled link
    if (!studentClass) {
      return (
        <div>
          <div className="flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors w-full text-black dark:text-white opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-3">
              <BookOpenIcon className="h-5 w-5 shrink-0" />
              <span>{t("nav.diary")}</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div>
        <Link
          to={`/${lng}/diary/class/${studentClass._id}/grades`}
          onClick={onNavigate}
          className={cn(
            "flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors w-full",
            location.pathname.startsWith(
              `/${lng}/diary/class/${studentClass._id}`,
            )
              ? "bg-red-500 text-white"
              : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
          )}
        >
          <div className="flex items-center gap-3">
            <BookOpenIcon className="h-5 w-5 shrink-0" />
            <span>{t("nav.diary")}</span>
          </div>
        </Link>
      </div>
    );
  }

  // Group classes by grade (for non-students)
  const classesByGrade: Record<number, typeof classes> = {};
  if (classes) {
    classes.forEach((cls) => {
      if (!classesByGrade[cls.grade]) {
        classesByGrade[cls.grade] = [];
      }
      classesByGrade[cls.grade]!.push(cls);
    });
  }

  // Sort grades
  const sortedGrades = Object.keys(classesByGrade)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div>
      <button
        onClick={() => setOpenDropdown(isOpen ? null : dropdownId)}
        className="flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors w-full text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700"
      >
        <div className="flex items-center gap-3">
          <BookOpenIcon className="h-5 w-5 shrink-0" />
          <span>{t("nav.diary")}</span>
        </div>
        <ChevronDownIcon
          className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div className="bg-sky-100 dark:bg-sky-900/30">
          {/* Staff children at the top - for staff who are also parents */}
          {staffChildren.length > 0 && (
            <>
              {staffChildren.map((child) => (
                <Link
                  key={child._id}
                  to={`/${lng}/diary/class/${child.classId}/grades?studentId=${child.userId}`}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-sm transition-colors pl-8 border-b border-sky-200 dark:border-sky-700",
                    location.pathname ===
                      `/${lng}/diary/class/${child.classId}/grades` &&
                      location.search.includes(`studentId=${child.userId}`)
                      ? "bg-red-500 text-white"
                      : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
                  )}
                >
                  <GraduationCapIcon className="h-4 w-4 shrink-0" />
                  <span className="font-medium">
                    {child.name}-{child.className}
                  </span>
                </Link>
              ))}
            </>
          )}

          <Link
            to={
              currentUser?._id
                ? `/${lng}/admin/user/${currentUser._id}?tab=schedule`
                : `/${lng}/diary/schedule`
            }
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-sm transition-colors pl-8",
              location.pathname === `/${lng}/admin/user/${currentUser?._id}` &&
                location.search.includes("tab=schedule")
                ? "bg-red-500 text-white"
                : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
            )}
          >
            <CalendarIcon className="h-5 w-5 shrink-0" />
            <span>{t("nav.diary.schedule")}</span>
          </Link>

          {/* Hide "My Lesson" for students */}
          {!isStudent && (
            <Link
              to={`/${lng}/diary/my-lesson`}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-sm transition-colors pl-8",
                location.pathname === `/${lng}/diary/my-lesson`
                  ? "bg-red-500 text-white"
                  : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
              )}
            >
              <BookOpenIcon className="h-5 w-5 shrink-0" />
              <span>{t("nav.diary.myLesson")}</span>
            </Link>
          )}

          {/* Show teacher's class */}
          {myClass && (
            <Link
              to={`/${lng}/diary/class/${myClass._id}/grades`}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-sm transition-colors pl-8 font-medium",
                location.pathname.startsWith(
                  `/${lng}/diary/class/${myClass._id}`,
                )
                  ? "bg-red-500 text-white"
                  : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
              )}
            >
              <GraduationCapIcon className="h-5 w-5 shrink-0" />
              <span>
                {myClass.name} ({t("nav.diary.myClass") || "мой клас"})
              </span>
            </Link>
          )}

          {/* Primary Classes Section */}
          <div>
            <button
              type="button"
              onClick={() => {
                // Toggle primary dropdown using local state
                setIsPrimaryOpen(!isPrimaryOpen);
              }}
              className={cn(
                "flex items-center justify-between px-4 py-3 text-sm transition-colors w-full pl-8",
                "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
              )}
            >
              <div className="flex items-center gap-3">
                <UsersIcon className="h-5 w-5 shrink-0" />
                <span>{t("nav.diary.primary")}</span>
              </div>
              <ChevronDownIcon
                className={cn(
                  "h-4 w-4 transition-transform",
                  isPrimaryOpen && "rotate-180",
                )}
              />
            </button>

            {isPrimaryOpen && (
              <div className="bg-sky-50 dark:bg-sky-950/50">
                {/* Show all classes sorted by grade */}
                {sortedGrades.map((grade) => {
                  const gradeClasses = classesByGrade[grade] || [];
                  const sortedClasses = [...gradeClasses].sort((a, b) =>
                    a.letter.localeCompare(b.letter),
                  );

                  return (
                    <div
                      key={grade}
                      className="px-4 py-2 flex items-center gap-2 pl-12"
                    >
                      <UsersIcon className="h-4 w-4 text-black dark:text-white shrink-0" />
                      <span className="text-sm text-black dark:text-white font-medium">
                        {grade} -
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {sortedClasses.map((cls) => (
                          <div
                            key={cls._id}
                            className="flex items-center gap-1"
                          >
                            <Link
                              to={`/${lng}/diary/class/${cls._id}/grades`}
                              onClick={onNavigate}
                              className={cn(
                                "px-2 py-1 text-sm rounded transition-colors",
                                location.pathname.startsWith(
                                  `/${lng}/diary/class/${cls._id}`,
                                )
                                  ? "bg-red-500 text-white"
                                  : "bg-background text-foreground hover:bg-sky-300 dark:hover:bg-sky-700",
                              )}
                            >
                              {cls.letter}
                            </Link>
                            {myClass && cls._id === myClass._id && (
                              <span className="text-xs text-black dark:text-white italic">
                                ({t("nav.diary.myClass")})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Statistics section with admin statistics and optional children dropdown
function StatisticsSection({
  lng,
  onNavigate,
  isParent,
  isAuthenticated = false,
}: {
  lng: string;
  onNavigate?: () => void;
  isParent?: boolean;
  isAuthenticated?: boolean;
}) {
  const { t } = useTranslation("common");
  const location = useLocation();
  const { openDropdown, setOpenDropdown } = useContext(DropdownContext);
  const dropdownId = "statistics";
  const isOpen = openDropdown === dropdownId;
  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );

  // Get parent's children if user is a parent
  const childrenStudents = useQuery(
    api.users.getParentChildren,
    isParent && currentUser?._id ? { userId: currentUser._id } : "skip",
  );

  return (
    <div>
      <button
        onClick={() => setOpenDropdown(isOpen ? null : dropdownId)}
        className="flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors w-full text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700"
      >
        <div className="flex items-center gap-3">
          <BarChartIcon className="h-5 w-5 shrink-0" />
          <span>{t("nav.statistics")}</span>
        </div>
        <ChevronDownIcon
          className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div className="bg-sky-100 dark:bg-sky-900/30">
          {/* Children links at the top (if parent) */}
          {isParent && childrenStudents && childrenStudents.length > 0 && (
            <>
              {childrenStudents.map((student) => (
                <Link
                  key={student._id}
                  to={`/${lng}/statistics/student/${student.userId}`}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 text-sm transition-colors pl-8",
                    location.pathname ===
                      `/${lng}/statistics/student/${student.userId}`
                      ? "bg-red-500 text-white"
                      : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
                  )}
                >
                  <GraduationCapIcon className="h-5 w-5 shrink-0" />
                  <span>
                    {student.name} ({student.className})
                  </span>
                </Link>
              ))}
              {/* Separator line after children */}
              <div className="border-t border-sky-300 dark:border-sky-700 my-2" />
            </>
          )}

          {/* Standard statistics links */}
          {/* Проверка и контрол - само за админ, директор, зам. директор */}
          {(currentUser?.role === "system_admin" ||
            currentUser?.role === "director" ||
            currentUser?.role === "vice_director" ||
            currentUser?.roles?.includes("system_admin") ||
            currentUser?.roles?.includes("director") ||
            currentUser?.roles?.includes("vice_director")) && (
            <Link
              to={`/${lng}/inspection`}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-sm transition-colors pl-8",
                location.pathname === `/${lng}/inspection`
                  ? "bg-red-500 text-white"
                  : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
              )}
            >
              <SearchCheckIcon className="h-5 w-5 shrink-0" />
              <span>{t("nav.inspection")}</span>
            </Link>
          )}

          <Link
            to={`/${lng}/statistics/my-hours`}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-sm transition-colors pl-8",
              location.pathname === `/${lng}/statistics/my-hours`
                ? "bg-red-500 text-white"
                : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
            )}
          >
            <BarChartIcon className="h-5 w-5 shrink-0" />
            <span>{t("nav.statistics.myHours")}</span>
          </Link>
        </div>
      )}
    </div>
  );
}

// Extracurricular section with teacher dropdown
function ExtracurricularSection({
  lng,
  onNavigate,
  isAuthenticated = false,
}: {
  lng: string;
  onNavigate?: () => void;
  isAuthenticated?: boolean;
}) {
  const { t } = useTranslation("common");
  const location = useLocation();
  const { openDropdown, setOpenDropdown } = useContext(DropdownContext);
  const dropdownId = "extracurricular";
  const isOpen = openDropdown === dropdownId;
  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );

  return (
    <div>
      <button
        onClick={() => setOpenDropdown(isOpen ? null : dropdownId)}
        className="flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors w-full text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <UsersIcon className="h-5 w-5 shrink-0" />
          <span className="truncate">{t("nav.extracurricular")}</span>
        </div>
        <ChevronDownIcon
          className={cn(
            "h-4 w-4 transition-transform shrink-0",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <div className="bg-sky-100 dark:bg-sky-900/30">
          {/* Teacher name display */}
          <div className="px-4 py-2 border-b border-border/50">
            <div className="flex items-center gap-2 text-sm text-black dark:text-white">
              <GraduationCapIcon className="h-4 w-4" />
              <span>
                {currentUser?.firstName} {currentUser?.lastName}
              </span>
            </div>
          </div>

          {/* Activity links */}
          <Link
            to={`/${lng}/extracurricular/my-activities`}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-sm transition-colors pl-8",
              location.pathname === `/${lng}/extracurricular/my-activities`
                ? "bg-red-500 text-white"
                : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
            )}
          >
            <UsersIcon className="h-5 w-5 shrink-0" />
            <span>{t("nav.extracurricular.myActivities")}</span>
          </Link>

          {/* Only show "All Activities" for non-students and non-parents */}
          {currentUser &&
            currentUser.role !== "student" &&
            currentUser.role !== "parent" && (
              <Link
                to={`/${lng}/extracurricular/all-activities`}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-sm transition-colors pl-8",
                  location.pathname === `/${lng}/extracurricular/all-activities`
                    ? "bg-red-500 text-white"
                    : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
                )}
              >
                <UsersIcon className="h-5 w-5 shrink-0" />
                <span>{t("nav.extracurricular.allActivities")}</span>
              </Link>
            )}
        </div>
      )}
    </div>
  );
}

// Distributions section
function DistributionsSection({
  lng,
  onNavigate,
}: {
  lng: string;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation("common");
  const location = useLocation();
  const { openDropdown, setOpenDropdown } = useContext(DropdownContext);
  const dropdownId = "distributions";
  const isOpen = openDropdown === dropdownId;

  return (
    <div>
      <button
        onClick={() => setOpenDropdown(isOpen ? null : dropdownId)}
        className="flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors w-full text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700"
      >
        <div className="flex items-center gap-3">
          <ClipboardListIcon className="h-5 w-5 shrink-0" />
          <span>{t("nav.distributions")}</span>
        </div>
        <ChevronDownIcon
          className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div className="bg-sky-100 dark:bg-sky-900/30">
          <Link
            to={`/${lng}/curriculum-plans`}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-sm transition-colors pl-8",
              location.pathname === `/${lng}/curriculum-plans`
                ? "bg-red-500 text-white"
                : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
            )}
          >
            <ClipboardListIcon className="h-5 w-5 shrink-0" />
            <span>{t("nav.distributions.allDistributions")}</span>
          </Link>
        </div>
      )}
    </div>
  );
}

// Events section for parents with children names
function ParentEventsSection({
  lng,
  onNavigate,
  isAuthenticated = false,
}: {
  lng: string;
  onNavigate?: () => void;
  isAuthenticated?: boolean;
}) {
  const { t } = useTranslation("common");
  const location = useLocation();
  const { openDropdown, setOpenDropdown } = useContext(DropdownContext);
  const dropdownId = "parent-events";
  const isOpen = openDropdown === dropdownId;
  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );

  // Get parent's children with full details
  const childrenStudents = useQuery(
    api.users.getParentChildren,
    currentUser?._id ? { userId: currentUser._id } : "skip",
  );

  // Also get staff parent info for staff in parent mode
  const staffParentInfo = useQuery(
    api.users.getStaffParentInfo,
    isAuthenticated ? {} : "skip",
  );

  // Use staffParentInfo children if available, otherwise use regular parent children
  const effectiveChildren = staffParentInfo?.children?.length
    ? staffParentInfo.children
    : childrenStudents;

  return (
    <div>
      <button
        onClick={() => setOpenDropdown(isOpen ? null : dropdownId)}
        className="flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors w-full text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700"
      >
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-5 w-5 shrink-0" />
          <span>{t("nav.events")}</span>
        </div>
        <ChevronDownIcon
          className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div className="bg-sky-100 dark:bg-sky-900/30">
          {/* Children names - clickable links to class tests */}
          {effectiveChildren && effectiveChildren.length > 0 && (
            <>
              {effectiveChildren.map((student) => (
                <Link
                  key={student._id}
                  to={`/${lng}/diary/class/${student.classId}/tests`}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-sm transition-colors pl-8 border-b border-sky-200 dark:border-sky-700",
                    location.pathname ===
                      `/${lng}/diary/class/${student.classId}/tests`
                      ? "bg-red-500 text-white"
                      : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
                  )}
                >
                  <GraduationCapIcon className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{student.name}</span>
                  <span className="text-muted-foreground">
                    ({student.className})
                  </span>
                </Link>
              ))}
            </>
          )}

          {/* My Invitations link */}
          <Link
            to={`/${lng}/events/my-invitations`}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-sm transition-colors pl-8",
              location.pathname === `/${lng}/events/my-invitations`
                ? "bg-red-500 text-white"
                : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
            )}
          >
            <CalendarIcon className="h-5 w-5 shrink-0" />
            <span>{t("nav.events.myInvitations")}</span>
          </Link>

          {/* Calendar link */}
          <Link
            to={`/${lng}/events/calendar`}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-sm transition-colors pl-8",
              location.pathname === `/${lng}/events/calendar`
                ? "bg-red-500 text-white"
                : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
            )}
          >
            <CalendarIcon className="h-5 w-5 shrink-0" />
            <span>{t("nav.events.calendar")}</span>
          </Link>
        </div>
      )}
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { lng } = useParams<{ lng: string }>();
  const { t } = useTranslation("common");
  const { user, isLoading } = useAuth();
  const isPreviewMode = localStorage.getItem("academo.previewAuth") === "true";
  const previewUser = {
    _id: "preview-admin",
    role: "system_admin",
    roles: ["system_admin", "director", "teacher", "class_teacher"],
    firstName: "Demo",
    lastName: "Admin",
  } as {
    _id: string;
    role: "system_admin";
    roles: Array<
      | "director"
      | "vice_director"
      | "system_admin"
      | "teacher"
      | "class_teacher"
      | "parent"
      | "student"
      | "secretary"
      | "pedagogical_counselor"
      | "housekeeper"
    >;
    firstName: string;
    lastName: string;
  };

  // Check if authenticated
  const isAuthenticated = !isLoading && !!user;
  const shouldUseBackendAuth = isAuthenticated && !isPreviewMode;

  const backendCurrentUser = useQuery(
    api.users.getCurrentUser,
    shouldUseBackendAuth ? {} : "skip",
  );
  const currentUser = isPreviewMode ? previewUser : backendCurrentUser;
  const navigationItems = getNavigationItems(lng || "bg");
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const unreadCount = useQuery(
    api.chats.getUnreadCount,
    shouldUseBackendAuth ? {} : "skip",
  );
  const location = useLocation();

  // Get module visibility settings
  const moduleVisibility = useQuery(
    api.platformSettings.getModuleVisibility,
    shouldUseBackendAuth ? {} : "skip",
  );

  // Helper function to check if user has a specific role (either primary or additional)
  const hasRole = (role: string) => {
    if (!currentUser) return false;
    return (
      currentUser.role === role ||
      (currentUser.roles &&
        currentUser.roles.includes(role as typeof currentUser.role))
    );
  };

  // Check if user is admin (primary or additional role) - Secretary is NOT admin
  const isAdmin =
    hasRole("system_admin") || hasRole("director") || hasRole("vice_director");

  const filteredItems = navigationItems.filter((item) => {
    if (!item.roles) return true;
    if (item.roles.includes("all")) return true;
    if (!currentUser?.role) return false;

    // Admins have access to EVERYTHING
    if (isAdmin) {
      return true;
    }

    // Check primary role
    if (item.roles.includes(currentUser.role)) return true;

    // Check additional roles
    if (currentUser.roles) {
      return currentUser.roles.some((r) => item.roles!.includes(r));
    }

    return false;
  });

  // Admins have access to ALL sections
  // Note: Secretary does NOT have diary access and has limited permissions
  const canSeeDiary =
    isAdmin ||
    !currentUser?.role ||
    hasRole("teacher") ||
    hasRole("student") ||
    hasRole("parent") ||
    hasRole("class_teacher") ||
    hasRole("pedagogical_counselor");
  const canSeeTasks = !hasRole("secretary") && !hasRole("housekeeper"); // Secretary and housekeeper don't have tasks
  const canSeeStatistics =
    isAdmin ||
    !currentUser?.role ||
    hasRole("teacher") ||
    hasRole("class_teacher") ||
    hasRole("pedagogical_counselor");
  const canSeeExtracurricular =
    isAdmin ||
    !currentUser?.role ||
    hasRole("teacher") ||
    hasRole("student") ||
    hasRole("class_teacher") ||
    hasRole("parent") ||
    hasRole("pedagogical_counselor") ||
    hasRole("housekeeper");
  const canSeeDistributions =
    isAdmin || !currentUser?.role || hasRole("pedagogical_counselor");

  // Secretary-specific: no diary, no statistics section, no extracurricular, no distributions
  const isSecretary = hasRole("secretary") && !isAdmin;
  // Housekeeper-specific: no diary, no statistics section, has extracurricular
  const isHousekeeper = hasRole("housekeeper") && !isAdmin;
  const showDiaryForUser = canSeeDiary && !isSecretary && !isHousekeeper;

  // Module visibility checks (combine role permissions with module settings)
  const showHome = moduleVisibility?.moduleHomeEnabled !== false;
  const showDiary =
    showDiaryForUser && moduleVisibility?.moduleDiaryEnabled !== false;
  const showTasks =
    canSeeTasks && moduleVisibility?.moduleTasksEnabled !== false;
  const showStatistics =
    moduleVisibility?.moduleStatisticsEnabled !== false &&
    !isSecretary &&
    !isHousekeeper;
  const showExtracurricular =
    canSeeExtracurricular &&
    moduleVisibility?.moduleExtracurricularEnabled !== false &&
    !isSecretary;
  const showEvents =
    moduleVisibility?.moduleEventsEnabled !== false &&
    !isSecretary &&
    !isHousekeeper;
  const showCompetitions =
    moduleVisibility?.moduleCompetitionsEnabled !== false &&
    !isSecretary &&
    !isHousekeeper;
  const showAdmin = moduleVisibility?.moduleAdminEnabled !== false;
  const showAdminSettingsOnly =
    moduleVisibility?.moduleAdminSettingsOnlyForAdmins === true;
  const showLectureHours =
    moduleVisibility?.moduleLectureHoursEnabled !== false && !isHousekeeper;
  const showFees =
    moduleVisibility?.moduleFeesEnabled !== false && !isSecretary;
  const showReports =
    moduleVisibility?.moduleReportsEnabled !== false && !isHousekeeper;
  const showMessages =
    moduleVisibility?.moduleMessagesEnabled !== false &&
    !isSecretary &&
    !isHousekeeper;

  return (
    <DropdownContext.Provider value={{ openDropdown, setOpenDropdown }}>
      <div className="academo-sidebar flex h-full flex-col border-r border-[#ececf4] bg-white">
        {/* Logo Header */}
        <div className="flex justify-center px-6 pb-8 pt-8">
          <img src="/academo-logo.png" alt="Academo" className="h-16 w-auto" />
        </div>

        <nav className="academo-scrollbar flex-1 overflow-y-auto pb-5">
          <div>
            {/* Home */}
            {showHome &&
              filteredItems
                .filter((item) => item.labelKey === "nav.home")
                .map((item) => (
                  <NavItemComponent
                    key={item.href}
                    item={item}
                    onNavigate={onNavigate}
                    currentUserRole={currentUser?.role}
                    isAuthenticated={shouldUseBackendAuth}
                  />
                ))}

            {/* Diary Section (custom) */}
            {showDiary && (
              <DiarySection
                lng={lng || "bg"}
                onNavigate={onNavigate}
                isAuthenticated={shouldUseBackendAuth}
              />
            )}

            {/* Tasks Section (custom) */}
            {showTasks && (
              <TasksSection
                lng={lng || "bg"}
                onNavigate={onNavigate}
                isAuthenticated={shouldUseBackendAuth}
              />
            )}

            {/* Student Statistics Section - for students only */}
            {showStatistics && currentUser?.role === "student" && (
              <StudentStatisticsSection
                lng={lng || "bg"}
                onNavigate={onNavigate}
                isAuthenticated={shouldUseBackendAuth}
              />
            )}

            {/* Statistics Section - for admins/teachers/parents (shows all statistics + children if parent) */}
            {showStatistics && canSeeStatistics && (
              <StatisticsSection
                lng={lng || "bg"}
                onNavigate={onNavigate}
                isParent={hasRole("parent")}
                isAuthenticated={shouldUseBackendAuth}
              />
            )}

            {/* Parent Statistics Section - for users who are ONLY parents (no admin role) */}
            {showStatistics && hasRole("parent") && !canSeeStatistics && (
              <ParentStatisticsSection
                lng={lng || "bg"}
                onNavigate={onNavigate}
                isAuthenticated={shouldUseBackendAuth}
              />
            )}

            {/* Messages on mobile only - show as mobile nav item */}
            {showMessages && (
              <div className="md:hidden">
                <Link
                  to={`/${lng || "bg"}/messages`}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors relative",
                    location.pathname === `/${lng || "bg"}/messages`
                      ? "bg-red-500 text-white"
                      : "text-black dark:text-white hover:bg-sky-300 dark:hover:bg-sky-700",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <MessageCircleIcon className="h-5 w-5 shrink-0" />
                    <span>{t("nav.messages")}</span>
                  </div>
                  {unreadCount && unreadCount > 0 && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Link>
              </div>
            )}

            {/* Lecture Hours */}
            {showLectureHours &&
              filteredItems
                .filter((item) => item.labelKey === "nav.lectureHours")
                .map((item) => (
                  <NavItemComponent
                    key={item.href}
                    item={item}
                    onNavigate={onNavigate}
                    currentUserRole={currentUser?.role}
                    isAuthenticated={shouldUseBackendAuth}
                  />
                ))}

            {/* Reports */}
            {showReports &&
              filteredItems
                .filter((item) => item.labelKey === "nav.reports")
                .map((item) => (
                  <NavItemComponent
                    key={item.href}
                    item={item}
                    onNavigate={onNavigate}
                    currentUserRole={currentUser?.role}
                    isAuthenticated={shouldUseBackendAuth}
                  />
                ))}

            {/* Extracurricular Section (custom) */}
            {showExtracurricular && (
              <ExtracurricularSection
                lng={lng || "bg"}
                onNavigate={onNavigate}
                isAuthenticated={shouldUseBackendAuth}
              />
            )}

            {/* Distributions Section (custom) */}
            {canSeeDistributions && !isSecretary && !isHousekeeper && (
              <DistributionsSection lng={lng || "bg"} onNavigate={onNavigate} />
            )}

            {/* Events Section for parents (custom with children names) - show when parent role */}
            {showEvents && hasRole("parent") && !isAdmin && (
              <ParentEventsSection
                lng={lng || "bg"}
                onNavigate={onNavigate}
                isAuthenticated={shouldUseBackendAuth}
              />
            )}

            {/* Rest of navigation items */}
            {filteredItems
              .filter((item) => {
                // Skip items that are rendered separately
                if (item.labelKey === "nav.home") return false;
                if (item.labelKey === "nav.lectureHours") return false;
                if (item.labelKey === "nav.reports") return false;
                // Exclude events for parents (they use ParentEventsSection)
                if (
                  hasRole("parent") &&
                  !isAdmin &&
                  item.labelKey === "nav.events"
                )
                  return false;

                // Module visibility checks
                if (item.labelKey === "nav.events" && !showEvents) return false;
                if (item.labelKey === "nav.competitions" && !showCompetitions)
                  return false;
                if (item.labelKey === "nav.fees" && !showFees) return false;
                if (item.labelKey === "nav.evaluations") {
                  return true;
                }

                // Admin module special handling
                if (item.labelKey === "nav.admin") {
                  if (!showAdmin) return false;
                  // If admin settings only mode, we'll handle this in NavItemComponent filter
                }

                return true;
              })
              .map((item) => {
                // For admin module in settings-only mode, only show settings child
                if (item.labelKey === "nav.admin" && showAdminSettingsOnly) {
                  const settingsOnlyItem = {
                    ...item,
                    children: item.children?.filter(
                      (child) => child.labelKey === "nav.admin.settings",
                    ),
                  };
                  return (
                    <NavItemComponent
                      key={item.href}
                      item={settingsOnlyItem}
                      onNavigate={onNavigate}
                      currentUserRole={currentUser?.role}
                      isAuthenticated={shouldUseBackendAuth}
                    />
                  );
                }
                return (
                  <NavItemComponent
                    key={item.href}
                    item={item}
                    onNavigate={onNavigate}
                    currentUserRole={currentUser?.role}
                    isAuthenticated={shouldUseBackendAuth}
                  />
                );
              })}
          </div>
        </nav>
      </div>
    </DropdownContext.Provider>
  );
}

export default function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation("common");

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-72 border-r border-[#ececf4] bg-white md:block">
        <SidebarContent />
      </aside>

      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent
          side="left"
          className="w-72 border-[#ececf4] bg-white p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{t("nav.navigation")}</SheetTitle>
          </SheetHeader>
          <SidebarContent onNavigate={onClose} />
        </SheetContent>
      </Sheet>
    </>
  );
}
