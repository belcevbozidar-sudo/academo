import { useState } from "react";
import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import DataTable from "@/components/DataTable.tsx";
import { RefreshCwIcon } from "lucide-react";

function MySubstitutionsInner() {
  const [search, setSearch] = useState("");
  const substitutions = useQuery(api.teacherAbsences.getMySubstitutions, {});

  const filteredSubstitutions = substitutions?.filter((sub) => {
    const searchLower = search.toLowerCase();
    return (
      sub.title.toLowerCase().includes(searchLower) ||
      sub.period.toLowerCase().includes(searchLower) ||
      sub.absentTeacher.toLowerCase().includes(searchLower) ||
      sub.reason.toLowerCase().includes(searchLower)
    );
  });

  const columns = [
    { header: "Заглавие", accessorKey: "title" },
    { header: "Период", accessorKey: "period" },
    { header: "Отсъстващ", accessorKey: "absentTeacher" },
    { header: "Причина", accessorKey: "reason" },
  ];

  if (!substitutions) {
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
            <div className="flex items-center gap-2">
              <RefreshCwIcon className="h-6 w-6 text-muted-foreground" />
              <CardTitle className="text-xl">Мои учителски замествания</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex items-center justify-end gap-4 mb-4">
              <span className="text-sm text-muted-foreground">Търсене:</span>
              <Input
                placeholder="Търсене..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
            </div>

            {filteredSubstitutions && filteredSubstitutions.length > 0 ? (
              <DataTable
                data={filteredSubstitutions}
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

export default function MySubstitutions() {
  return (
    <>
      <Unauthenticated>
        <Layout>
          <div className="container mx-auto p-6 max-w-7xl">
            <Card>
              <CardContent className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <p className="text-muted-foreground">
                  Моля, влезте, за да видите вашите замествания
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
        <MySubstitutionsInner />
      </Authenticated>
    </>
  );
}
