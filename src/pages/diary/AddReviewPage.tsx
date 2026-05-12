import { useState } from "react";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { useParams, useNavigate } from "react-router-dom";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { toast } from "sonner";
import { cn } from "@/lib/utils.ts";
import { ArrowLeftIcon, Users, Award, MessageSquare, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";

const praiseBadges = [
  { value: "general_praise", label: "Обща похвала" },
  { value: "active_participation", label: "Активно участие" },
  { value: "excellent_presentation", label: "Отлично представяне" },
  { value: "completed_task", label: "Изпълнена задача" },
  { value: "curiosity", label: "Любознателност" },
  { value: "diligence", label: "Прилежност" },
  { value: "progress", label: "Напредък" },
  { value: "communication", label: "Комуникативност" },
  { value: "sharp_mind", label: "Остър ум" },
  { value: "concentration", label: "Концентрация" },
  { value: "creativity", label: "Креативност" },
  { value: "teamwork", label: "Работа в екип" },
  { value: "leadership", label: "Лидерство" },
  { value: "patriotism", label: "Патриотизъм" },
  { value: "tolerance", label: "Толерантност" },
  { value: "emotional_intelligence", label: "Емоц. интелигентност" },
  { value: "presentation_skills", label: "Умения за презент." },
  { value: "digital_skills", label: "Дигитални умения" },
  { value: "musical_culture", label: "Музикална култура" },
  { value: "physical_culture", label: "Физическа култура" },
];

const warningBadges = [
  { value: "general_remark", label: "Обща забележка" },
  { value: "bad_discipline", label: "Лоша дисциплина" },
  { value: "lack_of_attention", label: "Липса на внимание" },
  { value: "official_remark", label: "Офиц. забележка" },
  { value: "disrespect", label: "Неуважение" },
  { value: "aggression", label: "Агресия" },
  { value: "removed_from_class", label: "Отстранен от час" },
  { value: "late", label: "Закъснение" },
  { value: "absence", label: "Отсъствие" },
  { value: "poor_performance", label: "Слабо представяне" },
  { value: "unprepared", label: "Без подготовка" },
  { value: "no_homework", label: "Без домашна работа" },
  { value: "no_textbook", label: "Без учебно помагало" },
  { value: "no_materials", label: "Без учебни пособия" },
  { value: "no_equipment", label: "Без екип" },
  { value: "no_uniform", label: "Без униформа" },
];

type SelectedBadge = {
  value: string;
  label: string;
  type: "praise" | "warning";
};

export default function AddReviewPage() {
  const navigate = useNavigate();
  const { classId, lng } = useParams<{ classId: string; lng: string }>();
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [badgeTab, setBadgeTab] = useState<"praise" | "warning">("praise");
  const [selectedBadges, setSelectedBadges] = useState<SelectedBadge[]>([]);
  const [globalComment, setGlobalComment] = useState("");
  const [badgeComments, setBadgeComments] = useState<Record<string, string>>({});
  const [reviewSubject, setReviewSubject] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get current user and teacher data
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const teachers = useQuery(api.admin.listTeachersWithNames, {});
  const teacherData = currentUser && teachers 
    ? teachers.find(t => t.userId === currentUser._id)
    : undefined;

  // Get subjects for this specific class only
  const classSubjectsData = useQuery(
    api.admin.getClassSubjectsTeachers,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  // Check if user is admin/director/vice-director
  const isAdmin = currentUser?.roles?.includes("director") || 
                  currentUser?.roles?.includes("vice_director") ||
                  currentUser?.roles?.includes("system_admin");
  
  // Admin/director/vice-director sees ALL subjects for this class
  // Teachers only see subjects they teach in this class
  const filteredSubjectsData = isAdmin
    ? classSubjectsData || []
    : classSubjectsData && teacherData
    ? classSubjectsData.filter(cs => cs.teacherId === teacherData._id)
    : classSubjectsData || [];
  
  // Create subject list with teacher names - include all entries (including ИУЧ)
  // Use a unique key combining subjectId + teacherId + preparationType to preserve all entries
  const subjects = filteredSubjectsData ? 
    filteredSubjectsData.map(cs => {
      // Build display name with subject, preparation type (only if not ЗП or ООП), and teacher
      const prepTypeSuffix = cs.preparationType && cs.preparationType !== "ЗП" && cs.preparationType !== "ООП"
        ? ` (${cs.preparationType})` 
        : "";
      const displayName = `${cs.subjectName}${prepTypeSuffix} - ${cs.teacherName}`;
      
      return {
        // Use combination of subjectId + teacherId + preparationType as unique key
        _id: `${cs.subjectId}-${cs.teacherId}-${cs.preparationType || "ЗП"}`,
        subjectId: cs.subjectId,
        name: displayName,
        teacherName: cs.teacherName,
      };
    }) : [];
  
  const allStudents = useQuery(
    api.admin.getStudentsByClass,
    classId ? { classId: classId as Id<"classes"> } : "skip"
  );
  
  const createRemark = useMutation(api.reviews.createRemark);

  // Helper to get unique badge key
  const getBadgeKey = (value: string, type: "praise" | "warning") => `${type}-${value}`;

  const handleSelectAll = () => {
    if (!allStudents) return;
    if (selectedStudents.length === allStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(allStudents.map(s => s._id));
    }
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const toggleBadge = (badgeValue: string, badgeLabel: string, type: "praise" | "warning") => {
    setSelectedBadges(prev => {
      const exists = prev.find(b => b.value === badgeValue && b.type === type);
      if (exists) {
        // Remove individual comment when badge is deselected
        const badgeKey = getBadgeKey(badgeValue, type);
        setBadgeComments(prevComments => {
          const newComments = { ...prevComments };
          delete newComments[badgeKey];
          return newComments;
        });
        return prev.filter(b => !(b.value === badgeValue && b.type === type));
      } else {
        return [...prev, { value: badgeValue, label: badgeLabel, type }];
      }
    });
  };

  const isBadgeSelected = (badgeValue: string, type: "praise" | "warning") => {
    return selectedBadges.some(b => b.value === badgeValue && b.type === type);
  };

  const selectedPraises = selectedBadges.filter(b => b.type === "praise");
  const selectedWarnings = selectedBadges.filter(b => b.type === "warning");

  const handleAddReview = async () => {
    if (selectedStudents.length === 0) {
      toast.error("Моля, изберете поне един ученик");
      return;
    }
    if (selectedBadges.length === 0) {
      toast.error("Моля, изберете поне една похвала или забележка");
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Create reviews for each selected student and each selected badge
      const promises: Promise<Id<"remarks">>[] = [];
      
      // Get the actual subjectId from the selected subject
      // The reviewSubject is a composite key: subjectId-teacherId-preparationType
      const selectedSubject = subjects.find(s => s._id === reviewSubject);
      const actualSubjectId = selectedSubject?.subjectId;
      
      for (const studentId of selectedStudents) {
        for (const badge of selectedBadges) {
          // Priority: individual comment > global comment > badge label
          const badgeKey = getBadgeKey(badge.value, badge.type);
          const individualComment = badgeComments[badgeKey]?.trim();
          const content = individualComment || globalComment.trim() || badge.label;
          promises.push(
            createRemark({
              studentId: studentId as Id<"students">,
              classId: classId as Id<"classes">,
              type: badge.type,
              content,
              subjectId: actualSubjectId && reviewSubject !== "none" ? actualSubjectId : undefined,
              badgeType: badge.value, // Добавяме типа на значката
            })
          );
        }
      }
      
      await Promise.all(promises);
      
      const totalReviews = selectedStudents.length * selectedBadges.length;
      toast.success(`Успешно добавени ${totalReviews} отзив${totalReviews > 1 ? "а" : ""}!`);
      navigate(`/${lng}/diary/class/${classId}/reviews`);
    } catch (error) {
      toast.error("Грешка при добавяне на отзив");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!allStudents) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <Skeleton className="h-96 w-full max-w-4xl" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex h-screen flex-col bg-background">
        {/* Header */}
        <div className="border-b bg-background">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-4">
              <Link to={`/${lng}/diary/class/${classId}/reviews`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeftIcon className="h-4 w-4 mr-2" />
                  Назад
                </Button>
              </Link>
              <h1 className="text-lg font-semibold">Добави отзив</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={() => navigate(`/${lng}/diary/class/${classId}/reviews`)}
                disabled={isSubmitting}
              >
                Откажи
              </Button>
              <Button 
                onClick={handleAddReview}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Добавяне..." : "Добави"}
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content - 3 columns */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Step 1: Select Students */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-foreground/20 text-sm font-bold">
                  1
                </div>
                <Users className="h-4 w-4" />
                <span className="font-medium">Избери ученик</span>
              </div>
              <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
                {/* Select All */}
                <label 
                  className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer border-b pb-3"
                >
                  <Checkbox 
                    checked={allStudents.length > 0 && selectedStudents.length === allStudents.length}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="font-medium text-sm">Избери всички</span>
                </label>
                
                {/* Student List */}
                {allStudents.map((student, index) => (
                  <label 
                    key={student._id}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded cursor-pointer transition-colors",
                      selectedStudents.includes(student._id) 
                        ? "bg-primary/10 border border-primary/30" 
                        : "hover:bg-muted"
                    )}
                  >
                    <Checkbox 
                      checked={selectedStudents.includes(student._id)}
                      onCheckedChange={() => toggleStudent(student._id)}
                    />
                    <span className="text-sm">
                      {index + 1}. {student.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Step 2: Select Badge */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-foreground/20 text-sm font-bold">
                  2
                </div>
                <Award className="h-4 w-4" />
                <span className="font-medium">Избери значка</span>
                {selectedBadges.length > 0 && (
                  <span className="ml-auto text-xs bg-primary-foreground/20 px-2 py-0.5 rounded-full">
                    {selectedBadges.length} избрани
                  </span>
                )}
              </div>
              
              {/* Tabs */}
              <div className="flex border-b">
                <button
                  className={cn(
                    "flex-1 py-3 px-4 text-sm font-medium transition-colors relative",
                    badgeTab === "praise" 
                      ? "bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400 border-b-2 border-green-600" 
                      : "hover:bg-muted"
                  )}
                  onClick={() => setBadgeTab("praise")}
                >
                  Похвали
                  {selectedPraises.length > 0 && (
                    <span className="ml-1 text-xs bg-green-600 text-white px-1.5 py-0.5 rounded-full">
                      {selectedPraises.length}
                    </span>
                  )}
                </button>
                <button
                  className={cn(
                    "flex-1 py-3 px-4 text-sm font-medium transition-colors relative",
                    badgeTab === "warning" 
                      ? "bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border-b-2 border-red-600" 
                      : "hover:bg-muted"
                  )}
                  onClick={() => setBadgeTab("warning")}
                >
                  Забележки
                  {selectedWarnings.length > 0 && (
                    <span className="ml-1 text-xs bg-red-600 text-white px-1.5 py-0.5 rounded-full">
                      {selectedWarnings.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Badge Grid */}
              <div className="p-4 max-h-[430px] overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                  {badgeTab === "praise" ? (
                    praiseBadges.map((badge) => (
                      <button
                        key={badge.value}
                        className={cn(
                          "p-3 rounded-lg text-xs font-medium text-center transition-all border relative",
                          isBadgeSelected(badge.value, "praise")
                            ? "bg-green-100 dark:bg-green-950/50 border-green-500 text-green-700 dark:text-green-400 ring-2 ring-green-500/50"
                            : "bg-background hover:bg-muted border-border"
                        )}
                        onClick={() => toggleBadge(badge.value, badge.label, "praise")}
                      >
                        {isBadgeSelected(badge.value, "praise") && (
                          <Check className="absolute top-1 right-1 h-3 w-3 text-green-600" />
                        )}
                        {badge.label}
                      </button>
                    ))
                  ) : (
                    warningBadges.map((badge) => (
                      <button
                        key={badge.value}
                        className={cn(
                          "p-3 rounded-lg text-xs font-medium text-center transition-all border relative",
                          isBadgeSelected(badge.value, "warning")
                            ? "bg-red-100 dark:bg-red-950/50 border-red-500 text-red-700 dark:text-red-400 ring-2 ring-red-500/50"
                            : "bg-background hover:bg-muted border-border"
                        )}
                        onClick={() => toggleBadge(badge.value, badge.label, "warning")}
                      >
                        {isBadgeSelected(badge.value, "warning") && (
                          <Check className="absolute top-1 right-1 h-3 w-3 text-red-600" />
                        )}
                        {badge.label}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Step 3: Enter Comment */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-foreground/20 text-sm font-bold">
                  3
                </div>
                <MessageSquare className="h-4 w-4" />
                <span className="font-medium">Въведи коментар</span>
              </div>
              <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                {/* Subject Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Предмет (опционално)</label>
                  <Select value={reviewSubject} onValueChange={setReviewSubject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Без предмет" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Без предмет</SelectItem>
                      {subjects?.map((subject) => (
                        <SelectItem key={subject._id} value={subject._id}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Global Comment Text Area */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Общ коментар за всички отзиви (опционално)</label>
                  <Textarea
                    placeholder="Коментар, който ще се приложи за всички значки без индивидуален коментар..."
                    value={globalComment}
                    onChange={(e) => setGlobalComment(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ако не въведете коментар, ще се използва името на всяка избрана значка.
                  </p>
                </div>

                {/* Individual Badge Comments */}
                {selectedBadges.length > 0 && (
                  <div className="space-y-3 pt-2 border-t">
                    <label className="text-sm font-medium">Индивидуални коментари за значки</label>
                    {selectedBadges.map((badge) => {
                      const badgeKey = getBadgeKey(badge.value, badge.type);
                      const isPraise = badge.type === "praise";
                      return (
                        <div key={badgeKey} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-xs font-medium px-2 py-0.5 rounded",
                              isPraise 
                                ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400" 
                                : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                            )}>
                              {badge.label}
                            </span>
                          </div>
                          <Textarea
                            placeholder={`Коментар за "${badge.label}" (опционално)...`}
                            value={badgeComments[badgeKey] || ""}
                            onChange={(e) => setBadgeComments(prev => ({
                              ...prev,
                              [badgeKey]: e.target.value
                            }))}
                            rows={2}
                            className="resize-none text-sm"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Summary */}
                <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                  <h4 className="text-sm font-medium">Обобщение:</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Избрани ученици: <span className="font-medium text-foreground">{selectedStudents.length}</span></li>
                    {selectedPraises.length > 0 && (
                      <li>• Похвали: <span className="font-medium text-green-600">
                        {selectedPraises.map(b => b.label).join(", ")}
                      </span></li>
                    )}
                    {selectedWarnings.length > 0 && (
                      <li>• Забележки: <span className="font-medium text-red-600">
                        {selectedWarnings.map(b => b.label).join(", ")}
                      </span></li>
                    )}
                    <li>• Общо отзиви: <span className="font-medium text-foreground">
                      {selectedStudents.length * selectedBadges.length}
                    </span></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
