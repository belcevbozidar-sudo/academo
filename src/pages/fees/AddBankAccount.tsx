import { useMutation, useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ArrowLeft, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";

function AddBankAccountInner() {
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();
  const createBankAccount = useMutation(api.fees.createBankAccount);
  const defaultSchool = useQuery(api.admin.getDefaultSchool, {});

  const [name, setName] = useState("");
  const [recipient, setRecipient] = useState("");
  const [iban, setIban] = useState("");
  const [bank, setBank] = useState("");
  const [customBank, setCustomBank] = useState("");

  if (defaultSchool === undefined) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const handleSave = async (andAdd: boolean = false) => {
    // Validation
    if (!name.trim()) {
      toast.error("Име на сметка е задължително");
      return;
    }
    if (!iban.trim()) {
      toast.error("IBAN е задължителен");
      return;
    }
    if (!bank.trim()) {
      toast.error("Банка на получателя е задължителна");
      return;
    }

    if (bank === "Друга" && !customBank.trim()) {
      toast.error("Моля, въведете името на банката");
      return;
    }

    if (!defaultSchool?.schoolId) {
      toast.error("Не е намерено училище");
      return;
    }

    try {
      await createBankAccount({
        name,
        iban,
        bank: bank === "Друга" ? customBank : bank,
        schoolId: defaultSchool.schoolId,
      });

      toast.success("Банковата сметка е създадена успешно");

      if (andAdd) {
        // Reset form
        setName("");
        setRecipient("");
        setIban("");
        setBank("");
        setCustomBank("");
      } else {
        navigate(`/${lng}/fees/bank-accounts`);
      }
    } catch (error) {
      const err = error as Error;
      toast.error(`Грешка: ${err.message}`);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <h1 className="text-2xl font-bold">Добавяне на банкова сметка</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(`/${lng}/fees/bank-accounts`)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад
            </Button>
            <Button 
              onClick={() => handleSave(true)}
              className="bg-teal-600 hover:bg-teal-700"
            >
              <Check className="h-4 w-4 mr-2" />
              Запази и добави
            </Button>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-6">Основни данни</h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <label className="text-sm font-medium">
                Име на сметка: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="px-3 py-2 border rounded-md"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Въведете име на сметка"
              />
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <label className="text-sm font-medium">Получател:</label>
              <input
                type="text"
                className="px-3 py-2 border rounded-md"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="напр: ОУ Иван Вазов"
              />
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <label className="text-sm font-medium">
                IBAN на получателя: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="px-3 py-2 border rounded-md"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                placeholder="Въведете IBAN"
              />
            </div>

            <div className="grid grid-cols-[200px_1fr] items-center gap-4">
              <label className="text-sm font-medium">
                Банка на получателя: <span className="text-red-500">*</span>
              </label>
              <select
                className="px-3 py-2 border rounded-md"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
              >
                <option value="">Изберете...</option>
                <option value="Алианц Банк България АД">Алианц Банк България АД</option>
                <option value="Банка ДСК">Банка ДСК</option>
                <option value="БНБ">БНБ</option>
                <option value="ОББ">ОББ</option>
                <option value="Пощенска банка">Пощенска банка</option>
                <option value="УниКредит Булбанк">УниКредит Булбанк</option>
                <option value="Първа инвестиционна банка АД (Fibank)">Първа инвестиционна банка АД (Fibank)</option>
                <option value="Централна кооперативна банка АД">Централна кооперативна банка АД</option>
                <option value="ИНВЕСТБАНК АД">ИНВЕСТБАНК АД</option>
                <option value="ТИ БИ АЙ Банк ЕАД">ТИ БИ АЙ Банк ЕАД</option>
                <option value="Друга">Друга</option>
              </select>
            </div>

            {bank === "Друга" && (
              <div className="grid grid-cols-[200px_1fr] items-center gap-4">
                <label className="text-sm font-medium">
                  Име на банката: <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="px-3 py-2 border rounded-md"
                  value={customBank}
                  onChange={(e) => setCustomBank(e.target.value)}
                  placeholder="Въведете име на банката"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default function AddBankAccount() {
  return (
    <>
      <Unauthenticated>
        <Layout>
          <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] space-y-4">
            <p className="text-muted-foreground">
              Моля, влезте в акаунта си.
            </p>
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
        <AddBankAccountInner />
      </Authenticated>
    </>
  );
}
