import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/utils/errors";
import { isOwner, isOwnerOrAdmin } from "@/lib/permissions/team-role";
import { logActivity } from "@/lib/activity-log/activity-log.service";
import { createNotification } from "@/lib/notification/notification.service";
import type { TeamResponse, TeamMemberResponse, TeamRole } from "@/types/api";
import type { CreateTeamInput, UpdateTeamInput } from "@/validation/team.schema";

// Returns every team the user belongs to, in the same TeamResponse shape
// used by the rest of the team endpoints (GET /api/teams, FR-021-adjacent
// per api.md). Also used by Dev B's project-creation flow to look up a
// teamId — that code reads `.id`, not a separate `teamId` field, so keep
// this shape in sync with TeamResponse rather than a bespoke one.
export async function getUserTeams(userId: string): Promise<TeamResponse[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("team_members")
    .select("team_id, role, teams!inner(id, name, owner_id, created_at, deleted_at)")
    .eq("user_id", userId)
    .is("teams.deleted_at", null);

  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch team memberships");
  }

  const rows = (data ?? []) as unknown as {
    team_id: string;
    role: TeamRole;
    teams: { id: string; name: string; owner_id: string; created_at: string };
  }[];

  return Promise.all(
    rows.map(async (row) => {
      const memberCount = await getMemberCount(row.team_id);
      return toTeamResponse(row.teams, row.role, memberCount);
    }),
  );
}

// Returns the user's first team, or throws 404 if they have none.
export async function getUserFirstTeam(userId: string): Promise<TeamResponse> {
  const teams = await getUserTeams(userId);
  if (teams.length === 0) {
    throw new ApiError(404, "NO_TEAM", "You must belong to a team to manage projects");
  }
  return teams[0];
}

// Checks if a user is a member of a specific team. Throws 404 if not
// (FR-070: never leak existence across teams).
export async function requireTeamMembership(
  userId: string,
  teamId: string,
): Promise<"OWNER" | "ADMIN" | "MEMBER"> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("team_members")
    .select("role")
    .eq("user_id", userId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to check team membership");
  }
  if (!data) {
    throw new ApiError(404, "NOT_FOUND", "Team not found");
  }
  return data.role as "OWNER" | "ADMIN" | "MEMBER";
}

async function getMemberCount(teamId: string): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId);

  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to count team members");
  }
  return count ?? 0;
}

function toTeamResponse(
  row: { id: string; name: string; owner_id: string; created_at: string },
  myRole: TeamRole,
  memberCount: number,
): TeamResponse {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    myRole,
    memberCount,
  };
}

// FR-010
export async function createTeam(userId: string, input: CreateTeamInput): Promise<TeamResponse> {
  const admin = createAdminClient();

  const { data: team, error: teamError } = await admin
    .from("teams")
    .insert({ name: input.name, owner_id: userId })
    .select()
    .single();

  if (teamError || !team) {
    throw new ApiError(500, "DB_ERROR", "Failed to create team");
  }

  const { error: memberError } = await admin
    .from("team_members")
    .insert({ team_id: team.id, user_id: userId, role: "OWNER" });

  if (memberError) {
    throw new ApiError(500, "DB_ERROR", "Failed to add owner as team member");
  }

  return toTeamResponse(team, "OWNER", 1);
}

// GET single team — any member can view
export async function getTeam(teamId: string, userId: string): Promise<TeamResponse> {
  const role = await requireTeamMembership(userId, teamId);
  const admin = createAdminClient();

  const { data: team, error } = await admin
    .from("teams")
    .select("id, name, owner_id, created_at")
    .eq("id", teamId)
    .is("deleted_at", null)
    .single();

  if (error || !team) {
    throw new ApiError(404, "NOT_FOUND", "Team not found");
  }

  const memberCount = await getMemberCount(teamId);
  return toTeamResponse(team, role, memberCount);
}

