"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TeamMemberResponse, TeamRole } from "@/types/api";
import { RoleBadge } from "@/components/team/RoleBadge";
import { Button } from "@/components/ui/Button";

function canKick(myRole: TeamRole, targetRole: TeamRole): boolean {
  if (myRole === "OWNER") return true;
  if (myRole === "ADMIN") return targetRole === "MEMBER";
  return false;
}

export function MembersPageClient({
  teamId,
  currentUserId,
  myRole,
  initialMembers,
}: {
  teamId: string;
  currentUserId: string;
  myRole: TeamRole;
  initialMembers: TeamMemberResponse[];
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [confirmKickId, setConfirmKickId] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleKick(userId: string) {
    setBusy(true);
    setActionError(null);
    const res = await fetch(`/api/teams/${teamId}/members/${userId}`, { method: "DELETE" });
    setBusy(false);
    setConfirmKickId(null);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setActionError(body?.error?.message ?? "Failed to remove member");
      return;
    }
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  }

  async function handleLeave() {
    setBusy(true);
    setActionError(null);
    const res = await fetch(`/api/teams/${teamId}/leave`, { method: "POST" });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setActionError(body?.error?.message ?? "Failed to leave team");
      setConfirmLeave(false);
      return;
    }
    router.push("/teams");
  }

  return (
    <div className="flex flex-col gap-4">
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-neutral-50 text-[11px] font-bold uppercase tracking-widest text-neutral-400 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {members.map((member) => {
              const isSelf = member.userId === currentUserId;
              const showKick = !isSelf && canKick(myRole, member.role);
              return (
                <tr key={member.userId}>
                  <td className="px-4 py-3 font-semibold">
                    {member.name} {isSelf && <span className="text-neutral-400">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{member.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={member.role} />
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {showKick &&
                      (confirmKickId === member.userId ? (
                        <span className="flex items-center justify-end gap-2">
                          <span className="text-neutral-500">Remove?</span>
                          <Button
                            variant="danger"
                            disabled={busy}
                            onClick={() => handleKick(member.userId)}
                            className="px-2.5 py-1 text-xs"
                          >
                            Yes
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => setConfirmKickId(null)}
                            className="px-2.5 py-1 text-xs"
                          >
                            Cancel
                          </Button>
                        </span>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={() => setConfirmKickId(member.userId)}
                          className="px-2.5 py-1 text-xs"
                        >
                          Remove
                        </Button>
                      ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {myRole !== "OWNER" && (
        <div className="self-start">
          {confirmLeave ? (
            <span className="flex items-center gap-2 text-sm">
              Leave this team?
              <Button variant="danger" disabled={busy} onClick={handleLeave}>
                Yes, leave
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setConfirmLeave(false)}>
                Cancel
              </Button>
            </span>
          ) : (
            <Button variant="secondary" onClick={() => setConfirmLeave(true)}>
              Leave team
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
