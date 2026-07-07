import { requireUser } from "@/lib/auth/session";
import { acceptInvite } from "@/lib/invite/invite.service";
import { ApiError, withApiErrorHandling } from "@/lib/utils/errors";

type Params = { params: Promise<{ inviteId: string }> };

// POST /api/invites/:inviteId/accept — FR-013
export async function POST(_request: Request, { params }: Params) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    if (!user.email) {
      throw new ApiError(422, "NO_EMAIL", "Your account has no email address");
    }
    const { inviteId } = await params;
    const role = await acceptInvite(inviteId, user.id, user.email);
    return Response.json({ role });
  });
}
