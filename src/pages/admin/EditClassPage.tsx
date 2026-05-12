import Layout from "@/components/Layout.tsx";
import { Authenticated, AuthLoading } from "@/lib/convex-preview";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ArrowLeftIcon } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import EditClassForm from "./EditClass.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

function EditClassPageInner() {
  const navigate = useNavigate();
  const { lng, classId } = useParams<{ lng: string; classId: string }>();

  if (!classId) {
    return <div>Invalid class ID</div>;
  }

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
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Редактирай паралелка</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Променете данните на паралелката
          </p>
        </div>
      </div>

      {/* Form */}
      <EditClassForm 
        classId={classId as Id<"classes">} 
        onSuccess={() => navigate(`/${lng}/admin/classes`)} 
      />
    </div>
  );
}

export default function EditClassPage() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
      </AuthLoading>

      <Authenticated>
        <Layout>
          <EditClassPageInner />
        </Layout>
      </Authenticated>
    </>
  );
}
