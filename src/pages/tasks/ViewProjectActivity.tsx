import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { useNavigate, useParams } from "react-router-dom";
import { FolderOpenIcon, ChevronLeftIcon } from "lucide-react";

const PROJECT_TYPE_LABELS: Record<string, string> = {
  national_partnership: "Национално партньорство",
  international_partnership: "Международно партньорство",
  no_partner: "Няма партньор",
};

const PROGRAM_TYPE_LABELS: Record<string, string> = {
  mon_national: "По национална програма на МОН",
  mon_esf: "По програма на МОН/ЕСФ",
  other_national: "Друга национална програма",
  npo_cooperation: "В сътрудничество с НПО",
  eu_lifelong_learning: "Програма на ЕС – Учене през целия живот",
  eu_erasmus: "Програма на ЕС – Еразъм",
  eu_other: "Програма на ЕС – друга",
  other_international: "Друга международна програма",
};

function formatDateTimeBG(timestamp: number): string {
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function ViewProjectActivityInner() {
  const { lng, activityId } = useParams();
  const navigate = useNavigate();

  const activity = useQuery(
    api.projectActivities.get,
    activityId ? { id: activityId as Id<"projectActivities"> } : "skip"
  );

  if (activity === undefined) {
    return (
      <Layout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  if (activity === null) {
    return (
      <Layout>
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Проектната дейност не е намерена.</p>
              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => navigate(`/${lng}/tasks/project-activities`)}
              >
                Назад
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FolderOpenIcon className="h-5 w-5" />
                Преглед на проектна дейност
              </CardTitle>
              <Button
                variant="secondary"
                onClick={() => navigate(`/${lng}/tasks/project-activities`)}
              >
                <ChevronLeftIcon className="h-4 w-4 mr-1" />
                Назад
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Tab-like header */}
            <div className="border-b mb-6">
              <div className="inline-block px-4 py-2 text-sm font-medium border border-b-0 rounded-t-md bg-muted">
                Основни данни
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-y-6 gap-x-8 items-start">
              {/* Име */}
              <p className="text-right font-semibold text-muted-foreground">Име:</p>
              <p>{activity.name}</p>

              {/* Начална дата */}
              <p className="text-right font-semibold text-muted-foreground">Начална дата:</p>
              <p>{formatDateTimeBG(activity.startDate)}</p>

              {/* Крайна дата */}
              <p className="text-right font-semibold text-muted-foreground">Крайна дата:</p>
              <p>{formatDateTimeBG(activity.endDate)}</p>

              {/* Вид на проекта */}
              <p className="text-right font-semibold text-muted-foreground">Вид на проекта:</p>
              <p>{activity.projectType ? PROJECT_TYPE_LABELS[activity.projectType] || activity.projectType : "—"}</p>

              {/* Вид на програмата */}
              <p className="text-right font-semibold text-muted-foreground">Вид на програмата:</p>
              <p>{activity.programType ? PROGRAM_TYPE_LABELS[activity.programType] || activity.programType : "—"}</p>

              {/* Интернет страница */}
              <p className="text-right font-semibold text-muted-foreground">Интернет страница:</p>
              <p>
                {activity.website ? (
                  <a href={activity.website} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    {activity.website}
                  </a>
                ) : "—"}
              </p>

              {/* Кратко описание */}
              <p className="text-right font-semibold text-muted-foreground">Кратко описание:</p>
              <p className="whitespace-pre-wrap">{activity.shortDescription || "—"}</p>

              {/* Основни резултати */}
              <p className="text-right font-semibold text-muted-foreground">Основни резултати:</p>
              <p className="whitespace-pre-wrap">{activity.mainResults || "—"}</p>

              {/* Добавена от */}
              <p className="text-right font-semibold text-muted-foreground">Добавена от:</p>
              <p>{activity.creatorName}</p>

              {/* Добавена на */}
              <p className="text-right font-semibold text-muted-foreground">Добавена на:</p>
              <p>{formatDateTimeBG(activity.createdAt)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default function ViewProjectActivity() {
  return (
    <>
      <Unauthenticated>
        <Layout>
          <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <p className="text-muted-foreground">Моля, влезте в профила си</p>
            <SignInButton />
          </div>
        </Layout>
      </Unauthenticated>
      <AuthLoading>
        <Layout>
          <div className="flex items-center justify-center min-h-screen">
            <Skeleton className="h-96 w-full max-w-md" />
          </div>
        </Layout>
      </AuthLoading>
      <Authenticated>
        <ViewProjectActivityInner />
      </Authenticated>
    </>
  );
}
