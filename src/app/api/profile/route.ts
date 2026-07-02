import { requireUser } from "@/lib/auth/session";
import { getProfile, updateProfile } from "@/lib/profile/profile.service";
import { updateProfileSchema } from "@/validation/profile.schema";
import { withApiErrorHandling } from "@/lib/utils/errors";

// GET /api/profile — FR-005
export async function GET() {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    return Response.json(await getProfile(user));
  });
}

// PATCH /api/profile — FR-005
export async function PATCH(request: Request) {
  return withApiErrorHandling(async () => {
    const user = await requireUser();
    const body = updateProfileSchema.parse(await request.json());
    return Response.json(await updateProfile(user, body));
  });
}
