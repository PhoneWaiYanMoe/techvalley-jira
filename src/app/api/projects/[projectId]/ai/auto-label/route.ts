import { requireUser } from "@/lib/auth/session";
import { suggestLabels } from "@/lib/ai/ai.service";
import { autoLabelSchema } from "@/validation/ai.schema";
import { withApiErrorHandling } from "@/lib/utils/errors";

type RouteContext = { params: Promise<{ projectId: string }> };

// POST /api/projects/:projectId/ai/auto-label — FR-043 (max 3 from project labels)
export async function POST(request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { projectId } = await params;
    const body = autoLabelSchema.parse(await request.json());
    const result = await suggestLabels(projectId, user.id, body);
    return Response.json(result);
  });
}
