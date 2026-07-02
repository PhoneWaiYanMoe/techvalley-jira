import { requireUser } from "@/lib/auth/session";
import { changePassword } from "@/lib/profile/profile.service";
import { changePasswordSchema } from "@/validation/profile.schema";
import { withApiErrorHandling } from "@/lib/utils/errors";

// PATCH /api/profile/password — FR-006
export async function PATCH(request: Request) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const body = changePasswordSchema.parse(await request.json());
    await changePassword(user, body);
    return new Response(null, { status: 204 });
  });
}
