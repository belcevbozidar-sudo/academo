import Layout from "@/components/Layout.tsx";
import { Authenticated, AuthLoading } from "@/lib/convex-preview";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ArrowLeftIcon } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import AddClassForm from "./AddClass.tsx";

function AddClassPageInner() {
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/${lng}/admin/classes`)}
          className="shrink-0"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Добави паралелка</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Попълнете данните за новата паралелка
          </p>
        </div>
      </div>

      {/* Form */}
      <AddClassForm onSuccess={() => navigate(`/${lng}/admin/classes`)} />
    </div>
  );
}

export default function AddClassPage() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
      </AuthLoading>

      <Authenticated>
        <Layout>
          <AddClassPageInner />
        </Layout>
      </Authenticated>
    </>
  );
}
