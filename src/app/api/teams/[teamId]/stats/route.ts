import { requireUser } from "@/lib/auth/session";
import { getTeamStats, parsePeriod } from "@/lib/dashboard/dashboard.service";
import { withApiErrorHandling } from "@/lib/utils/errors";

type RouteContext = { params: Promise<{ teamId: string }> };

// GET /api/teams/:teamId/stats?period=7|30|90 — FR-082
export async function GET(request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { teamId } = await params;
    const period = parsePeriod(new URL(request.url).searchParams.get("period"));
    const stats = await getTeamStats(teamId, user.id, period);
    return Response.json(stats);
  });
}
