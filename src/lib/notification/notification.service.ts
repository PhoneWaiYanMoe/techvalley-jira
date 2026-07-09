import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/utils/errors";
import type { NotificationResponse, NotificationType } from "@/types/api";

// FR-090 — best-effort, same reasoning as activity-log: a notification
// failing to write must never block the action that triggered it.
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message?: string,
  relatedEntityType?: string,
  relatedEntityId?: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert({
    user_id: userId,
    type,
    title,
    message: message ?? null,
    related_entity_type: relatedEntityType ?? null,
    related_entity_id: relatedEntityId ?? null,
  });

  if (error) {
    console.error("Failed to write notification", { userId, type, error });
  }
}

// FR-090 — paginated, newest first, includes the caller's total unread count.
export async function listNotifications(
  userId: string,
  cursor: string | null,
  limit: number,
): Promise<{ data: NotificationResponse[]; nextCursor: string | null; unreadCount: number }> {
  const admin = createAdminClient();

  let query = admin
    .from("notifications")
    .select("id, type, title, message, related_entity_type, related_entity_id, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    const cursorRow = await admin
      .from("notifications")
      .select("created_at")
      .eq("id", cursor)
      .single();
    if (cursorRow.data) {
      query = query.lt("created_at", cursorRow.data.created_at);
    }
  }

  const { data, error } = await query;
  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch notifications");
  }

  const { count: unreadCount, error: countError } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (countError) {
    throw new ApiError(500, "DB_ERROR", "Failed to count unread notifications");
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    data: page.map((row) => ({
      id: row.id,
      type: row.type as NotificationType,
      title: row.title,
      message: row.message,
      relatedEntityType: row.related_entity_type,
      relatedEntityId: row.related_entity_id,
      isRead: row.is_read,
      createdAt: row.created_at,
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
    unreadCount: unreadCount ?? 0,
  };
}

// FR-091 — mark a single notification read. Scoped to the owner so one user
// can't mark another's notifications.
export async function markAsRead(notificationId: string, userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", userId);

  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to mark notification as read");
  }
}

// FR-091
export async function markAllAsRead(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to mark all notifications as read");
  }
}
