import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";

function AllCompetitionsInner() {
  const competitions = useQuery(api.events.listCompetitions, {});

  if (!competitions) {
    return (
      <div className="p-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Всички състезания
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Преглед на всички състезания в училището
        </p>
      </div>

      {/* Table Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            Принтирай
          </Button>
          <Button variant="outline" size="sm">
            Копирай
          </Button>
          <Button variant="outline" size="sm">
            PDF
          </Button>
          <Button variant="outline" size="sm">
            Excel
          </Button>
          <Button variant="outline" size="sm">
            CSV
          </Button>
          <Button variant="outline" size="sm">
            Колони
          </Button>
          <Button variant="outline" size="sm">
            50 реда
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Търсене:</span>
          <input
            type="text"
            className="px-3 py-1 text-sm border rounded-md w-48"
            placeholder=""
          />
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Име</TableHead>
              <TableHead>Предмети</TableHead>
              <TableHead>Класове</TableHead>
              <TableHead>Кръгове</TableHead>
              <TableHead>Вътрешно</TableHead>
              <TableHead>Училища</TableHead>
              <TableHead>Резултати</TableHead>
              <TableHead>Добавено от</TableHead>
              <TableHead>Добавено на</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {competitions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Няма данни в таблицата
                </TableCell>
              </TableRow>
            ) : (
              competitions.map((competition) => (
                <TableRow key={competition._id}>
                  <TableCell className="font-medium">
                    {competition.name}
                  </TableCell>
                  <TableCell>
                    {competition.subjectName ? (
                      <Badge variant="secondary">
                        {competition.subjectName}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>
                    <Badge variant="outline">Да</Badge>
                  </TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {competition.participantCount} участници
                    </Badge>
                  </TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>
                    {new Date(competition.date).toLocaleDateString("bg-BG")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="text-sm text-muted-foreground">
            Показване на резултати от 0 до {competitions.length} от общо {competitions.length}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AllCompetitions() {
  return (
    <Layout>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-4">
          <p className="text-muted-foreground">
            Моля, влезте в акаунта си, за да видите състезанията.
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
        <AllCompetitionsInner />
      </Authenticated>
    </Layout>
  );
}
