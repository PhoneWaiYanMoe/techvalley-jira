import { requireUser } from "@/lib/auth/session";
import { getProjectDashboard } from "@/lib/project/project.service";
import { withApiErrorHandling } from "@/lib/utils/errors";

// GET /api/projects/:projectId/dashboard — FR-080
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { projectId } = await params;
    const dashboard = await getProjectDashboard(projectId, user.id);
    return Response.json(dashboard);
  });
}
