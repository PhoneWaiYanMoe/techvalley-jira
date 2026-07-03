import { requireUser } from "@/lib/auth/session";
import {
  getProject,
  updateProject,
  deleteProject,
} from "@/lib/project/project.service";
import { updateProjectSchema } from "@/validation/project.schema";
import { withApiErrorHandling } from "@/lib/utils/errors";

type RouteContext = { params: Promise<{ projectId: string }> };

// GET /api/projects/:projectId — FR-022
export async function GET(_request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { projectId } = await params;
    const project = await getProject(projectId, user.id);
    return Response.json(project);
  });
}

// PATCH /api/projects/:projectId — FR-023
export async function PATCH(request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { projectId } = await params;
    const body = updateProjectSchema.parse(await request.json());
    const project = await updateProject(projectId, user.id, body);
    return Response.json(project);
  });
}

// DELETE /api/projects/:projectId — FR-024
export async function DELETE(_request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { projectId } = await params;
    await deleteProject(projectId, user.id);
    return new Response(null, { status: 204 });
  });
}
