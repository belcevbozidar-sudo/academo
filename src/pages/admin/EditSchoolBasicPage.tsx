import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton.tsx";

// Bulgarian labels for all fields
const fieldLabels: Record<string, string> = {
  name: "Пълно (официално) име",
  shortName: "Кратко име",
  schoolType: "Вид",
  ownership: "Тип",
  isCentral: "Средищно училище",
  isProtected: "Защитено училище",
  isInnovative: "Иновативно училище",
  isStateFunded: "На държавно финансиране",
  isNationalImportance: "От национално значение",
  providesProfessionalTraining: "Осигурява професионална подготовка",
  fundingSource: "Финансира се от",
  isDelegatedBudget: "На делегиран бюджет",
  approvedBudget: "Утвърден бюджет",
  createdByInternationalAgreement: "Създадено по международен договор",
  city: "Населено място",
  district: "Район",
  address: "Адрес",
  postalCode: "Пощенски код",
  phone: "Телефон",
  phone2: "Телефон №2",
  fax: "Факс",
  website: "Уеб сайт",
  email: "Ел. поща",
  email2: "Ел. поща №2",
  neispuoCode: "НЕИСПУО код",
  iban: "IBAN",
  bank: "Банка",
  bic: "BIC",
  accountHolder: "Титуляр на сметката",
};

export default function EditSchoolBasicPage() {
  const navigate = useNavigate();
  const schoolDetails = useQuery(api.admin.getSchoolDetails, {});
  const updateSchool = useMutation(api.admin.updateSchoolDetails);
  
  const [basicData, setBasicData] = useState({
    name: "",
    shortName: "",
    schoolType: "",
    ownership: "",
    isCentral: false,
    isProtected: false,
    isInnovative: false,
    isStateFunded: false,
    isNationalImportance: false,
    providesProfessionalTraining: false,
    fundingSource: "",
    isDelegatedBudget: false,
    approvedBudget: "",
    createdByInternationalAgreement: false,
    city: "",
    district: "",
    address: "",
    postalCode: "",
    phone: "",
    phone2: "",
    fax: "",
    website: "",
    email: "",
    email2: "",
    neispuoCode: "",
    iban: "",
    bank: "",
    bic: "",
    accountHolder: "",
  });
  
  const [hiddenFields, setHiddenFields] = useState<string[]>([]);
  
  useEffect(() => {
    if (schoolDetails) {
      setBasicData({
        name: schoolDetails.name || "",
        shortName: schoolDetails.shortName || "",
        schoolType: schoolDetails.schoolType || "",
        ownership: schoolDetails.ownership || "",
        isCentral: schoolDetails.isCentral || false,
        isProtected: schoolDetails.isProtected || false,
        isInnovative: schoolDetails.isInnovative || false,
        isStateFunded: schoolDetails.isStateFunded || false,
        isNationalImportance: schoolDetails.isNationalImportance || false,
        providesProfessionalTraining: schoolDetails.providesProfessionalTraining || false,
        fundingSource: schoolDetails.fundingSource || "",
        isDelegatedBudget: schoolDetails.isDelegatedBudget || false,
        approvedBudget: schoolDetails.approvedBudget || "",
        createdByInternationalAgreement: schoolDetails.createdByInternationalAgreement || false,
        city: schoolDetails.city || "",
        district: schoolDetails.district || "",
        address: schoolDetails.address || "",
        postalCode: schoolDetails.postalCode || "",
        phone: schoolDetails.phone || "",
        phone2: schoolDetails.phone2 || "",
        fax: schoolDetails.fax || "",
        website: schoolDetails.website || "",
        email: schoolDetails.email || "",
        email2: schoolDetails.email2 || "",
        neispuoCode: schoolDetails.neispuoCode || "",
        iban: schoolDetails.iban || "",
        bank: schoolDetails.bank || "",
        bic: schoolDetails.bic || "",
        accountHolder: schoolDetails.accountHolder || "",
      });
      setHiddenFields(schoolDetails.hiddenFields || []);
    }
  }, [schoolDetails]);

  const handleSave = async () => {
    try {
      await updateSchool({ ...basicData, hiddenFields });
      toast.success("Основните данни са запазени успешно");
      navigate("/bg/admin/school");
    } catch (error) {
      toast.error("Грешка при запазване на данните");
    }
  };
  
  const toggleFieldVisibility = (fieldName: string) => {
    if (hiddenFields.includes(fieldName)) {
      setHiddenFields(hiddenFields.filter(f => f !== fieldName));
    } else {
      setHiddenFields([...hiddenFields, fieldName]);
    }
  };

  if (!schoolDetails) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-6">
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Редактиране на основни данни</h1>
          <Button variant="outline" onClick={() => navigate("/bg/admin/school")}>
            Отказ
          </Button>
        </div>

        <div className="bg-background border rounded-lg p-6 space-y-4">
          {/* All fields with visibility toggle */}
          {Object.entries(basicData).map(([key, value]) => (
            <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor={key} className="text-right">
                  {fieldLabels[key] || key}
                </Label>
                {typeof value === 'boolean' ? (
                  <div className="col-span-3">
                    <Checkbox
                      id={key}
                      checked={value}
                      onCheckedChange={(checked) => setBasicData({ ...basicData, [key]: checked as boolean })}
                    />
                  </div>
                ) : (
                  <Input
                    id={key}
                    value={value}
                    onChange={(e) => setBasicData({ ...basicData, [key]: e.target.value })}
                    className="col-span-3"
                  />
                )}
              </div>
              <Button
                type="button"
                size="icon"
                variant={hiddenFields.includes(key) ? "default" : "outline"}
                onClick={() => toggleFieldVisibility(key)}
                title={hiddenFields.includes(key) ? "Скрито" : "Видимо"}
              >
                {hiddenFields.includes(key) ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </Button>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate("/bg/admin/school")}>
            Отказ
          </Button>
          <Button onClick={handleSave}>Запази</Button>
        </div>
      </div>
    </Layout>
  );
}
