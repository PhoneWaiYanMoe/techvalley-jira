import { requireUser } from "@/lib/auth/session";
import { resendInvite } from "@/lib/invite/invite.service";
import { withApiErrorHandling } from "@/lib/utils/errors";

type Params = { params: Promise<{ teamId: string; inviteId: string }> };

// POST /api/teams/:teamId/invites/:inviteId/resend — FR-013
export async function POST(_request: Request, { params }: Params) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { teamId, inviteId } = await params;
    const invite = await resendInvite(teamId, inviteId, user.id);
    return Response.json(invite);
  });
}
