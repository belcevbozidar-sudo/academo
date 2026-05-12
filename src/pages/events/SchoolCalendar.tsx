import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { CalendarDays, Calendar } from "lucide-react";

// Format a timestamp to DD.MM.YYYY
function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

// Format date range
function formatDateRange(startDate: number, endDate: number): string {
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);
  if (startStr === endStr) return startStr;
  return `${startStr} - ${endStr}`;
}

// Build the display label: name + scope
function buildLabel(name: string, classNames: string): string {
  const scope =
    classNames === "Цялото училище"
      ? "неучебни дни за цялото училище"
      : `неучебни дни за ${classNames}`;
  return `${name} - ${scope}`;
}

function CalendarTimelineInner() {
  const nonSchoolDays = useQuery(api.nonSchoolDays.listNonSchoolDays, {});

  if (nonSchoolDays === undefined) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-6 w-48" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-10 flex-1" />
          </div>
        ))}
      </div>
    );
  }

  // Sort by start date ascending
  const sorted = [...nonSchoolDays].sort(
    (a, b) => a.startDate - b.startDate
  );

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold text-foreground">
          Училищен календар
        </h1>
      </div>

      {/* Timeline list */}
      <div className="space-y-3">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Calendar className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-sm">Няма добавени неучебни дни</p>
          </div>
        ) : (
          sorted.map((day) => (
            <div
              key={day._id}
              className="flex items-center gap-4"
            >
              {/* Date */}
              <div className="w-28 shrink-0 text-right">
                <span className="text-sm font-medium text-rose-500">
                  {formatDateRange(day.startDate, day.endDate)}
                </span>
              </div>

              {/* Circle icon */}
              <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-muted border border-border">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* Green banner */}
              <div className="flex-1 rounded-md bg-green-200/60 dark:bg-green-900/30 px-4 py-2.5">
                <span className="text-sm font-medium italic text-green-900 dark:text-green-200">
                  {buildLabel(day.name, day.classNames)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function SchoolCalendar() {
  return (
    <Layout>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-4">
          <p className="text-muted-foreground">
            Моля, влезте в акаунта си, за да видите календара.
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
        <CalendarTimelineInner />
      </Authenticated>
    </Layout>
  );
}
