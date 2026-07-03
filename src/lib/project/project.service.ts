import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/utils/errors";
import { requireTeamMembership } from "@/lib/team/team.service";
import type {
  ProjectResponse,
  ProjectDashboardResponse,
  DashboardIssue,
} from "@/types/api";
import type { CreateProjectInput, UpdateProjectInput } from "@/validation/project.schema";

// Status → display color mapping (matches design prototype)
const STATUS_COLORS: Record<string, string> = {
  Backlog: "#94a3b8",
  "In Progress": "#6366f1",
  "In Review": "#e0982e",
  Done: "#10b981",
};

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: "#f43f5e",
  MEDIUM: "#e0982e",
  LOW: "#94a3b8",
};

// Assignee avatar colors (deterministic from a small palette)
const AVATAR_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#e0982e",
  "#f43f5e",
  "#8b5cf6",
  "#10b981",
  "#14b8a6",
];

function getAvatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// --- List projects (FR-021) ---

export async function listProjects(
  userId: string,
): Promise<{ data: ProjectResponse[]; nextCursor: string | null }> {
  const admin = createAdminClient();

  // Get all teams the user belongs to
  const { data: memberships, error: memErr } = await admin
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId);

  if (memErr) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch team memberships");
  }

  const teamIds = (memberships ?? []).map((m: { team_id: string }) => m.team_id);
  if (teamIds.length === 0) {
    return { data: [], nextCursor: null };
  }

  // Fetch non-deleted projects for those teams
  const { data: projects, error: projErr } = await admin
    .from("projects")
    .select("*, profiles!projects_owner_id_fkey(name)")
    .in("team_id", teamIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (projErr) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch projects");
  }

  // Fetch user's favorites
  const { data: favs } = await admin
    .from("project_favorites")
    .select("project_id")
    .eq("user_id", userId);

  const favSet = new Set((favs ?? []).map((f: { project_id: string }) => f.project_id));

  // Fetch issue counts per project
  const projectIds = (projects ?? []).map((p: { id: string }) => p.id);
  const countsMap = await getIssueCountsByProject(projectIds);

  // Build response, sort: favorites first, then by created_at desc
  const result: ProjectResponse[] = (projects ?? []).map(
    (p: Record<string, unknown>) => {
      const profile = p["profiles"] as { name: string } | null;
      return toProjectResponse(
        p as { id: string; team_id: string; owner_id: string; name: string; description: string | null; is_archived: boolean; created_at: string },
        profile?.name ?? "Unknown",
        countsMap.get(p.id as string) ?? {},
        favSet.has(p.id as string),
      );
    },
  );

  result.sort((a, b) => {
    if (a.isFavorited !== b.isFavorited) return a.isFavorited ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return { data: result, nextCursor: null };
}

// --- Get single project (FR-022) ---

export async function getProject(
  projectId: string,
  userId: string,
): Promise<ProjectResponse> {
  const admin = createAdminClient();

  const { data: project, error } = await admin
    .from("projects")
    .select("*, profiles!projects_owner_id_fkey(name)")
    .eq("id", projectId)
    .is("deleted_at", null)
    .single();

  if (error || !project) {
    throw new ApiError(404, "NOT_FOUND", "Project not found");
  }

  // Verify user has access (is member of the project's team)
  await requireTeamMembership(userId, project.team_id);

  const counts = await getIssueCountsByProject([projectId]);
  const favSet = await getUserFavorites(userId, [projectId]);
  const profile = project.profiles as { name: string } | null;

  return toProjectResponse(
    project,
    profile?.name ?? "Unknown",
    counts.get(projectId) ?? {},
    favSet.has(projectId),
  );
}

// --- Create project (FR-020) ---

export async function createProject(
  teamId: string,
  userId: string,
  input: CreateProjectInput,
): Promise<ProjectResponse> {
  const admin = createAdminClient();

  // Verify team membership
  await requireTeamMembership(userId, teamId);

  // Check 15-project limit
  const { count, error: countErr } = await admin
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .is("deleted_at", null);

  if (countErr) {
    throw new ApiError(500, "DB_ERROR", "Failed to check project count");
  }
  if ((count ?? 0) >= 15) {
    throw new ApiError(
      422,
      "PROJECT_LIMIT",
      "This team has reached the maximum of 15 projects",
    );
  }

  const { data: project, error: insertErr } = await admin
    .from("projects")
    .insert({
      team_id: teamId,
      owner_id: userId,
      name: input.name,
      description: input.description ?? null,
    })
    .select()
    .single();

  if (insertErr || !project) {
    throw new ApiError(500, "DB_ERROR", "Failed to create project");
  }

  // Auto-favorite for creator
  await admin.from("project_favorites").insert({
    project_id: project.id,
    user_id: userId,
  });

  // Fetch owner name
  const { data: profile } = await admin
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .single();

  return toProjectResponse(project, profile?.name ?? "Unknown", {}, true);
}

// --- Update project (FR-023) ---

export async function updateProject(
  projectId: string,
  userId: string,
  input: UpdateProjectInput,
): Promise<ProjectResponse> {
  const admin = createAdminClient();
  const project = await getProjectForMutation(projectId, userId);

  const { data: updated, error } = await admin
    .from("projects")
    .update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    })
    .eq("id", projectId)
    .select()
    .single();

  if (error || !updated) {
    throw new ApiError(500, "DB_ERROR", "Failed to update project");
  }

  const counts = await getIssueCountsByProject([projectId]);
  const favSet = await getUserFavorites(userId, [projectId]);
  const { data: profile } = await admin
    .from("profiles")
    .select("name")
    .eq("id", project.owner_id)
    .single();

  return toProjectResponse(
    updated,
    profile?.name ?? "Unknown",
    counts.get(projectId) ?? {},
    favSet.has(projectId),
  );
}

