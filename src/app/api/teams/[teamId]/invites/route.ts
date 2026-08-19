import { requireUser } from "@/lib/auth/session";
import { createInvite, listTeamInvites } from "@/lib/invite/invite.service";
import { createInviteSchema } from "@/validation/team.schema";
import { withApiErrorHandling } from "@/lib/utils/errors";

type Params = { params: Promise<{ teamId: string }> };

// GET /api/teams/:teamId/invites — FR-013 (OWNER/ADMIN view of pending invites)
export async function GET(_request: Request, { params }: Params) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { teamId } = await params;
    const invites = await listTeamInvites(teamId, user.id);
    return Response.json({ data: invites });
  });
}

// POST /api/teams/:teamId/invites — FR-013
export async function POST(request: Request, { params }: Params) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { teamId } = await params;
    const body = createInviteSchema.parse(await request.json());
    const invite = await createInvite(teamId, user.id, user.email ?? "", body);
    return Response.json(invite, { status: 201 });
  });
}
