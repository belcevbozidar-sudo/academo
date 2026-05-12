import Layout from "@/components/Layout.tsx";
import { Authenticated, AuthLoading } from "@/lib/convex-preview";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ArrowLeftIcon } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import AddUserForm from "./AddUser.tsx";

function AddUserPageInner() {
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();

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
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Добави потребител</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Попълнете данните за новия потребител
          </p>
        </div>
      </div>

      {/* Form */}
      <AddUserForm onSuccess={() => navigate(`/${lng}/admin/users`)} />
    </div>
  );
}

export default function AddUserPage() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
      </AuthLoading>

      <Authenticated>
        <Layout>
          <AddUserPageInner />
        </Layout>
      </Authenticated>
    </>
  );
}
