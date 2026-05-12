import { useState } from "react";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader } from "@/components/ui/card.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { EditIcon, PlusIcon, Trash2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { toast } from "sonner";
import { Link, useParams, useNavigate } from "react-router-dom";

type LeadershipPosition = {
  positionTitle: string;
  userId?: Id<"users">;
  isHidden?: boolean;
  user?: {
    _id: Id<"users">;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    name?: string;
  } | null;
};

type CustomDataField = {
  label: string;
  value: string;
  isHidden?: boolean;
};

export default function School() {
  const { lng } = useParams<{ lng: string }>();
  const navigate = useNavigate();
  const schoolDetails = useQuery(api.admin.getSchoolDetails, {});
  const availableUsers = useQuery(api.admin.getUsersByRoles, {});
  const updateSchool = useMutation(api.admin.updateSchoolDetails);
  
  const [editLeadershipDialog, setEditLeadershipDialog] = useState(false);
  const [editOtherDialog, setEditOtherDialog] = useState(false);
  

  const [leadershipPositions, setLeadershipPositions] = useState<LeadershipPosition[]>([]);
  const [customData, setCustomData] = useState<CustomDataField[]>([]);
  
  const isAdmin = schoolDetails?.isUserAdmin ?? false;
  
  const openLeadershipEdit = () => {
    if (schoolDetails) {
      setLeadershipPositions(
        schoolDetails.leadershipPositions?.map(pos => ({
          positionTitle: pos.positionTitle,
          userId: pos.userId,
          isHidden: pos.isHidden || false,
        })) || []
      );
    }
    setEditLeadershipDialog(true);
  };
  
  const openOtherEdit = () => {
    if (schoolDetails) {
      setCustomData(
        schoolDetails.customData?.map(data => ({
          label: data.label,
          value: data.value,
          isHidden: data.isHidden || false,
        })) || []
      );
    }
    setEditOtherDialog(true);
  };
  
  const handleSaveLeadership = async () => {
    try {
      await updateSchool({ leadershipPositions });
      toast.success("Ръководството е запазено успешно");
      setEditLeadershipDialog(false);
    } catch (error) {
      toast.error("Грешка при запазване на данните");
    }
  };
  
  const handleSaveOther = async () => {
    try {
      await updateSchool({ customData });
      toast.success("Другите данни са запазени успешно");
      setEditOtherDialog(false);
    } catch (error) {
      toast.error("Грешка при запазване на данните");
    }
  };
  
  const addLeadershipPosition = () => {
    setLeadershipPositions([...leadershipPositions, { positionTitle: "", userId: undefined, isHidden: false }]);
  };
  
  const removeLeadershipPosition = (index: number) => {
    setLeadershipPositions(leadershipPositions.filter((_, i) => i !== index));
  };
  
  const updateLeadershipPosition = (index: number, field: keyof LeadershipPosition, value: string | boolean | Id<"users"> | undefined) => {
    const updated = [...leadershipPositions];
    updated[index] = { ...updated[index], [field]: value };
    setLeadershipPositions(updated);
  };
  
  const addCustomData = () => {
    setCustomData([...customData, { label: "", value: "", isHidden: false }]);
  };
  
  const removeCustomData = (index: number) => {
    setCustomData(customData.filter((_, i) => i !== index));
  };
  
  const updateCustomData = (index: number, field: keyof CustomDataField, value: string | boolean) => {
    const updated = [...customData];
    updated[index] = { ...updated[index], [field]: value };
    setCustomData(updated);
  };
  
  const isFieldHidden = (fieldName: string) => {
    return schoolDetails?.hiddenFields?.includes(fieldName) ?? false;
  };
  
  if (schoolDetails === undefined) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }
  
  if (!schoolDetails) {
    return (
      <Layout>
        <div className="text-center text-muted-foreground">
          Няма данни за училището
        </div>
      </Layout>
    );
  }
  
  // Helper to render a field row
  const renderField = (label: string, value: string | boolean | number | null | undefined, fieldName?: string) => {
    // Check if field is hidden (only for non-admins)
    if (!isAdmin && fieldName && isFieldHidden(fieldName)) {
      return null;
    }
    
    return (
      <div className="grid grid-cols-[250px_1fr] gap-4 items-center border-b pb-2">
        <div className="font-medium text-muted-foreground">{label}:</div>
        <div>{typeof value === "boolean" ? (value ? "Да" : "Не") : (value || "—")}</div>
      </div>
    );
  };
  
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">🏫 {schoolDetails.name || "Училище"}</h1>
        </div>
        
        <Tabs defaultValue="basic" className="w-full">
          <Card>
            <CardHeader className="border-b">
              <TabsList className="w-full justify-start h-auto flex-wrap">
                <TabsTrigger value="basic">Основни данни</TabsTrigger>
                <TabsTrigger value="leadership">Ръководство</TabsTrigger>
                <TabsTrigger value="other">Други данни</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="p-6">
              <TabsContent value="basic" className="space-y-4 mt-0">
                <div className="flex justify-end mb-4">
                  {isAdmin && (
                    <Button variant="default" className="gap-2" onClick={() => navigate(`/${lng}/admin/school/edit-basic`)}>
                      <EditIcon className="h-4 w-4" />
                      Редактирай
                    </Button>
                  )}
                </div>
                
                <div className="grid gap-4">
                  {renderField("Пълно (официално) име", schoolDetails.name, "name")}
                  {renderField("Кратко име", schoolDetails.shortName, "shortName")}
                  {renderField("Вид", schoolDetails.schoolType, "schoolType")}
                  {renderField("Тип", schoolDetails.ownership, "ownership")}
                  {renderField("Средищно училище", schoolDetails.isCentral, "isCentral")}
                  {renderField("Защитено училище", schoolDetails.isProtected, "isProtected")}
                  {renderField("Иновативно училище", schoolDetails.isInnovative, "isInnovative")}
                  {renderField("На държавно финансиране", schoolDetails.isStateFunded, "isStateFunded")}
                  {renderField("От национално значение", schoolDetails.isNationalImportance, "isNationalImportance")}
                  {renderField("Осигурява професионална подготовка", schoolDetails.providesProfessionalTraining, "providesProfessionalTraining")}
                  {renderField("Финансира се от", schoolDetails.fundingSource, "fundingSource")}
                  {renderField("На делегиран бюджет", schoolDetails.isDelegatedBudget, "isDelegatedBudget")}
                  {renderField("Утвърден бюджет за текущата календарна година", schoolDetails.approvedBudget, "approvedBudget")}
                  
                  {/* Fields from "Other Data" moved here */}
                  {renderField("Създадено по силата на международен договор", schoolDetails.createdByInternationalAgreement, "createdByInternationalAgreement")}
                  {renderField("Населено място", schoolDetails.city, "city")}
                  {renderField("Район", schoolDetails.district, "district")}
                  {renderField("Адрес", schoolDetails.address, "address")}
                  {renderField("Пощенски код", schoolDetails.postalCode, "postalCode")}
                  {!isFieldHidden("phone") && !(!isAdmin && schoolDetails.hiddenFields?.includes("phone")) && (
                    <div className="grid grid-cols-[250px_1fr] gap-4 items-center border-b pb-2">
                      <div className="font-medium text-muted-foreground">Телефон:</div>
                      <div className="text-blue-600">{schoolDetails.phone || "—"}</div>
                    </div>
                  )}
                  {!isFieldHidden("phone2") && !(!isAdmin && schoolDetails.hiddenFields?.includes("phone2")) && (
                    <div className="grid grid-cols-[250px_1fr] gap-4 items-center border-b pb-2">
                      <div className="font-medium text-muted-foreground">Телефон №2:</div>
                      <div className="text-blue-600">{schoolDetails.phone2 || "—"}</div>
                    </div>
                  )}
                  {renderField("Факс", schoolDetails.fax, "fax")}
                  {!isFieldHidden("website") && !(!isAdmin && schoolDetails.hiddenFields?.includes("website")) && (
                    <div className="grid grid-cols-[250px_1fr] gap-4 items-center border-b pb-2">
                      <div className="font-medium text-muted-foreground">Уеб сайт:</div>
                      <div className="text-blue-600">{schoolDetails.website || "—"}</div>
                    </div>
                  )}
                  {!isFieldHidden("email") && !(!isAdmin && schoolDetails.hiddenFields?.includes("email")) && (
                    <div className="grid grid-cols-[250px_1fr] gap-4 items-center border-b pb-2">
                      <div className="font-medium text-muted-foreground">Ел. поща:</div>
                      <div className="text-blue-600">{schoolDetails.email || "—"}</div>
                    </div>
                  )}
                  {!isFieldHidden("email2") && !(!isAdmin && schoolDetails.hiddenFields?.includes("email2")) && (
                    <div className="grid grid-cols-[250px_1fr] gap-4 items-center border-b pb-2">
                      <div className="font-medium text-muted-foreground">Ел. поща №2:</div>
                      <div className="text-blue-600">{schoolDetails.email2 || "—"}</div>
                    </div>
                  )}
                  {renderField("НЕИСПУО код", schoolDetails.neispuoCode, "neispuoCode")}
                  
                  {/* Bank Account section */}
                  <div className="mt-6 mb-2">
                    <h3 className="text-lg font-semibold">💳 Банкова сметка</h3>
                  </div>
                  {renderField("IBAN", schoolDetails.iban, "iban")}
                  {renderField("Банка", schoolDetails.bank, "bank")}
                  {renderField("BIC", schoolDetails.bic, "bic")}
                  {renderField("Титуляр на сметката", schoolDetails.accountHolder, "accountHolder")}
                </div>
              </TabsContent>
              
              <TabsContent value="leadership" className="space-y-4 mt-0">
                <div className="flex justify-end mb-4">
                  {isAdmin && (
                    <Button variant="default" className="gap-2" onClick={openLeadershipEdit}>
                      <EditIcon className="h-4 w-4" />
                      Редактирай
                    </Button>
                  )}
                </div>
                
                <div className="grid gap-4">
                  {schoolDetails.leadershipPositions && schoolDetails.leadershipPositions.length > 0 ? (
                    schoolDetails.leadershipPositions.map((pos, idx) => (
                      <div key={idx} className="grid grid-cols-[250px_1fr] gap-4 items-center border-b pb-2">
                        <div className="font-medium text-muted-foreground">{pos.positionTitle}:</div>
                        <div>
                          {pos.user ? (
                            <Link 
                              to={`/${lng}/admin/user/${pos.user._id}`}
                              className="text-blue-600 hover:underline"
                            >
                              {[pos.user.firstName, pos.user.middleName, pos.user.lastName].filter(Boolean).join(" ") || pos.user.name || "—"}
                            </Link>
                          ) : "—"}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      Няма добавени ръководни позиции
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="other" className="space-y-4 mt-0">
                <div className="flex justify-end mb-4">
                  {isAdmin && (
                    <Button variant="default" className="gap-2" onClick={openOtherEdit}>
                      <EditIcon className="h-4 w-4" />
                      Редактирай
                    </Button>
                  )}
                </div>
                
                <div className="grid gap-4">
                  {schoolDetails.customData && schoolDetails.customData.length > 0 ? (
                    schoolDetails.customData.map((data, idx) => (
                      <div key={idx} className="grid grid-cols-[250px_1fr] gap-4 items-center border-b pb-2">
                        <div className="font-medium text-muted-foreground">{data.label}:</div>
                        <div>{data.value || "—"}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      Няма добавени данни
                    </div>
                  )}
                </div>
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
        
        {/* Edit Leadership Dialog */}
        <Dialog open={editLeadershipDialog} onOpenChange={setEditLeadershipDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Редактиране на ръководство</DialogTitle>
              <DialogDescription>
                Добавяйте и редактирайте ръководни позиции (директори, зам. директори и др.)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {leadershipPositions.map((pos, idx) => (
                <div key={idx} className="border rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Позиция</Label>
                    <Input
                      value={pos.positionTitle}
                      onChange={(e) => updateLeadershipPosition(idx, "positionTitle", e.target.value)}
                      placeholder="Директор, Зам. директор # 1, ..."
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Служител</Label>
                    <Select
                      value={pos.userId || ""}
                      onValueChange={(value) => updateLeadershipPosition(idx, "userId", value as Id<"users">)}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Изберете служител" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableUsers?.map(user => (
                          <SelectItem key={user._id} value={user._id}>
                            {user.name} ({user.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <Checkbox
                      id={`hidden-${idx}`}
                      checked={pos.isHidden || false}
                      onCheckedChange={(checked) => updateLeadershipPosition(idx, "isHidden", checked as boolean)}
                    />
                    <Label htmlFor={`hidden-${idx}`} className="cursor-pointer">
                      Скрий от нeадмини
                    </Label>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeLeadershipPosition(idx)}
                    >
                      <Trash2Icon className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button type="button" onClick={addLeadershipPosition} className="w-full gap-2">
                <PlusIcon className="h-4 w-4" />
                Добави позиция
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditLeadershipDialog(false)}>
                Отказ
              </Button>
              <Button onClick={handleSaveLeadership}>
                Запази
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Edit Other Data Dialog */}
        <Dialog open={editOtherDialog} onOpenChange={setEditOtherDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Редактиране на други данни</DialogTitle>
              <DialogDescription>
                Добавяйте персонализирани данни (Информация и Отговор)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {customData.map((data, idx) => (
                <div key={idx} className="border rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Информация</Label>
                    <Input
                      value={data.label}
                      onChange={(e) => updateCustomData(idx, "label", e.target.value)}
                      placeholder="Наименование/Титла"
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Отговор</Label>
                    <Input
                      value={data.value}
                      onChange={(e) => updateCustomData(idx, "value", e.target.value)}
                      placeholder="Стойност"
                      className="col-span-3"
                    />
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <Checkbox
                      id={`custom-hidden-${idx}`}
                      checked={data.isHidden || false}
                      onCheckedChange={(checked) => updateCustomData(idx, "isHidden", checked as boolean)}
                    />
                    <Label htmlFor={`custom-hidden-${idx}`} className="cursor-pointer">
                      Скрий от неадмини
                    </Label>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeCustomData(idx)}
                    >
                      <Trash2Icon className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button type="button" onClick={addCustomData} className="w-full gap-2">
                <PlusIcon className="h-4 w-4" />
                Добави данни
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOtherDialog(false)}>
                Отказ
              </Button>
              <Button onClick={handleSaveOther}>
                Запази
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
