import { useState } from "react";
import { useAction } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const changePassword = useAction(api.usersActions.changePasswordAction);

  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const handleSubmit = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(t("toast.passwordsNotMatch"));
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error(t("toast.passwordTooShort"));
      return;
    }
    try {
      await changePassword({ newPassword: passwordForm.newPassword });
      toast.success(t("toast.passwordChanged"));
      navigate("/bg/profile");
    } catch (error) {
      toast.error(t("toast.passwordChangeError"));
    }
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("profile.changePassword")}</h1>
          <Button variant="outline" onClick={() => navigate("/bg/profile")}>
            Отказ
          </Button>
        </div>

        <div className="bg-background border rounded-lg p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">{t("profile.passwordDialog.newPassword")}</Label>
            <Input
              id="newPassword"
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("profile.passwordDialog.confirmPassword")}</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate("/bg/profile")}>
            {t("buttons.cancel")}
          </Button>
          <Button onClick={handleSubmit}>{t("profile.passwordDialog.changePassword")}</Button>
        </div>
      </div>
    </Layout>
  );
}
