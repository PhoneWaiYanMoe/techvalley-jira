import { requireUser } from "@/lib/auth/session";
import { changeRole } from "@/lib/team/team.service";
import { changeRoleSchema } from "@/validation/team.schema";
import { withApiErrorHandling } from "@/lib/utils/errors";

type Params = { params: Promise<{ teamId: string; userId: string }> };

// PATCH /api/teams/:teamId/members/:userId/role — FR-018
export async function PATCH(request: Request, { params }: Params) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { teamId, userId } = await params;
    const body = changeRoleSchema.parse(await request.json());
    await changeRole(teamId, user.id, userId, body.role);
    return new Response(null, { status: 204 });
  });
}
