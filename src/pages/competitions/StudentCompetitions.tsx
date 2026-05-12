import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { AlertTriangle } from "lucide-react";
import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";

function StudentCompetitionsInner() {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  
  // Show warning that no competition results are entered yet for this student
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Резултати от състезания на {currentUser?.firstName} {currentUser?.lastName}
        </h1>
      </div>

      {/* Tab header - only shows "Резултати" tab */}
      <div className="border-b">
        <div className="flex gap-4">
          <div className="px-4 py-2 border-b-2 border-primary font-medium">
            Резултати
          </div>
        </div>
      </div>

      {/* Warning message */}
      <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900 rounded-lg p-6 flex items-start gap-4">
        <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 shrink-0 mt-1" />
        <p className="text-base text-yellow-800 dark:text-yellow-200">
          Все още не са въведжани резултати от състезания за този ученик.
        </p>
      </div>
    </div>
  );
}

export default function StudentCompetitions() {
  return (
    <Layout>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-4">
          <p className="text-muted-foreground">
            Моля, влезте в акаунта си, за да видите резултатите.
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
        <StudentCompetitionsInner />
      </Authenticated>
    </Layout>
  );
}
