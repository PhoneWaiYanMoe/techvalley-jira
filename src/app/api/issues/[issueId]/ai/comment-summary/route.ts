import { requireUser } from "@/lib/auth/session";
import { summarizeComments } from "@/lib/ai/ai.service";
import { withApiErrorHandling } from "@/lib/utils/errors";

type RouteContext = { params: Promise<{ issueId: string }> };

// POST /api/issues/:issueId/ai/comment-summary — FR-045 (422 if <5 comments, 429 if rate-limited)
export async function POST(_request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { issueId } = await params;
    const result = await summarizeComments(issueId, user.id);
    return Response.json(result);
  });
}
