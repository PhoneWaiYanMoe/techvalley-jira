import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/utils/errors";
import { requireProjectAccess, statusColor, type ProjectRow } from "@/lib/issue/issue.service";
import type { IssueStatusOption, TeamRole } from "@/types/api";
import type { CreateStatusInput, UpdateStatusInput } from "@/validation/status.schema";

// FR-053: 3 default statuses + max 5 custom = 8 columns total.
const MAX_CUSTOM_STATUSES = 5;

type StatusRow = {
  id: string;
  project_id: string;
  name: string;
  color: string | null;
  position: number;
  is_default: boolean;
  wip_limit: number | null;
};

function toStatusOption(s: StatusRow): IssueStatusOption {
  return {
    id: s.id,
    name: s.name,
    color: statusColor(s.name, s.color),
    position: s.position,
    isDefault: s.is_default,
    wipLimit: s.wip_limit,
  };
}

async function requireStatusAccess(
  statusId: string,
  userId: string,
): Promise<{ status: StatusRow; project: ProjectRow; role: TeamRole }> {
  const admin = createAdminClient();
  const { data: status, error } = await admin
    .from("issue_statuses")
    .select("id, project_id, name, color, position, is_default, wip_limit")
    .eq("id", statusId)
    .single();

  if (error || !status) {
    throw new ApiError(404, "NOT_FOUND", "Status not found");
  }

  const { project, role } = await requireProjectAccess(status.project_id, userId);
  return { status: status as StatusRow, project, role };
}

// --- List (FR-033) ---

export async function listStatuses(
  projectId: string,
  userId: string,
): Promise<IssueStatusOption[]> {
  const admin = createAdminClient();
  await requireProjectAccess(projectId, userId);

  const { data, error } = await admin
    .from("issue_statuses")
    .select("id, project_id, name, color, position, is_default, wip_limit")
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch statuses");
  }

  return (data ?? []).map((s) => toStatusOption(s as StatusRow));
}

// --- Create custom status (FR-053) ---

export async function createStatus(
  projectId: string,
  userId: string,
  input: CreateStatusInput,
): Promise<IssueStatusOption> {
  const admin = createAdminClient();
  const { project } = await requireProjectAccess(projectId, userId);

  if (project.is_archived) {
    throw new ApiError(422, "PROJECT_ARCHIVED", "This project is archived and read-only");
  }

  const { count, error: countErr } = await admin
    .from("issue_statuses")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("is_default", false);

  if (countErr) {
    throw new ApiError(500, "DB_ERROR", "Failed to count statuses");
  }
  if ((count ?? 0) >= MAX_CUSTOM_STATUSES) {
    throw new ApiError(
      422,
      "STATUS_LIMIT",
      "This project has reached the maximum of 5 custom statuses",
    );
  }

  // Default to appending at the end of the board.
  const position = input.position ?? (await nextStatusPosition(projectId));

  const { data: created, error: insertErr } = await admin
    .from("issue_statuses")
    .insert({
      project_id: projectId,
      name: input.name,
      color: input.color ?? null,
      position,
      is_default: false,
    })
    .select("id, project_id, name, color, position, is_default, wip_limit")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      throw new ApiError(422, "DUPLICATE_STATUS", "A status with this name already exists");
    }
    throw new ApiError(500, "DB_ERROR", "Failed to create status");
  }

  return toStatusOption(created as StatusRow);
}

// --- Update status (FR-053 rename/recolor/reorder, FR-054 WIP limit) ---

export async function updateStatus(
  statusId: string,
  userId: string,
  input: UpdateStatusInput,
): Promise<IssueStatusOption> {
  const admin = createAdminClient();
  const { status, project } = await requireStatusAccess(statusId, userId);

  if (project.is_archived) {
    throw new ApiError(422, "PROJECT_ARCHIVED", "This project is archived and read-only");
  }

  const update: Record<string, unknown> = {};

  if (input.name !== undefined && input.name !== status.name) {
    // Default statuses (Backlog / In Progress / Done) are locked — no rename.
    if (status.is_default) {
      throw new ApiError(422, "STATUS_LOCKED", "Default statuses cannot be renamed");
    }
    update.name = input.name;
  }
  if (input.color !== undefined) update.color = input.color;
  if (input.position !== undefined) update.position = input.position;
  if (input.wipLimit !== undefined) update.wip_limit = input.wipLimit;

  if (Object.keys(update).length === 0) {
    return toStatusOption(status);
  }

  const { data: updated, error } = await admin
    .from("issue_statuses")
    .update(update)
    .eq("id", statusId)
    .select("id, project_id, name, color, position, is_default, wip_limit")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ApiError(422, "DUPLICATE_STATUS", "A status with this name already exists");
    }
    throw new ApiError(500, "DB_ERROR", "Failed to update status");
  }

  return toStatusOption(updated as StatusRow);
}

// --- Delete custom status (FR-053: issues move to Backlog) ---

export async function deleteStatus(statusId: string, userId: string): Promise<void> {
  const admin = createAdminClient();
  const { status, project } = await requireStatusAccess(statusId, userId);

  if (project.is_archived) {
    throw new ApiError(422, "PROJECT_ARCHIVED", "This project is archived and read-only");
  }
  if (status.is_default) {
    throw new ApiError(422, "STATUS_LOCKED", "Default statuses cannot be deleted");
  }

  // FR-053: issues with the deleted status move to Backlog (lowest-position default).
  const { data: backlog, error: backlogErr } = await admin
    .from("issue_statuses")
    .select("id, name")
    .eq("project_id", status.project_id)
    .eq("is_default", true)
    .order("position", { ascending: true })
    .limit(1)
    .single();

  if (backlogErr || !backlog) {
    throw new ApiError(500, "DB_ERROR", "Project has no default status");
  }

  const { data: orphans, error: orphanErr } = await admin
    .from("issues")
    .select("id")
    .eq("status_id", statusId)
    .is("deleted_at", null);

  if (orphanErr) {
    throw new ApiError(500, "DB_ERROR", "Failed to reassign issues");
  }

  if (orphans && orphans.length > 0) {
    let position = await nextIssuePosition(backlog.id);
    // Reassign each orphaned issue to the bottom of Backlog and record the
    // status change in issue_history (FR-039).
    for (const orphan of orphans) {
      const { error: moveErr } = await admin
        .from("issues")
        .update({ status_id: backlog.id, position })
        .eq("id", orphan.id);
      if (moveErr) {
        throw new ApiError(500, "DB_ERROR", "Failed to reassign issues");
      }
      position += 1;
    }

    await admin.from("issue_history").insert(
      orphans.map((o) => ({
        issue_id: o.id,
        field_name: "status",
        old_value: status.name,
        new_value: backlog.name,
        changed_by: userId,
      })),
    );
  }

  const { error: deleteErr } = await admin
    .from("issue_statuses")
    .delete()
    .eq("id", statusId);

  if (deleteErr) {
    throw new ApiError(500, "DB_ERROR", "Failed to delete status");
  }
}

// --- Helpers ---

async function nextStatusPosition(projectId: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("issue_statuses")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.position ?? -1) + 1;
}

async function nextIssuePosition(statusId: string): Promise<number> {
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
