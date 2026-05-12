import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export default function LessonRedirect() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation("common");
  
  const classId = searchParams.get("classId") as Id<"classes"> | null;
  const subjectId = searchParams.get("subjectId") as Id<"subjects"> | null;
  const periodIndex = searchParams.get("periodIndex");
  const dayOfWeek = searchParams.get("dayOfWeek");
  const dateStr = searchParams.get("date");
  
  // Get existing lesson ID
  const lessonId = useQuery(
    api.lessons.getLessonByScheduleEntry,
    classId && subjectId && periodIndex !== null && dayOfWeek !== null
      ? {
          classId,
          subjectId,
          periodIndex: parseInt(periodIndex),
          dayOfWeek: parseInt(dayOfWeek),
          date: dateStr ? parseInt(dateStr) : undefined,
        }
      : "skip"
  );
  
  const createLesson = useMutation(api.lessons.createFromSchedule);
  
  useEffect(() => {
    if (!classId || !subjectId || periodIndex === null || dayOfWeek === null) {
      toast.error("Невалидни параметри за урок");
      navigate(`/${i18n.language}/diary`);
      return;
    }
    
    if (lessonId === undefined) {
      // Still loading
      return;
    }
    
    if (lessonId) {
      // Lesson exists, redirect to it
      navigate(`/${i18n.language}/diary/lesson/${lessonId}`);
    } else {
      // Lesson doesn't exist, create it
      const createAndRedirect = async () => {
        try {
          const newLessonId = await createLesson({
            classId,
            subjectId,
            periodIndex: parseInt(periodIndex),
            dayOfWeek: parseInt(dayOfWeek),
            date: dateStr ? parseInt(dateStr) : undefined,
          });
          navigate(`/${i18n.language}/diary/lesson/${newLessonId}`);
        } catch (error) {
          console.error("Failed to create lesson:", error);
          toast.error("Грешка при създаване на урок");
          navigate(`/${i18n.language}/diary`);
        }
      };
      createAndRedirect();
    }
  }, [lessonId, classId, subjectId, periodIndex, dayOfWeek, dateStr, navigate, i18n.language, createLesson]);
  
  return (
    <Layout>
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="space-y-4 text-center">
          <Skeleton className="h-8 w-64 mx-auto" />
          <Skeleton className="h-6 w-48 mx-auto" />
          <p className="text-sm text-muted-foreground">Зареждане на урок...</p>
        </div>
      </div>
    </Layout>
  );
}
