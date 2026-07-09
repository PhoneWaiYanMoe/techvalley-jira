import { requireUser } from "@/lib/auth/session";
import { getPersonalDashboard } from "@/lib/dashboard/dashboard.service";
import { withApiErrorHandling } from "@/lib/utils/errors";

// GET /api/dashboard/personal — FR-081
export async function GET() {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const dashboard = await getPersonalDashboard(user.id);
    return Response.json(dashboard);
  });
}
