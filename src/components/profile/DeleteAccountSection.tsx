"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/client";

export function DeleteAccountSection({ requiresPassword }: { requiresPassword: boolean }) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleDelete() {
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/profile", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requiresPassword ? { password } : {}),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setSubmitting(false);
      setError(body?.error?.message ?? t("profile.deleteFailed"));
      return;
    }

    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-red-600">{t("profile.dangerZone")}</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        {t("profile.deleteWarning")}
      </p>
      <Button variant="danger" className="mt-4" onClick={() => setOpen(true)}>
        {t("profile.deleteAccount")}
      </Button>

      {open && (
        <div
          onClick={() => !submitting && setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,20,35,.45)] backdrop-blur-sm animate-[fadeIn_.18s_ease]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[460px] max-w-[calc(100vw-40px)] rounded-xl border border-neutral-200 bg-white p-6 shadow-2xl animate-[popIn_.24s_cubic-bezier(.2,.7,.2,1)] dark:border-neutral-800 dark:bg-neutral-900"
          >
            <h3 className="text-lg font-semibold">{t("profile.deleteConfirmTitle")}</h3>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {t("profile.deleteCannotUndo")}
              {requiresPassword && ` ${t("profile.deleteEnterPassword")}`}
            </p>
            {requiresPassword && (
              <div className="mt-4">
                <Input
                  id="deletePassword"
                  label={t("auth.password")}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            )}
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" disabled={submitting} onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="danger"
                disabled={submitting || (requiresPassword && !password)}
                onClick={handleDelete}
              >
                {submitting ? t("common.deleting") : t("profile.deleteAccount")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
