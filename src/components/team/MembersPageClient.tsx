"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { InviteResponse, TeamMemberResponse, TeamRole } from "@/types/api";
import { RoleBadge } from "@/components/team/RoleBadge";
import { Button } from "@/components/ui/Button";
import { InviteMemberModal } from "@/components/team/InviteMemberModal";
import { isOwnerOrAdmin } from "@/lib/permissions/team-role";

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
  initialInvites,
}: {
  teamId: string;
  currentUserId: string;
  myRole: TeamRole;
  initialMembers: TeamMemberResponse[];
  initialInvites: InviteResponse[];
}) {
  const router = useRouter();
  const canManage = isOwnerOrAdmin(myRole);
  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [confirmKickId, setConfirmKickId] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmTransferTo, setConfirmTransferTo] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleResendInvite(inviteId: string) {
    setBusy(true);
    setActionError(null);
    const res = await fetch(`/api/teams/${teamId}/invites/${inviteId}/resend`, {
      method: "POST",
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setActionError(body?.error?.message ?? "Failed to resend invite");
      return;
    }
    const updated: InviteResponse = await res.json();
    setInvites((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

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

  async function handleRoleChange(userId: string, newRole: TeamRole) {
    if (newRole === "OWNER" && confirmTransferTo !== userId) {
      setConfirmTransferTo(userId);
      return;
    }

    setBusy(true);
    setActionError(null);
    const res = await fetch(`/api/teams/${teamId}/members/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    setBusy(false);
    setConfirmTransferTo(null);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setActionError(body?.error?.message ?? "Failed to update role");
      return;
    }

    if (newRole === "OWNER") {
      // Ownership transferred away from us — refresh from the server rather
      // than guessing the new member list shape.
      router.refresh();
      return;
    }
    setMembers((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, role: newRole } : m)),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setInviteModalOpen(true)} className="text-xs">
            Invite member
          </Button>
        </div>
      )}

      {canManage && invites.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-neutral-50 text-[11px] font-bold uppercase tracking-widest text-neutral-400 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-3">Pending invite</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {invites.map((invite) => {
                const expired = new Date(invite.expiresAt) < new Date();
                return (
                  <tr key={invite.id}>
                    <td className="px-4 py-3 text-neutral-500">{invite.email}</td>
                    <td className="px-4 py-3">
                      <RoleBadge role={invite.role} />
                    </td>
                    <td className={`px-4 py-3 ${expired ? "text-red-600" : "text-neutral-500"}`}>
                      {expired ? "Expired" : new Date(invite.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => handleResendInvite(invite.id)}
                        className="px-2.5 py-1 text-xs"
                      >
                        Resend
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
              const showRoleControl = myRole === "OWNER" && !isSelf && member.role !== "OWNER";
              return (
                <tr key={member.userId}>
                  <td className="px-4 py-3 font-semibold">
                    {member.name} {isSelf && <span className="text-neutral-400">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{member.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    {showRoleControl ? (
                      confirmTransferTo === member.userId ? (
                        <span className="flex items-center gap-2">
                          <span className="text-neutral-500">Make owner?</span>
                          <Button
                            variant="danger"
                            disabled={busy}
                            onClick={() => handleRoleChange(member.userId, "OWNER")}
                            className="px-2.5 py-1 text-xs"
                          >
                            Yes
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => setConfirmTransferTo(null)}
                            className="px-2.5 py-1 text-xs"
                          >
                            Cancel
                          </Button>
                        </span>
                      ) : (
                        <select
                          value={member.role}
                          disabled={busy}
                          onChange={(e) => handleRoleChange(member.userId, e.target.value as TeamRole)}
                          className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-900"
                        >
                          <option value="MEMBER">MEMBER</option>
                          <option value="ADMIN">ADMIN</option>
                          <option value="OWNER">Transfer ownership…</option>
                        </select>
                      )
                    ) : (
                      <RoleBadge role={member.role} />
                    )}
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

      {inviteModalOpen && (
        <InviteMemberModal
          teamId={teamId}
          onClose={() => setInviteModalOpen(false)}
          onSent={(invite) => {
            setInvites((prev) => [invite, ...prev.filter((i) => i.id !== invite.id)]);
            setInviteModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
