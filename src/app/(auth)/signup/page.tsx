import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/SignupForm";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Sign up — TechValley Jira Lite",
};

export default async function SignupPage() {
  const t = await getT();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{t("auth.signupTitle")}</h1>
      <SignupForm />
      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
        {t("auth.or")}
        <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
      </div>
      <GoogleSignInButton />
    </div>
  );
}
