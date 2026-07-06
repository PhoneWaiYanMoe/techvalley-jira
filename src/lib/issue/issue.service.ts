import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/utils/errors";
import { requireTeamMembership } from "@/lib/team/team.service";
import { isOwnerOrAdmin } from "@/lib/permissions/team-role";
import type {
  IssueDetailResponse,
  IssueListResponse,
  IssueResponse,
  IssueStatusOption,
  TeamRole,
} from "@/types/api";
import type { CreateIssueInput, UpdateIssueInput } from "@/validation/issue.schema";

const ISSUE_LIMIT_PER_PROJECT = 200;
const DEFAULT_PAGE_SIZE = 20;

// Fallback colors for statuses without an explicit color (matches design prototype)
const STATUS_COLORS: Record<string, string> = {
  Backlog: "#94a3b8",
  "In Progress": "#6366f1",
  "In Review": "#e0982e",
  Done: "#10b981",
};

function statusColor(name: string, color: string | null): string {
  return color ?? STATUS_COLORS[name] ?? "#94a3b8";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

type IssueRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status_id: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  assignee_id: string | null;
  creator_id: string;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  issue_statuses: { id: string; name: string; color: string | null };
};

const ISSUE_SELECT =
  "id, project_id, title, description, status_id, priority, assignee_id, creator_id, due_date, position, created_at, updated_at, issue_statuses!inner(id, name, color)";

// --- Access guards (FR-070: non-members get 404, never 403) ---

type ProjectRow = { id: string; team_id: string; owner_id: string; name: string; is_archived: boolean };

async function requireProjectAccess(
  projectId: string,
  userId: string,
): Promise<{ project: ProjectRow; role: TeamRole }> {
  const admin = createAdminClient();

  const { data: project, error } = await admin
    .from("projects")
    .select("id, team_id, owner_id, name, is_archived")
    .eq("id", projectId)
    .is("deleted_at", null)
    .single();

  if (error || !project) {
    throw new ApiError(404, "NOT_FOUND", "Project not found");
  }

  const role = await requireTeamMembership(userId, project.team_id);
  return { project, role };
}

async function requireIssueAccess(
  issueId: string,
  userId: string,
): Promise<{ issue: IssueRow; project: ProjectRow; role: TeamRole }> {
  const admin = createAdminClient();

  const { data: issue, error } = await admin
    .from("issues")
    .select(ISSUE_SELECT)
    .eq("id", issueId)
    .is("deleted_at", null)
    .single();

  if (error || !issue) {
    throw new ApiError(404, "NOT_FOUND", "Issue not found");
  }

  const { project, role } = await requireProjectAccess(issue.project_id, userId);
  return { issue: issue as unknown as IssueRow, project, role };
}

// FR-034: assignee must be a member of the project's team
async function requireAssigneeInTeam(assigneeUserId: string, teamId: string): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("team_members")
    .select("user_id")
    .eq("user_id", assigneeUserId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to check assignee membership");
  }
  if (!data) {
    throw new ApiError(422, "INVALID_ASSIGNEE", "Assignee must be a member of the project's team");
  }
}

// --- Statuses (FR-033; CRUD arrives with FR-053) ---

export async function listStatuses(
  projectId: string,
  userId: string,
): Promise<IssueStatusOption[]> {
  const admin = createAdminClient();
  await requireProjectAccess(projectId, userId);

  const { data, error } = await admin
    .from("issue_statuses")
    .select("id, name, color, position, is_default, wip_limit")
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch statuses");
  }

  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    color: statusColor(s.name, s.color),
    position: s.position,
    isDefault: s.is_default,
    wipLimit: s.wip_limit,
  }));
}

// --- Create issue (FR-030) ---

