import { requireUser } from "@/lib/auth/session";
import { listLabels, createLabel } from "@/lib/label/label.service";
import { createLabelSchema } from "@/validation/label.schema";
import { withApiErrorHandling } from "@/lib/utils/errors";

type RouteContext = { params: Promise<{ projectId: string }> };

// GET /api/projects/:projectId/labels — FR-038
export async function GET(_request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { projectId } = await params;
    const labels = await listLabels(projectId, user.id);
    return Response.json(labels);
  });
}

// POST /api/projects/:projectId/labels — FR-038 (422 if 20/project hit)
export async function POST(request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { projectId } = await params;
    const body = createLabelSchema.parse(await request.json());
    const label = await createLabel(projectId, user.id, body);
    return Response.json(label, { status: 201 });
  });
}
