"use client";

import { useState } from "react";
import type { LabelResponse } from "@/types/api";

export const LABEL_COLORS = [
  "#6366f1",
  "#f43f5e",
  "#e0982e",
  "#10b981",
  "#0ea5e9",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#64748b",
];

function ColorSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {LABEL_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={c}
          className={`h-5 w-5 rounded-full transition-transform ${
            value.toLowerCase() === c ? "ring-2 ring-offset-1 ring-neutral-400 dark:ring-offset-neutral-900" : ""
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

export function LabelManager({
  projectId,
  labels,
  setLabels,
  disabled,
}: {
  projectId: string;
  labels: LabelResponse[];
  setLabels: (labels: LabelResponse[]) => void;
  disabled: boolean;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(LABEL_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(LABEL_COLORS[0]);

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error?.message ?? "Failed to create label");
      }
      const created: LabelResponse = await res.json();
      setLabels([...labels, created].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to create label");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: string) {
    setErr(null);
    try {
      const res = await fetch(`/api/labels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), color: editColor }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error?.message ?? "Failed to update label");
      }
      const updated: LabelResponse = await res.json();
      setLabels(
        labels.map((l) => (l.id === id ? updated : l)).sort((a, b) => a.name.localeCompare(b.name)),
      );
      setEditId(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to update label");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this label? It will be removed from all issues.")) return;
    setErr(null);
    try {
      const res = await fetch(`/api/labels/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error?.message ?? "Failed to delete label");
      }
      setLabels(labels.filter((l) => l.id !== id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to delete label");
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[13.5px] font-bold">
          Labels{" "}
          <span className="font-mono text-[11px] font-normal text-neutral-400">
            {labels.length}/20
          </span>
        </h2>
      </div>

      {err && <p className="mb-3 text-[12px] font-semibold text-rose-600">{err}</p>}

      {/* Existing labels */}
      <div className="mb-5 flex flex-col gap-2">
        {labels.length === 0 && (
          <p className="text-[12.5px] text-neutral-400">No labels yet.</p>
        )}
        {labels.map((label) =>
          editId === label.id ? (
            <div
              key={label.id}
              className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700"
            >
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={30}
                className="rounded-md border border-neutral-200 px-2 py-1 text-[12.5px] dark:border-neutral-700 dark:bg-neutral-800"
              />
              <ColorSwatches value={editColor} onChange={setEditColor} />
              <div className="flex gap-2">
                <button
                  onClick={() => void saveEdit(label.id)}
                  disabled={!editName.trim()}
                  className="rounded-md bg-indigo-600 px-3 py-1 text-[11.5px] font-bold text-white disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditId(null)}
                  className="rounded-md border border-neutral-200 px-3 py-1 text-[11.5px] font-semibold text-neutral-500 dark:border-neutral-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              key={label.id}
              className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800"
            >
              <span
                className="rounded px-2 py-0.5 text-[11px] font-bold"
                style={{ backgroundColor: `${label.color}1a`, color: label.color }}
              >
                {label.name}
              </span>
              <span className="flex-1" />
              {!disabled && (
                <>
                  <button
                    onClick={() => {
                      setEditId(label.id);
                      setEditName(label.name);
                      setEditColor(label.color);
                    }}
                    className="text-[11.5px] font-semibold text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => void remove(label.id)}
                    className="text-[11.5px] font-semibold text-rose-500 hover:text-rose-700"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ),
        )}
      </div>

      {/* Create form */}
      {!disabled && labels.length < 20 && (
        <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void create();
            }}
            maxLength={30}
            placeholder="New label name"
            className="mb-2 w-full rounded-md border border-neutral-200 px-2 py-1.5 text-[12.5px] dark:border-neutral-700 dark:bg-neutral-800"
          />
          <div className="mb-3 flex items-center justify-between">
            <ColorSwatches value={color} onChange={setColor} />
          </div>
          <button
            onClick={() => void create()}
            disabled={!name.trim() || busy}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-[11.5px] font-bold text-white disabled:opacity-60"
          >
            {busy ? "Adding…" : "Add label"}
          </button>
        </div>
      )}
    </div>
  );
}
