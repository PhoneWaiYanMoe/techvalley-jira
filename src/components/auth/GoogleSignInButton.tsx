"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/client";

// FR-004: same flow for both login and signup — Supabase auto-registers new
// users and logs in existing ones. Treated as a separate auth method from
// email/password (no account merging), per PRD.
export function GoogleSignInButton() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // On success, the browser is redirected to Google — no further action here.
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="secondary" disabled={loading} onClick={handleClick}>
        {loading ? t("auth.redirecting") : t("auth.continueWithGoogle")}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
