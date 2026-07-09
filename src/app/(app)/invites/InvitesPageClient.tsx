"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { InviteResponse } from "@/types/api";
import { RoleBadge } from "@/components/team/RoleBadge";
import { Button } from "@/components/ui/Button";

export function InvitesPageClient() {
  const router = useRouter();
  const [invites, setInvites] = useState<InviteResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/invites/mine");
        if (!res.ok) throw new Error("Failed to load invites");
        const data = await res.json();
        setInvites(data.data ?? []);
      } catch {
        // silently fail — UI shows empty state
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleAccept(invite: InviteResponse) {
    setBusyId(invite.id);
    setError(null);
    const res = await fetch(`/api/invites/${invite.id}/accept`, { method: "POST" });
    setBusyId(null);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "Failed to accept invite");
      return;
    }
    setInvites((prev) => prev.filter((i) => i.id !== invite.id));
    router.push(`/teams/${invite.teamId}`);
  }

  return (
    <div className="p-6 pb-10">
      <div className="mb-5 flex items-baseline gap-2.5">
        <h1 className="text-xl font-bold tracking-tight">My invites</h1>
        <span className="font-mono text-sm text-neutral-400">{invites.length}</span>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-indigo-600" />
        </div>
      ) : invites.length > 0 ? (
        <div className="flex flex-col gap-3">
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div>
                <div className="text-sm font-bold">{invite.teamName}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                  <RoleBadge role={invite.role} />
                  <span>Expires {new Date(invite.expiresAt).toLocaleDateString()}</span>
                </div>
              </div>
              <Button disabled={busyId === invite.id} onClick={() => handleAccept(invite)}>
                {busyId === invite.id ? "Joining…" : "Accept"}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
          <div className="text-[15px] font-bold text-neutral-900 dark:text-neutral-100">
            No pending invites
          </div>
          <div className="mt-1 text-[13px]">Team invites sent to your email will show up here.</div>
        </div>
      )}
    </div>
  );
}
