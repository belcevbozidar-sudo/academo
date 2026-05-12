import Layout from "@/components/Layout.tsx";
import { Authenticated, AuthLoading } from "@/lib/convex-preview";
import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { useState, useMemo } from "react";
import { Plus, X, TableIcon, ListIcon } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

// Grade options (1-12 + ПГ)
const getGradeLabel = (grade: number) => {
  if (grade === 13) return "ПГ(5Г.)";
  if (grade === 14) return "ПГ(6Г.)";
  return String(grade);
};

function CurriculumPlansInner() {
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();
  const [search, setSearch] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [onlyMySchool, setOnlyMySchool] = useState(false);

  const plans = useQuery(api.curriculumPlans.listCurriculumPlans, {
    onlyMine,
    onlyMySchool,
  });

  // Filter plans by search
  const filteredPlans = useMemo(() => {
    if (!plans) return [];
    if (!search.trim()) return plans;
    const searchLower = search.toLowerCase();
    return plans.filter(
      (p) =>
        p.title.toLowerCase().includes(searchLower) ||
        p.subjectName.toLowerCase().includes(searchLower) ||
        p.publisher.toLowerCase().includes(searchLower) ||
        p.addedByName.toLowerCase().includes(searchLower)
    );
  }, [plans, search]);

  const handleClearFilters = () => {
    setSearch("");
    setOnlyMine(false);
    setOnlyMySchool(false);
  };

  const handleRowClick = (planId: string, isOwner: boolean) => {
    if (isOwner) {
      navigate(`/${lng}/admin/curriculum-plans/edit/${planId}`);
    } else {
      toast.info("Можете да редактирате само собствените си разпределения");
    }
  };

  if (plans === undefined) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <TableIcon className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Всички тематични разпределения</h1>
      </div>

      {/* Add button */}
      <Button
        onClick={() => navigate(`/${lng}/admin/curriculum-plans/add`)}
        className="bg-teal-500 hover:bg-teal-600 text-white"
      >
        <Plus className="h-4 w-4 mr-2" />
        Добави
      </Button>

      {/* Filters */}
      <div className="bg-muted/50 p-4 rounded-lg space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <Input
            placeholder="Търсене..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 bg-background"
          />
          <div className="flex items-center gap-2">
            <Checkbox
              id="onlyMine"
              checked={onlyMine}
              onCheckedChange={(checked) => setOnlyMine(checked === true)}
            />
            <Label htmlFor="onlyMine" className="text-sm cursor-pointer">
              Добавени от мен
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="onlyMySchool"
              checked={onlyMySchool}
              onCheckedChange={(checked) => setOnlyMySchool(checked === true)}
            />
            <Label htmlFor="onlyMySchool" className="text-sm cursor-pointer">
              Добавени от моето училище
            </Label>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearFilters}
            className="ml-auto"
          >
            <X className="h-4 w-4 mr-1" />
            Изчисти
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Име</TableHead>
              <TableHead className="font-semibold">Предмет</TableHead>
              <TableHead className="font-semibold text-center">Клас</TableHead>
              <TableHead className="font-semibold">Издателство</TableHead>
              <TableHead className="font-semibold text-center">Брой теми</TableHead>
              <TableHead className="font-semibold">Добавен от</TableHead>
              <TableHead className="font-semibold text-center">Добавен на</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPlans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Няма намерени тематични разпределения
                </TableCell>
              </TableRow>
            ) : (
              filteredPlans.map((plan) => (
                <TableRow
                  key={plan._id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(plan._id, plan.isOwner)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ListIcon className="h-4 w-4 text-sky-500" />
                      <span className="text-sky-600 hover:underline">{plan.title}</span>
                    </div>
                  </TableCell>
                  <TableCell>{plan.subjectName}</TableCell>
                  <TableCell className="text-center">{getGradeLabel(plan.grade)}</TableCell>
                  <TableCell>{plan.publisher}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <ListIcon className="h-4 w-4 text-muted-foreground" />
                      {plan.topicsCount}
                    </div>
                  </TableCell>
                  <TableCell>{plan.addedByName}</TableCell>
                  <TableCell className="text-center">
                    {new Date(plan.addedDate).toLocaleDateString("bg-BG", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function CurriculumPlans() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-96" />
        </div>
      </AuthLoading>

      <Authenticated>
        <Layout>
          <CurriculumPlansInner />
        </Layout>
      </Authenticated>
    </>
  );
}
