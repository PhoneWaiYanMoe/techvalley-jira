"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { loginSchema } from "@/validation/auth.schema";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/client";

export function LoginForm() {
  const router = useRouter();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const passwordUpdated =
    searchParams.get("reset") === "success" || searchParams.get("passwordChanged") === "true";
  const oauthError =
    searchParams.get("error") === "oauth_failed"
      ? (searchParams.get("errorMessage") ?? t("auth.googleFailed"))
      : null;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[issue.path[0] as string] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    setSubmitting(false);

    if (error) {
      setFormError(t("auth.invalidCredentials"));
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {passwordUpdated && (
        <p className="text-sm text-green-600">{t("auth.passwordUpdated")}</p>
      )}
      {oauthError && <p className="text-sm text-red-600">{oauthError}</p>}
      <Input
        id="email"
        label={t("auth.email")}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
        required
      />
      <Input
        id="password"
        label={t("auth.password")}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
        required
      />
      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? t("auth.loggingIn") : t("auth.login")}
      </Button>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        <Link href="/forgot-password" className="underline">
          {t("auth.forgotPassword")}
        </Link>
      </p>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {t("auth.noAccount")}{" "}
        <Link href="/signup" className="font-medium underline">
          {t("auth.signup")}
        </Link>
      </p>
    </form>
  );
}
