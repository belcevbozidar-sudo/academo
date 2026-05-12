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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { XIcon, FilterIcon } from "lucide-react";
import DataTable from "@/components/DataTable.tsx";
import { Badge } from "@/components/ui/badge.tsx";

function ReceivedTasksInner() {
  const [showFilters, setShowFilters] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const assignments = useQuery(api.assignmentsQueries.getMyAssignments, {});
  const subjects = useQuery(api.admin.listSubjects, {});

  const filteredAssignments = assignments?.filter((assignment) => {
    const matchesName = !nameFilter || assignment.title.toLowerCase().includes(nameFilter.toLowerCase());
    const matchesSubject = subjectFilter === "all" || assignment.subjectName === subjectFilter;
    const matchesStatus = statusFilter === "all" || assignment.status === statusFilter;
    
    return matchesName && matchesSubject && matchesStatus;
  });

  const columns = [
    { header: "Име", accessorKey: "title" },
    { header: "Тип", accessorKey: "type" },
    { 
      header: "Статус", 
      accessorKey: "status",
      cell: (row: { status: string }) => {
        const statusMap: Record<string, string> = {
          pending: "Чакаща",
          in_progress: "В процес",
          completed: "Завършена"
        };
        return statusMap[row.status] || row.status;
      }
    },
    { header: "Предмет", accessorKey: "subjectName" },
    { header: "Клас", accessorKey: "className" },
    { 
      header: "Добавена от", 
      accessorKey: "addedBy",
      cell: () => "-"
    },
    {
      header: "Добавена на",
      accessorKey: "assignedDate",
      cell: (row: { assignedDate: number }) => new Date(row.assignedDate).toLocaleDateString("bg-BG"),
    },
  ];

  const handleClearFilters = () => {
    setNameFilter("");
    setSubjectFilter("all");
    setStatusFilter("all");
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Получени задачи</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filter Toggle Button */}
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <FilterIcon className="h-4 w-4 mr-2" />
                Филтри
              </Button>
            </div>

            {/* Filters - Collapsible */}
            {showFilters && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    placeholder="Име"
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                  />
                  <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Изберете (предмет)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Изберете (предмет)</SelectItem>
                      {subjects?.map((subject) => (
                        <SelectItem key={subject._id} value={subject.name}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Изберете (статус)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Изберете (статус)</SelectItem>
                      <SelectItem value="pending">Чакаща</SelectItem>
                      <SelectItem value="in_progress">В процес</SelectItem>
                      <SelectItem value="completed">Завършена</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Button variant="destructive" size="sm" onClick={handleClearFilters}>
                    <XIcon className="h-4 w-4 mr-2" />
                    Изчисти
                  </Button>
                </div>
              </>
            )}

            {/* Data Table */}
            <DataTable
              data={filteredAssignments || []}
              columns={columns}
            />
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

export default function ReceivedTasks() {
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
        <ReceivedTasksInner />
      </Authenticated>
    </>
  );
}
