import { useMutation, useQuery } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "@/lib/convex-preview";
import Layout from "@/components/Layout.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useNavigate, useParams } from "react-router-dom";
import { Edit, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";

function AllBankAccountsInner() {
  const navigate = useNavigate();
  const { lng } = useParams<{ lng: string }>();
  const bankAccounts = useQuery(api.fees.listBankAccounts, {});
  const removeBankAccount = useMutation(api.fees.removeBankAccount);
  const [searchTerm, setSearchTerm] = useState("");

  if (bankAccounts === undefined) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const filteredAccounts = bankAccounts.filter((account) =>
    Object.values(account).some((value) =>
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const handleEdit = (id: Id<"bankAccounts">) => {
    navigate(`/${lng}/fees/bank-accounts/${id}/edit`);
  };

  const handleCopy = async (account: { iban: string }) => {
    try {
      await navigator.clipboard.writeText(account.iban);
      toast.success("IBAN копиран успешно");
    } catch (error) {
      toast.error("Грешка при копиране на IBAN");
    }
  };

  const handleDelete = async (id: Id<"bankAccounts">) => {
    if (!confirm("Сигурни ли сте, че искате да изтриете тази банкова сметка?")) {
      return;
    }
    try {
      await removeBankAccount({ id });
      toast.success("Банковата сметка е изтрита успешно");
    } catch (error) {
      const err = error as Error;
      toast.error(`Грешка: ${err.message}`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    toast.info("PDF експортът скоро ще бъде наличен");
  };

  const handleExportExcel = () => {
    // Simple CSV export (Excel compatible)
    const headers = ["Име на сметка", "IBAN", "Банка на получателя"];
    const rows = filteredAccounts.map((account) => [
      account.name,
      account.iban,
      account.bank,
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "banкови_сметки.csv";
    link.click();
  };

  const handleExportCSV = () => {
    handleExportExcel();
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
            <h1 className="text-2xl font-bold">Всички банкови сметки</h1>
          </div>
          <Button
            onClick={() => navigate(`/${lng}/fees/bank-accounts/add`)}
            className="bg-cyan-500 hover:bg-cyan-600"
          >
            Добави
          </Button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>Принтирай</Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>PDF</Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>Excel</Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>CSV</Button>
        </div>

        {/* Search */}
        <div className="flex items-center justify-between">
          <span>Търсене:</span>
          <input
            type="text"
            className="px-3 py-2 border rounded-md w-64"
            placeholder="Търсене..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left py-3 px-4 font-medium">Име на сметка</th>
                <th className="text-left py-3 px-4 font-medium">IBAN</th>
                <th className="text-left py-3 px-4 font-medium">Банка на получателя</th>
                <th className="text-left py-3 px-4 font-medium">Брой такси</th>
                <th className="text-left py-3 px-4 font-medium">Операции</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    {searchTerm ? "Няма резултати" : "Няма налични банкови сметки"}
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((account) => (
                  <tr key={account._id} className="border-t hover:bg-muted/50">
                    <td className="py-3 px-4">{account.name}</td>
                    <td className="py-3 px-4">{account.iban}</td>
                    <td className="py-3 px-4">{account.bank}</td>
                    <td className="py-3 px-4">0</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => handleEdit(account._id)}
                        >
                          <Edit className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => handleCopy(account)}
                        >
                          <Copy className="h-4 w-4 text-green-500" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => handleDelete(account._id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="text-sm text-muted-foreground">
          Показване на резултати от 1 до {filteredAccounts.length} от общо {bankAccounts.length}
        </div>
      </div>
    </Layout>
  );
}

export default function AllBankAccounts() {
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
        <AllBankAccountsInner />
      </Authenticated>
    </>
  );
}
