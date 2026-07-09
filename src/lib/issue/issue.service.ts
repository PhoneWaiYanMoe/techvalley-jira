import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/utils/errors";
import { requireTeamMembership } from "@/lib/team/team.service";
import { isOwnerOrAdmin } from "@/lib/permissions/team-role";
import { createNotification } from "@/lib/notification/notification.service";
import type {
  BoardCard,
  BoardResponse,
  IssueDetailResponse,
  IssueHistoryResponse,
  IssueListResponse,
  IssueResponse,
  IssueStatusOption,
  TeamRole,
} from "@/types/api";
import type {
  CreateIssueInput,
  MoveIssueInput,
  UpdateIssueInput,
} from "@/validation/issue.schema";

const ISSUE_LIMIT_PER_PROJECT = 200;
const DEFAULT_PAGE_SIZE = 20;

// Fallback colors for statuses without an explicit color (matches design prototype)
const STATUS_COLORS: Record<string, string> = {
  Backlog: "#94a3b8",
  "In Progress": "#6366f1",
  "In Review": "#e0982e",
  Done: "#10b981",
};

export function statusColor(name: string, color: string | null): string {
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

export type ProjectRow = { id: string; team_id: string; owner_id: string; name: string; is_archived: boolean };

export async function requireProjectAccess(
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

export async function requireIssueAccess(
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

  // FR-038: link any selected labels (validated against the project).
  if (input.labelIds && input.labelIds.length > 0) {
    await syncIssueLabels(created.id, projectId, input.labelIds);
  }

  // FR-090: notify the assignee, if one was set on creation.
  if (created.assignee_id) {
    await createNotification(
      created.assignee_id,
      "ISSUE_ASSIGNED",
      `You were assigned to "${created.title}"`,
      undefined,
      "issue",
      created.id,
    );
  }

  return toIssueResponse(created as unknown as IssueRow, await getProfileMap([created.assignee_id]));
}

// --- List issues with search / filter / sort (FR-036) ---

export type ListIssuesFilters = {
  cursor?: string | null; // offset-based cursor (stringified offset)
  limit?: number;
  status?: string; // statusId
  assignee?: string; // userId, or "unassigned"
  priority?: "HIGH" | "MEDIUM" | "LOW";
  label?: string; // labelId
  hasDueDate?: boolean;
  dueFrom?: string;
  dueTo?: string;
  search?: string; // title contains
  sort?: "created" | "due" | "priority" | "updated";
};

const PRIORITY_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export async function listIssues(
  projectId: string,
  userId: string,
  opts: ListIssuesFilters,
): Promise<IssueListResponse> {
  const admin = createAdminClient();
  await requireProjectAccess(projectId, userId);

  const limit = Math.min(Math.max(opts.limit ?? DEFAULT_PAGE_SIZE, 1), 50);
  const offset = Math.max(Number(opts.cursor ?? 0) || 0, 0);

  // FR-038 label filter: resolve the set of issue ids carrying that label first.
  let labelIssueIds: string[] | null = null;
  if (opts.label) {
    const { data: links } = await admin
      .from("issue_labels")
      .select("issue_id")
      .eq("label_id", opts.label);
    labelIssueIds = (links ?? []).map((l) => l.issue_id);
    if (labelIssueIds.length === 0) {
      return { data: [], nextCursor: null, total: 0 };
    }
  }

  // A project caps at 200 issues, so fetch all matches and sort/paginate in
  // memory — this keeps priority ordering and arbitrary sort keys simple.
  let query = admin
    .from("issues")
    .select(ISSUE_SELECT)
    .eq("project_id", projectId)
    .is("deleted_at", null);

  if (opts.status) query = query.eq("status_id", opts.status);
  if (opts.priority) query = query.eq("priority", opts.priority);
  if (opts.assignee === "unassigned") query = query.is("assignee_id", null);
  else if (opts.assignee) query = query.eq("assignee_id", opts.assignee);
  if (opts.hasDueDate) query = query.not("due_date", "is", null);
  if (opts.dueFrom) query = query.gte("due_date", opts.dueFrom);
  if (opts.dueTo) query = query.lte("due_date", opts.dueTo);
  if (opts.search) query = query.ilike("title", `%${opts.search}%`);
  if (labelIssueIds) query = query.in("id", labelIssueIds);

  const { data: rowsData, error } = await query.limit(ISSUE_LIMIT_PER_PROJECT);
  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch issues");
  }

  const rows = (rowsData ?? []) as unknown as IssueRow[];

  const sort = opts.sort ?? "created";
  rows.sort((a, b) => {
    switch (sort) {
      case "due": {
        // Nulls last, then earliest due first.
        if (a.due_date === b.due_date) return b.created_at.localeCompare(a.created_at);
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }
      case "priority":
        if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority]) {
          return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        }
        return b.created_at.localeCompare(a.created_at);
      case "updated":
        return b.updated_at.localeCompare(a.updated_at);
      case "created":
      default:
        return b.created_at.localeCompare(a.created_at);
    }
  });

  const total = rows.length;
  const page = rows.slice(offset, offset + limit);
  const hasMore = offset + limit < total;

  const [profileMap, labelMap] = await Promise.all([
    getProfileMap(page.map((r) => r.assignee_id)),
    getIssueLabelMap(page.map((r) => r.id)),
  ]);

  return {
    data: page.map((r) => ({
      ...toIssueResponse(r, profileMap),
      labels: labelMap.get(r.id) ?? [],
    })),
    nextCursor: hasMore ? String(offset + limit) : null,
    total,
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

  const [{ count: commentCount }, { data: subtasks }, labelMap] = await Promise.all([
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
    getIssueLabelMap([issueId]),
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
    labels: labelMap.get(issueId) ?? [],
    commentCount: commentCount ?? 0,
  };
}

// FR-038: validate labelIds belong to the project, then replace the issue's set.
async function syncIssueLabels(
  issueId: string,
  projectId: string,
  labelIds: string[],
): Promise<void> {
  const admin = createAdminClient();

  if (labelIds.length > 0) {
    const unique = [...new Set(labelIds)];
    const { data: valid, error } = await admin
      .from("labels")
      .select("id")
      .eq("project_id", projectId)
      .in("id", unique);

    if (error) {
      throw new ApiError(500, "DB_ERROR", "Failed to validate labels");
    }
    if ((valid?.length ?? 0) !== unique.length) {
      throw new ApiError(422, "INVALID_LABEL", "One or more labels do not belong to this project");
    }
  }

  const { error: delErr } = await admin.from("issue_labels").delete().eq("issue_id", issueId);
  if (delErr) {
    throw new ApiError(500, "DB_ERROR", "Failed to update labels");
  }

  if (labelIds.length > 0) {
    const rows = [...new Set(labelIds)].map((label_id) => ({ issue_id: issueId, label_id }));
    const { error: insErr } = await admin.from("issue_labels").insert(rows);
    if (insErr) {
      throw new ApiError(500, "DB_ERROR", "Failed to update labels");
    }
  }
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
    // FR-040/041: editing the description invalidates the AI summary/suggestion cache.
    update.ai_summary = null;
    update.ai_summary_generated_at = null;
    update.ai_suggestion = null;
    update.ai_suggestion_generated_at = null;
    update.ai_description_hash = null;
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

  // FR-038: replace-set the issue's labels when labelIds is provided.
  if (input.labelIds !== undefined) {
    await syncIssueLabels(issueId, issue.project_id, input.labelIds);
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

  // FR-090: notify the new assignee on reassignment (not on unassignment).
  if (
    input.assigneeUserId !== undefined &&
    input.assigneeUserId !== null &&
    input.assigneeUserId !== issue.assignee_id
  ) {
    await createNotification(
      input.assigneeUserId,
      "ISSUE_ASSIGNED",
      `You were assigned to "${updated.title}"`,
      undefined,
      "issue",
      issueId,
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

// --- Move issue (FR-051 cross-column, FR-052 reorder within column) ---

export async function moveIssue(
  issueId: string,
  userId: string,
  input: MoveIssueInput,
): Promise<void> {
  const admin = createAdminClient();
  const { issue, project } = await requireIssueAccess(issueId, userId);

  if (project.is_archived) {
    throw new ApiError(422, "PROJECT_ARCHIVED", "This project is archived and read-only");
  }

  // FR-033: status must belong to this project
  const { data: status, error: statusErr } = await admin
    .from("issue_statuses")
    .select("id, name")
    .eq("id", input.statusId)
    .eq("project_id", issue.project_id)
    .maybeSingle();

  if (statusErr) {
    throw new ApiError(500, "DB_ERROR", "Failed to check status");
  }
  if (!status) {
    throw new ApiError(422, "INVALID_STATUS", "Status does not belong to this project");
  }

  const { error: updateErr } = await admin
    .from("issues")
    .update({ status_id: input.statusId, position: input.position })
    .eq("id", issueId);

  if (updateErr) {
    throw new ApiError(500, "DB_ERROR", "Failed to move issue");
  }

  // FR-039: a cross-column move is a status change; a within-column reorder is not.
  if (input.statusId !== issue.status_id) {
    await admin.from("issue_history").insert({
      issue_id: issueId,
      field_name: "status",
      old_value: issue.issue_statuses.name,
      new_value: status.name,
      changed_by: userId,
    });
  }
}

// --- Issue change history (FR-039) ---

export async function getIssueHistory(
  issueId: string,
  userId: string,
  opts: { cursor?: string | null; limit?: number },
): Promise<IssueHistoryResponse> {
  const admin = createAdminClient();
  await requireIssueAccess(issueId, userId);

  const limit = Math.min(Math.max(opts.limit ?? DEFAULT_PAGE_SIZE, 1), 50);

  let query = admin
    .from("issue_history")
    .select("id, changed_by, field_name, old_value, new_value, created_at")
    .eq("issue_id", issueId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (opts.cursor) {
    const { data: cursorRow } = await admin
      .from("issue_history")
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
    throw new ApiError(500, "DB_ERROR", "Failed to fetch history");
  }

  type HistoryRow = {
    id: string;
    changed_by: string | null;
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    created_at: string;
  };

  const all = (rows ?? []) as HistoryRow[];
  const page = all.slice(0, limit);
  const hasMore = all.length > limit;

  const profileMap = await getProfileMap(page.map((r) => r.changed_by));

  return {
    data: page.map((r) => ({
      id: r.id,
      field: r.field_name,
      oldValue: r.old_value,
      newValue: r.new_value,
      changedBy: r.changed_by ? (profileMap.get(r.changed_by)?.name ?? "Unknown") : "Unknown",
      changedAt: r.created_at,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

// --- Kanban board (FR-050): statuses + all cards in one payload ---

export async function getBoard(projectId: string, userId: string): Promise<BoardResponse> {
  const admin = createAdminClient();
  await requireProjectAccess(projectId, userId);

  // Statuses are fetched inline (not via status.service) to avoid an import cycle.
  const { data: statusRows, error: statusErr } = await admin
    .from("issue_statuses")
    .select("id, name, color, position, is_default, wip_limit")
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  if (statusErr) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch statuses");
  }

  const statuses: IssueStatusOption[] = (statusRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    color: statusColor(s.name, s.color),
    position: s.position,
    isDefault: s.is_default,
    wipLimit: s.wip_limit,
  }));

  const { data: issueRows, error: issueErr } = await admin
    .from("issues")
    .select(
      "id, title, status_id, priority, assignee_id, due_date, position, created_at",
    )
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("position", { ascending: true })
    .limit(ISSUE_LIMIT_PER_PROJECT);

  if (issueErr) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch board issues");
  }

  const rows = issueRows ?? [];
  const issueIds = rows.map((r) => r.id);
  const profileMap = await getProfileMap(rows.map((r) => r.assignee_id));

  // Subtask progress + labels per card (labels stay empty until FR-038 populates them).
  const [subtaskMap, labelMap] = await Promise.all([
    getSubtaskProgressMap(issueIds),
    getIssueLabelMap(issueIds),
  ]);

  const cards: BoardCard[] = rows.map((r) => {
    const assignee = r.assignee_id ? profileMap.get(r.assignee_id) : null;
    return {
      id: r.id,
      title: r.title,
      statusId: r.status_id,
      priority: r.priority,
      position: Number(r.position),
      dueDate: r.due_date,
      createdAt: r.created_at,
      assignee:
        r.assignee_id && assignee
          ? { id: r.assignee_id, name: assignee.name, initials: assignee.initials }
          : null,
      labels: labelMap.get(r.id) ?? [],
      subtaskProgress: subtaskMap.get(r.id) ?? { done: 0, total: 0 },
    };
  });

  return { statuses, issues: cards };
}

async function getSubtaskProgressMap(
  issueIds: string[],
): Promise<Map<string, { done: number; total: number }>> {
  const map = new Map<string, { done: number; total: number }>();
  if (issueIds.length === 0) return map;

  const admin = createAdminClient();
  const { data } = await admin
    .from("subtasks")
    .select("issue_id, is_completed")
    .in("issue_id", issueIds);

  (data ?? []).forEach((s: { issue_id: string; is_completed: boolean }) => {
    const prog = map.get(s.issue_id) ?? { done: 0, total: 0 };
    prog.total += 1;
    if (s.is_completed) prog.done += 1;
    map.set(s.issue_id, prog);
  });

  return map;
}

async function getIssueLabelMap(
  issueIds: string[],
): Promise<Map<string, { id: string; name: string; color: string }[]>> {
  const map = new Map<string, { id: string; name: string; color: string }[]>();
  if (issueIds.length === 0) return map;

  const admin = createAdminClient();
  const { data } = await admin
    .from("issue_labels")
    .select("issue_id, labels!inner(id, name, color)")
    .in("issue_id", issueIds);

  type LabelJoinRow = {
    issue_id: string;
    // PostgREST embeds a to-one relation as an object, but the generated types
    // widen it to an array — normalize either shape.
    labels:
      | { id: string; name: string; color: string }
      | { id: string; name: string; color: string }[];
  };

  ((data ?? []) as LabelJoinRow[]).forEach((row) => {
    const label = Array.isArray(row.labels) ? row.labels[0] : row.labels;
    if (!label) return;
    const list = map.get(row.issue_id) ?? [];
    list.push({ id: label.id, name: label.name, color: label.color });
    map.set(row.issue_id, list);
  });

  return map;
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
