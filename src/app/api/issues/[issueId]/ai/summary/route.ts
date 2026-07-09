import { requireUser } from "@/lib/auth/session";
import { generateSummary } from "@/lib/ai/ai.service";
import { withApiErrorHandling } from "@/lib/utils/errors";

type RouteContext = { params: Promise<{ issueId: string }> };

// POST /api/issues/:issueId/ai/summary — FR-040 (422 if description ≤10 chars, 429 if rate-limited)
export async function POST(_request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { issueId } = await params;
    const result = await generateSummary(issueId, user.id);
    return Response.json(result);
  });
}
