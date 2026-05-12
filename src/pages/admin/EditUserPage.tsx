import Layout from "@/components/Layout.tsx";
import { Authenticated, AuthLoading } from "@/lib/convex-preview";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ArrowLeftIcon } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import EditUserForm from "./EditUser.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

function EditUserPageInner() {
  const navigate = useNavigate();
  const { lng, userId } = useParams<{ lng: string; userId: string }>();

  if (!userId) {
    return <div>Invalid user ID</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/${lng}/admin/users`)}
          className="shrink-0"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Редактирай потребител</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Променете данните на потребителя
          </p>
        </div>
      </div>

      {/* Form */}
      <EditUserForm 
        userId={userId as Id<"users">} 
        onSuccess={() => navigate(`/${lng}/admin/users`)} 
      />
    </div>
  );
}

export default function EditUserPage() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
      </AuthLoading>

      <Authenticated>
        <Layout>
          <EditUserPageInner />
        </Layout>
      </Authenticated>
    </>
  );
}