// --- Delete project (FR-024, soft delete) ---

export async function deleteProject(
  projectId: string,
  userId: string,
): Promise<void> {
  const admin = createAdminClient();
  await getProjectForMutation(projectId, userId);

  const { error } = await admin
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", projectId);

  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to delete project");
  }
}

// --- Archive/restore project (FR-026) ---

export async function archiveProject(
  projectId: string,
  userId: string,
  archived: boolean,
): Promise<ProjectResponse> {
  const admin = createAdminClient();
  await getProjectForMutation(projectId, userId);

  const { data: updated, error } = await admin
    .from("projects")
    .update({ is_archived: archived })
    .eq("id", projectId)
    .select()
    .single();

  if (error || !updated) {
    throw new ApiError(500, "DB_ERROR", "Failed to update archive status");
  }

  const counts = await getIssueCountsByProject([projectId]);
  const favSet = await getUserFavorites(userId, [projectId]);
  const { data: profile } = await admin
    .from("profiles")
    .select("name")
    .eq("id", updated.owner_id)
    .single();

  return toProjectResponse(
    updated,
    profile?.name ?? "Unknown",
    counts.get(projectId) ?? {},
    favSet.has(projectId),
  );
}

// --- Toggle favorite (FR-027) ---

export async function toggleFavorite(
  projectId: string,
  userId: string,
  favorite: boolean,
): Promise<void> {
  const admin = createAdminClient();

  // Verify project exists and user has access
  const { data: project, error } = await admin
    .from("projects")
    .select("team_id")
    .eq("id", projectId)
    .is("deleted_at", null)
    .single();

  if (error || !project) {
    throw new ApiError(404, "NOT_FOUND", "Project not found");
  }
  await requireTeamMembership(userId, project.team_id);

  if (favorite) {
    await admin
      .from("project_favorites")
      .upsert({ project_id: projectId, user_id: userId }, { onConflict: "project_id,user_id" });
  } else {
    await admin
      .from("project_favorites")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", userId);
  }
}

// --- Project dashboard (FR-080) ---

export async function getProjectDashboard(
  projectId: string,
  userId: string,
): Promise<ProjectDashboardResponse> {
  const admin = createAdminClient();

  const projectResp = await getProject(projectId, userId);

  // Fetch all non-deleted issues for this project
  const { data: issues, error: issueErr } = await admin
    .from("issues")
    .select("id, title, status_id, priority, assignee_id, due_date, created_at, issue_statuses!inner(name)")
    .eq("project_id", projectId)
    .is("deleted_at", null);

  if (issueErr) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch project issues");
  }

  const allIssues = (issues ?? []) as Record<string, unknown>[];

  // Resolve assignee names
  const assigneeIds = [
    ...new Set(
      allIssues
        .map((i) => i.assignee_id as string | null)
        .filter(Boolean),
    ),
  ];
  const assigneeMap = new Map<string, { name: string; initials: string; color: string }>();
  if (assigneeIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, name")
      .in("id", assigneeIds);

    (profiles ?? []).forEach((p: { id: string; name: string }, idx: number) => {
      assigneeMap.set(p.id, {
        name: p.name,
        initials: getInitials(p.name),
        color: getAvatarColor(idx),
      });
    });
  }

  // Map issues to a simpler shape
  const mapped = allIssues.map((i) => {
    const statusName = (i.issue_statuses as { name: string }).name;
    const assignee = i.assignee_id ? assigneeMap.get(i.assignee_id as string) : null;
    return {
      id: i.id as string,
      title: i.title as string,
      status: statusName,
      priority: i.priority as string,
      assigneeId: i.assignee_id as string | null,
      assigneeName: assignee?.name ?? null,
      assigneeInitials: assignee?.initials ?? null,
      assigneeColor: assignee?.color ?? null,
      dueDate: i.due_date as string | null,
      createdAt: i.created_at as string,
    };
  });

  // KPIs
  const total = mapped.length;
  const done = mapped.filter((i) => i.status === "Done").length;
  const inFlight = mapped.filter(
    (i) => i.status === "In Progress" || i.status === "In Review",
  ).length;
  const highOpen = mapped.filter(
    (i) => i.priority === "HIGH" && i.status !== "Done",
  ).length;

  // Status breakdown
  const statusCounts = new Map<string, number>();
  mapped.forEach((i) => statusCounts.set(i.status, (statusCounts.get(i.status) ?? 0) + 1));
  const statusBreakdown = Object.keys(STATUS_COLORS).map((name) => ({
    name,
    count: statusCounts.get(name) ?? 0,
    color: STATUS_COLORS[name],
  }));

  // Priority breakdown
  const prioCounts = new Map<string, number>();
  mapped.forEach((i) => prioCounts.set(i.priority, (prioCounts.get(i.priority) ?? 0) + 1));
  const priorityBreakdown = ["HIGH", "MEDIUM", "LOW"].map((name) => ({
    name: name.charAt(0) + name.slice(1).toLowerCase(),
    count: prioCounts.get(name) ?? 0,
    color: PRIORITY_COLORS[name],
  }));

  // Workload by assignee (open issues only)
  const wlMap = new Map<string, number>();
  mapped
    .filter((i) => i.status !== "Done" && i.assigneeId)
    .forEach((i) => wlMap.set(i.assigneeId!, (wlMap.get(i.assigneeId!) ?? 0) + 1));
  const workloadByAssignee = [...wlMap.entries()]
    .map(([uid, count]) => {
      const info = assigneeMap.get(uid);
      return {
        userId: uid,
        name: info?.name ?? "Unknown",
        initials: info?.initials ?? "?",
        color: info?.color ?? getAvatarColor(0),
        openCount: count,
      };
    })
    .sort((a, b) => b.openCount - a.openCount)
    .slice(0, 5);

  // Recent issues (max 5)
  const recentIssues: DashboardIssue[] = [...mapped]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map(toDashboardIssue);

  // Due soon (within 7 days, not done, max 5)
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dueSoonIssues: DashboardIssue[] = mapped
    .filter((i) => {
      if (!i.dueDate || i.status === "Done") return false;
      const d = new Date(i.dueDate);
      return d <= in7;
    })
    .sort(
      (a, b) =>
        new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime(),
    )
    .slice(0, 5)
    .map(toDashboardIssue);

  return {
    project: projectResp,
    kpis: {
      totalIssues: total,
      completionRate: total ? Math.round((done / total) * 100) : 0,
      inFlight,
      highPriorityOpen: highOpen,
    },
    statusBreakdown,
    priorityBreakdown,
    workloadByAssignee,
    recentIssues,
    dueSoonIssues,
  };
}

