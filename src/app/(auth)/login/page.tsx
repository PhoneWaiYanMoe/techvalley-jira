import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Log in — TechValley Jira Lite",
};

export default async function LoginPage() {
  const t = await getT();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{t("auth.loginTitle")}</h1>
      <Suspense>
        <LoginForm />
      </Suspense>
      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
        {t("auth.or")}
        <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
      </div>
      <GoogleSignInButton />
    </div>
  );
}
