import { requireUser } from "@/lib/auth/session";
import { moveIssue } from "@/lib/issue/issue.service";
import { moveIssueSchema } from "@/validation/issue.schema";
import { withApiErrorHandling } from "@/lib/utils/errors";

type RouteContext = { params: Promise<{ issueId: string }> };

// PATCH /api/issues/:issueId/move — FR-051/052 (drag-drop status + reorder)
export async function PATCH(request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { issueId } = await params;
    const body = moveIssueSchema.parse(await request.json());
    await moveIssue(issueId, user.id, body);
    return new Response(null, { status: 204 });
  });
}
