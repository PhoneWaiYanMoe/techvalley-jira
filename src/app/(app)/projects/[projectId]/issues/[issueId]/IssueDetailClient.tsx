"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  IssueDetailResponse,
  IssueResponse,
  IssueStatusOption,
  LabelResponse,
  TeamMemberResponse,
} from "@/types/api";
import { ProjectTabs } from "@/components/projects/ProjectTabs";
import { PriorityDot, DueBadge } from "@/components/issues/IssueBadges";
import { LabelPicker } from "@/components/labels/LabelPicker";
import { SubtaskList } from "@/components/subtasks/SubtaskList";
import { IssueHistory } from "@/components/issues/IssueHistory";
import type { SubtaskResponse } from "@/types/api";
import type { UpdateIssueInput } from "@/validation/issue.schema";

const controlClass =
  "w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-900 outline-none focus:ring-2 focus:ring-neutral-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:ring-neutral-600";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function IssueDetailClient({
  projectId,
  issueId,
}: {
  projectId: string;
  issueId: string;
}) {
  const router = useRouter();
  const [issue, setIssue] = useState<IssueDetailResponse | null>(null);
  const [statuses, setStatuses] = useState<IssueStatusOption[]>([]);
  const [members, setMembers] = useState<TeamMemberResponse[]>([]);
  const [availableLabels, setAvailableLabels] = useState<LabelResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Title / description edit state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [descDirty, setDescDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [issueRes, statusRes, labelRes] = await Promise.all([
        fetch(`/api/issues/${issueId}`),
        fetch(`/api/projects/${projectId}/statuses`),
        fetch(`/api/projects/${projectId}/labels`),
      ]);
      if (!issueRes.ok) {
        const d = await issueRes.json();
        throw new Error(d.error?.message ?? "Failed to load issue");
      }
      const detail: IssueDetailResponse = await issueRes.json();
      setIssue(detail);
      setDescDraft(detail.description ?? "");
      if (statusRes.ok) setStatuses(await statusRes.json());
      if (labelRes.ok) setAvailableLabels(await labelRes.json());

      // Assignee options = the project's team members (FR-034)
      const memberRes = await fetch(`/api/teams/${detail.teamId}/members`);
      if (memberRes.ok) {
        const json: { data?: TeamMemberResponse[] } = await memberRes.json();
        setMembers(json.data ?? []);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [issueId, projectId]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const readOnly = issue?.projectArchived ?? false;

  async function patchIssue(input: UpdateIssueInput) {
    if (!issue || readOnly) return;
    const prev = issue;
    setSaveError(null);

    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error?.message ?? "Failed to save");
      }
      const updated: IssueResponse = await res.json();
      setIssue({
        ...prev,
        ...updated,
        description: input.description !== undefined ? input.description : prev.description,
      });
    } catch (err) {
      setIssue(prev);
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handleDelete() {
    if (!issue || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/issues/${issueId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error?.message ?? "Failed to delete issue");
      }
      router.push(`/projects/${projectId}/issues`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to delete issue");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  // FR-038: replace-set the issue's labels.
  async function handleLabelsChange(ids: string[]) {
    if (!issue || readOnly) return;
    const prev = issue;
    const nextLabels = availableLabels.filter((l) => ids.includes(l.id));
    setIssue({ ...issue, labels: nextLabels });
    setSaveError(null);
    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelIds: ids }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error?.message ?? "Failed to update labels");
      }
    } catch (err) {
      setIssue(prev);
      setSaveError(err instanceof Error ? err.message : "Failed to update labels");
    }
  }

  function saveTitle() {
    setEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (issue && trimmed && trimmed !== issue.title) {
      void patchIssue({ title: trimmed });
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-indigo-600" />
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-600">{error ?? "Issue not found"}</p>
      </div>
    );
  }

  return (
    <div className="p-6 pb-10">
      {/* Back button + tabs */}
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => router.push(`/projects/${projectId}/issues`)}
          className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 shadow-sm transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Issues
        </button>
        <ProjectTabs projectId={projectId} />
        <span className="truncate text-xs text-neutral-400">{issue.projectName}</span>
      </div>

      {readOnly && (
        <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-400">
          This project is archived — the issue is read-only.
        </div>
      )}

      {saveError && (
        <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2.5 text-[12px] font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-400">
          {saveError}
        </div>
      )}

      <div className="grid grid-cols-[1.15fr_1fr] gap-4 max-lg:grid-cols-1">
        {/* Main column */}
        <div className="flex flex-col gap-4">
          {/* Title + description */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            {editingTitle && !readOnly ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                maxLength={200}
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-lg font-bold tracking-tight outline-none focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:focus:ring-neutral-600"
              />
            ) : (
              <h1
                onClick={() => {
                  if (readOnly) return;
                  setTitleDraft(issue.title);
                  setEditingTitle(true);
                }}
                title={readOnly ? undefined : "Click to edit"}
                className={`text-lg font-bold tracking-tight ${readOnly ? "" : "cursor-text rounded-lg -mx-1 px-1 hover:bg-neutral-50 dark:hover:bg-neutral-800"}`}
              >
                {issue.title}
              </h1>
            )}

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-bold text-neutral-500">Description</label>
              <textarea
                value={descDraft}
                onChange={(e) => {
                  setDescDraft(e.target.value);
                  setDescDirty(true);
                }}
                disabled={readOnly}
                placeholder="No description yet."
                maxLength={5000}
                rows={6}
                className={`${controlClass} resize-y leading-relaxed`}
              />
              {descDirty && !readOnly && (
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setDescDraft(issue.description ?? "");
                      setDescDirty(false);
                    }}
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
                  >
                    Discard
                  </button>
                  <button
                    onClick={() => {
                      setDescDirty(false);
                      void patchIssue({ description: descDraft.trim() || null });
                    }}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm"
                  >
                    Save description
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Subtasks — FR-039-2 */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <SubtaskList
              issueId={issueId}
              subtasks={issue.subtasks}
              setSubtasks={(subtasks: SubtaskResponse[]) => setIssue({ ...issue, subtasks })}
              readOnly={readOnly}
            />
          </div>

          {/* Comments — FR-060..063, Day 5 */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-[13.5px] font-bold">
              Comments{" "}
              <span className="font-mono text-[11px] font-normal text-neutral-400">
                {issue.commentCount}
              </span>
            </h2>
            <p className="mt-2 text-[12.8px] text-neutral-400">Comments coming soon.</p>
          </div>

          {/* Change history — FR-039 */}
          <IssueHistory issueId={issueId} />
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="mb-4 text-[13.5px] font-bold">Details</h2>

            <div className="flex flex-col gap-3.5">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-neutral-500">Status</label>
                <select
                  value={issue.status.id}
                  onChange={(e) => void patchIssue({ statusId: e.target.value })}
                  disabled={readOnly}
                  className={controlClass}
                >
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-neutral-500">Assignee</label>
                <select
                  value={issue.assignee?.id ?? ""}
                  onChange={(e) => void patchIssue({ assigneeUserId: e.target.value || null })}
                  disabled={readOnly}
                  className={controlClass}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-bold text-neutral-500">
                  Priority <PriorityDot priority={issue.priority} />
                </label>
                <select
                  value={issue.priority}
                  onChange={(e) =>
                    void patchIssue({ priority: e.target.value as "HIGH" | "MEDIUM" | "LOW" })
                  }
                  disabled={readOnly}
                  className={controlClass}
                >
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-2 text-xs font-bold text-neutral-500">
                  Due date <DueBadge dueDate={issue.dueDate} />
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={issue.dueDate ?? ""}
                    onChange={(e) => void patchIssue({ dueDate: e.target.value || null })}
                    disabled={readOnly}
                    className={controlClass}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-neutral-500">Labels</label>
                <LabelPicker
                  projectId={projectId}
                  available={availableLabels}
                  selectedIds={issue.labels.map((l) => l.id)}
                  onChange={(ids) => void handleLabelsChange(ids)}
                  onCreated={(label) => setAvailableLabels((prev) => [...prev, label])}
                  disabled={readOnly}
                />
              </div>

              <div className="border-t border-neutral-100 pt-3.5 dark:border-neutral-800">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-bold text-neutral-500">Created by</span>
                  <span className="font-semibold">{issue.creator.name}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[12px]">
                  <span className="font-bold text-neutral-500">Created</span>
                  <span className="font-mono text-neutral-400">{formatDate(issue.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* AI — FR-040/041, Day 5 */}
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="mb-3 text-[13.5px] font-bold">AI</h2>
            <div className="flex gap-2">
              <button
                disabled
                title="Coming soon (FR-040)"
                className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[12px] font-semibold text-neutral-400 disabled:cursor-not-allowed dark:border-neutral-700 dark:bg-neutral-800"
              >
                ✦ AI Summary
              </button>
              <button
                disabled
                title="Coming soon (FR-041)"
                className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[12px] font-semibold text-neutral-400 disabled:cursor-not-allowed dark:border-neutral-700 dark:bg-neutral-800"
              >
                ✦ AI Suggestion
              </button>
            </div>
          </div>

          {/* Danger zone — FR-035 */}
          {issue.canDelete && !readOnly && (
            <div className="rounded-xl border border-rose-200 bg-white p-5 shadow-sm dark:border-rose-900 dark:bg-neutral-900">
              <h2 className="mb-3 text-[13.5px] font-bold text-rose-600">Danger zone</h2>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-lg bg-rose-600 px-3 py-2 text-[12px] font-bold text-white shadow-sm disabled:opacity-60"
                  >
                    {deleting ? "Deleting…" : "Confirm delete"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-[12px] font-semibold text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-600 dark:border-rose-900 dark:bg-rose-950"
                >
                  Delete issue
                </button>
              )}
              <p className="mt-2.5 text-[11.5px] text-neutral-400">
                Soft-deletes the issue. Allowed for the issue creator, project owner, and team
                owners/admins.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
