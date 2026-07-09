import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/utils/errors";
import { requireIssueAccess, type ProjectRow } from "@/lib/issue/issue.service";
import type { SubtaskResponse } from "@/types/api";
import type { CreateSubtaskInput, UpdateSubtaskInput } from "@/validation/subtask.schema";

const MAX_SUBTASKS_PER_ISSUE = 20;

type SubtaskRow = {
  id: string;
  issue_id: string;
  title: string;
  is_completed: boolean;
  position: number;
};

function toSubtask(s: SubtaskRow): SubtaskResponse {
  return { id: s.id, title: s.title, isCompleted: s.is_completed, position: s.position };
}

async function requireSubtaskAccess(
  subtaskId: string,
  userId: string,
): Promise<{ subtask: SubtaskRow; project: ProjectRow }> {
  const admin = createAdminClient();
  const { data: subtask, error } = await admin
    .from("subtasks")
    .select("id, issue_id, title, is_completed, position")
    .eq("id", subtaskId)
    .single();

  if (error || !subtask) {
    throw new ApiError(404, "NOT_FOUND", "Subtask not found");
  }

  const { project } = await requireIssueAccess(subtask.issue_id, userId);
  return { subtask: subtask as SubtaskRow, project };
}

// --- Create (FR-039-2: max 20 per issue) ---

export async function createSubtask(
  issueId: string,
  userId: string,
  input: CreateSubtaskInput,
): Promise<SubtaskResponse> {
  const admin = createAdminClient();
  const { project } = await requireIssueAccess(issueId, userId);

  if (project.is_archived) {
    throw new ApiError(422, "PROJECT_ARCHIVED", "This project is archived and read-only");
  }

  const { count, error: countErr } = await admin
    .from("subtasks")
    .select("id", { count: "exact", head: true })
    .eq("issue_id", issueId);

  if (countErr) {
    throw new ApiError(500, "DB_ERROR", "Failed to count subtasks");
  }
  if ((count ?? 0) >= MAX_SUBTASKS_PER_ISSUE) {
    throw new ApiError(422, "SUBTASK_LIMIT", "This issue has reached the maximum of 20 subtasks");
  }

  const { data: last } = await admin
    .from("subtasks")
    .select("position")
    .eq("issue_id", issueId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (last?.position ?? -1) + 1;

  const { data: created, error: insertErr } = await admin
    .from("subtasks")
    .insert({ issue_id: issueId, title: input.title, position })
    .select("id, issue_id, title, is_completed, position")
    .single();

  if (insertErr || !created) {
    throw new ApiError(500, "DB_ERROR", "Failed to create subtask");
  }

  return toSubtask(created as SubtaskRow);
}

// --- Update (title / completion / reorder) ---

export async function updateSubtask(
  subtaskId: string,
  userId: string,
  input: UpdateSubtaskInput,
): Promise<SubtaskResponse> {
  const admin = createAdminClient();
  const { subtask, project } = await requireSubtaskAccess(subtaskId, userId);

  if (project.is_archived) {
    throw new ApiError(422, "PROJECT_ARCHIVED", "This project is archived and read-only");
  }

  const update: Record<string, unknown> = {};
  if (input.title !== undefined) update.title = input.title;
  if (input.isCompleted !== undefined) update.is_completed = input.isCompleted;
  if (input.position !== undefined) update.position = input.position;

  if (Object.keys(update).length === 0) {
    return toSubtask(subtask);
  }
  update.updated_at = new Date().toISOString();

  const { data: updated, error } = await admin
    .from("subtasks")
    .update(update)
    .eq("id", subtaskId)
    .select("id, issue_id, title, is_completed, position")
    .single();

  if (error || !updated) {
    throw new ApiError(500, "DB_ERROR", "Failed to update subtask");
  }

  return toSubtask(updated as SubtaskRow);
}

// --- Delete ---

export async function deleteSubtask(subtaskId: string, userId: string): Promise<void> {
  const admin = createAdminClient();
  const { project } = await requireSubtaskAccess(subtaskId, userId);

  if (project.is_archived) {
    throw new ApiError(422, "PROJECT_ARCHIVED", "This project is archived and read-only");
  }

  const { error } = await admin.from("subtasks").delete().eq("id", subtaskId);
  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to delete subtask");
  }
}
