import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/utils/errors";
import { getUserTeams, requireTeamMembership } from "@/lib/team/team.service";
import { listProjects } from "@/lib/project/project.service";
import type {
  PersonalDashboardResponse,
  PersonalDashboardIssue,
  StatsPeriod,
  StatsTrendPoint,
  MemberStatCount,
  ProjectStatusBreakdown,
  TeamStatsResponse,
} from "@/types/api";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// --- Personal dashboard (FR-081) ---

export async function getPersonalDashboard(userId: string): Promise<PersonalDashboardResponse> {
  const admin = createAdminClient();

  const [teams, projectList] = await Promise.all([getUserTeams(userId), listProjects(userId)]);

  // Issues assigned to me, excluding archived projects (matches the
  // due-date-check convention: archived-project work is read-only, so it
  // doesn't belong in an actionable "my work" view).
  const { data: rows, error } = await admin
    .from("issues")
    .select(
      "id, title, priority, due_date, created_at, project_id, projects!inner(name, is_archived), issue_statuses!inner(name)",
    )
    .eq("assignee_id", userId)
    .is("deleted_at", null)
    .eq("projects.is_archived", false);

  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch assigned issues");
  }

  const mapped: PersonalDashboardIssue[] = (
    (rows ?? []) as unknown as {
      id: string;
      title: string;
      priority: "HIGH" | "MEDIUM" | "LOW";
      due_date: string | null;
      created_at: string;
      project_id: string;
      projects: { name: string };
      issue_statuses: { name: string };
    }[]
  ).map((r) => ({
    id: r.id,
    title: r.title,
    status: r.issue_statuses.name,
    priority: r.priority,
    assigneeName: null,
    assigneeInitials: null,
    dueDate: r.due_date,
    createdAt: r.created_at,
    projectId: r.project_id,
    projectName: r.projects.name,
  }));

  const statusMap = new Map<string, PersonalDashboardIssue[]>();
  for (const issue of mapped) {
    const list = statusMap.get(issue.status) ?? [];
    list.push(issue);
    statusMap.set(issue.status, list);
  }
  const issuesByStatus = [...statusMap.entries()]
    .map(([status, issues]) => ({ status, count: issues.length, issues }))
    .sort((a, b) => b.count - a.count);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const dueTodayIssues = mapped
    .filter((i) => i.dueDate === todayStr && i.status !== "Done")
    .sort((a, b) => a.title.localeCompare(b.title));

  const dueSoonIssues = mapped
    .filter((i) => {
      if (!i.dueDate || i.status === "Done" || i.dueDate === todayStr) return false;
      const d = new Date(i.dueDate);
      return d > now && d <= in7;
    })
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

  // Recent comments (max 5). Comments have a table (schema.sql) but no
  // service layer yet — that's Dev B's Day 5 scope, not landed as of Day 6.
  // Read the table directly rather than waiting on that service to exist.
  const { data: commentRows } = await admin
    .from("comments")
    .select("id, content, created_at, issue_id, issues!inner(title, project_id)")
    .eq("author_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5);

  const recentComments = (
    (commentRows ?? []) as unknown as {
      id: string;
      content: string;
      created_at: string;
      issue_id: string;
      issues: { title: string; project_id: string };
    }[]
  ).map((c) => ({
    id: c.id,
    issueId: c.issue_id,
    issueTitle: c.issues.title,
    projectId: c.issues.project_id,
    content: c.content,
    createdAt: c.created_at,
  }));

  return {
    totalAssigned: mapped.length,
    issuesByStatus,
    dueTodayIssues,
    dueSoonIssues,
    recentComments,
    teams,
    projects: projectList.data,
  };
}

// --- Team statistics (FR-082) ---

export function parsePeriod(raw: string | null): StatsPeriod {
  const n = Number(raw);
  return n === 7 || n === 90 ? n : 30;
}

function buildTrend(timestamps: string[], period: StatsPeriod): StatsTrendPoint[] {
  const counts = new Map<string, number>();
  for (const ts of timestamps) {
    const date = ts.slice(0, 10);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }

  const points: StatsTrendPoint[] = [];
  const today = new Date();
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 10);
    points.push({ date: dateStr, count: counts.get(dateStr) ?? 0 });
  }
  return points;
}

