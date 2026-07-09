import { requireUser } from "@/lib/auth/session";
import { listMyInvites } from "@/lib/invite/invite.service";
import { ApiError, withApiErrorHandling } from "@/lib/utils/errors";

// GET /api/invites/mine — FR-013
export async function GET() {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    if (!user.email) {
      throw new ApiError(422, "NO_EMAIL", "Your account has no email address");
    }
    const invites = await listMyInvites(user.email);
    return Response.json({ data: invites });
  });
}
