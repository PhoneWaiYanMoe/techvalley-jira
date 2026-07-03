"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { resetPasswordSchema } from "@/validation/auth.schema";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type LinkState = "verifying" | "ready" | "invalid";

export function ResetPasswordForm() {
  const router = useRouter();
  const [linkState, setLinkState] = useState<LinkState>("verifying");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // Supabase's recovery email link uses the older implicit/hash-token flow
    // (#access_token=...&refresh_token=...&type=recovery), not the PKCE
    // ?code= flow. @supabase/ssr's browser client is built around PKCE and
    // doesn't reliably auto-detect hash tokens, so parse and set the session
    // explicitly rather than waiting on a PASSWORD_RECOVERY event that may
    // never fire.
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    if (accessToken && refreshToken && hashParams.get("type") === "recovery") {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(
        ({ error }) => {
          if (error) {
            setLinkState("invalid");
          } else {
            // Drop the tokens from the visible URL now that they're in the session.
            window.history.replaceState(null, "", window.location.pathname);
            setLinkState("ready");
          }
        },
      );
      return;
    }

    // No hash tokens present — maybe a reload after setSession already ran,
    // or the PKCE flow (a session already exists). Fall back to checking.
    supabase.auth.getSession().then(({ data }) => {
      setLinkState(data.session ? "ready" : "invalid");
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = resetPasswordSchema.safeParse({ newPassword, confirmPassword });
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
    const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });

    if (error) {
      setSubmitting(false);
      setFormError(error.message);
      return;
    }

    await supabase.auth.signOut();
    router.push("/login?reset=success");
  }

  if (linkState === "verifying") {
    return (
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Verifying your reset link…
      </p>
    );
  }

  if (linkState === "invalid") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-red-600">
          This reset link is invalid or has expired.
        </p>
        <Link href="/forgot-password" className="text-sm underline">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        id="newPassword"
        label="New password"
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        error={fieldErrors.newPassword}
        minLength={6}
        maxLength={100}
        required
      />
      <Input
        id="confirmPassword"
        label="Confirm new password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={fieldErrors.confirmPassword}
        required
      />
      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
