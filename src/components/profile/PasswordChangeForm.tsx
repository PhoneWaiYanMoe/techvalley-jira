"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { changePasswordSchema } from "@/validation/profile.schema";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function PasswordChangeForm({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (disabled) {
    return (
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Password change is disabled for accounts that signed up via Google only.
      </p>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = changePasswordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword,
    });
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

    const res = await fetch("/api/profile/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });

    if (!res.ok) {
      setSubmitting(false);
      const body = await res.json().catch(() => null);
      setFormError(body?.error?.message ?? "Failed to change password");
      return;
    }

    // Changing the password invalidates the current session server-side, so
    // staying on the page would leave the user looking "logged in" until the
    // next navigation silently bounced them to /login with no explanation.
    // Sign out and redirect immediately instead, same pattern as the
    // forgot-password reset flow.
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login?passwordChanged=true");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        id="currentPassword"
        label="Current password"
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        error={fieldErrors.currentPassword}
        required
      />
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
      <Button type="submit" disabled={submitting} className="self-start">
        {submitting ? "Changing…" : "Change password"}
      </Button>
    </form>
  );
}
