import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/utils/errors";
import { isOwnerOrAdmin } from "@/lib/permissions/team-role";
import { requireTeamMembership } from "@/lib/team/team.service";
import { logActivity } from "@/lib/activity-log/activity-log.service";
import { sendInviteEmail } from "@/lib/email/send-invite-email";
import { createNotification } from "@/lib/notification/notification.service";
import type { InviteResponse, TeamRole } from "@/types/api";
import type { CreateInviteInput } from "@/validation/team.schema";

const INVITE_EXPIRY_DAYS = 7;

// No getUserByEmail in the admin SDK, only paginated listUsers — fine at
// this project's scale (used only to decide whether to also fire an
// in-app FR-090 notification for an existing user; email always sends
// regardless).
async function findUserIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const target = email.toLowerCase();

  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) break;
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  return null;
}

function toInviteResponse(row: {
  id: string;
  team_id: string;
  email: string;
  role: TeamRole;
  status: "PENDING" | "ACCEPTED";
  expires_at: string;
  created_at: string;
  teams?: { name: string } | null;
}): InviteResponse {
  return {
    id: row.id,
    teamId: row.team_id,
    teamName: row.teams?.name,
    email: row.email,
    role: row.role,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

// FR-013 — OWNER/ADMIN only. Re-sends (bumps expiry) if a pending invite for
// this team+email already exists, matching PRD's "Resend" behavior, since
// (team_id, email) is a unique constraint.
export async function createInvite(
  teamId: string,
  actingUserId: string,
  input: CreateInviteInput,
): Promise<InviteResponse> {
  const role = await requireTeamMembership(actingUserId, teamId);
  if (!isOwnerOrAdmin(role)) {
    throw new ApiError(403, "FORBIDDEN", "Only the team owner or an admin can invite members");
  }

  const admin = createAdminClient();

  const { data: team, error: teamError } = await admin
    .from("teams")
    .select("name")
    .eq("id", teamId)
    .single();
  if (teamError || !team) {
    throw new ApiError(404, "NOT_FOUND", "Team not found");
  }

  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: invite, error: upsertError } = await admin
    .from("team_invites")
    .upsert(
      {
        team_id: teamId,
        email: input.email,
        role: input.role,
        invited_by: actingUserId,
        status: "PENDING",
        expires_at: expiresAt,
      },
      { onConflict: "team_id,email" },
    )
    .select()
    .single();

  if (upsertError || !invite) {
    throw new ApiError(500, "DB_ERROR", "Failed to create invite");
  }

  await sendInviteEmail({ toEmail: input.email, teamName: team.name });
  await logActivity(teamId, actingUserId, "INVITE_SENT", "invite", invite.id, {
    email: input.email,
  });

  // FR-090 — only fires if the invited email already belongs to a
  // registered user; otherwise the email itself is the only notice they
  // get until they sign up.
  const existingUserId = await findUserIdByEmail(input.email);
  if (existingUserId) {
    await createNotification(
      existingUserId,
      "TEAM_INVITE",
      `You've been invited to join ${team.name}`,
      undefined,
      "team",
      teamId,
    );
  }

  return toInviteResponse({ ...invite, teams: { name: team.name } });
}

// FR-013 — OWNER/ADMIN view of this team's pending invites.
export async function listTeamInvites(
  teamId: string,
  actingUserId: string,
): Promise<InviteResponse[]> {
  const role = await requireTeamMembership(actingUserId, teamId);
  if (!isOwnerOrAdmin(role)) {
    throw new ApiError(403, "FORBIDDEN", "Only the team owner or an admin can view invites");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("team_invites")
    .select("*")
    .eq("team_id", teamId)
    .eq("status", "PENDING")
    .order("created_at", { ascending: false });

  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch invites");
  }

  return (data ?? []).map(toInviteResponse);
}

// FR-013 — bumps expiry another 7 days and re-sends the email.
export async function resendInvite(
  teamId: string,
  inviteId: string,
  actingUserId: string,
): Promise<InviteResponse> {
  const role = await requireTeamMembership(actingUserId, teamId);
  if (!isOwnerOrAdmin(role)) {
    throw new ApiError(403, "FORBIDDEN", "Only the team owner or an admin can resend invites");
  }

  const admin = createAdminClient();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: invite, error } = await admin
    .from("team_invites")
    .update({ expires_at: expiresAt })
    .eq("id", inviteId)
    .eq("team_id", teamId)
    .eq("status", "PENDING")
    .select("*, teams(name)")
    .single();

  if (error || !invite) {
    throw new ApiError(404, "NOT_FOUND", "Invite not found");
  }

  await sendInviteEmail({ toEmail: invite.email, teamName: invite.teams?.name ?? "your team" });

  return toInviteResponse(invite);
}

// FR-013 — invites pending for the current user's email address.
export async function listMyInvites(userEmail: string): Promise<InviteResponse[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("team_invites")
    .select("*, teams(name)")
    .ilike("email", userEmail)
    .eq("status", "PENDING")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch invites");
  }

  return (data ?? []).map(toInviteResponse);
}

// FR-013 — accepts an invite: joins the team at the invited role, marks the
// invite ACCEPTED. Rejects expired invites or a mismatched email.
export async function acceptInvite(inviteId: string, userId: string, userEmail: string): Promise<TeamRole> {
  const admin = createAdminClient();

  const { data: invite, error } = await admin
    .from("team_invites")
    .select("*")
    .eq("id", inviteId)
    .single();

  if (error || !invite) {
    throw new ApiError(404, "NOT_FOUND", "Invite not found");
  }

  if (invite.status !== "PENDING") {
    throw new ApiError(422, "INVITE_ALREADY_USED", "This invite has already been accepted");
  }

  if (new Date(invite.expires_at) < new Date()) {
    throw new ApiError(422, "INVITE_EXPIRED", "This invite has expired");
  }

  if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new ApiError(403, "FORBIDDEN", "This invite was sent to a different email address");
  }

  const { error: memberError } = await admin
    .from("team_members")
    .upsert(
      { team_id: invite.team_id, user_id: userId, role: invite.role },
      { onConflict: "team_id,user_id", ignoreDuplicates: true },
    );

  if (memberError) {
    throw new ApiError(500, "DB_ERROR", "Failed to join team");
  }

  await admin.from("team_invites").update({ status: "ACCEPTED" }).eq("id", inviteId);
  await logActivity(invite.team_id, userId, "MEMBER_JOINED", "member", userId);

  return invite.role as TeamRole;
}
