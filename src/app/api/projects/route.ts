import { requireUser } from "@/lib/auth/session";
import { listProjects } from "@/lib/project/project.service";
import { withApiErrorHandling } from "@/lib/utils/errors";

// GET /api/projects — FR-021 (list all projects for the current user)
export async function GET() {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const result = await listProjects(user.id);
    return Response.json(result);
  });
}
