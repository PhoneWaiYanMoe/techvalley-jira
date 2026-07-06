import { requireUser } from "@/lib/auth/session";
import { getTeam, updateTeam, deleteTeam } from "@/lib/team/team.service";
import { updateTeamSchema } from "@/validation/team.schema";
import { withApiErrorHandling } from "@/lib/utils/errors";

type Params = { params: Promise<{ teamId: string }> };

// GET /api/teams/:teamId
export async function GET(_request: Request, { params }: Params) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { teamId } = await params;
    return Response.json(await getTeam(teamId, user.id));
  });
}

// PATCH /api/teams/:teamId — FR-011
export async function PATCH(request: Request, { params }: Params) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { teamId } = await params;
    const body = updateTeamSchema.parse(await request.json());
    return Response.json(await updateTeam(teamId, user.id, body));
  });
}

// DELETE /api/teams/:teamId — FR-012
export async function DELETE(_request: Request, { params }: Params) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { teamId } = await params;
    await deleteTeam(teamId, user.id);
    return new Response(null, { status: 204 });
  });
}
