import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog.tsx";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty.tsx";
import { CheckIcon, XIcon, ClockIcon, FileTextIcon, UserIcon, BookOpenIcon, CalendarIcon, AlertCircleIcon } from "lucide-react";
import { format } from "date-fns";
import { bg } from "date-fns/locale";
import { cn } from "@/lib/utils.ts";
import { useState } from "react";
import { toast } from "sonner";

function RequestsInner() {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<Id<"gradeDeleteRequests"> | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  
  const requests = useQuery(api.gradeDeleteRequests.getAllRequests, { status: statusFilter });
  const approveRequest = useMutation(api.gradeDeleteRequests.approveRequest);
  const rejectRequest = useMutation(api.gradeDeleteRequests.rejectRequest);

  // Check if user is admin
  const isAdmin = currentUser?.roles?.includes("director") || 
                  currentUser?.roles?.includes("vice_director") ||
                  currentUser?.roles?.includes("system_admin");

  if (!currentUser) {
    return (
      <Layout>
        <div className="p-6">
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Нямате достъп</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Тази страница е достъпна само за директори и администратори.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const handleApprove = async (requestId: Id<"gradeDeleteRequests">) => {
    if (!confirm("Сигурни ли сте, че искате да одобрите тази заявка? Оценката ще бъде изтрита.")) {
      return;
    }
    
    try {
      await approveRequest({ requestId });
      toast.success("Заявката е одобрена. Оценката е изтрита.");
    } catch (error) {
      console.error(error);
      toast.error("Грешка при одобряване на заявката");
    }
  };

  const handleOpenRejectModal = (requestId: Id<"gradeDeleteRequests">) => {
    setSelectedRequestId(requestId);
    setRejectionReason("");
    setRejectModalOpen(true);
  };

  const handleReject = async () => {
    if (!selectedRequestId) return;
    
    try {
      await rejectRequest({ 
        requestId: selectedRequestId,
        rejectionReason: rejectionReason || undefined,
      });
      toast.success("Заявката е отхвърлена");
      setRejectModalOpen(false);
      setSelectedRequestId(null);
    } catch (error) {
      console.error(error);
      toast.error("Грешка при отхвърляне на заявката");
    }
  };

  const getGradeColor = (value: number | "absent") => {
    if (value === "absent") return "bg-gray-500 text-white";
    if (value <= 2) return "bg-red-500 text-white";
    if (value === 3) return "bg-orange-500 text-white";
    if (value === 4) return "bg-yellow-500 text-white";
    if (value === 5) return "bg-blue-500 text-white";
    return "bg-green-600 text-white";
  };

  const getStatusBadge = (status: "pending" | "approved" | "rejected") => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            <ClockIcon className="h-3 w-3" />
            Чакаща
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <CheckIcon className="h-3 w-3" />
            Одобрена
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <XIcon className="h-3 w-3" />
            Отхвърлена
          </span>
        );
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Заявки</h1>
            <p className="text-muted-foreground">Управление на заявки за изтриване на оценки</p>
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2">
          <Button
            variant={statusFilter === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("pending")}
          >
            <ClockIcon className="h-4 w-4 mr-2" />
            Чакащи
            {requests?.filter(r => r.status === "pending").length ? (
              <span className="ml-2 bg-yellow-500/20 px-2 py-0.5 rounded-full text-xs">
                {requests.filter(r => r.status === "pending").length}
              </span>
            ) : null}
          </Button>
          <Button
            variant={statusFilter === "approved" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("approved")}
          >
            <CheckIcon className="h-4 w-4 mr-2" />
            Одобрени
          </Button>
          <Button
            variant={statusFilter === "rejected" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("rejected")}
          >
            <XIcon className="h-4 w-4 mr-2" />
            Отхвърлени
          </Button>
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("all")}
          >
            Всички
          </Button>
        </div>

        {/* Requests List */}
        {!requests ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileTextIcon />
              </EmptyMedia>
              <EmptyTitle>Няма заявки</EmptyTitle>
              <EmptyDescription>
                {statusFilter === "pending" 
                  ? "Няма чакащи заявки за изтриване на оценки"
                  : "Няма заявки с избрания статус"}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <Card key={request._id} className={cn(
                "transition-all",
                request.status === "pending" && "border-yellow-300 dark:border-yellow-700 bg-yellow-50/50 dark:bg-yellow-950/20"
              )}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-4">
                      {/* Header with status */}
                      <div className="flex items-center gap-3">
                        {getStatusBadge(request.status)}
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(request.requestedAt), "dd.MM.yyyy HH:mm", { locale: bg })}
                        </span>
                      </div>

                      {/* Grade info */}
                      <div className="flex items-center gap-6 flex-wrap">
                        {/* Grade value */}
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg",
                            getGradeColor(request.gradeSnapshot.value)
                          )}>
                            {request.gradeSnapshot.value === "absent" ? "О" : request.gradeSnapshot.value}
                          </span>
                        </div>

                        {/* Student */}
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{request.gradeSnapshot.studentName}</span>
                        </div>

                        {/* Class */}
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span>{request.gradeSnapshot.className}</span>
                        </div>

                        {/* Subject */}
                        <div className="flex items-center gap-2">
                          <BookOpenIcon className="h-4 w-4 text-muted-foreground" />
                          <span>{request.gradeSnapshot.subjectName}</span>
                        </div>

                        {/* Grade date */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarIcon className="h-4 w-4" />
                          <span>Дата: {format(new Date(request.gradeSnapshot.date), "dd.MM.yyyy", { locale: bg })}</span>
                        </div>

                        {/* Grade type */}
                        {request.gradeSnapshot.gradeType && (
                          <span className="text-sm text-muted-foreground">
                            Тип: {request.gradeSnapshot.gradeType}
                          </span>
                        )}
                      </div>

                      {/* Reason */}
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm">
                          <span className="font-medium text-muted-foreground">Причина за изтриване:</span>{" "}
                          {request.reason}
                        </p>
                      </div>

                      {/* Requested by */}
                      <div className="text-sm text-muted-foreground">
                        Заявено от: <span className="font-medium text-foreground">{request.requesterName}</span>
                        {" • "}
                        Учител: <span className="font-medium text-foreground">{request.gradeSnapshot.teacherName}</span>
                      </div>

                      {/* Resolution info */}
                      {request.status !== "pending" && request.resolverName && (
                        <div className="text-sm text-muted-foreground border-t pt-3 mt-3">
                          {request.status === "approved" ? "Одобрена" : "Отхвърлена"} от:{" "}
                          <span className="font-medium text-foreground">{request.resolverName}</span>
                          {request.resolvedAt && (
                            <span> на {format(new Date(request.resolvedAt), "dd.MM.yyyy HH:mm", { locale: bg })}</span>
                          )}
                          {request.rejectionReason && (
                            <p className="mt-1">
                              <span className="font-medium">Причина за отхвърляне:</span> {request.rejectionReason}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    {request.status === "pending" && (
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleApprove(request._id)}
                        >
                          <CheckIcon className="h-4 w-4 mr-2" />
                          Одобри
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleOpenRejectModal(request._id)}
                        >
                          <XIcon className="h-4 w-4 mr-2" />
                          Отхвърли
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Reject Modal */}
        <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Отхвърляне на заявка</DialogTitle>
              <DialogDescription>
                Добавете причина за отхвърляне (по желание)
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <textarea
                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background resize-none"
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Причина за отхвърляне (по желание)"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectModalOpen(false)}>
                Отказ
              </Button>
              <Button variant="destructive" onClick={handleReject}>
                <XIcon className="h-4 w-4 mr-2" />
                Отхвърли
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

export default function Requests() {
  return (
    <>
      <Unauthenticated>
        <Layout>
          <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-4">
            <p className="text-muted-foreground">Моля, влезте в акаунта си.</p>
            <SignInButton />
          </div>
        </Layout>
      </Unauthenticated>
      <AuthLoading>
        <Layout>
          <div className="p-6">
            <Skeleton className="h-96 w-full" />
          </div>
        </Layout>
      </AuthLoading>
      <Authenticated>
        <RequestsInner />
      </Authenticated>
    </>
  );
}
