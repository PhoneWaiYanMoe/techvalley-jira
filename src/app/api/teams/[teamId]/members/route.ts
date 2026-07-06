import { requireUser } from "@/lib/auth/session";
import { listMembers } from "@/lib/team/team.service";
import { withApiErrorHandling } from "@/lib/utils/errors";

type Params = { params: Promise<{ teamId: string }> };

// GET /api/teams/:teamId/members — FR-014
export async function GET(_request: Request, { params }: Params) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { teamId } = await params;
    const members = await listMembers(teamId, user.id);
    return Response.json({ data: members });
  });
}
