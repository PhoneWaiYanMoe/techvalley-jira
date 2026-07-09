import { requireUser } from "@/lib/auth/session";
import { updateLabel, deleteLabel } from "@/lib/label/label.service";
import { updateLabelSchema } from "@/validation/label.schema";
import { withApiErrorHandling } from "@/lib/utils/errors";

type RouteContext = { params: Promise<{ labelId: string }> };

// PATCH /api/labels/:labelId — FR-038
export async function PATCH(request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { labelId } = await params;
    const body = updateLabelSchema.parse(await request.json());
    const label = await updateLabel(labelId, user.id, body);
    return Response.json(label);
  });
}

// DELETE /api/labels/:labelId — FR-038
export async function DELETE(_request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { labelId } = await params;
    await deleteLabel(labelId, user.id);
    return new Response(null, { status: 204 });
  });
}
