import Layout from "@/components/Layout.tsx";
import { Authenticated, AuthLoading } from "@/lib/convex-preview";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ArrowLeftIcon } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import AddSubjectForm from "./AddSubject.tsx";

function AddSubjectPageInner() {
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/${lng}/admin/subjects`)}
          className="shrink-0"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Добави учебен предмет</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Попълнете данните за новия предмет
          </p>
        </div>
      </div>

      {/* Form */}
      <AddSubjectForm onSuccess={() => navigate(`/${lng}/admin/subjects`)} />
    </div>
  );
}

export default function AddSubjectPage() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
      </AuthLoading>

      <Authenticated>
        <Layout>
          <AddSubjectPageInner />
        </Layout>
      </Authenticated>
    </>
  );
}
