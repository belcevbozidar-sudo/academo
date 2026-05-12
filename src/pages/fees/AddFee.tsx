import { useMutation, useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { ArrowLeft, Check, X, Plus, Minus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import type { Id } from "@/convex/_generated/dataModel";

type Installment = {
  index: number;
  amount: number;
  dueDate: string;
};

function AddFeeInner() {
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();
  const createFee = useMutation(api.fees.create);
  const allUsers = useQuery(api.admin.listUsers, {});
  const allClasses = useQuery(api.admin.listClasses, {});
  const allStudents = useQuery(api.admin.listStudents, {});
  const defaultSchool = useQuery(api.admin.getDefaultSchool, {});
  const bankAccounts = useQuery(api.fees.listBankAccounts, {});

  // Active tab
  const [activeTab, setActiveTab] = useState("basic");

  // Basic data
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState<"BGN" | "EUR" | "USD">("EUR");
  const [amount, setAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountValidUntil, setDiscountValidUntil] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Payment methods
  const [methodCash, setMethodCash] = useState(true);
  const [methodOnline, setMethodOnline] = useState(false);
  const [methodBank, setMethodBank] = useState(false);
  const [bankAccount, setBankAccount] = useState("");
  const [bankTransferDescription, setBankTransferDescription] = useState("");

  // Installments
  const [installmentsCount, setInstallmentsCount] = useState(1);
  const [installments, setInstallments] = useState<Installment[]>([
    { index: 1, amount: 0, dueDate: "" },
  ]);

  // Assigned users
  const [filterGrade, setFilterGrade] = useState<number | "">("");
  const [filterClassId, setFilterClassId] = useState<Id<"classes"> | "">("");
  const [filterGroup, setFilterGroup] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<Id<"users">>>(new Set());

  if (allUsers === undefined || allClasses === undefined || allStudents === undefined || defaultSchool === undefined || bankAccounts === undefined) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const handleInstallmentsCountChange = (delta: number) => {
    const newCount = Math.max(1, installmentsCount + delta);
    setInstallmentsCount(newCount);

    const amountValue = parseFloat(discountAmount || amount) || 0;
    const amountPerInstallment = amountValue / newCount;

    const newInstallments: Installment[] = [];
    for (let i = 0; i < newCount; i++) {
      newInstallments.push({
        index: i + 1,
        amount: parseFloat(amountPerInstallment.toFixed(2)),
        dueDate: installments[i]?.dueDate || "",
      });
    }

    setInstallments(newInstallments);
  };

  const updateInstallment = (
    index: number,
    field: "amount" | "dueDate",
    value: string | number
  ) => {
    const updated = [...installments];
    if (field === "amount") {
      updated[index].amount = parseFloat(value as string) || 0;
    } else {
      updated[index].dueDate = value as string;
    }
    setInstallments(updated);
  };

  const removeInstallment = (index: number) => {
    if (installments.length <= 1) {
      toast.error("Трябва да има поне една вноска");
      return;
    }
    setInstallments(installments.filter((_, i) => i !== index));
    setInstallmentsCount(installmentsCount - 1);
  };

  const totalInstallmentsAmount = installments.reduce(
    (sum, inst) => sum + inst.amount,
    0
  );

  const handleToggleUser = (userId: Id<"users">) => {
    const newSet = new Set(selectedUserIds);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setSelectedUserIds(newSet);
  };

  const handleClearFilters = () => {
    setFilterGrade("");
    setFilterClassId("");
    setFilterGroup("");
    setSearchQuery("");
  };

  const handleBackButton = () => {
    if (activeTab === "basic") {
      navigate(`/${lng}/fees/all-fees`);
    } else if (activeTab === "methods") {
      setActiveTab("basic");
    } else if (activeTab === "installments") {
      setActiveTab("methods");
    } else if (activeTab === "users") {
      setActiveTab("installments");
    }
  };

  const handleNextTab = () => {
    if (activeTab === "basic") {
      setActiveTab("methods");
    } else if (activeTab === "methods") {
      setActiveTab("installments");
    } else if (activeTab === "installments") {
      setActiveTab("users");
    }
  };

  const handleSave = async (andAdd: boolean = false) => {
    // Validation
    if (!title.trim()) {
      toast.error("Наименованието е задължително");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Стойността трябва да бъде положително число");
      return;
    }
    if (!dueDate) {
      toast.error("Краен срок за плащане е задължителен");
      return;
    }
    if (!methodCash && !methodOnline && !methodBank) {
      toast.error("Изберете поне един метод на плащане");
      return;
    }
    if (installments.some((inst) => !inst.dueDate)) {
      toast.error("Всички вноски трябва да имат краен срок");
      return;
    }
    if (selectedUserIds.size === 0) {
      toast.error("Добавете поне един задължен потребител");
      return;
    }

    const totalAmount = parseFloat(discountAmount || amount);
    if (Math.abs(totalInstallmentsAmount - totalAmount) > 0.01) {
      toast.error(
        `Сумата на вноските (${totalInstallmentsAmount.toFixed(2)}) трябва да е равна на общата сума (${totalAmount.toFixed(2)})`
      );
      return;
    }

    if (!defaultSchool?.schoolId) {
      toast.error("Не е намерено училище");
      return;
    }

    try {
      await createFee({
        title,
        description: description || undefined,
        currency,
        amount: parseFloat(amount),
        discountAmount: discountAmount ? parseFloat(discountAmount) : undefined,
        discountValidUntil: discountValidUntil
          ? new Date(discountValidUntil).getTime()
          : undefined,
        dueDate: new Date(dueDate).getTime(),
        methods: {
          cash: methodCash,
          online: methodOnline,
          bank: methodBank,
        },
        installmentsCount,
        installments: installments.map((inst) => ({
          index: inst.index,
          amount: inst.amount,
          dueDate: new Date(inst.dueDate).getTime(),
        })),
        assignToUserIds: Array.from(selectedUserIds),
        schoolId: defaultSchool.schoolId,
      });

      toast.success("Таксата е създадена успешно");

      // Винаги навигира към списъка с такси
      navigate(`/${lng}/fees/all-fees`);
    } catch (error) {
      const err = error as Error;
      toast.error(`Грешка: ${err.message}`);
    }
  };

  // Filter students for assignment
  const studentsWithClasses = allStudents.map((student) => {
    const user = allUsers.find((u) => u._id === student.userId);
    const classDoc = allClasses.find((c) => c._id === student.classId);
    return {
      ...student,
      userName: user?.name || "Неизвестен",
      className: classDoc?.name || "—",
      grade: classDoc?.grade || 0,
    };
  });

  let filteredStudents = studentsWithClasses;
  if (filterGrade) {
    filteredStudents = filteredStudents.filter((s) => s.grade === filterGrade);
  }
  if (filterClassId) {
    filteredStudents = filteredStudents.filter((s) => s.classId === filterClassId);
  }
  if (searchQuery) {
    filteredStudents = filteredStudents.filter((s) =>
      s.userName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // Get unique grades for filter
  const uniqueGrades = Array.from(new Set(studentsWithClasses.map((s) => s.grade))).sort();

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header with action buttons */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h1 className="text-2xl font-bold">Добавяне на такса</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleBackButton}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад
            </Button>
            {activeTab !== "users" ? (
              <Button 
                onClick={handleNextTab}
                className="bg-teal-600 hover:bg-teal-700"
              >
                <Check className="h-4 w-4 mr-2" />
                Запази и премини
              </Button>
            ) : (
              <Button 
                onClick={() => handleSave(true)}
                className="bg-teal-600 hover:bg-teal-700"
              >
                <Check className="h-4 w-4 mr-2" />
                Запази и добави
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Основни данни</TabsTrigger>
            <TabsTrigger value="methods">Методи на плащане</TabsTrigger>
            <TabsTrigger value="installments">Вноски</TabsTrigger>
            <TabsTrigger value="users">Задължени лица 👤</TabsTrigger>
          </TabsList>

          {/* Основни данни */}
          <TabsContent value="basic" className="space-y-4 mt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">
                  Наименование: <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Напр. Срочна такса за обучение"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">
                  Пояснение за плащането:
                </label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Опишете таксата..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Валута: <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as "BGN" | "EUR" | "USD")}
                >
                  <option value="BGN">BGN</option>
                  <option value="EUR">Евро</option>
                  <option value="USD">USD</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Стойност: <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 border rounded-md"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    const newCount = installmentsCount;
                    const amountValue = parseFloat(e.target.value) || 0;
                    const amountPerInstallment = amountValue / newCount;
                    setInstallments(installments.map((inst, i) => ({
                      ...inst,
                      amount: parseFloat(amountPerInstallment.toFixed(2)),
                    })));
                  }}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Стойност (с отстъпка):
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 border rounded-md"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Отстъпка валидна до:
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border rounded-md"
                  value={discountValidUntil}
                  onChange={(e) => setDiscountValidUntil(e.target.value)}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">
                  Краен срок за плащане: <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border rounded-md"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {/* Bottom button */}
            <div className="flex justify-end pt-4 border-t">
              <Button 
                onClick={handleNextTab}
                className="bg-teal-600 hover:bg-teal-700"
              >
                <Check className="h-4 w-4 mr-2" />
                Запази и премини
              </Button>
            </div>
          </TabsContent>

          {/* Методи на плащане */}
          <TabsContent value="methods" className="space-y-4 mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-md">
                <span className="font-medium">В брой:</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={methodCash ? "default" : "secondary"}
                    className={methodCash ? "bg-teal-500 hover:bg-teal-600 text-white" : ""}
                    onClick={() => setMethodCash(true)}
                  >
                    ДА
                  </Button>
                  <Button
                    size="sm"
                    variant={!methodCash ? "default" : "secondary"}
                    className={!methodCash ? "bg-red-500 hover:bg-red-600 text-white" : ""}
                    onClick={() => setMethodCash(false)}
                  >
                    НЕ
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-md">
                <span className="font-medium">Онлайн:</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={methodOnline ? "default" : "secondary"}
                    className={methodOnline ? "bg-teal-500 hover:bg-teal-600 text-white" : ""}
                    onClick={() => setMethodOnline(true)}
                  >
                    ДА
                  </Button>
                  <Button
                    size="sm"
                    variant={!methodOnline ? "default" : "secondary"}
                    className={!methodOnline ? "bg-red-500 hover:bg-red-600 text-white" : ""}
                    onClick={() => setMethodOnline(false)}
                  >
                    НЕ
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-md">
                <span className="font-medium">По банков път:</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={methodBank ? "default" : "secondary"}
                    className={methodBank ? "bg-teal-500 hover:bg-teal-600 text-white" : ""}
                    onClick={() => setMethodBank(true)}
                  >
                    ДА
                  </Button>
                  <Button
                    size="sm"
                    variant={!methodBank ? "default" : "secondary"}
                    className={!methodBank ? "bg-red-500 hover:bg-red-600 text-white" : ""}
                    onClick={() => setMethodBank(false)}
                  >
                    НЕ
                  </Button>
                </div>
              </div>

              {/* Bank details fields */}
              {methodBank && (
                <>
                  <div className="flex items-center gap-4 p-4 border rounded-md">
                    <label className="font-medium min-w-[180px]">По сметка:</label>
                    <select
                      className="flex-1 px-3 py-2 border rounded-md"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                    >
                      <option value="">Изберете...</option>
                      {bankAccounts.map((account) => (
                        <option key={account._id} value={account._id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2 p-4 border rounded-md">
                    <label className="font-medium block">Описание на превода:</label>
                    <textarea
                      className="w-full px-3 py-2 border rounded-md"
                      rows={3}
                      value={bankTransferDescription}
                      onChange={(e) => setBankTransferDescription(e.target.value)}
                      placeholder="Въведете описание..."
                    />
                  </div>
                </>
              )}
            </div>

            {/* Bottom button */}
            <div className="flex justify-end pt-4 border-t">
              <Button 
                onClick={handleNextTab}
                className="bg-teal-600 hover:bg-teal-700"
              >
                <Check className="h-4 w-4 mr-2" />
                Запази и премини
              </Button>
            </div>
          </TabsContent>

          {/* Вноски */}
          <TabsContent value="installments" className="space-y-4 mt-6">
            <div className="flex items-center gap-2 mb-4">
              <label className="font-medium">Брой вноски <span className="text-red-500">*</span></label>
              <Button
                size="sm"
                variant="secondary"
                className="bg-blue-500 text-white hover:bg-blue-600"
                onClick={() => handleInstallmentsCountChange(1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <span className="px-4 py-1 border rounded">{installmentsCount}</span>
              <Button
                size="sm"
                variant="secondary"
                className="bg-red-500 text-white hover:bg-red-600"
                onClick={() => handleInstallmentsCountChange(-1)}
              >
                <Minus className="h-4 w-4" />
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium">Изтрий</th>
                    <th className="text-left py-3 px-4 font-medium">Вноска</th>
                    <th className="text-left py-3 px-4 font-medium">Сума</th>
                    <th className="text-left py-3 px-4 font-medium">Краен срок</th>
                  </tr>
                </thead>
                <tbody>
                  {installments.map((inst, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="py-2 px-4">
                        {installments.length > 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 bg-red-500 hover:bg-red-600 text-white"
                            onClick={() => removeInstallment(idx)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                      <td className="py-2 px-4">{inst.index}</td>
                      <td className="py-2 px-4">
                        <input
                          type="text"
                          className="w-full px-2 py-1 border rounded"
                          value={inst.amount || ""}
                          onChange={(e) =>
                            updateInstallment(idx, "amount", e.target.value)
                          }
                          placeholder="Сума"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <input
                          type="date"
                          className="w-full px-2 py-1 border rounded"
                          value={inst.dueDate}
                          onChange={(e) =>
                            updateInstallment(idx, "dueDate", e.target.value)
                          }
                          placeholder="До дата"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 bg-muted/50">
                  <tr>
                    <td className="py-3 px-4 font-semibold" colSpan={2}>Общо</td>
                    <td className="py-3 px-4 font-semibold">{installmentsCount}</td>
                    <td className="py-3 px-4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Bottom button */}
            <div className="flex justify-end pt-4 border-t">
              <Button 
                onClick={handleNextTab}
                className="bg-teal-600 hover:bg-teal-700"
              >
                <Check className="h-4 w-4 mr-2" />
                Запази и премини
              </Button>
            </div>
          </TabsContent>

          {/* Задължени лица */}
          <TabsContent value="users" className="space-y-4 mt-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800">
                Плащанията се записват на ученик. Всеки родител вижда и може да заплати начислените плащания на неговото дете.
              </p>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">Клас</label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={filterGrade}
                  onChange={(e) => setFilterGrade(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Всички</option>
                  {uniqueGrades.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Паралелка</label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={filterClassId}
                  onChange={(e) =>
                    setFilterClassId(
                      e.target.value ? (e.target.value as Id<"classes">) : ""
                    )
                  }
                >
                  <option value="">Всички</option>
                  {allClasses
                    .filter((c) => !filterGrade || c.grade === filterGrade)
                    .map((cls) => (
                      <option key={cls._id} value={cls._id}>
                        {cls.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Потребителска група</label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={filterGroup}
                  onChange={(e) => setFilterGroup(e.target.value)}
                >
                  <option value="">Всички</option>
                </select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="secondary"
                  className="w-full bg-red-500 hover:bg-red-600 text-white"
                  onClick={handleClearFilters}
                >
                  <X className="h-4 w-4 mr-2" />
                  Изчисти
                </Button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Търсене по име:</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-md"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Търсене..."
              />
            </div>

            <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium w-12"></th>
                    <th className="text-left py-3 px-4 font-medium">Име</th>
                    <th className="text-left py-3 px-4 font-medium">Роля</th>
                    <th className="text-left py-3 px-4 font-medium">Паралелка</th>
                    <th className="text-left py-3 px-4 font-medium">Вноски</th>
                    <th className="text-left py-3 px-4 font-medium">Сума</th>
                    <th className="text-left py-3 px-4 font-medium w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student._id} className="border-t hover:bg-muted/50">
                      <td className="py-2 px-4">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.has(student.userId)}
                          onChange={() => handleToggleUser(student.userId)}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                          {student.userName}
                        </div>
                      </td>
                      <td className="py-2 px-4">Ученик</td>
                      <td className="py-2 px-4">{student.className}</td>
                      <td className="py-2 px-4">{installmentsCount}</td>
                      <td className="py-2 px-4">0</td>
                      <td className="py-2 px-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 bg-blue-500 hover:bg-blue-600 text-white"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-sm text-muted-foreground mt-2">
              Показване на резултати от 0 до {filteredStudents.length} от общо {filteredStudents.length}
            </div>

            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <div className="font-medium mb-2">
                Избрани потребители: {selectedUserIds.size}
              </div>
            </div>

            {/* Bottom button */}
            <div className="flex justify-end pt-4 border-t">
              <Button 
                onClick={() => handleSave(true)}
                className="bg-teal-600 hover:bg-teal-700"
              >
                <Check className="h-4 w-4 mr-2" />
                Запази и добави
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

export default function AddFee() {
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
        <AddFeeInner />
      </Authenticated>
    </>
  );
}
