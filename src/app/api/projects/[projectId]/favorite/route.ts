import { requireUser } from "@/lib/auth/session";
import { toggleFavorite } from "@/lib/project/project.service";
import { favoriteProjectSchema } from "@/validation/project.schema";
import { withApiErrorHandling } from "@/lib/utils/errors";

// POST /api/projects/:projectId/favorite — FR-027
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { projectId } = await params;
    const body = favoriteProjectSchema.parse(await request.json());
    await toggleFavorite(projectId, user.id, body.favorite);
    return new Response(null, { status: 204 });
  });
}
