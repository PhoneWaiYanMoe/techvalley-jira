"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTeamSchema } from "@/validation/team.schema";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/client";

export function TeamSettingsForm({ teamId, initialName }: { teamId: string; initialName: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState(initialName);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setNotice(null);

    const parsed = updateTeamSchema.safeParse({ name });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0].message);
      return;
    }
    setFieldError(undefined);
    setSubmitting(true);

    const res = await fetch(`/api/teams/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setFormError(body?.error?.message ?? t("teamSettings.updateFailed"));
      return;
    }

    setNotice(t("teamSettings.updated"));
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <Input
        id="teamName"
        label={t("teamSettings.teamName")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldError}
        maxLength={50}
        required
      />
      {formError && <p className="text-sm text-red-600">{formError}</p>}
      {notice && <p className="text-sm text-green-600">{notice}</p>}
      <Button type="submit" disabled={submitting} className="self-start">
        {submitting ? t("common.saving") : t("profile.saveChanges")}
      </Button>
    </form>
  );
}