export async function createIssue(
  projectId: string,
  userId: string,
  input: CreateIssueInput,
): Promise<IssueResponse> {
  const admin = createAdminClient();
  const { project } = await requireProjectAccess(projectId, userId);

  if (project.is_archived) {
    throw new ApiError(422, "PROJECT_ARCHIVED", "This project is archived and read-only");
  }

  const { count, error: countErr } = await admin
    .from("issues")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .is("deleted_at", null);

  if (countErr) {
    throw new ApiError(500, "DB_ERROR", "Failed to check issue count");
  }
  if ((count ?? 0) >= ISSUE_LIMIT_PER_PROJECT) {
    throw new ApiError(
      422,
      "ISSUE_LIMIT",
      "This project has reached the maximum of 200 issues",
    );
  }

  if (input.assigneeUserId) {
    await requireAssigneeInTeam(input.assigneeUserId, project.team_id);
  }

  // FR-030: created with status = Backlog (the lowest-position seeded default)
  const { data: backlog, error: statusErr } = await admin
    .from("issue_statuses")
    .select("id")
    .eq("project_id", projectId)
    .eq("is_default", true)
    .order("position", { ascending: true })
    .limit(1)
    .single();

  if (statusErr || !backlog) {
    throw new ApiError(500, "DB_ERROR", "Project has no default status");
  }

  const position = await nextPositionInStatus(backlog.id);

  const { data: created, error: insertErr } = await admin
    .from("issues")
    .insert({
      project_id: projectId,
      title: input.title,
      description: input.description ?? null,
      status_id: backlog.id,
      priority: input.priority ?? "MEDIUM",
      assignee_id: input.assigneeUserId ?? null,
      creator_id: userId,
      due_date: input.dueDate ?? null,
      position,
    })
    .select(ISSUE_SELECT)
    .single();

  if (insertErr || !created) {
    throw new ApiError(500, "DB_ERROR", "Failed to create issue");
  }

  return toIssueResponse(created as unknown as IssueRow, await getProfileMap([created.assignee_id]));
}

// --- List issues (basic version; FR-036 filters/sort arrive Day 4) ---

export async function listIssues(
  projectId: string,
  userId: string,
  opts: { cursor?: string | null; limit?: number },
): Promise<IssueListResponse> {
  const admin = createAdminClient();
  await requireProjectAccess(projectId, userId);

  const limit = Math.min(Math.max(opts.limit ?? DEFAULT_PAGE_SIZE, 1), 50);

  const { count, error: countErr } = await admin
    .from("issues")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .is("deleted_at", null);

  if (countErr) {
    throw new ApiError(500, "DB_ERROR", "Failed to count issues");
  }

  let query = admin
    .from("issues")
    .select(ISSUE_SELECT)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (opts.cursor) {
    // Keyset pagination: cursor is the last issue id of the previous page
    const { data: cursorRow } = await admin
      .from("issues")
      .select("created_at, id")
      .eq("id", opts.cursor)
      .single();

    if (cursorRow) {
      query = query.or(
        `created_at.lt.${cursorRow.created_at},and(created_at.eq.${cursorRow.created_at},id.lt.${cursorRow.id})`,
      );
    }
  }

  const { data: rows, error } = await query;

  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch issues");
  }

  const page = (rows ?? []).slice(0, limit) as unknown as IssueRow[];
  const hasMore = (rows ?? []).length > limit;

  const profileMap = await getProfileMap(page.map((r) => r.assignee_id));

  return {
    data: page.map((r) => toIssueResponse(r, profileMap)),
    nextCursor: hasMore ? page[page.length - 1].id : null,
    total: count ?? 0,
  };
}

// --- Issue detail (FR-031) ---

export async function getIssueDetail(
  issueId: string,
  userId: string,
): Promise<IssueDetailResponse> {
  const admin = createAdminClient();
  const { issue, project, role } = await requireIssueAccess(issueId, userId);

  const profileMap = await getProfileMap([issue.assignee_id, issue.creator_id]);

  const [{ count: commentCount }, { data: subtasks }] = await Promise.all([
    admin
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("issue_id", issueId)
      .is("deleted_at", null),
    admin
      .from("subtasks")
      .select("id, title, is_completed, position")
      .eq("issue_id", issueId)
      .order("position", { ascending: true }),
  ]);

  const creator = profileMap.get(issue.creator_id);

  return {
    ...toIssueResponse(issue, profileMap),
    description: issue.description,
    creator: { id: issue.creator_id, name: creator?.name ?? "Unknown" },
    teamId: project.team_id,
    projectName: project.name,
    projectArchived: project.is_archived,
    canDelete: canDeleteIssue(issue, project, role, userId),
    subtasks: (subtasks ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      isCompleted: s.is_completed,
      position: s.position,
    })),
    labels: [], // FR-038 (Day 4)
    commentCount: commentCount ?? 0,
  };
}

// --- Update issue (FR-032; any team member) ---

