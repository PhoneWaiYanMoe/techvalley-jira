import { requireUser } from "@/lib/auth/session";
import { getIssueHistory } from "@/lib/issue/issue.service";
import { withApiErrorHandling } from "@/lib/utils/errors";

type RouteContext = { params: Promise<{ issueId: string }> };

// GET /api/issues/:issueId/history?cursor= — FR-039 (paginated change log)
export async function GET(request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { issueId } = await params;
    const cursor = new URL(request.url).searchParams.get("cursor");
    const history = await getIssueHistory(issueId, user.id, { cursor });
    return Response.json(history);
  });
}
