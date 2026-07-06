import { requireUser } from "@/lib/auth/session";
import { getUserTeams, createTeam } from "@/lib/team/team.service";
import { createTeamSchema } from "@/validation/team.schema";
import { withApiErrorHandling } from "@/lib/utils/errors";

// GET /api/teams — returns teams the current user belongs to
export async function GET() {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const teams = await getUserTeams(user.id);
    return Response.json({ data: teams });
  });
}

// POST /api/teams — FR-010
export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const body = createTeamSchema.parse(await request.json());
    const team = await createTeam(user.id, body);
    return Response.json(team, { status: 201 });
  });
}
