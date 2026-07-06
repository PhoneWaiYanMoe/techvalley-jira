import { requireUser } from "@/lib/auth/session";
import { kickMember } from "@/lib/team/team.service";
import { withApiErrorHandling } from "@/lib/utils/errors";

type Params = { params: Promise<{ teamId: string; userId: string }> };

// DELETE /api/teams/:teamId/members/:userId — FR-015
export async function DELETE(_request: Request, { params }: Params) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { teamId, userId } = await params;
    await kickMember(teamId, user.id, userId);
    return new Response(null, { status: 204 });
  });
}