// --- Helpers ---

function toProjectResponse(
  row: { id: string; team_id: string; owner_id: string; name: string; description: string | null; is_archived: boolean; created_at: string },
  ownerName: string,
  issueCounts: Record<string, number>,
  isFavorited: boolean,
): ProjectResponse {
  return {
    id: row.id,
    teamId: row.team_id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    isArchived: row.is_archived,
    createdAt: row.created_at,
    issueCounts,
    isFavorited,
    ownerName,
    ownerInitials: getInitials(ownerName),
  };
}

function toDashboardIssue(i: Record<string, unknown>): DashboardIssue {
  return {
    id: i.id as string,
    title: i.title as string,
    status: i.status as string,
    priority: i.priority as string,
    assigneeName: i.assigneeName as string | null,
    assigneeInitials: i.assigneeInitials as string | null,
    dueDate: i.dueDate as string | null,
    createdAt: i.createdAt as string,
  };
}

async function getIssueCountsByProject(
  projectIds: string[],
): Promise<Map<string, Record<string, number>>> {
  const map = new Map<string, Record<string, number>>();
  if (projectIds.length === 0) return map;

  const admin = createAdminClient();
  const { data } = await admin
    .from("issues")
    .select("project_id, status_id, issue_statuses!inner(name)")
    .in("project_id", projectIds)
    .is("deleted_at", null);

  (data ?? []).forEach((row: Record<string, unknown>) => {
    const pid = row.project_id as string;
    const statusName = (row.issue_statuses as { name: string }).name;
    if (!map.has(pid)) map.set(pid, {});
    const counts = map.get(pid)!;
    counts[statusName] = (counts[statusName] ?? 0) + 1;
  });

  return map;
}

async function getUserFavorites(
  userId: string,
  projectIds: string[],
): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("project_favorites")
    .select("project_id")
    .eq("user_id", userId)
    .in("project_id", projectIds);

  return new Set((data ?? []).map((f: { project_id: string }) => f.project_id));
}

// Permission check: user must be team OWNER, ADMIN, or project owner.
// Returns the project row.
async function getProjectForMutation(
  projectId: string,
  userId: string,
): Promise<{ team_id: string; owner_id: string }> {
  const admin = createAdminClient();

  const { data: project, error } = await admin
    .from("projects")
    .select("team_id, owner_id")
    .eq("id", projectId)
    .is("deleted_at", null)
    .single();

  if (error || !project) {
    throw new ApiError(404, "NOT_FOUND", "Project not found");
  }

  const role = await requireTeamMembership(userId, project.team_id);

  // Project owner can always mutate; team OWNER/ADMIN can too
  if (project.owner_id === userId || role === "OWNER" || role === "ADMIN") {
    return project;
  }

  throw new ApiError(403, "FORBIDDEN", "You don't have permission to modify this project");
}
