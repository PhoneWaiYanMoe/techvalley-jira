import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/utils/errors";
import { requireIssueAccess, type ProjectRow } from "@/lib/issue/issue.service";
import { isOwnerOrAdmin } from "@/lib/permissions/team-role";
import { createNotification } from "@/lib/notification/notification.service";
import type { CommentResponse, CommentListResponse, TeamRole } from "@/types/api";
import type { CreateCommentInput, UpdateCommentInput } from "@/validation/comment.schema";

const DEFAULT_PAGE_SIZE = 20;

type CommentRow = {
  id: string;
  issue_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

type IssueRefRow = { id: string; creator_id: string; assignee_id: string | null };

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// FR-063: delete allowed for author, issue owner, project owner, team OWNER/ADMIN.
function canDeleteComment(
  comment: { author_id: string },
  issue: { creator_id: string },
  project: { owner_id: string },
  role: TeamRole,
  userId: string,
): boolean {
  return (
    comment.author_id === userId ||
    issue.creator_id === userId ||
    project.owner_id === userId ||
    isOwnerOrAdmin(role)
  );
}

async function getAuthorMap(
  authorIds: string[],
): Promise<Map<string, { name: string; profileImage: string | null }>> {
  const map = new Map<string, { name: string; profileImage: string | null }>();
  const ids = [...new Set(authorIds)];
  if (ids.length === 0) return map;

  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id, name, profile_image").in("id", ids);
  (data ?? []).forEach((p: { id: string; name: string; profile_image: string | null }) => {
    map.set(p.id, { name: p.name, profileImage: p.profile_image });
  });
  return map;
}

function toComment(
  row: CommentRow,
  authorMap: Map<string, { name: string; profileImage: string | null }>,
  ctx: { issue: { creator_id: string }; project: ProjectRow; role: TeamRole; userId: string },
): CommentResponse {
  const author = authorMap.get(row.author_id);
  const name = author?.name ?? "Unknown";
  // Fresh comments have updated_at == created_at (the trigger only fires on UPDATE);
  // treat a >1s gap as a real edit so trigger jitter never shows a false "edited".
  const edited =
    new Date(row.updated_at).getTime() - new Date(row.created_at).getTime() > 1000;

  return {
    id: row.id,
    content: row.content,
    author: {
      id: row.author_id,
      name,
      initials: getInitials(name),
      profileImage: author?.profileImage ?? null,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    edited,
    canEdit: row.author_id === ctx.userId,
    canDelete: canDeleteComment(row, ctx.issue, ctx.project, ctx.role, ctx.userId),
  };
}

async function requireCommentAccess(
  commentId: string,
  userId: string,
): Promise<{ comment: CommentRow; issue: IssueRefRow; project: ProjectRow; role: TeamRole }> {
  const admin = createAdminClient();
  const { data: comment, error } = await admin
    .from("comments")
    .select("id, issue_id, author_id, content, created_at, updated_at")
    .eq("id", commentId)
    .is("deleted_at", null)
    .single();

  if (error || !comment) {
    throw new ApiError(404, "NOT_FOUND", "Comment not found");
  }

  const { issue, project, role } = await requireIssueAccess(comment.issue_id, userId);
  return { comment: comment as CommentRow, issue, project, role };
}

// --- List (FR-061: chronological, cursor-paginated) ---

export async function listComments(
  issueId: string,
  userId: string,
  opts: { cursor?: string | null; limit?: number } = {},
): Promise<CommentListResponse> {
  const admin = createAdminClient();
  const { issue, project, role } = await requireIssueAccess(issueId, userId);
  const limit = Math.min(Math.max(opts.limit ?? DEFAULT_PAGE_SIZE, 1), 50);

  let query = admin
    .from("comments")
    .select("id, issue_id, author_id, content, created_at, updated_at")
    .eq("issue_id", issueId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit + 1);

  if (opts.cursor) {
    const { data: cursorRow } = await admin
      .from("comments")
      .select("created_at")
      .eq("id", opts.cursor)
      .single();
    if (cursorRow) {
      query = query.gt("created_at", cursorRow.created_at);
    }
  }

  const { data, error } = await query;
  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch comments");
  }

  const rows = (data ?? []) as CommentRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const authorMap = await getAuthorMap(page.map((r) => r.author_id));
  const ctx = { issue, project, role, userId };

  return {
    data: page.map((r) => toComment(r, authorMap, ctx)),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

// --- Create (FR-060) ---

export async function createComment(
  issueId: string,
  userId: string,
  input: CreateCommentInput,
): Promise<CommentResponse> {
  const admin = createAdminClient();
  const { issue, project, role } = await requireIssueAccess(issueId, userId);

  if (project.is_archived) {
    throw new ApiError(422, "PROJECT_ARCHIVED", "This project is archived and read-only");
  }

  const { data: created, error } = await admin
    .from("comments")
    .insert({ issue_id: issueId, author_id: userId, content: input.content })
    .select("id, issue_id, author_id, content, created_at, updated_at")
    .single();

  if (error || !created) {
    throw new ApiError(500, "DB_ERROR", "Failed to create comment");
  }

  // FR-090 ISSUE_COMMENT — notify the issue owner (creator) and assignee,
  // skipping the commenter themselves. De-duped when creator === assignee.
  const { data: issueRow } = await admin
    .from("issues")
    .select("title")
    .eq("id", issueId)
    .single();
  const title = issueRow?.title ?? "an issue";
  const recipients = new Set<string>();
  if (issue.creator_id !== userId) recipients.add(issue.creator_id);
  if (issue.assignee_id && issue.assignee_id !== userId) recipients.add(issue.assignee_id);
  for (const recipient of recipients) {
    await createNotification(
      recipient,
      "ISSUE_COMMENT",
      `New comment on "${title}"`,
      undefined,
      "issue",
      issueId,
    );
  }

  const authorMap = await getAuthorMap([userId]);
  return toComment(created as CommentRow, authorMap, { issue, project, role, userId });
}

// --- Update (FR-062: author only) ---

export async function updateComment(
  commentId: string,
  userId: string,
  input: UpdateCommentInput,
): Promise<CommentResponse> {
  const admin = createAdminClient();
  const { comment, issue, project, role } = await requireCommentAccess(commentId, userId);

  if (comment.author_id !== userId) {
    throw new ApiError(403, "FORBIDDEN", "Only the comment author can edit this comment");
  }
  if (project.is_archived) {
    throw new ApiError(422, "PROJECT_ARCHIVED", "This project is archived and read-only");
  }

  const { data: updated, error } = await admin
    .from("comments")
    .update({ content: input.content, updated_at: new Date().toISOString() })
    .eq("id", commentId)
    .select("id, issue_id, author_id, content, created_at, updated_at")
    .single();

  if (error || !updated) {
    throw new ApiError(500, "DB_ERROR", "Failed to update comment");
  }

  const authorMap = await getAuthorMap([userId]);
  return toComment(updated as CommentRow, authorMap, { issue, project, role, userId });
}

// --- Delete (FR-063: author, issue owner, project owner, team OWNER/ADMIN) — soft delete ---

export async function deleteComment(commentId: string, userId: string): Promise<void> {
  const admin = createAdminClient();
  const { comment, issue, project, role } = await requireCommentAccess(commentId, userId);

  if (!canDeleteComment(comment, issue, project, role, userId)) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to delete this comment");
  }
  if (project.is_archived) {
    throw new ApiError(422, "PROJECT_ARCHIVED", "This project is archived and read-only");
  }

  const { error } = await admin
    .from("comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId);

  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to delete comment");
  }
}
