import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/utils/errors";
import { requireIssueAccess, requireProjectAccess } from "@/lib/issue/issue.service";
import { generateText } from "@/lib/ai/gemini";
import { checkAiRateLimit, logAiRequest } from "@/lib/ai/rate-limit";
import type {
  AiSummaryResponse,
  AiSuggestionResponse,
  AiAutoLabelResponse,
  AiDuplicateCheckResponse,
  AiCommentSummaryResponse,
} from "@/types/api";
import type { AutoLabelInput, DuplicateCheckInput } from "@/validation/ai.schema";

const MIN_DESCRIPTION_LENGTH = 10; // FR-040/041: must be OVER 10 chars
const MIN_COMMENTS_FOR_SUMMARY = 5; // FR-045
const MAX_AUTO_LABELS = 3; // FR-043
const MAX_DUPLICATES = 3; // FR-044

function md5(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

// Gemini may wrap JSON in ```json fences even in JSON mode; strip defensively.
function parseJson<T>(raw: string): T | null {
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/[[{][\s\S]*[\]}]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// --- FR-040: AI summary (button-triggered, cached on description hash) ---

export async function generateSummary(
  issueId: string,
  userId: string,
): Promise<AiSummaryResponse> {
  const admin = createAdminClient();
  const { issue } = await requireIssueAccess(issueId, userId);

  const description = (issue.description ?? "").trim();
  if (description.length <= MIN_DESCRIPTION_LENGTH) {
    throw new ApiError(
      422,
      "DESCRIPTION_TOO_SHORT",
      "The description must be longer than 10 characters to use AI features.",
    );
  }

  const hash = md5(description);
  const { data: cacheRow } = await admin
    .from("issues")
    .select("ai_summary, ai_description_hash")
    .eq("id", issueId)
    .single();

  if (cacheRow?.ai_summary && cacheRow.ai_description_hash === hash) {
    return { summary: cacheRow.ai_summary, cached: true };
  }

  await checkAiRateLimit(userId);
  const summary = await generateText(
    `Summarize the following issue description in 2-4 concise sentences. ` +
      `Focus on what the problem or task is. Do not add a preamble.\n\n${description}`,
  );

  await admin
    .from("issues")
    .update({
      ai_summary: summary,
      ai_summary_generated_at: new Date().toISOString(),
      ai_description_hash: hash,
    })
    .eq("id", issueId);
  await logAiRequest(userId, "summary");

  return { summary, cached: false };
}

// --- FR-041: AI solution suggestion (same caching as summary) ---

export async function generateSuggestion(
  issueId: string,
  userId: string,
): Promise<AiSuggestionResponse> {
  const admin = createAdminClient();
  const { issue } = await requireIssueAccess(issueId, userId);

  const description = (issue.description ?? "").trim();
  if (description.length <= MIN_DESCRIPTION_LENGTH) {
    throw new ApiError(
      422,
      "DESCRIPTION_TOO_SHORT",
      "The description must be longer than 10 characters to use AI features.",
    );
  }

  const hash = md5(description);
  const { data: cacheRow } = await admin
    .from("issues")
    .select("ai_suggestion, ai_description_hash")
    .eq("id", issueId)
    .single();

  if (cacheRow?.ai_suggestion && cacheRow.ai_description_hash === hash) {
    return { suggestion: cacheRow.ai_suggestion, cached: true };
  }

  await checkAiRateLimit(userId);
  const suggestion = await generateText(
    `You are a senior engineer. Suggest a practical approach to resolve the ` +
      `following issue. Give concrete, actionable steps. Keep it under 200 words.\n\n${description}`,
  );

  await admin
    .from("issues")
    .update({
      ai_suggestion: suggestion,
      ai_suggestion_generated_at: new Date().toISOString(),
      ai_description_hash: hash,
    })
    .eq("id", issueId);
  await logAiRequest(userId, "suggestion");

  return { suggestion, cached: false };
}

// --- FR-043: auto-label recommendation from existing project labels ---

export async function suggestLabels(
  projectId: string,
  userId: string,
  input: AutoLabelInput,
): Promise<AiAutoLabelResponse> {
  const admin = createAdminClient();
  await requireProjectAccess(projectId, userId);

  const { data: labels } = await admin
    .from("labels")
    .select("id, name")
    .eq("project_id", projectId);

  if (!labels || labels.length === 0) {
    return { labelIds: [] };
  }

  await checkAiRateLimit(userId);

  const labelList = labels.map((l, i) => `${i}: ${l.name}`).join("\n");
  const raw = await generateText(
    `Given an issue and a list of available labels, choose up to ${MAX_AUTO_LABELS} labels ` +
      `that best fit the issue. Only choose from the list. Respond with a JSON array of the ` +
      `chosen label numbers, e.g. [0, 2]. If none fit, respond [].\n\n` +
      `Issue title: ${input.title}\n` +
      `Issue description: ${input.description ?? "(none)"}\n\n` +
      `Available labels:\n${labelList}`,
    { json: true },
  );

  const indices = parseJson<number[]>(raw) ?? [];
  const labelIds = indices
    .filter((i) => Number.isInteger(i) && i >= 0 && i < labels.length)
    .slice(0, MAX_AUTO_LABELS)
    .map((i) => labels[i].id);

  await logAiRequest(userId, "auto_label");
  return { labelIds: [...new Set(labelIds)] };
}

// --- FR-044: duplicate detection (one LLM call over existing titles) ---

export async function checkDuplicates(
  projectId: string,
  userId: string,
  input: DuplicateCheckInput,
): Promise<AiDuplicateCheckResponse> {
  const admin = createAdminClient();
  await requireProjectAccess(projectId, userId);

  const { data: issues } = await admin
    .from("issues")
    .select("id, title")
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .limit(200);

  if (!issues || issues.length === 0) {
    return { similarIssues: [] };
  }

  await checkAiRateLimit(userId);

  const titleList = issues.map((it, i) => `${i}: ${it.title}`).join("\n");
  const raw = await generateText(
    `A user is creating a new issue titled "${input.title}". From the list of existing ` +
      `issue titles below, identify up to ${MAX_DUPLICATES} that are likely duplicates or ` +
      `describe the same work. Respond with a JSON array of objects ` +
      `{"index": number, "similarity": number between 0 and 1}. Only include genuinely ` +
      `similar ones (similarity >= 0.6). If none, respond [].\n\n` +
      `Existing issues:\n${titleList}`,
    { json: true },
  );

  const parsed = parseJson<{ index: number; similarity: number }[]>(raw) ?? [];
  const similarIssues = parsed
    .filter(
      (p) =>
        Number.isInteger(p.index) &&
        p.index >= 0 &&
        p.index < issues.length &&
        typeof p.similarity === "number",
    )
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_DUPLICATES)
    .map((p) => ({
      id: issues[p.index].id,
      title: issues[p.index].title,
      similarity: Math.round(Math.min(Math.max(p.similarity, 0), 1) * 100) / 100,
    }));

  await logAiRequest(userId, "dup_detection");
  return { similarIssues };
}

// --- FR-045: comment discussion summary (>=5 comments, cached on comment count) ---

type StoredCommentSummary = { summary: string; keyDecisions: string[] };

export async function summarizeComments(
  issueId: string,
  userId: string,
): Promise<AiCommentSummaryResponse> {
  const admin = createAdminClient();
  await requireIssueAccess(issueId, userId);

  const { count } = await admin
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("issue_id", issueId)
    .is("deleted_at", null);

  const commentCount = count ?? 0;
  if (commentCount < MIN_COMMENTS_FOR_SUMMARY) {
    throw new ApiError(
      422,
      "NOT_ENOUGH_COMMENTS",
      "At least 5 comments are needed to generate a discussion summary.",
    );
  }

  const { data: cacheRow } = await admin
    .from("issues")
    .select("ai_comment_summary, ai_comment_summary_count")
    .eq("id", issueId)
    .single();

  if (cacheRow?.ai_comment_summary && cacheRow.ai_comment_summary_count === commentCount) {
    const stored = parseJson<StoredCommentSummary>(cacheRow.ai_comment_summary);
    if (stored) {
      return { summary: stored.summary, keyDecisions: stored.keyDecisions ?? [], cached: true };
    }
  }

  const { data: comments } = await admin
    .from("comments")
    .select("author_id, content, created_at")
    .eq("issue_id", issueId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const authorIds = [...new Set((comments ?? []).map((c) => c.author_id))];
  const { data: profiles } = await admin.from("profiles").select("id, name").in("id", authorIds);
  const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.name]));

  const thread = (comments ?? [])
    .map((c) => `${nameMap.get(c.author_id) ?? "User"}: ${c.content}`)
    .join("\n");

  await checkAiRateLimit(userId);
  const raw = await generateText(
    `Summarize the following issue discussion thread. Respond as JSON with two keys: ` +
      `"summary" (a 3-5 sentence overview) and "keyDecisions" (an array of short strings ` +
      `for any decisions reached; empty array if none).\n\n${thread}`,
    { json: true },
  );

  const parsed = parseJson<StoredCommentSummary>(raw);
  const summary = parsed?.summary?.trim() || raw.trim();
  const keyDecisions = Array.isArray(parsed?.keyDecisions) ? parsed!.keyDecisions : [];

  await admin
    .from("issues")
    .update({
      ai_comment_summary: JSON.stringify({ summary, keyDecisions }),
      ai_comment_summary_generated_at: new Date().toISOString(),
      ai_comment_summary_count: commentCount,
    })
    .eq("id", issueId);
  await logAiRequest(userId, "comment_summary");

  return { summary, keyDecisions, cached: false };
}
