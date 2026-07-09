// Response DTOs matching docs/api.md. Request bodies are covered by the zod
// schemas in src/validation/*.schema.ts (via z.infer) — this file is for
// response shapes and anything not 1:1 with a request schema.

export type ProfileResponse = {
  id: string;
  name: string;
  profileImage: string | null;
  email: string | null;
};

// --- Teams (FR-010..019) ---

export type TeamRole = "OWNER" | "ADMIN" | "MEMBER";

export type TeamResponse = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  myRole: TeamRole;
  memberCount: number;
};

export type TeamMemberResponse = {
  userId: string;
  name: string;
  email: string | null;
  role: TeamRole;
  joinedAt: string;
};

// --- Projects (FR-020..027) ---

export type ProjectResponse = {
  id: string;
  teamId: string;
  ownerId: string;
  name: string;
  description: string | null;
  isArchived: boolean;
  createdAt: string;
  issueCounts: Record<string, number>;
  isFavorited: boolean;
  ownerName: string;
  ownerInitials: string;
};

export type ProjectListResponse = {
  data: ProjectResponse[];
  nextCursor: string | null;
};

export type DashboardIssue = {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigneeName: string | null;
  assigneeInitials: string | null;
  dueDate: string | null;
  createdAt: string;
};

// --- Issues (FR-030..036) ---

export type IssueStatusOption = {
  id: string;
  name: string;
  color: string | null;
  position: number;
  isDefault: boolean;
  wipLimit: number | null;
};

export type LabelResponse = {
  id: string;
  name: string;
  color: string;
};

export type IssueResponse = {
  id: string;
  projectId: string;
  title: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  status: { id: string; name: string; color: string };
  assignee: { id: string; name: string; initials: string } | null;
};

export type IssueListItem = IssueResponse & {
  labels: LabelResponse[];
};

export type IssueListResponse = {
  data: IssueListItem[];
  nextCursor: string | null;
  total: number;
};

export type SubtaskResponse = {
  id: string;
  title: string;
  isCompleted: boolean;
  position: number;
};

export type IssueDetailResponse = IssueResponse & {
  description: string | null;
  creator: { id: string; name: string };
  teamId: string;
  projectName: string;
  projectArchived: boolean;
  canDelete: boolean;
  subtasks: SubtaskResponse[];
  labels: LabelResponse[];
  commentCount: number;
};

// --- Kanban board (FR-050..054) ---

export type BoardCard = {
  id: string;
  title: string;
  statusId: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  position: number;
  dueDate: string | null;
  createdAt: string;
  assignee: { id: string; name: string; initials: string } | null;
  labels: { id: string; name: string; color: string }[];
  subtaskProgress: { done: number; total: number };
};

export type BoardResponse = {
  statuses: IssueStatusOption[];
  issues: BoardCard[];
};

// --- Issue change history (FR-039) ---

export type IssueHistoryEntry = {
  id: string;
  field: string; // status | assignee | priority | title | due_date
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
  changedAt: string;
};

export type IssueHistoryResponse = {
  data: IssueHistoryEntry[];
  nextCursor: string | null;
};

export type ProjectDashboardResponse = {
  project: ProjectResponse;
  kpis: {
    totalIssues: number;
    completionRate: number;
    inFlight: number;
    highPriorityOpen: number;
  };
  statusBreakdown: { name: string; count: number; color: string }[];
  priorityBreakdown: { name: string; count: number; color: string }[];
  workloadByAssignee: {
    userId: string;
    name: string;
    initials: string;
    color: string;
    openCount: number;
  }[];
  recentIssues: DashboardIssue[];
  dueSoonIssues: DashboardIssue[];
};
