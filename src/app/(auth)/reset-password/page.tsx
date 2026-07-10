import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Set new password — TechValley Jira Lite",
};

export default async function ResetPasswordPage() {
  const t = await getT();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{t("auth.resetTitle")}</h1>
      <ResetPasswordForm />
    </div>
  );
}
