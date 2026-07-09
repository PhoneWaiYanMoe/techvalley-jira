"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import type { CommentResponse, CommentListResponse } from "@/types/api";

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CommentList({
  issueId,
  readOnly,
  initialCount,
  onCountChange,
}: {
  issueId: string;
  readOnly: boolean;
  initialCount: number;
  onCountChange?: (count: number) => void;
}) {
  const [comments, setComments] = useState<CommentResponse[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function setCountBoth(next: number) {
    setCount(next);
    onCountChange?.(next);
  }

  async function fetchPage(cursor?: string) {
    if (cursor) setLoading(true);
    try {
      const url = `/api/issues/${issueId}/comments${cursor ? `?cursor=${cursor}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load comments");
      const data: CommentListResponse = await res.json();
      setComments((prev) => (cursor ? [...prev, ...data.data] : data.data));
      setNextCursor(data.nextCursor);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      await fetchPage();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId]);

  async function post() {
    const content = draft.trim();
    if (!content || posting) return;
    setPosting(true);
    setErr(null);
    try {
      const res = await fetch(`/api/issues/${issueId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error?.message ?? "Failed to post comment");
      }
      const created: CommentResponse = await res.json();
      // Only append when the newest page is already loaded (no gap), otherwise
      // the load-more flow will surface it in order.
      if (!nextCursor) setComments((prev) => [...prev, created]);
      setCountBoth(count + 1);
      setDraft("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to post comment");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-[13.5px] font-bold">Comments</h2>
        <span className="font-mono text-[11px] text-neutral-400">{count}</span>
      </div>

      {err && <p className="mb-2 text-[11.5px] font-semibold text-rose-600">{err}</p>}

      {nextCursor && (
        <button
          onClick={() => void fetchPage(nextCursor)}
          disabled={loading}
          className="mb-3 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-neutral-500 hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
        >
          {loading ? "Loading…" : "Load earlier comments"}
        </button>
      )}

      {loading && comments.length === 0 ? (
        <p className="py-2 text-[12.5px] text-neutral-400">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="py-2 text-[12.5px] text-neutral-400">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              readOnly={readOnly}
              onUpdated={(updated) =>
                setComments((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
              }
              onDeleted={(id) => {
                setComments((prev) => prev.filter((x) => x.id !== id));
                setCountBoth(count - 1);
              }}
            />
          ))}
        </ul>
      )}

      {!readOnly && (
        <div className="mt-4">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Add a comment…"
            className="w-full resize-y rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[12.8px] outline-none focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:focus:ring-neutral-600"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="font-mono text-[10.5px] text-neutral-400">{draft.length}/1000</span>
            <button
              onClick={() => void post()}
              disabled={!draft.trim() || posting}
              className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-[12px] font-bold text-white disabled:opacity-60"
            >
              {posting ? "Posting…" : "Comment"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  readOnly,
  onUpdated,
  onDeleted,
}: {
  comment: CommentResponse;
  readOnly: boolean;
  onUpdated: (c: CommentResponse) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(comment.content);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const content = value.trim();
    if (!content || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error?.message ?? "Failed to save comment");
      }
      const updated: CommentResponse = await res.json();
      onUpdated(updated);
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save comment");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/comments/${comment.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete comment");
      onDeleted(comment.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to delete comment");
      setBusy(false);
    }
  }

  return (
    <li className="flex gap-3">
      <Avatar src={comment.author.profileImage} initials={comment.author.initials} size={30} />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-bold">{comment.author.name}</span>
          <span className="font-mono text-[10.5px] text-neutral-400">
            {when(comment.createdAt)}
            {comment.edited && " · edited"}
          </span>
        </div>

        {editing ? (
          <div className="mt-1.5">
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={1000}
              rows={3}
              className="w-full resize-y rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[12.8px] outline-none focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:focus:ring-neutral-600"
            />
            <div className="mt-1.5 flex gap-2">
              <button
                onClick={() => void save()}
                disabled={!value.trim() || busy}
                className="rounded-lg bg-indigo-600 px-3 py-1 text-[11.5px] font-bold text-white disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => {
                  setValue(comment.content);
                  setEditing(false);
                  setErr(null);
                }}
                className="rounded-lg border border-neutral-200 px-3 py-1 text-[11.5px] font-semibold text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-[12.8px] text-neutral-700 dark:text-neutral-200">
            {comment.content}
          </p>
        )}

        {err && <p className="mt-1 text-[11px] font-semibold text-rose-600">{err}</p>}

        {!editing && !readOnly && (comment.canEdit || comment.canDelete) && (
          <div className="mt-1.5 flex gap-3">
            {comment.canEdit && (
              <button
                onClick={() => setEditing(true)}
                className="text-[11px] font-semibold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                Edit
              </button>
            )}
            {comment.canDelete && (
              <button
                onClick={() => void remove()}
                disabled={busy}
                className="text-[11px] font-semibold text-neutral-400 hover:text-rose-500 disabled:opacity-60"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