// FR-011 — OWNER or ADMIN only
export async function updateTeam(
  teamId: string,
  userId: string,
  input: UpdateTeamInput,
): Promise<TeamResponse> {
  const role = await requireTeamMembership(userId, teamId);
  if (!isOwnerOrAdmin(role)) {
    throw new ApiError(403, "FORBIDDEN", "Only the team owner or an admin can update the team");
  }

  const admin = createAdminClient();
  const { data: team, error } = await admin
    .from("teams")
    .update({ name: input.name })
    .eq("id", teamId)
    .select("id, name, owner_id, created_at")
    .single();

  if (error || !team) {
    throw new ApiError(500, "DB_ERROR", "Failed to update team");
  }

  await logActivity(teamId, userId, "TEAM_UPDATED", "team", teamId, { name: input.name });

  const memberCount = await getMemberCount(teamId);
  return toTeamResponse(team, role, memberCount);
}

// FR-012 — OWNER only. Cascades soft delete to the team's projects, those
// projects' issues, and those issues' comments (PRD: "all sub-projects,
// issues, comments, etc. are Soft Deleted").
export async function deleteTeam(teamId: string, userId: string): Promise<void> {
  const role = await requireTeamMembership(userId, teamId);
  if (!isOwner(role)) {
    throw new ApiError(403, "FORBIDDEN", "Only the team owner can delete the team");
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: projects, error: projectsError } = await admin
    .from("projects")
    .select("id")
    .eq("team_id", teamId)
    .is("deleted_at", null);

  if (projectsError) {
    throw new ApiError(500, "DB_ERROR", "Failed to look up team projects");
  }

  const projectIds = (projects ?? []).map((p: { id: string }) => p.id);

  if (projectIds.length > 0) {
    const { data: issues, error: issuesError } = await admin
      .from("issues")
      .select("id")
      .in("project_id", projectIds)
      .is("deleted_at", null);

    if (issuesError) {
      throw new ApiError(500, "DB_ERROR", "Failed to look up team issues");
    }

    const issueIds = (issues ?? []).map((i: { id: string }) => i.id);

    if (issueIds.length > 0) {
      await admin.from("comments").update({ deleted_at: now }).in("issue_id", issueIds);
    }
    await admin.from("issues").update({ deleted_at: now }).in("project_id", projectIds);
  }

  await admin.from("projects").update({ deleted_at: now }).eq("team_id", teamId);

  const { error: teamError } = await admin
    .from("teams")
    .update({ deleted_at: now })
    .eq("id", teamId);

  if (teamError) {
    throw new ApiError(500, "DB_ERROR", "Failed to delete team");
  }
}

// FR-014 — any team member can view
export async function listMembers(teamId: string, userId: string): Promise<TeamMemberResponse[]> {
  await requireTeamMembership(userId, teamId);
  const admin = createAdminClient();

  const { data: members, error } = await admin
    .from("team_members")
    .select("user_id, role, joined_at, profiles!inner(name)")
    .eq("team_id", teamId)
    .order("joined_at", { ascending: true });

  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch team members");
  }

  const rows = (members ?? []) as unknown as {
    user_id: string;
    role: TeamRole;
    joined_at: string;
    profiles: { name: string };
  }[];

  const admin2 = createAdminClient();
  return Promise.all(
    rows.map(async (row) => {
      const { data: authUser } = await admin2.auth.admin.getUserById(row.user_id);
      return {
        userId: row.user_id,
        name: row.profiles.name,
        email: authUser?.user?.email ?? null,
        role: row.role,
        joinedAt: row.joined_at,
      };
    }),
  );
}

