import { requireUser } from "@/lib/auth/session";
import { createProject } from "@/lib/project/project.service";
import { createProjectSchema } from "@/validation/project.schema";
import { withApiErrorHandling } from "@/lib/utils/errors";

// POST /api/teams/:teamId/projects — FR-020
export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { teamId } = await params;
    const body = createProjectSchema.parse(await request.json());
    const project = await createProject(teamId, user.id, body);
    return Response.json(project, { status: 201 });
  });
}
