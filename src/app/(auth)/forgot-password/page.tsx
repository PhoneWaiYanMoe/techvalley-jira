import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Forgot password — TechValley Jira Lite",
};

export default async function ForgotPasswordPage() {
  const t = await getT();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{t("auth.forgotTitle")}</h1>
      <ForgotPasswordForm />
    </div>
  );
}
