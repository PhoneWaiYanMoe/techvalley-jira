import { requireUser } from "@/lib/auth/session";
import { getBoard } from "@/lib/issue/issue.service";
import { withApiErrorHandling } from "@/lib/utils/errors";

type RouteContext = { params: Promise<{ projectId: string }> };

// GET /api/projects/:projectId/board — FR-050 (statuses + all cards for the kanban board)
export async function GET(_request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { projectId } = await params;
    const board = await getBoard(projectId, user.id);
    return Response.json(board);
  });
}
