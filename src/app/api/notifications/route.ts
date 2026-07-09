import { requireUser } from "@/lib/auth/session";
import { listNotifications } from "@/lib/notification/notification.service";
import { withApiErrorHandling } from "@/lib/utils/errors";

// GET /api/notifications?cursor=&limit= — FR-090
export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);

    const result = await listNotifications(user.id, cursor, limit);
    return Response.json(result);
  });
}
