"use client";

import { useState } from "react";

export function AddColumn({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await onAdd(name.trim());
      setName("");
      setAdding(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to add column");
    } finally {
      setBusy(false);
    }
  }

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="flex h-9 w-[260px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300 text-[12px] font-bold text-neutral-400 transition-colors hover:border-neutral-400 hover:text-neutral-600 dark:border-neutral-700 dark:hover:border-neutral-600"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add column
      </button>
    );
  }

  return (
    <div className="w-[300px] shrink-0 rounded-lg border border-neutral-200 bg-white p-2.5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submit();
          if (e.key === "Escape") setAdding(false);
        }}
        maxLength={30}
        placeholder="Column name"
        className="mb-2 w-full rounded-md border border-neutral-200 px-2 py-1.5 text-[12.5px] dark:border-neutral-700 dark:bg-neutral-800"
      />
      {err && <p className="mb-2 text-[11px] font-semibold text-rose-600">{err}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={busy || !name.trim()}
          className="flex-1 rounded-md bg-indigo-600 px-2 py-1.5 text-[11.5px] font-bold text-white disabled:opacity-60"
        >
          {busy ? "Adding…" : "Add"}
        </button>
        <button
          onClick={() => {
            setAdding(false);
            setName("");
            setErr(null);
          }}
          className="rounded-md border border-neutral-200 px-2 py-1.5 text-[11.5px] font-semibold text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
