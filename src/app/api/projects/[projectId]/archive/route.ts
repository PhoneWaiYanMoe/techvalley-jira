import { requireUser } from "@/lib/auth/session";
import { archiveProject } from "@/lib/project/project.service";
import { archiveProjectSchema } from "@/validation/project.schema";
import { withApiErrorHandling } from "@/lib/utils/errors";

// PATCH /api/projects/:projectId/archive — FR-026
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { projectId } = await params;
    const body = archiveProjectSchema.parse(await request.json());
    const project = await archiveProject(projectId, user.id, body.archived);
    return Response.json(project);
  });
}
