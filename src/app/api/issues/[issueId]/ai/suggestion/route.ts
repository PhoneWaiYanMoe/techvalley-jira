import { requireUser } from "@/lib/auth/session";
import { generateSuggestion } from "@/lib/ai/ai.service";
import { withApiErrorHandling } from "@/lib/utils/errors";

type RouteContext = { params: Promise<{ issueId: string }> };

// POST /api/issues/:issueId/ai/suggestion — FR-041 (422 if description ≤10 chars, 429 if rate-limited)
export async function POST(_request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { issueId } = await params;
    const result = await generateSuggestion(issueId, user.id);
    return Response.json(result);
  });
}
