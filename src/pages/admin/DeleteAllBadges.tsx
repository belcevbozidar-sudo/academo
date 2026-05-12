import { useAction } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangleIcon, TrashIcon } from "lucide-react";

export default function DeleteAllBadges() {
  const deleteAllBadges = useAction(api.deleteAllBadges.deleteAllBadges);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletedCount, setDeletedCount] = useState<number | null>(null);

  const handleDelete = async () => {
    if (!confirm("Сигурни ли сте, че искате да изтриете ВСИЧКИ забележки от базата данни? Това действие не може да бъде отменено!")) {
      return;
    }

    setIsDeleting(true);
    setDeletedCount(null);

    try {
      const result = await deleteAllBadges({});
      setDeletedCount(result.deletedCount);
      toast.success(`Успешно изтрити ${result.deletedCount} забележки!`);
    } catch (error) {
      console.error("Error deleting badges:", error);
      toast.error("Грешка при изтриване на забележките");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="h-6 w-6 text-red-500" />
            Изтриване на всички забележки
          </CardTitle>
          <CardDescription>
            ВНИМАНИЕ: Това действие ще изтрие ВСИЧКИ забележки от базата данни и не може да бъде отменено!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-200">
              Този инструмент ще изтрие всички забележки (badges) от базата данни.
              Това включва всички стари типове забележки които не съществуват в новата schema.
            </p>
          </div>

          {deletedCount !== null && (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                ✓ Успешно изтрити {deletedCount} забележки!
              </p>
            </div>
          )}

          <Button
            variant="destructive"
            size="lg"
            className="w-full"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <TrashIcon className="h-5 w-5 mr-2" />
            {isDeleting ? "Изтриване..." : "Изтрий всички забележки"}
          </Button>

          {isDeleting && (
            <p className="text-sm text-center text-muted-foreground">
              Моля изчакайте, изтриването може да отнеме няколко секунди...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
