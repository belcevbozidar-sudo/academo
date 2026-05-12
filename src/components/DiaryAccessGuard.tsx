import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Card } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ShieldXIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton.tsx";

/**
 * DiaryAccessGuard - Guards diary pages from unauthorized access
 * 
 * Roles that CANNOT access diary:
 * - secretary (секретар)
 * - housekeeper (домакин)
 * 
 * These roles can access diary:
 * - teacher, class_teacher, director, vice_director, system_admin
 * - student, parent (for their own/children's data)
 * - pedagogical_counselor (view only, can only add student support)
 */
export function DiaryAccessGuard({ children }: { children: React.ReactNode }) {
  const currentUser = useQuery(api.users.getCurrentUser, {});

  // Still loading
  if (currentUser === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Skeleton className="h-32 w-64" />
      </div>
    );
  }

  // Check if user has a role that blocks diary access
  const isSecretary = currentUser?.roles?.includes("secretary");
  const isHousekeeper = currentUser?.roles?.includes("housekeeper");
  
  // Check if user has any role that grants diary access
  const hasTeacherAccess = currentUser?.roles?.includes("teacher") || 
                           currentUser?.roles?.includes("class_teacher");
  const hasAdminAccess = currentUser?.roles?.includes("director") || 
                         currentUser?.roles?.includes("vice_director") ||
                         currentUser?.roles?.includes("system_admin");
  const hasStudentParentAccess = currentUser?.roles?.includes("student") || 
                                  currentUser?.roles?.includes("parent");
  const hasPedagogicalCounselorAccess = currentUser?.roles?.includes("pedagogical_counselor");
  
  // If user is ONLY secretary or housekeeper (without other roles that grant access), block them
  const canAccessDiary = hasTeacherAccess || hasAdminAccess || hasStudentParentAccess || hasPedagogicalCounselorAccess;
  const isBlockedRole = (isSecretary || isHousekeeper) && !canAccessDiary;
  
  if (isBlockedRole) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <ShieldXIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <h2 className="text-xl font-bold mb-2">Достъпът е ограничен</h2>
          <p className="text-muted-foreground mb-6">
            Нямате права за достъп до дневника на класа. Моля, свържете се с администратор ако смятате, че това е грешка.
          </p>
          <Link to="/bg">
            <Button>Към началната страница</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
