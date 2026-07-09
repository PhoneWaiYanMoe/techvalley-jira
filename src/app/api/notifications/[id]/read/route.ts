import { requireUser } from "@/lib/auth/session";
import { markAsRead } from "@/lib/notification/notification.service";
import { withApiErrorHandling } from "@/lib/utils/errors";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/notifications/:id/read — FR-091
export async function PATCH(_request: Request, { params }: Params) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { id } = await params;
    await markAsRead(id, user.id);
    return new Response(null, { status: 204 });
  });
}
