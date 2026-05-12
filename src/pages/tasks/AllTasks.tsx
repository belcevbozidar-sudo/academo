import { useState } from "react";
import { useQuery, useAction } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { PlusIcon, XIcon, FilterIcon } from "lucide-react";
import DataTable from "@/components/DataTable.tsx";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge.tsx";

function AllTasksInner() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Form state
  const [formType, setFormType] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formClassId, setFormClassId] = useState("");
  const [formSubjectId, setFormSubjectId] = useState("");

  const assignments = useQuery(api.assignmentsQueries.getMyAssignments, {});
  const classes = useQuery(api.admin.listClasses, {});
  const subjects = useQuery(api.admin.listSubjects, {});
  const createAssignment = useAction(api.assignmentsActions.createAssignmentAction);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!formType || !formDescription || !formClassId || !formSubjectId) {
        toast.error("Моля, попълнете всички задължителни полета");
        return;
      }

      await createAssignment({
        title: formType,
        type: formType,
        description: formDescription,
        classId: formClassId as Id<"classes">,
        subjectId: formSubjectId as Id<"subjects">,
        status: "pending",
      });

      toast.success("Задачата е добавена успешно");
      setAddDialogOpen(false);
      
      // Reset form
      setFormType("");
      setFormDescription("");
      setFormClassId("");
      setFormSubjectId("");
    } catch (error) {
      console.error("Error creating assignment:", error);
      toast.error("Грешка при добавяне на задача");
    }
  };

  const filteredAssignments = assignments?.filter((assignment) => {
    const matchesName = !nameFilter || assignment.title.toLowerCase().includes(nameFilter.toLowerCase());
    const matchesSubject = subjectFilter === "all" || assignment.subjectName === subjectFilter;
    const matchesClass = classFilter === "all" || assignment.className === classFilter;
    const matchesStatus = statusFilter === "all" || assignment.status === statusFilter;
    
    return matchesName && matchesSubject && matchesClass && matchesStatus;
  });

  const columns = [
    { header: "Име", accessorKey: "title" },
    { header: "Тип", accessorKey: "type" },
    { 
      header: "Статус", 
      accessorKey: "status",
      cell: (row: { status: string }) => (
        <Badge className="bg-yellow-500 text-black hover:bg-yellow-600">
          Възложена
        </Badge>
      )
    },
    { header: "Предмет", accessorKey: "subjectName" },
    { header: "Клас", accessorKey: "className" },
    { 
      header: "Добавена от", 
      accessorKey: "addedBy",
      cell: () => "Радослав Г. Костов - Якимов"
    },
    {
      header: "Добавена на",
      accessorKey: "assignedDate",
      cell: (row: { assignedDate: number }) => {
        const date = new Date(row.assignedDate);
        return `${date.toLocaleDateString("bg-BG")} ${date.toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" })}`;
      },
    },
  ];

  const handleClearFilters = () => {
    setNameFilter("");
    setSubjectFilter("all");
    setClassFilter("all");
    setStatusFilter("all");
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Всички задачи</CardTitle>
              <Button onClick={() => setAddDialogOpen(true)}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Добави
              </Button>
            </div>
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  <Select value={classFilter} onValueChange={setClassFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Изберете (клас)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Изберете (клас)</SelectItem>
                      {classes?.map((cls) => (
                        <SelectItem key={cls._id} value={cls.name}>
                          {cls.name}
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

            {/* Section Label */}
            <div className="text-sm text-muted-foreground">
              Добавени от мен
            </div>

            {/* Data Table */}
            <DataTable
              data={filteredAssignments || []}
              columns={columns}
            />
          </CardContent>
        </Card>

        {/* Add Dialog */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Добавяне на задача</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>
                  Тип: <span className="text-destructive">*</span>
                </Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Домашно" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Домашна">Домашна</SelectItem>
                    <SelectItem value="Проект">Проект</SelectItem>
                    <SelectItem value="Административна задача">Административна задача</SelectItem>
                    <SelectItem value="Друго">Друго</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  Описание: <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  placeholder="Кратко описание"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Паралелка: <span className="text-destructive">*</span>
                </Label>
                <Select value={formClassId} onValueChange={setFormClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Изберете паралелка" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes?.map((cls) => (
                      <SelectItem key={cls._id} value={cls._id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  Предмет: <span className="text-destructive">*</span>
                </Label>
                <Select value={formSubjectId} onValueChange={setFormSubjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Изберете предмет" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects?.map((subject) => (
                      <SelectItem key={subject._id} value={subject._id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddDialogOpen(false)}
                >
                  Назад
                </Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700">
                  Запази
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

export default function AllTasks() {
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
        <AllTasksInner />
      </Authenticated>
    </>
  );
}
