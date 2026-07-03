"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { forgotPasswordSchema } from "@/validation/auth.schema";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldErrors({ email: parsed.error.issues[0].message });
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setSubmitting(false);

    // Always show the same success state regardless of whether the email
    // exists — same anti-enumeration reasoning as the signup duplicate check.
    if (error) {
      setFormError(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <p className="text-sm text-green-600">
        If an account exists for that email, a password reset link has been sent.
        The link expires in 1 hour.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        id="email"
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
        required
      />
      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        <Link href="/login" className="underline">
          Back to log in
        </Link>
      </p>
    </form>
  );
}
