import { requireUser } from "@/lib/auth/session";
import { createSubtask } from "@/lib/subtask/subtask.service";
import { createSubtaskSchema } from "@/validation/subtask.schema";
import { withApiErrorHandling } from "@/lib/utils/errors";

type RouteContext = { params: Promise<{ issueId: string }> };

// POST /api/issues/:issueId/subtasks — FR-039-2 (422 if 20/issue hit)
export async function POST(request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { issueId } = await params;
    const body = createSubtaskSchema.parse(await request.json());
    const subtask = await createSubtask(issueId, user.id, body);
    return Response.json(subtask, { status: 201 });
  });
}
