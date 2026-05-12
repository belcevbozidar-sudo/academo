import { useState } from "react";
import { useMutation } from "@/lib/convex-preview";
import { api } from "@/convex/_generated/api.js";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function Enable2FAPage() {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const sendTwoFactorCode = useMutation(api.users.sendTwoFactorCode);
  const verifyTwoFactorCode = useMutation(api.users.verifyTwoFactorCode);

  const [codeSent, setCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  const handleSendCode = async () => {
    try {
      await sendTwoFactorCode();
      setCodeSent(true);
      toast.success(t("toast.codeSent"));
    } catch (error) {
      toast.error(t("toast.codeSendError"));
    }
  };

  const handleVerifyCode = async () => {
    try {
      const success = await verifyTwoFactorCode({ code: verificationCode });
      if (success) {
        toast.success(t("toast.2faEnabled"));
        navigate("/bg/profile");
      } else {
        toast.error(t("toast.invalidCode"));
      }
    } catch (error) {
      toast.error(t("toast.2faError"));
    }
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("profile.2fa.enableDialog.title")}</h1>
          <Button variant="outline" onClick={() => navigate("/bg/profile")}>
            Отказ
          </Button>
        </div>

        <div className="bg-background border rounded-lg p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("profile.2fa.enableDialog.description")}
          </p>

          {!codeSent ? (
            <Button onClick={handleSendCode} className="w-full">
              {t("profile.2fa.enableDialog.sendCode")}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verificationCode">{t("profile.2fa.enableDialog.code")}</Label>
                <Input
                  id="verificationCode"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="123456"
                />
              </div>
            </div>
          )}
        </div>

        {codeSent && (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                navigate("/bg/profile");
              }}
            >
              {t("buttons.cancel")}
            </Button>
            <Button onClick={handleVerifyCode}>{t("profile.2fa.enableDialog.verify")}</Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
