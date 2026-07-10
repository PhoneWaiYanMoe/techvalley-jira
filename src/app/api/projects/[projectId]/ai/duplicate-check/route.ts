import { requireUser } from "@/lib/auth/session";
import { checkDuplicates } from "@/lib/ai/ai.service";
import { duplicateCheckSchema } from "@/validation/ai.schema";
import { withApiErrorHandling } from "@/lib/utils/errors";

type RouteContext = { params: Promise<{ projectId: string }> };

// POST /api/projects/:projectId/ai/duplicate-check — FR-044 (max 3 similar issues)
export async function POST(request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { projectId } = await params;
    const body = duplicateCheckSchema.parse(await request.json());
    const result = await checkDuplicates(projectId, user.id, body);
    return Response.json(result);
  });
}
