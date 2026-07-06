import { requireUser } from "@/lib/auth/session";
import {
  getIssueDetail,
  updateIssue,
  deleteIssue,
} from "@/lib/issue/issue.service";
import { updateIssueSchema } from "@/validation/issue.schema";
import { withApiErrorHandling } from "@/lib/utils/errors";

type RouteContext = { params: Promise<{ issueId: string }> };

// GET /api/issues/:issueId — FR-031
export async function GET(_request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { issueId } = await params;
    const issue = await getIssueDetail(issueId, user.id);
    return Response.json(issue);
  });
}

// PATCH /api/issues/:issueId — FR-032 (writes issue_history per changed field, FR-039)
export async function PATCH(request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { issueId } = await params;
    const body = updateIssueSchema.parse(await request.json());
    const issue = await updateIssue(issueId, user.id, body);
    return Response.json(issue);
  });
}

// DELETE /api/issues/:issueId — FR-035
export async function DELETE(_request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { issueId } = await params;
    await deleteIssue(issueId, user.id);
    return new Response(null, { status: 204 });
  });
}
