import { requireUser } from "@/lib/auth/session";
import { requireTeamMembership } from "@/lib/team/team.service";
import { listActivity } from "@/lib/activity-log/activity-log.service";
import { withApiErrorHandling } from "@/lib/utils/errors";

type Params = { params: Promise<{ teamId: string }> };

// GET /api/teams/:teamId/activity?cursor=&limit= — FR-019, any team member
export async function GET(request: Request, { params }: Params) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { teamId } = await params;
    await requireTeamMembership(user.id, teamId);

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);

    const result = await listActivity(teamId, cursor, limit);
    return Response.json(result);
  });
}
