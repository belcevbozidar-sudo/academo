import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useState, useEffect } from "react";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import { DiaryAccessGuard } from "@/components/DiaryAccessGuard.tsx";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { 
  UserIcon, 
  ArrowLeftIcon,
  SettingsIcon,
  XIcon,
  HelpCircleIcon,
  CheckIcon,
  FilterIcon,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { UserNameLink } from "@/components/ui/user-name-link.tsx";

function RemedialExamsInner() {
  const { classId, lng } = useParams<{ classId: string; lng: string }>();
  const navigate = useNavigate();
  
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState<Id<"remedialExams"> | null>(null);
  const [selectedSession, setSelectedSession] = useState<"session1" | "session2" | "additional" | null>(null);
  const [sessionUpdates, setSessionUpdates] = useState<Map<string, {
    session1Required: boolean;
    session2Required: boolean;
    additionalRequired: boolean;
  }>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  
  const currentUser = useQuery(api.users.getCurrentUser, {});
  
  const classData = useQuery(
    api.admin.getClassById,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  // Get subjects for this specific class only
  const classSubjectsData = useQuery(
    api.admin.getClassSubjectsTeachers,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  // Get unique subjects from classSubjects
  const subjects = classSubjectsData ? 
    Array.from(
      new Map(classSubjectsData.map(cs => [cs.subjectId, { _id: cs.subjectId, name: cs.subjectName }])).values()
    ) : [];

  const allStudents = useQuery(
    api.admin.getStudentsByClass,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  // Get only students with "takes_exam" annual result for the admin modal
  const studentsForRemedial = useQuery(
    api.remedialExams.getStudentsForRemedialExams,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  const remedialExams = useQuery(
    api.remedialExams.getRemedialExamsByClass,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );

  const updateGrade = useMutation(api.remedialExams.updateRemedialExamGrade);
  const bulkUpdateSessions = useMutation(api.remedialExams.bulkUpdateSessionRequirements);

  // Check if admin
  const isAdmin = currentUser?.roles?.includes("director") || 
                  currentUser?.roles?.includes("vice_director") ||
                  currentUser?.roles?.includes("system_admin");

  // Check if current user is the class teacher of this class
  const isClassTeacher = classData?.classTeacherId && currentUser?._id === classData.classTeacherId;
  
  // Only class teacher and admins can edit поправителни изпити
  const canEdit = isClassTeacher || isAdmin;

  // Reset session updates when admin modal opens - only for students with "takes_exam" result
  useEffect(() => {
    if (adminModalOpen && selectedSubject && studentsForRemedial && remedialExams) {
      const initialUpdates = new Map<string, {
        session1Required: boolean;
        session2Required: boolean;
        additionalRequired: boolean;
      }>();
      
      studentsForRemedial.forEach(student => {
        const existingExam = remedialExams.find(
          e => e.studentId === student._id && e.subjectId === selectedSubject
        );
        initialUpdates.set(student._id, {
          session1Required: existingExam?.session1Required || false,
          session2Required: existingExam?.session2Required || false,
          additionalRequired: existingExam?.additionalRequired || false,
        });
      });
      
      setSessionUpdates(initialUpdates);
    }
  }, [adminModalOpen, selectedSubject, studentsForRemedial, remedialExams]);

  // Group exams by student - showing each student once with all their subjects
  const studentExams = allStudents?.map(student => {
    const exams = remedialExams?.filter(e => e.studentId === student._id) || [];
    return {
      student,
      exams,
    };
  }).filter(se => se.exams.length > 0) || [];

  const stats = [
    { label: "Оц.", link: `/${lng}/diary/class/${classId}/grades` },
    { label: "Отс.", link: `/${lng}/diary/class/${classId}/absences` },
    { label: "Отз.", link: `/${lng}/diary/class/${classId}/reviews` },
    { label: "Раз.", link: `/${lng}/diary/class/${classId}/schedule` },
    { label: "Тем.", link: `/${lng}/diary/class/${classId}/topics` },
    { label: "Кон.", link: `/${lng}/diary/class/${classId}/tests` },
    { label: "Дом.", link: `/${lng}/diary/class/${classId}/homework` },
    { label: "ВЧК", link: `/${lng}/diary/class/${classId}/internal-commission` },
    { label: "Род.", link: `/${lng}/diary/class/${classId}/parent-meetings` },
    { label: "Поп.", link: `/${lng}/diary/class/${classId}/remedial-exams` },
    { label: "Под.", link: `/${lng}/diary/class/${classId}/student-support` },
    { label: "Сан.", link: `/${lng}/diary/class/${classId}/sanctions` },
    { label: "Год.", link: `/${lng}/diary/class/${classId}/annual-results` },
    { label: "Уч.", link: `/${lng}/diary/class/${classId}/students` },
  ];

  const handleOpenGradeModal = (examId: Id<"remedialExams">, session: "session1" | "session2" | "additional") => {
    setSelectedExamId(examId);
    setSelectedSession(session);
    setGradeModalOpen(true);
  };

  const handleSelectGrade = async (grade: number | "absent" | null) => {
    if (!selectedExamId || !selectedSession) return;
    
    try {
      await updateGrade({
        examId: selectedExamId,
        session: selectedSession,
        grade: grade ?? undefined,
      });
      toast.success("Оценката е записана успешно!");
      setGradeModalOpen(false);
    } catch (error) {
      toast.error("Грешка при записване на оценката");
      console.error(error);
    }
  };

  const handleToggleSession = (studentId: string, session: "session1Required" | "session2Required" | "additionalRequired") => {
    setSessionUpdates(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(studentId) || { session1Required: false, session2Required: false, additionalRequired: false };
      newMap.set(studentId, {
        ...current,
        [session]: !current[session],
      });
      return newMap;
    });
  };

  const handleSaveAdminChanges = async () => {
    if (!selectedSubject || !classId) return;
    
    setIsSaving(true);
    try {
      const updates = Array.from(sessionUpdates.entries()).map(([studentId, data]) => ({
        studentId: studentId as Id<"students">,
        session1Required: data.session1Required,
        session2Required: data.session2Required,
        additionalRequired: data.additionalRequired,
      }));
      
      await bulkUpdateSessions({
        classId: classId as Id<"classes">,
        subjectId: selectedSubject as Id<"subjects">,
        updates,
      });
      
      toast.success("Промените са записани успешно!");
      setAdminModalOpen(false);
    } catch (error) {
      toast.error("Грешка при записване на промените");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatGrade = (grade: number | "absent" | undefined): string => {
    if (grade === undefined) return "";
    if (grade === "absent") return "Неявил се";
    return grade.toString();
  };

  if (!classData || !allStudents) {
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
            <Link to={`/${lng}/diary/class/${classId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Назад
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-lg font-semibold">
                {isAdmin ? (
                  <Link 
                    to={`/${lng}/admin/classes/${classId}`}
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
          {canEdit && (
            <Button 
              variant="default" 
              size="sm"
              onClick={() => setAdminModalOpen(true)}
            >
              <SettingsIcon className="h-4 w-4 mr-2" />
              Администрирай
            </Button>
          )}
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-2 px-6 py-2 border-t overflow-x-auto">
          {stats.map((stat, index) => (
            <Link
              key={index}
              to={stat.link}
              className={cn(
                "px-4 py-2 text-sm font-medium whitespace-nowrap rounded transition-colors",
                stat.link === `/${lng}/diary/class/${classId}/remedial-exams`
                  ? "bg-accent text-accent-foreground"
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
          {/* Info message */}
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded text-sm text-blue-800 dark:text-blue-200">
            Въведете информация за поправителни изпити, ако са се състояли или са предвидени такива.
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full border">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left py-3 px-4 text-sm font-medium border">№</th>
                  <th className="text-left py-3 px-4 text-sm font-medium border">Ученик</th>
                  <th className="text-left py-3 px-4 text-sm font-medium border">Предмет</th>
                  <th className="text-center py-3 px-4 text-sm font-medium border">I сесия</th>
                  <th className="text-center py-3 px-4 text-sm font-medium border">II сесия</th>
                  <th className="text-center py-3 px-4 text-sm font-medium border">Доп. сесия</th>
                </tr>
              </thead>
              <tbody>
                {studentExams.length > 0 ? (
                  studentExams.map((se, index) => (
                    se.exams.map((exam, examIndex) => (
                      <tr key={exam._id} className="hover:bg-muted/50">
                        {examIndex === 0 ? (
                          <>
                            <td className="py-3 px-4 text-sm border" rowSpan={se.exams.length}>
                              {index + 1}
                            </td>
                            <td className="py-3 px-4 text-sm border" rowSpan={se.exams.length}>
                              <div className="flex items-center gap-2">
                                <UserIcon className="h-4 w-4 text-primary" />
                                <UserNameLink
                                  userId={se.student.userId}
                                  fullName={se.student.name}
                                />
                              </div>
                            </td>
                          </>
                        ) : null}
                        <td className="py-3 px-4 text-sm border">
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded text-xs">
                            {exam.subjectShortName}
                          </span>{" "}
                          {exam.subjectName}
                        </td>
                        <td className="py-3 px-4 text-sm text-center border">
                          {exam.session1Required ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full h-full"
                              onClick={() => handleOpenGradeModal(exam._id, "session1")}
                            >
                              {exam.session1Grade !== undefined ? (
                                <span className={cn(
                                  "font-medium",
                                  exam.session1Grade === "absent" ? "text-orange-600" :
                                  typeof exam.session1Grade === "number" && exam.session1Grade < 3 ? "text-red-600" :
                                  "text-green-600"
                                )}>
                                  ({formatGrade(exam.session1Grade)})
                                </span>
                              ) : (
                                <HelpCircleIcon className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-center border">
                          {exam.session2Required ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full h-full"
                              onClick={() => handleOpenGradeModal(exam._id, "session2")}
                            >
                              {exam.session2Grade !== undefined ? (
                                <span className={cn(
                                  "font-medium",
                                  exam.session2Grade === "absent" ? "text-orange-600" :
                                  typeof exam.session2Grade === "number" && exam.session2Grade < 3 ? "text-red-600" :
                                  "text-green-600"
                                )}>
                                  ({formatGrade(exam.session2Grade)})
                                </span>
                              ) : (
                                <HelpCircleIcon className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-center border">
                          {exam.additionalRequired ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full h-full"
                              onClick={() => handleOpenGradeModal(exam._id, "additional")}
                            >
                              {exam.additionalGrade !== undefined ? (
                                <span className={cn(
                                  "font-medium",
                                  exam.additionalGrade === "absent" ? "text-orange-600" :
                                  typeof exam.additionalGrade === "number" && exam.additionalGrade < 3 ? "text-red-600" :
                                  "text-green-600"
                                )}>
                                  ({formatGrade(exam.additionalGrade)})
                                </span>
                              ) : (
                                <HelpCircleIcon className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      Все още няма добавени поправителни изпити. Натиснете "Администрирай", за да добавите.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Grade Selection Modal */}
      {gradeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-background rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="text-center mb-4">
              <p className="text-sm text-muted-foreground">Изберете оценка и натиснете</p>
              <p className="text-sm text-muted-foreground">"Запази", за да я въведете.</p>
            </div>
            
            <div className="flex justify-center gap-2 mb-6">
              {[2, 3, 4, 5, 6].map(grade => (
                <Button
                  key={grade}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-10 h-10 text-lg font-bold",
                    grade === 2 && "border-red-500 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30",
                    grade === 3 && "border-orange-500 text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/30",
                    grade === 4 && "border-yellow-500 text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900/30",
                    grade === 5 && "border-green-500 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30",
                    grade === 6 && "border-green-600 text-green-700 hover:bg-green-100 dark:hover:bg-green-900/30",
                  )}
                  onClick={() => handleSelectGrade(grade)}
                >
                  {grade}
                </Button>
              ))}
              <Button
                variant="secondary"
                size="sm"
                className="h-10 text-sm font-medium"
                onClick={() => handleSelectGrade("absent")}
              >
                Неявил се
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setGradeModalOpen(false)}
              >
                Затвори
              </Button>
              <Button
                className="flex-1"
                onClick={() => handleSelectGrade(null)}
              >
                <CheckIcon className="h-4 w-4 mr-2" />
                Запази
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Modal - Full Screen */}
      {adminModalOpen && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="h-screen flex flex-col">
            {/* Header */}
            <div className="p-4 border-b bg-amber-50 dark:bg-amber-950/30">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <SettingsIcon className="h-5 w-5" />
                  Администриране на поправителни изпити в {classData.name}
                </h2>
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={() => setAdminModalOpen(false)} 
                    variant="outline"
                    size="sm"
                  >
                    <ArrowLeftIcon className="h-4 w-4 mr-2" />
                    Назад
                  </Button>
                  <Button
                    onClick={handleSaveAdminChanges}
                    size="sm"
                    disabled={!selectedSubject || isSaving}
                  >
                    <CheckIcon className="h-4 w-4 mr-2" />
                    {isSaving ? "Записване..." : "Запази"}
                  </Button>
                </div>
              </div>
              
              {/* Warning messages */}
              <div className="space-y-2 text-sm">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded border border-amber-300 dark:border-amber-700">
                  Само ученици с Годишен резултат "Полага изпит" могат да имат поправителни изпити.
                </div>
                <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded border border-amber-300 dark:border-amber-700">
                  Ако премахнете сесия, за която вече има въведени резултати, тези резултати ще бъдат изтрити.
                </div>
              </div>
            </div>

            {/* Subject selector */}
            <div className="p-4 border-b">
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="Изберете предмет" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject._id} value={subject._id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              {selectedSubject ? (
                studentsForRemedial && studentsForRemedial.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border">
                    <thead>
                      <tr className="bg-muted">
                        <th className="text-left py-3 px-4 text-sm font-medium border">№</th>
                        <th className="text-left py-3 px-4 text-sm font-medium border">Ученик</th>
                        <th className="text-center py-3 px-4 text-sm font-medium border">I сесия</th>
                        <th className="text-center py-3 px-4 text-sm font-medium border">II сесия</th>
                        <th className="text-center py-3 px-4 text-sm font-medium border">Доп. сесия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentsForRemedial.map((student, index) => {
                        const updates = sessionUpdates.get(student._id) || {
                          session1Required: false,
                          session2Required: false,
                          additionalRequired: false,
                        };
                        
                        return (
                          <tr key={student._id} className="hover:bg-muted/50">
                            <td className="py-3 px-4 text-sm border">{index + 1}</td>
                            <td className="py-3 px-4 text-sm border">{student.name}</td>
                            <td className="py-3 px-4 text-sm text-center border">
                              <div className="flex justify-center gap-2">
                                <Button
                                  variant={updates.session1Required ? "default" : "outline"}
                                  size="sm"
                                  className={cn(
                                    "w-12",
                                    updates.session1Required && "bg-green-600 hover:bg-green-700"
                                  )}
                                  onClick={() => handleToggleSession(student._id, "session1Required")}
                                >
                                  ДА
                                </Button>
                                <Button
                                  variant={!updates.session1Required ? "destructive" : "outline"}
                                  size="sm"
                                  className="w-12"
                                  onClick={() => handleToggleSession(student._id, "session1Required")}
                                >
                                  НЕ
                                </Button>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-center border">
                              <div className="flex justify-center gap-2">
                                <Button
                                  variant={updates.session2Required ? "default" : "outline"}
                                  size="sm"
                                  className={cn(
                                    "w-12",
                                    updates.session2Required && "bg-green-600 hover:bg-green-700"
                                  )}
                                  onClick={() => handleToggleSession(student._id, "session2Required")}
                                >
                                  ДА
                                </Button>
                                <Button
                                  variant={!updates.session2Required ? "destructive" : "outline"}
                                  size="sm"
                                  className="w-12"
                                  onClick={() => handleToggleSession(student._id, "session2Required")}
                                >
                                  НЕ
                                </Button>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-center border">
                              <div className="flex justify-center gap-2">
                                <Button
                                  variant={updates.additionalRequired ? "default" : "outline"}
                                  size="sm"
                                  className={cn(
                                    "w-12",
                                    updates.additionalRequired && "bg-green-600 hover:bg-green-700"
                                  )}
                                  onClick={() => handleToggleSession(student._id, "additionalRequired")}
                                >
                                  ДА
                                </Button>
                                <Button
                                  variant={!updates.additionalRequired ? "destructive" : "outline"}
                                  size="sm"
                                  className="w-12"
                                  onClick={() => handleToggleSession(student._id, "additionalRequired")}
                                >
                                  НЕ
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="mb-2">Няма ученици с годишен резултат "Полага изпит" в този клас.</p>
                    <p className="text-sm">Отидете в "Годишни резултати", за да отбележите кои ученици полагат изпит.</p>
                  </div>
                )
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Изберете предмет, за да управлявате поправителните изпити.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RemedialExamsPage() {
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
          <RemedialExamsInner />
        </DiaryAccessGuard>
      </Authenticated>
    </Layout>
  );
}
