"use client";

import { useState } from "react";
import type { ProjectResponse } from "@/types/api";

export function CreateProjectModal({
  teamId,
  slotsLeft,
  onClose,
  onCreated,
}: {
  teamId: string;
  slotsLeft: number;
  onClose: () => void;
  onCreated: (project: ProjectResponse) => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const nameLen = name.length;
  const disabled = !name.trim() || submitting;

  async function handleCreate() {
    if (disabled) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/teams/${teamId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: desc.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Failed to create project");
      }

      const project: ProjectResponse = await res.json();
      onCreated(project);
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
          <h2 className="text-lg font-bold tracking-tight">New project</h2>
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
          placeholder="e.g. Checkout Redesign"
          maxLength={100}
          className="mb-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[13.5px] text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:ring-neutral-600"
        />
        <div className="mb-3.5 text-right font-mono text-[10.5px] text-neutral-400">
          {nameLen}/100
        </div>

        {/* Description */}
        <label className="mb-1.5 block text-xs font-bold text-neutral-500">
          Description <span className="font-normal text-neutral-400">· optional</span>
        </label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="What is this project about?"
          maxLength={2000}
          rows={3}
          className="mb-4 w-full resize-y rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[13px] leading-relaxed text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:ring-neutral-600"
        />

        {/* Slot indicator */}
        <div className="mb-5 flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2.5 text-[11.5px] font-semibold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
          </svg>
          {slotsLeft} of 15 project slots remaining on this team
        </div>

        {/* Error */}
        {formError && (
          <p className="mb-3 text-sm text-red-600">{formError}</p>
        )}

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
            {submitting ? "Creating…" : "Create project"}
          </button>
        </div>
      </div>
    </div>
  );
}
