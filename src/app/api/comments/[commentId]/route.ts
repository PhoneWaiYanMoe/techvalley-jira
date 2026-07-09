import { requireUser } from "@/lib/auth/session";
import { updateComment, deleteComment } from "@/lib/comment/comment.service";
import { updateCommentSchema } from "@/validation/comment.schema";
import { withApiErrorHandling } from "@/lib/utils/errors";

type RouteContext = { params: Promise<{ commentId: string }> };

// PATCH /api/comments/:commentId — FR-062 (author only)
export async function PATCH(request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { commentId } = await params;
    const body = updateCommentSchema.parse(await request.json());
    const comment = await updateComment(commentId, user.id, body);
    return Response.json(comment);
  });
}

// DELETE /api/comments/:commentId — FR-063 (author, issue owner, project owner, team OWNER/ADMIN)
export async function DELETE(_request: Request, { params }: RouteContext) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { commentId } = await params;
    await deleteComment(commentId, user.id);
    return new Response(null, { status: 204 });
  });
}
