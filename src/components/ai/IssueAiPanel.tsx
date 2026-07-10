"use client";

import { useState } from "react";
import type { AiSummaryResponse, AiSuggestionResponse } from "@/types/api";

const MIN_DESCRIPTION_LENGTH = 10; // FR-040/041

function AiAction({
  issueId,
  kind,
  label,
  enabled,
}: {
  issueId: string;
  kind: "summary" | "suggestion";
  label: string;
  enabled: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (loading) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/issues/${issueId}/ai/${kind}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "AI request failed");
      const r = data as AiSummaryResponse & AiSuggestionResponse;
      setText(kind === "summary" ? r.summary : r.suggestion);
      setCached(Boolean(r.cached));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={() => void run()}
        disabled={!enabled || loading}
        title={enabled ? undefined : "Add a description longer than 10 characters first"}
        className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[12px] font-semibold text-neutral-600 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
      >
        {loading ? "Thinking…" : `✦ ${label}`}
      </button>
      {err && <p className="mt-1.5 text-[11px] font-semibold text-rose-600">{err}</p>}
      {text && (
        <div className="mt-2 rounded-lg bg-neutral-50 p-3 text-[12.3px] leading-relaxed whitespace-pre-wrap text-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-200">
          {text}
          {cached && (
            <span className="mt-1.5 block font-mono text-[10px] text-neutral-400">cached</span>
          )}
        </div>
      )}
    </div>
  );
}

export function IssueAiPanel({
  issueId,
  descriptionLength,
}: {
  issueId: string;
  descriptionLength: number;
}) {
  const enabled = descriptionLength > MIN_DESCRIPTION_LENGTH;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-3 text-[13.5px] font-bold">AI</h2>
      {!enabled && (
        <p className="mb-2.5 text-[11.5px] text-neutral-400">
          Add a description longer than 10 characters to enable AI.
        </p>
      )}
      <div className="flex flex-col gap-2.5">
        <AiAction issueId={issueId} kind="summary" label="AI Summary" enabled={enabled} />
        <AiAction issueId={issueId} kind="suggestion" label="AI Suggestion" enabled={enabled} />
      </div>
    </div>
  );
}
