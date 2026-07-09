import { requireUser } from "@/lib/auth/session";
import { updateSubtask, deleteSubtask } from "@/lib/subtask/subtask.service";
import { updateSubtaskSchema } from "@/validation/subtask.schema";
import { withApiErrorHandling } from "@/lib/utils/errors";

type RouteContext = { params: Promise<{ subtaskId: string }> };

// PATCH /api/subtasks/:subtaskId — FR-039-2 (title / isCompleted / position)
export async function PATCH(request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { subtaskId } = await params;
    const body = updateSubtaskSchema.parse(await request.json());
    const subtask = await updateSubtask(subtaskId, user.id, body);
    return Response.json(subtask);
  });
}

// DELETE /api/subtasks/:subtaskId — FR-039-2
export async function DELETE(_request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { subtaskId } = await params;
    await deleteSubtask(subtaskId, user.id);
    return new Response(null, { status: 204 });
  });
}
