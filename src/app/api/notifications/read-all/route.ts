import { requireUser } from "@/lib/auth/session";
import { markAllAsRead } from "@/lib/notification/notification.service";
import { withApiErrorHandling } from "@/lib/utils/errors";

// PATCH /api/notifications/read-all — FR-091
export async function PATCH() {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    await markAllAsRead(user.id);
    return new Response(null, { status: 204 });
  });
}
