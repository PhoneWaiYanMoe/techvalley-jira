import { requireUser } from "@/lib/auth/session";
import { listStatuses } from "@/lib/issue/issue.service";
import { withApiErrorHandling } from "@/lib/utils/errors";

type RouteContext = { params: Promise<{ projectId: string }> };

// GET /api/projects/:projectId/statuses — FR-033 (create/edit/delete arrive with FR-053)
export async function GET(_request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { projectId } = await params;
    const statuses = await listStatuses(projectId, user.id);
    return Response.json(statuses);
  });
}
