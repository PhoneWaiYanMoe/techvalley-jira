"use client";

import { useState } from "react";
import type { TeamResponse } from "@/types/api";

export function CreateTeamModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (team: TeamResponse) => void;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const nameLen = name.length;
  const disabled = !name.trim() || submitting;

  async function handleCreate() {
    if (disabled) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Failed to create team");
      }

      const team: TeamResponse = await res.json();
      onCreated(team);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
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
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">New team</h2>
          <button
            onClick={onClose}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Name */}
        <label className="mb-1.5 block text-xs font-bold text-neutral-500">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Platform Team"
          maxLength={50}
          className="mb-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[13.5px] text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:ring-neutral-600"
        />
        <div className="mb-4 text-right font-mono text-[10.5px] text-neutral-400">
          {nameLen}/50
        </div>

        {/* Error */}
        {formError && <p className="mb-3 text-sm text-red-600">{formError}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={disabled}
            className="rounded-lg bg-indigo-600 px-4.5 py-2.5 text-[13px] font-bold text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create team"}
          </button>
        </div>
      </div>
    </div>
  );
}
