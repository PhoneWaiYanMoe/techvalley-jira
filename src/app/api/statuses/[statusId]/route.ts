import { requireUser } from "@/lib/auth/session";
import { updateStatus, deleteStatus } from "@/lib/status/status.service";
import { updateStatusSchema } from "@/validation/status.schema";
import { withApiErrorHandling } from "@/lib/utils/errors";

type RouteContext = { params: Promise<{ statusId: string }> };

// PATCH /api/statuses/:statusId — FR-053/054 (rename/recolor/reorder/WIP limit)
export async function PATCH(request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { statusId } = await params;
    const body = updateStatusSchema.parse(await request.json());
    const status = await updateStatus(statusId, user.id, body);
    return Response.json(status);
  });
}

// DELETE /api/statuses/:statusId — FR-053 (issues moved to Backlog)
export async function DELETE(_request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { statusId } = await params;
    await deleteStatus(statusId, user.id);
    return new Response(null, { status: 204 });
  });
}
