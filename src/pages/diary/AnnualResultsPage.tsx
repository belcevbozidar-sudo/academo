import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useState } from "react";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import { DiaryAccessGuard } from "@/components/DiaryAccessGuard.tsx";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { 
  ArrowLeftIcon,
  CheckIcon,
  PencilIcon,
  UserIcon,
  GraduationCapIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { UserNameLink } from "@/components/ui/user-name-link.tsx";
import { format } from "date-fns";
import { bg } from "date-fns/locale";

// Result labels
const RESULT_LABELS: Record<string, string> = {
  completes: "Завършва",
  stays: "Остава",
  takes_exam: "Полага изпит",
};

// Result badge colors
const RESULT_COLORS: Record<string, string> = {
  completes: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  stays: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  takes_exam: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
};

function EditResultForm({ 
  student, 
  classId, 
  onCancel 
}: { 
  student: {
    _id: string;
    userId: string;
    studentName: string;
    result: string | null;
    resultAfterExam: string | null;
  }; 
  classId: string; 
  onCancel: () => void;
}) {
  const upsertResult = useMutation(api.annualResults.upsertAnnualResult);
  
  const [result, setResult] = useState(student.result || "");
  const [resultAfterExam, setResultAfterExam] = useState(student.resultAfterExam || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await upsertResult({
        studentId: student._id as Id<"students">,
        classId: classId as Id<"classes">,
        result: result ? (result as "completes" | "stays" | "takes_exam") : undefined,
        resultAfterExam: resultAfterExam ? (resultAfterExam as "completes" | "stays") : undefined,
      });
      toast.success("Резултатът е записан успешно");
      onCancel();
    } catch (error) {
      toast.error("Грешка при записване");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Назад
            </Button>
            <div className="flex items-center gap-2">
              <CheckIcon className="h-5 w-5 text-green-500" />
              <h1 className="text-lg font-semibold">
                Редакция на годишни резултати на {student.studentName}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="default" 
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              <CheckIcon className="h-4 w-4 mr-2" />
              {isSaving ? "Запазване..." : "Запази"}
            </Button>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <Card className="max-w-2xl mx-auto p-6">
          <div className="space-y-8">
            {/* Result */}
            <div>
              <div className="mb-2">
                <Label className="font-medium text-base">Резултат:</Label>
                <div className="text-sm text-muted-foreground">
                  Годишен резултат (завършва, остава, полага поправителни изпити)
                </div>
                <div className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1 rounded mt-2 inline-block">
                  Попълва се винаги.
                </div>
              </div>
              <Select value={result} onValueChange={setResult}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Изберете" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Изберете</SelectItem>
                  <SelectItem value="completes">Завършва</SelectItem>
                  <SelectItem value="stays">Остава</SelectItem>
                  <SelectItem value="takes_exam">Полага изпит</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Result After Exam */}
            <div>
              <div className="mb-2">
                <Label className="font-medium text-base">Резултат (след изпит):</Label>
                <div className="text-sm text-muted-foreground">
                  Годишен резултат след полагане на поправителни изпити (завършва, остава)
                </div>
                <div className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1 rounded mt-2 inline-block">
                  Попълва се само след полагане на поправителни изпити.
                </div>
              </div>
              <Select value={resultAfterExam} onValueChange={setResultAfterExam}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Изберете" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Изберете</SelectItem>
                  <SelectItem value="completes">Завършва</SelectItem>
                  <SelectItem value="stays">Остава</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function AnnualResultsListView({ classId }: { classId: string }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editStudentId = searchParams.get("edit");
  
  const classData = useQuery(
    api.admin.getClassById,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  const currentUser = useQuery(api.users.getCurrentUser, {});
  
  const annualResults = useQuery(
    api.annualResults.getAnnualResultsByClass,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  
  // Check if current user is a student or PURE parent (not staff)
  const isCurrentUserStudent = currentUser?.roles?.includes("student");
  const isCurrentUserParent = currentUser?.roles?.includes("parent") && 
    !currentUser?.roles?.includes("director") && 
    !currentUser?.roles?.includes("vice_director") && 
    !currentUser?.roles?.includes("system_admin") &&
    !currentUser?.roles?.includes("teacher") &&
    !currentUser?.roles?.includes("class_teacher") &&
    !currentUser?.roles?.includes("secretary");
  
  // Check if current user is the class teacher of this class
  const isClassTeacher = classData?.classTeacherId && currentUser?._id === classData.classTeacherId;
  
  // Check if current user is admin (can see class details link)
  const isAdmin = currentUser?.roles?.includes("director") || 
                  currentUser?.roles?.includes("vice_director") ||
                  currentUser?.roles?.includes("system_admin");
  
  // Only class teacher and admins can edit годишни резултати
  const canEdit = !isCurrentUserStudent && !isCurrentUserParent && (isClassTeacher || isAdmin);

  const stats = [
    { label: "Оц.", link: `/bg/diary/class/${classId}/grades` },
    { label: "Отс.", link: `/bg/diary/class/${classId}/absences` },
    { label: "Отз.", link: `/bg/diary/class/${classId}/reviews` },
    { label: "Раз.", link: `/bg/diary/class/${classId}/schedule` },
    { label: "Тем.", link: `/bg/diary/class/${classId}/topics` },
    { label: "Кон.", link: `/bg/diary/class/${classId}/tests` },
    { label: "Дом.", link: `/bg/diary/class/${classId}/homework` },
    { label: "ВЧК", link: `/bg/diary/class/${classId}/internal-commission` },
    { label: "Род.", link: `/bg/diary/class/${classId}/parent-meetings` },
    { label: "Поп.", link: `/bg/diary/class/${classId}/remedial-exams` },
    { label: "Под.", link: `/bg/diary/class/${classId}/student-support` },
    { label: "Сан.", link: `/bg/diary/class/${classId}/sanctions` },
    { label: "Год.", link: `/bg/diary/class/${classId}/annual-results` },
    { label: "Уч.", link: `/bg/diary/class/${classId}/students` },
  ];

  // Find the student being edited
  const editingStudent = editStudentId 
    ? annualResults?.find(s => s._id === editStudentId)
    : null;

  if (editingStudent) {
    return (
      <EditResultForm 
        student={editingStudent}
        classId={classId}
        onCancel={() => navigate(`/bg/diary/class/${classId}/annual-results`)}
      />
    );
  }

  if (!classData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const classTeacher = classData.classTeacher;

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link to={`/bg/diary/class/${classId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Назад
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <GraduationCapIcon className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">
                {isAdmin ? (
                  <Link 
                    to={`/bg/admin/classes/${classId}`}
                    className="text-primary hover:underline"
                  >
                    {classData.name}
                  </Link>
                ) : (
                  classData.name
                )} -{" "}
                {classTeacher ? (
                  <>
                    <UserNameLink
                      userId={classTeacher._id}
                      firstName={classTeacher.firstName}
                      lastName={classTeacher.lastName}
                    /> (класен)
                  </>
                ) : (
                  "Без класен ръководител"
                )}
              </h1>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-2 px-6 py-2 border-t overflow-x-auto">
          {stats.map((stat, index) => (
            <Link
              key={index}
              to={stat.link}
              className={cn(
                "px-4 py-2 text-sm font-medium whitespace-nowrap rounded transition-colors",
                stat.link === `/bg/diary/class/${classId}/annual-results`
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              )}
            >
              {stat.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <Card className="p-6">
          {/* Info Banner */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Въведете годишните резултати на учениците в настоящия клас
            </p>
          </div>

          {annualResults && annualResults.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold w-12">№</TableHead>
                    <TableHead className="font-semibold">Ученик</TableHead>
                    <TableHead className="font-semibold">
                      <div className="flex items-center gap-1">
                        Резултат
                        <span className="text-xs text-muted-foreground" title="Сортиране">ⓘ</span>
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold">
                      <div className="flex items-center gap-1">
                        Резултат (след изпит)
                        <span className="text-xs text-muted-foreground" title="Сортиране">ⓘ</span>
                      </div>
                    </TableHead>
                    {canEdit && <TableHead className="font-semibold text-center w-24">Операции</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {annualResults.map((student, index) => (
                    <>
                      <TableRow 
                        key={student._id} 
                        className={cn(
                          "hover:bg-muted/50 cursor-pointer",
                          expandedRow === student._id && "bg-muted/30"
                        )}
                        onClick={() => setExpandedRow(expandedRow === student._id ? null : student._id)}
                      >
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <UserIcon className="h-4 w-4 text-primary" />
                            <span className="text-primary hover:underline">
                              {student.studentName}
                            </span>
                            {expandedRow === student._id ? (
                              <ChevronUpIcon className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {student.result ? (
                            <span className={cn(
                              "px-2 py-1 rounded text-xs font-medium",
                              RESULT_COLORS[student.result]
                            )}>
                              {RESULT_LABELS[student.result]}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {student.resultAfterExam ? (
                            <span className={cn(
                              "px-2 py-1 rounded text-xs font-medium",
                              RESULT_COLORS[student.resultAfterExam]
                            )}>
                              {RESULT_LABELS[student.resultAfterExam]}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/bg/diary/class/${classId}/annual-results?edit=${student._id}`);
                              }}
                            >
                              <PencilIcon className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                      
                      {/* Expanded Row Details */}
                      {expandedRow === student._id && (
                        <TableRow className="bg-blue-50/50 dark:bg-blue-900/10">
                          <TableCell colSpan={canEdit ? 5 : 4} className="py-4">
                            <div className="pl-8 space-y-2">
                              <div className="font-medium text-blue-700 dark:text-blue-300">
                                Годишен резултат (завършва, остава, полага поправителни изпити)
                              </div>
                              <div className="text-sm">
                                Резултат: {student.result ? RESULT_LABELS[student.result] : "Не е въведен"}
                              </div>
                              {student.updatedAt && (
                                <div className="text-xs text-muted-foreground">
                                  Обвидено от: 🎓 {student.updatedByName} / 📅 {format(new Date(student.updatedAt), "yyyy-MM-dd HH:mm:ss", { locale: bg })}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border rounded-lg">
              <GraduationCapIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Няма ученици в този клас</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function AnnualResultsInner() {
  const { classId } = useParams<{ classId: string }>();
  
  if (!classId) {
    return null;
  }

  return <AnnualResultsListView classId={classId} />;
}

export default function AnnualResultsPage() {
  return (
    <Layout>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <p className="text-muted-foreground">Моля, влезте в профила си</p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="flex items-center justify-center min-h-screen">
          <Skeleton className="h-96 w-full max-w-md" />
        </div>
      </AuthLoading>
      <Authenticated>
        <DiaryAccessGuard>
          <AnnualResultsInner />
        </DiaryAccessGuard>
      </Authenticated>
    </Layout>
  );
}
