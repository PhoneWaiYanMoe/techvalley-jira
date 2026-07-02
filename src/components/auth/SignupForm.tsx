"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { signupSchema } from "@/validation/auth.schema";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setNotice(null);

    const parsed = signupSchema.safeParse({ name, email, password });
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
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { name: parsed.data.name } },
    });

    setSubmitting(false);

    if (error) {
      setFormError(
        error.message.toLowerCase().includes("already registered")
          ? "An account with this email already exists."
          : error.message,
      );
      return;
    }

    if (data.session) {
      router.push("/dashboard");
      return;
    }

    // Supabase doesn't return an error for a duplicate signup (by design, to
    // avoid leaking which emails are registered) — instead it returns a user
    // object with an empty `identities` array. That's the documented signal
    // to distinguish this from a genuine new signup pending confirmation.
    if (data.user && data.user.identities?.length === 0) {
      setFormError(
        "This email may already be registered. Try logging in, or use \"Forgot password\" if you don't remember your password.",
      );
      return;
    }

    // Email confirmation is enabled — no session yet.
    setNotice("Check your email to confirm your account before logging in.");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        id="name"
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        maxLength={50}
        required
      />
      <Input
        id="email"
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
        maxLength={255}
        required
      />
      <Input
        id="password"
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
        minLength={6}
        maxLength={100}
        required
      />
      {formError && <p className="text-sm text-red-600">{formError}</p>}
      {notice && <p className="text-sm text-green-600">{notice}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Creating account…" : "Sign up"}
      </Button>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