export async function getTeamStats(
  teamId: string,
  userId: string,
  period: StatsPeriod,
): Promise<TeamStatsResponse> {
  await requireTeamMembership(userId, teamId);
  const admin = createAdminClient();

  const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();

  const { data: projectRows, error: projErr } = await admin
    .from("projects")
    .select("id, name")
    .eq("team_id", teamId)
    .is("deleted_at", null);

  if (projErr) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch team projects");
  }

  const projects = (projectRows ?? []) as { id: string; name: string }[];
  const projectIds = projects.map((p) => p.id);

  const { data: memberRows, error: memErr } = await admin
    .from("team_members")
    .select("user_id, profiles!inner(name)")
    .eq("team_id", teamId);

  if (memErr) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch team members");
  }

  const members = (memberRows ?? []) as unknown as { user_id: string; profiles: { name: string } }[];
  const memberInfo = new Map(
    members.map((m) => [m.user_id, { name: m.profiles.name, initials: getInitials(m.profiles.name) }]),
  );

  if (projectIds.length === 0) {
    const emptyPerMember: MemberStatCount[] = members.map((m) => ({
      userId: m.user_id,
      name: memberInfo.get(m.user_id)!.name,
      initials: memberInfo.get(m.user_id)!.initials,
      count: 0,
    }));
    return {
      period,
      creationTrend: buildTrend([], period),
      completionTrend: buildTrend([], period),
      assignedPerMember: emptyPerMember,
      completedPerMember: emptyPerMember,
      statusPerProject: [],
    };
  }

  // Creation trend
  const { data: createdRows, error: createdErr } = await admin
    .from("issues")
    .select("created_at")
    .in("project_id", projectIds)
    .is("deleted_at", null)
    .gte("created_at", since);

  if (createdErr) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch issue creation data");
  }
  const creationTrend = buildTrend(
    ((createdRows ?? []) as { created_at: string }[]).map((r) => r.created_at),
    period,
  );

  // Completion — status transitions to "Done" via issue_history, attributed
  // to the issue's current assignee (matches assignedPerMember's assignee-
  // centric framing rather than whoever happened to click the dropdown).
  const { data: doneRows, error: doneErr } = await admin
    .from("issue_history")
    .select("created_at, issues!inner(project_id, assignee_id)")
    .eq("field_name", "status")
    .eq("new_value", "Done")
    .gte("created_at", since);

  if (doneErr) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch completion data");
  }

  const doneInTeam = (
    (doneRows ?? []) as unknown as {
      created_at: string;
      issues: { project_id: string; assignee_id: string | null };
    }[]
  ).filter((r) => projectIds.includes(r.issues.project_id));

  const completionTrend = buildTrend(
    doneInTeam.map((r) => r.created_at),
    period,
  );

  const completedCounts = new Map<string, number>();
  for (const r of doneInTeam) {
    if (!r.issues.assignee_id) continue;
    completedCounts.set(r.issues.assignee_id, (completedCounts.get(r.issues.assignee_id) ?? 0) + 1);
  }

  // Assigned per member — current open-workload snapshot (not period-scoped).
  const { data: openRows, error: openErr } = await admin
    .from("issues")
    .select("assignee_id, issue_statuses!inner(name)")
    .in("project_id", projectIds)
    .is("deleted_at", null)
    .not("assignee_id", "is", null);

  if (openErr) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch assignment data");
  }

  const assignedCounts = new Map<string, number>();
  for (const r of (openRows ?? []) as unknown as { assignee_id: string; issue_statuses: { name: string } }[]) {
    if (r.issue_statuses.name === "Done") continue;
    assignedCounts.set(r.assignee_id, (assignedCounts.get(r.assignee_id) ?? 0) + 1);
  }

  const toMemberStats = (counts: Map<string, number>): MemberStatCount[] =>
    members
      .map((m) => ({
        userId: m.user_id,
        name: memberInfo.get(m.user_id)!.name,
        initials: memberInfo.get(m.user_id)!.initials,
        count: counts.get(m.user_id) ?? 0,
      }))
      .sort((a, b) => b.count - a.count);

  // Issue status per project — current snapshot.
  const { data: statusRows, error: statusErr } = await admin
    .from("issues")
    .select("project_id, issue_statuses!inner(name, color)")
    .in("project_id", projectIds)
    .is("deleted_at", null);

  if (statusErr) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch issue status data");
  }

  const statusPerProjectMap = new Map<string, Map<string, { count: number; color: string | null }>>();
  for (const r of (statusRows ?? []) as unknown as {
    project_id: string;
    issue_statuses: { name: string; color: string | null };
  }[]) {
    const inner = statusPerProjectMap.get(r.project_id) ?? new Map();
    const existing = inner.get(r.issue_statuses.name) ?? { count: 0, color: r.issue_statuses.color };
    existing.count += 1;
    inner.set(r.issue_statuses.name, existing);
    statusPerProjectMap.set(r.project_id, inner);
  }

  const statusPerProject: ProjectStatusBreakdown[] = projects.map((p) => ({
    projectId: p.id,
    projectName: p.name,
    statuses: [...(statusPerProjectMap.get(p.id) ?? new Map()).entries()].map(([name, v]) => ({
      name,
      count: v.count,
      color: v.color,
    })),
  }));

  return {
    period,
    creationTrend,
    completionTrend,
    assignedPerMember: toMemberStats(assignedCounts),
    completedPerMember: toMemberStats(completedCounts),
    statusPerProject,
  };
}
