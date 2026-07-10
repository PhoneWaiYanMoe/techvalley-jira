import { requireUser } from "@/lib/auth/session";
import { listComments, createComment } from "@/lib/comment/comment.service";
import { createCommentSchema } from "@/validation/comment.schema";
import { withApiErrorHandling } from "@/lib/utils/errors";

type RouteContext = { params: Promise<{ issueId: string }> };

// GET /api/issues/:issueId/comments?cursor=&limit= — FR-061 (chronological, paginated)
export async function GET(request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { issueId } = await params;
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;
    const comments = await listComments(issueId, user.id, {
      cursor,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return Response.json(comments);
  });
}

// POST /api/issues/:issueId/comments — FR-060
export async function POST(request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { issueId } = await params;
    const body = createCommentSchema.parse(await request.json());
    const comment = await createComment(issueId, user.id, body);
    return Response.json(comment, { status: 201 });
  });
}
