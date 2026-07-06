import { requireUser } from "@/lib/auth/session";
import { leaveTeam } from "@/lib/team/team.service";
import { withApiErrorHandling } from "@/lib/utils/errors";

type Params = { params: Promise<{ teamId: string }> };

// POST /api/teams/:teamId/leave — FR-016
export async function POST(_request: Request, { params }: Params) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { teamId } = await params;
    await leaveTeam(teamId, user.id);
    return new Response(null, { status: 204 });
  });
}
