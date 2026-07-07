import { createAdminClient } from "@/lib/supabase/admin";

export type ActivityAction =
  | "MEMBER_JOINED"
  | "MEMBER_KICKED"
  | "MEMBER_LEFT"
  | "ROLE_CHANGED"
  | "TEAM_UPDATED"
  | "INVITE_SENT";

export type ActivityLogEntry = {
  id: string;
  action: ActivityAction;
  actorId: string | null;
  actorName: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

// FR-019. Best-effort: a logging failure should never block the action that
// triggered it, so this swallows errors rather than throwing.
export async function logActivity(
  teamId: string,
  actorId: string,
  action: ActivityAction,
  targetType?: string,
  targetId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("team_activity_logs").insert({
    team_id: teamId,
    actor_id: actorId,
    action,
    target_type: targetType ?? null,
    target_id: targetId ?? null,
    metadata: metadata ?? null,
  });

  if (error) {
    console.error("Failed to write activity log entry", { teamId, action, error });
  }
}

// FR-019 — paginated, chronological (newest first).
export async function listActivity(
  teamId: string,
  cursor: string | null,
  limit: number,
): Promise<{ data: ActivityLogEntry[]; nextCursor: string | null }> {
  const admin = createAdminClient();

  let query = admin
    .from("team_activity_logs")
    .select("id, actor_id, action, target_type, target_id, metadata, created_at, profiles(name)")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    const cursorRow = await admin
      .from("team_activity_logs")
      .select("created_at")
      .eq("id", cursor)
      .single();
    if (cursorRow.data) {
      query = query.lt("created_at", cursorRow.data.created_at);
    }
  }

  const { data, error } = await query;
  if (error) {
    throw new Error("Failed to fetch activity log");
  }

  const rows = (data ?? []) as unknown as {
    id: string;
    actor_id: string | null;
    action: ActivityAction;
    target_type: string | null;
    target_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    profiles: { name: string } | null;
  }[];

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    data: page.map((row) => ({
      id: row.id,
      action: row.action,
      actorId: row.actor_id,
      actorName: row.profiles?.name ?? null,
      targetType: row.target_type,
      targetId: row.target_id,
      metadata: row.metadata,
      createdAt: row.created_at,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}
