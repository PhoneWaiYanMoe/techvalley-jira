"use client";

import { useState } from "react";
import type { InviteResponse, TeamRole } from "@/types/api";
import { useI18n } from "@/lib/i18n/client";

export function InviteMemberModal({
  teamId,
  onClose,
  onSent,
}: {
  teamId: string;
  onClose: () => void;
  onSent: (invite: InviteResponse) => void;
}) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Extract<TeamRole, "ADMIN" | "MEMBER">>("MEMBER");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const disabled = !email.trim() || submitting;

  async function handleInvite() {
    if (disabled) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/teams/${teamId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? t("members.sendInviteFailed"));
      }

      const invite: InviteResponse = await res.json();
      onSent(invite);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,20,35,.45)] backdrop-blur-sm animate-[fadeIn_.18s_ease]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[460px] max-w-[calc(100vw-40px)] rounded-xl border border-neutral-200 bg-white p-6 shadow-2xl animate-[popIn_.24s_cubic-bezier(.2,.7,.2,1)] dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">{t("members.invite")}</h2>
          <button
            onClick={onClose}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <label className="mb-1.5 block text-xs font-bold text-neutral-500">
          {t("members.email")}
        </label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("members.emailPlaceholder")}
          type="email"
          maxLength={255}
          className="mb-4 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[13.5px] text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:ring-neutral-600"
        />

        <label className="mb-1.5 block text-xs font-bold text-neutral-500">
          {t("members.role")}
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "ADMIN" | "MEMBER")}
          className="mb-4 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[13.5px] text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        >
          <option value="MEMBER">{t("members.roleMember")}</option>
          <option value="ADMIN">{t("members.roleAdmin")}</option>
        </select>

        {formError && <p className="mb-3 text-sm text-red-600">{formError}</p>}

        <div className="flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleInvite}
            disabled={disabled}
            className="rounded-lg bg-indigo-600 px-4.5 py-2.5 text-[13px] font-bold text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? t("auth.sending") : t("members.sendInvite")}
          </button>
        </div>
      </div>
    </div>
  );
}