export async function updateIssue(
  issueId: string,
  userId: string,
  input: UpdateIssueInput,
): Promise<IssueResponse> {
  const admin = createAdminClient();
  const { issue, project } = await requireIssueAccess(issueId, userId);

  if (project.is_archived) {
    throw new ApiError(422, "PROJECT_ARCHIVED", "This project is archived and read-only");
  }

  const update: Record<string, unknown> = {};
  const history: { field_name: string; old_value: string | null; new_value: string | null }[] = [];

  if (input.title !== undefined && input.title !== issue.title) {
    update.title = input.title;
    history.push({ field_name: "title", old_value: issue.title, new_value: input.title });
  }

  if (input.description !== undefined && input.description !== issue.description) {
    update.description = input.description;
    // description changes aren't tracked in issue_history (schema: status|assignee|priority|title|due_date)
  }

  if (input.priority !== undefined && input.priority !== issue.priority) {
    update.priority = input.priority;
    history.push({ field_name: "priority", old_value: issue.priority, new_value: input.priority });
  }

  if (input.dueDate !== undefined && input.dueDate !== issue.due_date) {
    update.due_date = input.dueDate;
    history.push({ field_name: "due_date", old_value: issue.due_date, new_value: input.dueDate });
  }

  if (input.statusId !== undefined && input.statusId !== issue.status_id) {
    // FR-033: status must belong to this project
    const { data: status, error } = await admin
      .from("issue_statuses")
      .select("id, name")
      .eq("id", input.statusId)
      .eq("project_id", issue.project_id)
      .maybeSingle();

    if (error) {
      throw new ApiError(500, "DB_ERROR", "Failed to check status");
    }
    if (!status) {
      throw new ApiError(422, "INVALID_STATUS", "Status does not belong to this project");
    }

    update.status_id = input.statusId;
    update.position = await nextPositionInStatus(input.statusId);
    history.push({
      field_name: "status",
      old_value: issue.issue_statuses.name,
      new_value: status.name,
    });
  }

  if (input.assigneeUserId !== undefined && input.assigneeUserId !== issue.assignee_id) {
    if (input.assigneeUserId !== null) {
      await requireAssigneeInTeam(input.assigneeUserId, project.team_id);
    }
    update.assignee_id = input.assigneeUserId;

    const names = await getProfileMap([issue.assignee_id, input.assigneeUserId]);
    history.push({
      field_name: "assignee",
      old_value: issue.assignee_id ? (names.get(issue.assignee_id)?.name ?? null) : null,
      new_value: input.assigneeUserId ? (names.get(input.assigneeUserId)?.name ?? null) : null,
    });
  }

  if (Object.keys(update).length === 0) {
    return toIssueResponse(issue, await getProfileMap([issue.assignee_id]));
  }

  const { data: updated, error: updateErr } = await admin
    .from("issues")
    .update(update)
    .eq("id", issueId)
    .select(ISSUE_SELECT)
    .single();

  if (updateErr || !updated) {
    throw new ApiError(500, "DB_ERROR", "Failed to update issue");
  }

  // FR-039 groundwork: one history row per changed tracked field
  if (history.length > 0) {
    await admin.from("issue_history").insert(
      history.map((h) => ({ ...h, issue_id: issueId, changed_by: userId })),
    );
  }

  return toIssueResponse(
    updated as unknown as IssueRow,
    await getProfileMap([updated.assignee_id]),
  );
}

// --- Delete issue (FR-035: creator, project owner, team OWNER/ADMIN) ---

export async function deleteIssue(issueId: string, userId: string): Promise<void> {
  const admin = createAdminClient();
  const { issue, project, role } = await requireIssueAccess(issueId, userId);

  if (!canDeleteIssue(issue, project, role, userId)) {
    throw new ApiError(403, "FORBIDDEN", "You don't have permission to delete this issue");
  }

  const { error } = await admin
    .from("issues")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", issueId);

  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to delete issue");
  }
}

// --- Helpers ---

function canDeleteIssue(
  issue: { creator_id: string },
  project: { owner_id: string },
  role: TeamRole,
  userId: string,
): boolean {
  return (
    issue.creator_id === userId ||
    project.owner_id === userId ||
    isOwnerOrAdmin(role)
  );
}

async function nextPositionInStatus(statusId: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("issues")
    .select("position")
    .eq("status_id", statusId)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.position ?? 0) + 1;
}

async function getProfileMap(
  userIds: (string | null)[],
): Promise<Map<string, { name: string; initials: string }>> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  const map = new Map<string, { name: string; initials: string }>();
  if (ids.length === 0) return map;

  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id, name").in("id", ids);

  (data ?? []).forEach((p: { id: string; name: string }) => {
    map.set(p.id, { name: p.name, initials: getInitials(p.name) });
  });

  return map;
}

function toIssueResponse(
  row: IssueRow,
  profileMap: Map<string, { name: string; initials: string }>,
): IssueResponse {
  const assignee = row.assignee_id ? profileMap.get(row.assignee_id) : null;
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    priority: row.priority,
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: {
      id: row.issue_statuses.id,
      name: row.issue_statuses.name,
      color: statusColor(row.issue_statuses.name, row.issue_statuses.color),
    },
    assignee:
      row.assignee_id && assignee
        ? { id: row.assignee_id, name: assignee.name, initials: assignee.initials }
        : null,
  };
}