// FR-015 — OWNER can kick ADMIN or MEMBER; ADMIN can only kick MEMBER.
// Neither can kick themselves.
export async function kickMember(
  teamId: string,
  actingUserId: string,
  targetUserId: string,
): Promise<void> {
  if (actingUserId === targetUserId) {
    throw new ApiError(403, "FORBIDDEN", "You cannot kick yourself from the team");
  }

  const actingRole = await requireTeamMembership(actingUserId, teamId);
  if (!isOwnerOrAdmin(actingRole)) {
    throw new ApiError(403, "FORBIDDEN", "Only the team owner or an admin can kick members");
  }

  const admin = createAdminClient();
  const { data: target, error } = await admin
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (error || !target) {
    throw new ApiError(404, "NOT_FOUND", "Member not found");
  }

  if (actingRole === "ADMIN" && target.role !== "MEMBER") {
    throw new ApiError(403, "FORBIDDEN", "Admins can only kick regular members");
  }

  const { error: deleteError } = await admin
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", targetUserId);

  if (deleteError) {
    throw new ApiError(500, "DB_ERROR", "Failed to remove member");
  }

  const targetName = await getProfileName(targetUserId);
  await logActivity(teamId, actingUserId, "MEMBER_KICKED", "member", targetUserId, { targetName });
}

// FR-016 — ADMIN/MEMBER only. OWNER must delete the team instead.
export async function leaveTeam(teamId: string, userId: string): Promise<void> {
  const role = await requireTeamMembership(userId, teamId);
  if (isOwner(role)) {
    throw new ApiError(
      422,
      "OWNER_CANNOT_LEAVE",
      "The team owner cannot leave — delete the team or transfer ownership instead",
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", userId);

  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to leave team");
  }

  await logActivity(teamId, userId, "MEMBER_LEFT", "member", userId);
}

async function getProfileName(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("name").eq("id", userId).maybeSingle();
  return data?.name ?? null;
}

// FR-018 — OWNER only. Promote MEMBER<->ADMIN freely; setting a target to
// OWNER transfers ownership (old owner becomes ADMIN), keeping exactly one
// OWNER at all times. Cannot act on yourself — use transfer for that.
export async function changeRole(
  teamId: string,
  actingUserId: string,
  targetUserId: string,
  newRole: TeamRole,
): Promise<void> {
  if (actingUserId === targetUserId) {
    throw new ApiError(403, "FORBIDDEN", "You cannot change your own role");
  }

  const actingRole = await requireTeamMembership(actingUserId, teamId);
  if (!isOwner(actingRole)) {
    throw new ApiError(403, "FORBIDDEN", "Only the team owner can change member roles");
  }

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (targetError || !target) {
    throw new ApiError(404, "NOT_FOUND", "Member not found");
  }

  if (newRole === "OWNER") {
    // Transfer ownership: target becomes OWNER, acting owner becomes ADMIN.
    const { error: promoteError } = await admin
      .from("team_members")
      .update({ role: "OWNER" })
      .eq("team_id", teamId)
      .eq("user_id", targetUserId);
    if (promoteError) {
      throw new ApiError(500, "DB_ERROR", "Failed to transfer ownership");
    }

    await admin
      .from("team_members")
      .update({ role: "ADMIN" })
      .eq("team_id", teamId)
      .eq("user_id", actingUserId);

    await admin.from("teams").update({ owner_id: targetUserId }).eq("id", teamId);

    const targetName = await getProfileName(targetUserId);
    await logActivity(teamId, actingUserId, "ROLE_CHANGED", "member", targetUserId, {
      newRole: "OWNER",
      targetName,
    });
    await createNotification(
      targetUserId,
      "ROLE_CHANGED",
      "You are now the team owner",
      undefined,
      "team",
      teamId,
    );
    return;
  }

  if (target.role === "OWNER") {
    throw new ApiError(
      422,
      "CANNOT_DEMOTE_OWNER",
      "Transfer ownership to someone else before demoting the current owner",
    );
  }

  const { error: updateError } = await admin
    .from("team_members")
    .update({ role: newRole })
    .eq("team_id", teamId)
    .eq("user_id", targetUserId);

  if (updateError) {
    throw new ApiError(500, "DB_ERROR", "Failed to update member role");
  }

  const targetName = await getProfileName(targetUserId);
  await logActivity(teamId, actingUserId, "ROLE_CHANGED", "member", targetUserId, {
    newRole,
    targetName,
  });
  await createNotification(
    targetUserId,
    "ROLE_CHANGED",
    `Your role was changed to ${newRole}`,
    undefined,
    "team",
    teamId,
  );
}
