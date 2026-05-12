import { useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function Disable2FAPage() {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const disableTwoFactor = useMutation(api.users.disableTwoFactor);

  const handleDisable = async () => {
    try {
      await disableTwoFactor();
      toast.success(t("toast.2faDisabled"));
      navigate("/bg/profile");
    } catch (error) {
      toast.error(t("toast.2faError"));
    }
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("profile.2fa.disableDialog.title")}</h1>
          <Button variant="outline" onClick={() => navigate("/bg/profile")}>
            Отказ
          </Button>
        </div>

        <div className="bg-background border rounded-lg p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("profile.2fa.disableDialog.description")}
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate("/bg/profile")}>
            {t("buttons.cancel")}
          </Button>
          <Button variant="destructive" onClick={handleDisable}>
            {t("profile.2fa.disableDialog.confirm")}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
