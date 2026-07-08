import { checkDueDates } from "@/lib/notification/due-date-check.service";
import { errorResponse } from "@/lib/utils/errors";

// POST /api/notifications/check-due-dates — FR-090 due-soon/due-today.
// Not user-facing: meant to be invoked once a day by an external scheduler
// (Vercel Cron once deployed; run manually or via any HTTP-capable cron
// until then). Protected by a shared secret rather than a user session,
// since there's no logged-in "actor" for a scheduled job.
export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return errorResponse(401, "UNAUTHENTICATED", "Invalid or missing cron secret");
  }

  const result = await checkDueDates();
  return Response.json(result);
}
