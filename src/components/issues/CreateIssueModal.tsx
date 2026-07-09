"use client";

import { useEffect, useState } from "react";
import type { IssueResponse, LabelResponse, TeamMemberResponse } from "@/types/api";
import { LabelPicker } from "@/components/labels/LabelPicker";

const selectClass =
  "w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[13px] text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:ring-neutral-600";

export function CreateIssueModal({
  projectId,
  teamId,
  onClose,
  onCreated,
}: {
  projectId: string;
  teamId: string;
  onClose: () => void;
  onCreated: (issue: IssueResponse) => void;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [members, setMembers] = useState<TeamMemberResponse[]>([]);
  const [labels, setLabels] = useState<LabelResponse[]>([]);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // FR-034: assignee options are the project's team members only
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/teams/${teamId}/members`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json: { data?: TeamMemberResponse[] }) => {
        if (!cancelled) setMembers(json.data ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  // FR-038: project labels available to attach
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/labels`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: LabelResponse[]) => {
        if (!cancelled) setLabels(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const disabled = !title.trim() || submitting;

  async function handleCreate() {
    if (disabled) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: desc.trim() || undefined,
          priority,
          assigneeUserId: assigneeId || undefined,
          dueDate: dueDate || undefined,
          labelIds: labelIds.length > 0 ? labelIds : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Failed to create issue");
      }

      const issue: IssueResponse = await res.json();
      onCreated(issue);
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
        className="max-h-[calc(100vh-40px)] w-[460px] max-w-[calc(100vw-40px)] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-6 shadow-2xl animate-[popIn_.24s_cubic-bezier(.2,.7,.2,1)] dark:border-neutral-800 dark:bg-neutral-900"
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">New issue</h2>
          <button
            onClick={onClose}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Title */}
        <label className="mb-1.5 block text-xs font-bold text-neutral-500">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Fix login redirect loop"
          maxLength={200}
          className="mb-1 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[13.5px] text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:ring-neutral-600"
        />
        <div className="mb-3.5 text-right font-mono text-[10.5px] text-neutral-400">
          {title.length}/200
        </div>

        {/* Description */}
        <label className="mb-1.5 block text-xs font-bold text-neutral-500">
          Description <span className="font-normal text-neutral-400">· optional</span>
        </label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Details, context, acceptance criteria…"
          maxLength={5000}
          rows={3}
          className="mb-4 w-full resize-y rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[13px] leading-relaxed text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:ring-neutral-600"
        />

        {/* Priority + Due date */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-neutral-500">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as "HIGH" | "MEDIUM" | "LOW")}
              className={selectClass}
            >
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-neutral-500">
              Due date <span className="font-normal text-neutral-400">· optional</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={selectClass}
            />
          </div>
        </div>

        {/* Assignee (team members only, FR-034) */}
        <label className="mb-1.5 block text-xs font-bold text-neutral-500">
          Assignee <span className="font-normal text-neutral-400">· optional</span>
        </label>
        <select
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          className={`${selectClass} mb-5`}
        >
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </select>

        {/* Labels (FR-038) */}
        <label className="mb-1.5 block text-xs font-bold text-neutral-500">
          Labels <span className="font-normal text-neutral-400">· optional</span>
        </label>
        <div className="mb-5">
          <LabelPicker
            projectId={projectId}
            available={labels}
            selectedIds={labelIds}
            onChange={setLabelIds}
            onCreated={(label) => setLabels((prev) => [...prev, label])}
          />
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
            {submitting ? "Creating…" : "Create issue"}
          </button>
        </div>
      </div>
    </div>
  );
}
