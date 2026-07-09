"use client";

import { useEffect, useRef, useState } from "react";
import type { IssueStatusOption } from "@/types/api";

type StatusPatch = { name?: string; color?: string; wipLimit?: number | null };

export function ColumnMenu({
  status,
  onUpdate,
  onDelete,
}: {
  status: IssueStatusOption;
  onUpdate: (patch: StatusPatch) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(status.name);
  const [color, setColor] = useState(status.color ?? "#94a3b8");
  const [wip, setWip] = useState(status.wipLimit != null ? String(status.wipLimit) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const isCustom = !status.isDefault;

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function reset() {
    setName(status.name);
    setColor(status.color ?? "#94a3b8");
    setWip(status.wipLimit != null ? String(status.wipLimit) : "");
    setErr(null);
  }

  async function save() {
    const patch: StatusPatch = {};
    if (isCustom && name.trim() && name.trim() !== status.name) patch.name = name.trim();
    if (isCustom && color !== status.color) patch.color = color;
    const nextWip = wip.trim() === "" ? null : Number(wip);
    if (nextWip !== status.wipLimit) patch.wipLimit = nextWip;

    if (Object.keys(patch).length === 0) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onUpdate(patch);
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete the "${status.name}" column? Its issues move to Backlog.`)) return;
    setBusy(true);
    setErr(null);
    try {
      await onDelete();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to delete");
      setBusy(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          reset();
          setOpen((v) => !v);
        }}
        aria-label="Column options"
        className="flex h-5 w-5 items-center justify-center rounded text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 dark:hover:bg-neutral-700"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-6 z-20 w-56 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {isCustom && (
            <label className="mb-2 block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                Name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={30}
                className="w-full rounded-md border border-neutral-200 px-2 py-1 text-[12px] dark:border-neutral-700 dark:bg-neutral-800"
              />
            </label>
          )}

          {isCustom && (
            <label className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                Color
              </span>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-6 w-10 cursor-pointer rounded border border-neutral-200 dark:border-neutral-700"
              />
            </label>
          )}

          <label className="mb-3 block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-neutral-400">
              WIP limit (blank = unlimited)
            </span>
            <input
              type="number"
              min={1}
              max={50}
              value={wip}
              onChange={(e) => setWip(e.target.value)}
              placeholder="Unlimited"
              className="w-full rounded-md border border-neutral-200 px-2 py-1 text-[12px] dark:border-neutral-700 dark:bg-neutral-800"
            />
          </label>

          {err && <p className="mb-2 text-[11px] font-semibold text-rose-600">{err}</p>}

          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={busy}
              className="flex-1 rounded-md bg-indigo-600 px-2 py-1.5 text-[11.5px] font-bold text-white disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            {isCustom && (
              <button
                onClick={remove}
                disabled={busy}
                className="rounded-md border border-rose-200 px-2 py-1.5 text-[11.5px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-900 dark:hover:bg-rose-950"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
