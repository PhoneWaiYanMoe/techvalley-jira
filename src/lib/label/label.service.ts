import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/utils/errors";
import { requireProjectAccess, type ProjectRow } from "@/lib/issue/issue.service";
import type { LabelResponse, TeamRole } from "@/types/api";
import type { CreateLabelInput, UpdateLabelInput } from "@/validation/label.schema";

const MAX_LABELS_PER_PROJECT = 20;

type LabelRow = { id: string; project_id: string; name: string; color: string };

function toLabel(l: LabelRow): LabelResponse {
  return { id: l.id, name: l.name, color: l.color };
}

async function requireLabelAccess(
  labelId: string,
  userId: string,
): Promise<{ label: LabelRow; project: ProjectRow; role: TeamRole }> {
  const admin = createAdminClient();
  const { data: label, error } = await admin
    .from("labels")
    .select("id, project_id, name, color")
    .eq("id", labelId)
    .single();

  if (error || !label) {
    throw new ApiError(404, "NOT_FOUND", "Label not found");
  }

  const { project, role } = await requireProjectAccess(label.project_id, userId);
  return { label: label as LabelRow, project, role };
}

// --- List (FR-038) ---

export async function listLabels(projectId: string, userId: string): Promise<LabelResponse[]> {
  const admin = createAdminClient();
  await requireProjectAccess(projectId, userId);

  const { data, error } = await admin
    .from("labels")
    .select("id, project_id, name, color")
    .eq("project_id", projectId)
    .order("name", { ascending: true });

  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch labels");
  }

  return (data ?? []).map((l) => toLabel(l as LabelRow));
}

// --- Create (FR-038: max 20 per project) ---

export async function createLabel(
  projectId: string,
  userId: string,
  input: CreateLabelInput,
): Promise<LabelResponse> {
  const admin = createAdminClient();
  const { project } = await requireProjectAccess(projectId, userId);

  if (project.is_archived) {
    throw new ApiError(422, "PROJECT_ARCHIVED", "This project is archived and read-only");
  }

  const { count, error: countErr } = await admin
    .from("labels")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (countErr) {
    throw new ApiError(500, "DB_ERROR", "Failed to count labels");
  }
  if ((count ?? 0) >= MAX_LABELS_PER_PROJECT) {
    throw new ApiError(422, "LABEL_LIMIT", "This project has reached the maximum of 20 labels");
  }

  const { data: created, error: insertErr } = await admin
    .from("labels")
    .insert({ project_id: projectId, name: input.name, color: input.color })
    .select("id, project_id, name, color")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      throw new ApiError(422, "DUPLICATE_LABEL", "A label with this name already exists");
    }
    throw new ApiError(500, "DB_ERROR", "Failed to create label");
  }

  return toLabel(created as LabelRow);
}

// --- Update (FR-038) ---

export async function updateLabel(
  labelId: string,
  userId: string,
  input: UpdateLabelInput,
): Promise<LabelResponse> {
  const admin = createAdminClient();
  const { label, project } = await requireLabelAccess(labelId, userId);

  if (project.is_archived) {
    throw new ApiError(422, "PROJECT_ARCHIVED", "This project is archived and read-only");
  }

  const update: Record<string, unknown> = {};
  if (input.name !== undefined) update.name = input.name;
  if (input.color !== undefined) update.color = input.color;

  if (Object.keys(update).length === 0) {
    return toLabel(label);
  }

  const { data: updated, error } = await admin
    .from("labels")
    .update(update)
    .eq("id", labelId)
    .select("id, project_id, name, color")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new ApiError(422, "DUPLICATE_LABEL", "A label with this name already exists");
    }
    throw new ApiError(500, "DB_ERROR", "Failed to update label");
  }

  return toLabel(updated as LabelRow);
}

// --- Delete (FR-038; issue_labels rows cascade via FK) ---

export async function deleteLabel(labelId: string, userId: string): Promise<void> {
  const admin = createAdminClient();
  const { project } = await requireLabelAccess(labelId, userId);

  if (project.is_archived) {
    throw new ApiError(422, "PROJECT_ARCHIVED", "This project is archived and read-only");
  }

  const { error } = await admin.from("labels").delete().eq("id", labelId);
  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to delete label");
  }
}
