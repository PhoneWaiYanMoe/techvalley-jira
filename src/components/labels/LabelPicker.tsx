"use client";

import { useEffect, useRef, useState } from "react";
import type { LabelResponse } from "@/types/api";
import { LABEL_COLORS } from "./LabelManager";

const MAX_LABELS_PER_ISSUE = 5;

export function LabelPicker({
  projectId,
  available,
  selectedIds,
  onChange,
  onCreated,
  disabled = false,
}: {
  projectId: string;
  available: LabelResponse[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCreated: (label: LabelResponse) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(LABEL_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const selected = available.filter((l) => selectedIds.includes(l.id));
  const atMax = selectedIds.length >= MAX_LABELS_PER_ISSUE;

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else if (!atMax) {
      onChange([...selectedIds, id]);
    }
  }

  async function createInline() {
    if (!newName.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error?.message ?? "Failed to create label");
      }
      const created: LabelResponse = await res.json();
      onCreated(created);
      if (!atMax) onChange([...selectedIds, created.id]);
      setNewName("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create label");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map((label) => (
          <span
            key={label.id}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold"
            style={{ backgroundColor: `${label.color}1a`, color: label.color }}
          >
            {label.name}
            {!disabled && (
              <button
                onClick={() => toggle(label.id)}
                aria-label={`Remove ${label.name}`}
                className="opacity-60 hover:opacity-100"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </span>
        ))}
        {selected.length === 0 && (
          <span className="text-[12px] text-neutral-400">No labels</span>
        )}
        {!disabled && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 rounded border border-dashed border-neutral-300 px-2 py-0.5 text-[11px] font-semibold text-neutral-500 hover:border-neutral-400 dark:border-neutral-600"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Label
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 top-8 z-30 w-60 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <div className="max-h-44 overflow-y-auto">
            {available.length === 0 && (
              <p className="px-2 py-2 text-[11.5px] text-neutral-400">No labels yet — create one below.</p>
            )}
            {available.map((label) => {
              const checked = selectedIds.includes(label.id);
              return (
                <button
                  key={label.id}
                  onClick={() => toggle(label.id)}
                  disabled={!checked && atMax}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-neutral-50 disabled:opacity-40 dark:hover:bg-neutral-800"
                >
                  <span
                    className="flex h-3.5 w-3.5 items-center justify-center rounded-sm"
                    style={{ backgroundColor: checked ? label.color : "transparent", border: `1.5px solid ${label.color}` }}
                  >
                    {checked && (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </span>
                  <span className="text-[12px] font-semibold" style={{ color: label.color }}>
                    {label.name}
                  </span>
                </button>
              );
            })}
          </div>

          {atMax && (
            <p className="px-2 py-1 text-[10.5px] font-semibold text-amber-600">Max 5 labels per issue.</p>
          )}

          <div className="mt-1 border-t border-neutral-100 pt-2 dark:border-neutral-800">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void createInline();
              }}
              maxLength={30}
              placeholder="Create new label"
              className="mb-1.5 w-full rounded-md border border-neutral-200 px-2 py-1 text-[11.5px] dark:border-neutral-700 dark:bg-neutral-800"
            />
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {LABEL_COLORS.slice(0, 6).map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    aria-label={c}
                    className={`h-4 w-4 rounded-full ${newColor === c ? "ring-2 ring-neutral-400" : ""}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button
                onClick={() => void createInline()}
                disabled={!newName.trim() || busy}
                className="rounded-md bg-indigo-600 px-2 py-1 text-[10.5px] font-bold text-white disabled:opacity-60"
              >
                Add
              </button>
            </div>
            {err && <p className="mt-1 text-[10.5px] font-semibold text-rose-600">{err}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
