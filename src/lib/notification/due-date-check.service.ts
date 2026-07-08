import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notification/notification.service";

// FR-090 "Due date approaching (1 day before)" / "Due date today". Unlike
// the other triggers, these aren't fired by a user action — they need to
// run once a day. See CLAUDE.md for how this gets invoked until a real
// scheduler (Vercel Cron) is wired up post-deploy.
export async function checkDueDates(): Promise<{ dueSoon: number; dueToday: number }> {
  const admin = createAdminClient();

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const todayStart = `${todayStr}T00:00:00.000Z`;

  let dueSoon = 0;
  let dueToday = 0;

  for (const [dueDate, type, label] of [
    [tomorrowStr, "DUE_SOON", "due tomorrow"],
    [todayStr, "DUE_TODAY", "due today"],
  ] as const) {
    const { data: issues, error } = await admin
      .from("issues")
      .select("id, title, assignee_id, project_id, projects!inner(is_archived), issue_statuses!inner(name)")
      .eq("due_date", dueDate)
      .is("deleted_at", null)
      .not("assignee_id", "is", null);

    if (error) {
      console.error("Failed to query due-date issues", type, error);
      continue;
    }

    for (const row of (issues ?? []) as unknown as {
      id: string;
      title: string;
      assignee_id: string;
      projects: { is_archived: boolean };
      issue_statuses: { name: string };
    }[]) {
      if (row.projects.is_archived || row.issue_statuses.name === "Done") continue;

      // Idempotency: skip if we already notified this assignee about this
      // issue+type today (this function may run more than once a day).
      const { data: existing } = await admin
        .from("notifications")
        .select("id")
        .eq("user_id", row.assignee_id)
        .eq("type", type)
        .eq("related_entity_id", row.id)
        .gte("created_at", todayStart)
        .maybeSingle();

      if (existing) continue;

      await createNotification(
        row.assignee_id,
        type,
        `"${row.title}" is ${label}`,
        undefined,
        "issue",
        row.id,
      );

      if (type === "DUE_SOON") dueSoon++;
      else dueToday++;
    }
  }

  return { dueSoon, dueToday };
}
