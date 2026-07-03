import { requireUser } from "@/lib/auth/session";
import { getUserTeams } from "@/lib/team/team.service";
import { withApiErrorHandling } from "@/lib/utils/errors";

// GET /api/teams — returns teams the current user belongs to
export async function GET() {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const teams = await getUserTeams(user.id);
    return Response.json({ data: teams });
  });
}
