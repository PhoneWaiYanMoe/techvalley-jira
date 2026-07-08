import { requireUser } from "@/lib/auth/session";
import { listStatuses, createStatus } from "@/lib/status/status.service";
import { createStatusSchema } from "@/validation/status.schema";
import { withApiErrorHandling } from "@/lib/utils/errors";

type RouteContext = { params: Promise<{ projectId: string }> };

// GET /api/projects/:projectId/statuses — FR-033/053 (ordered columns incl. wipLimit)
export async function GET(_request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { projectId } = await params;
    const statuses = await listStatuses(projectId, user.id);
    return Response.json(statuses);
  });
}

// POST /api/projects/:projectId/statuses — FR-053 (422 if 5 custom hit)
export async function POST(request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { projectId } = await params;
    const body = createStatusSchema.parse(await request.json());
    const status = await createStatus(projectId, user.id, body);
    return Response.json(status, { status: 201 });
  });
}
