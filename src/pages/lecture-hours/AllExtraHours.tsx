import { useState } from "react";
import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import DataTable from "@/components/DataTable.tsx";
import { DownloadIcon, FilterIcon, ClockIcon } from "lucide-react";

function AllExtraHoursInner() {
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [titleFilter, setTitleFilter] = useState("");
  const extraHours = useQuery(api.teacherExtraHours.getAllExtraHours, {});

  const filteredExtraHours = extraHours?.filter((eh) => {
    const searchLower = search.toLowerCase();
    const titleMatch = !titleFilter || eh.title.toLowerCase().includes(titleFilter.toLowerCase());
    const generalMatch = 
      eh.title.toLowerCase().includes(searchLower) ||
      eh.teacher.toLowerCase().includes(searchLower) ||
      eh.period.toLowerCase().includes(searchLower);

    return titleMatch && generalMatch;
  });

  const columns = [
    { header: "Заглавие", accessorKey: "title" },
    { header: "Учител", accessorKey: "teacher" },
    { header: "Период", accessorKey: "period" },
  ];

  if (!extraHours) {
    return (
      <Layout>
        <div className="container mx-auto p-6 max-w-7xl">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-7xl">
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClockIcon className="h-6 w-6 text-muted-foreground" />
                <CardTitle className="text-xl">Всички графици с часове над хорариума</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="default" 
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  Изтегли всички
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <FilterIcon className="h-4 w-4 mr-2" />
                  Филтри
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {showFilters && (
              <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">Заглавие</label>
                    <Input
                      placeholder="Филтър по заглавие..."
                      value={titleFilter}
                      onChange={(e) => setTitleFilter(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-4 mb-4">
              <span className="text-sm text-muted-foreground">Търсене:</span>
              <Input
                placeholder="Търсене..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
            </div>

            {filteredExtraHours && filteredExtraHours.length > 0 ? (
              <DataTable
                data={filteredExtraHours}
                columns={columns}
                showExport={true}
              />
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Няма данни в таблицата</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default function AllExtraHours() {
  return (
    <>
      <Unauthenticated>
        <Layout>
          <div className="container mx-auto p-6 max-w-7xl">
            <Card>
              <CardContent className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <p className="text-muted-foreground">
                  Моля, влезте, за да видите всички графици с часове над хорариума
                </p>
                <SignInButton />
              </CardContent>
            </Card>
          </div>
        </Layout>
      </Unauthenticated>

      <AuthLoading>
        <Layout>
          <div className="container mx-auto p-6 max-w-7xl">
            <Skeleton className="h-96 w-full" />
          </div>
        </Layout>
      </AuthLoading>

      <Authenticated>
        <AllExtraHoursInner />
      </Authenticated>
    </>
  );
}
