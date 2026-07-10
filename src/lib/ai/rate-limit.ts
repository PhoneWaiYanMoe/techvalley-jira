import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/utils/errors";

// FR-042: enforce BOTH windows (the PRD requires at least one; we do both).
const PER_MINUTE = 10;
const PER_DAY = 100;

export type AiFeature =
  | "summary"
  | "suggestion"
  | "auto_label"
  | "dup_detection"
  | "comment_summary";

/**
 * FR-042 rate-limit guard. Counts the caller's recent ai_request_logs rows and
 * throws 429 (with a Retry-After header, per api.md) if either the per-minute or
 * per-day cap is hit. Call BEFORE hitting the model; on success, call logAiRequest.
 */
export async function checkAiRateLimit(userId: string): Promise<void> {
  const admin = createAdminClient();
  const now = Date.now();
  const minuteAgo = new Date(now - 60_000).toISOString();
  const dayAgo = new Date(now - 86_400_000).toISOString();

  const [minuteRes, dayRes] = await Promise.all([
    admin
      .from("ai_request_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", minuteAgo),
    admin
      .from("ai_request_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", dayAgo),
  ]);

  if (minuteRes.error || dayRes.error) {
    throw new ApiError(500, "DB_ERROR", "Failed to check AI rate limit");
  }

  const perMinute = minuteRes.count ?? 0;
  const perDay = dayRes.count ?? 0;

  if (perMinute >= PER_MINUTE) {
    throw new ApiError(
      429,
      "RATE_LIMITED",
      `AI rate limit reached (${PER_MINUTE}/min). Please wait about a minute and try again.`,
      { "Retry-After": "60" },
    );
  }
  if (perDay >= PER_DAY) {
    throw new ApiError(
      429,
      "RATE_LIMITED",
      `Daily AI limit reached (${PER_DAY}/day). Please try again tomorrow.`,
      { "Retry-After": "3600" },
    );
  }
}

// Best-effort audit row; a logging failure must not fail the AI response the
// user already received (same non-throwing pattern as notifications/activity log).
export async function logAiRequest(userId: string, feature: AiFeature): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("ai_request_logs").insert({ user_id: userId, feature });
  if (error) {
    console.error("Failed to log AI request", { userId, feature, error });
  }
}
