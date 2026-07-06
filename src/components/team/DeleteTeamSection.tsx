"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function DeleteTeamSection({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleDelete() {
    setError(null);
    setSubmitting(true);

    const res = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setSubmitting(false);
      setError(body?.error?.message ?? "Failed to delete team");
      return;
    }

    router.push("/teams");
  }

  return (
    <div className="max-w-md border-t border-neutral-200 pt-8 dark:border-neutral-800">
      <h2 className="text-lg font-semibold text-red-600">Danger zone</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Deleting this team is permanent — all its projects, issues, and comments will be
        soft-deleted too.
      </p>
      <Button variant="danger" className="mt-4" onClick={() => setOpen(true)}>
        Delete team
      </Button>

      {open && (
        <div
          onClick={() => !submitting && setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,20,35,.45)] backdrop-blur-sm animate-[fadeIn_.18s_ease]"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[460px] max-w-[calc(100vw-40px)] rounded-xl border border-neutral-200 bg-white p-6 shadow-2xl animate-[popIn_.24s_cubic-bezier(.2,.7,.2,1)] dark:border-neutral-800 dark:bg-neutral-900"
          >
            <h3 className="text-lg font-semibold">Delete this team?</h3>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              This can&apos;t be undone. All projects, issues, and comments under this team
              will be soft-deleted.
            </p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" disabled={submitting} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" disabled={submitting} onClick={handleDelete}>
                {submitting ? "Deleting…" : "Delete team"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
