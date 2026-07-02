import type { User } from "@supabase/supabase-js";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/utils/errors";
import type { UpdateProfileInput, ChangePasswordInput } from "@/validation/profile.schema";
import type { ProfileResponse } from "@/types/api";

function toProfileResponse(
  row: { id: string; name: string; profile_image: string | null },
  email: string | null,
): ProfileResponse {
  return {
    id: row.id,
    name: row.name,
    profileImage: row.profile_image,
    email,
  };
}

// FR-005
export async function getProfile(user: User): Promise<ProfileResponse> {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, name, profile_image")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    throw new ApiError(404, "NOT_FOUND", "Profile not found");
  }
  return toProfileResponse(profile, user.email ?? null);
}

// FR-005
export async function updateProfile(
  user: User,
  input: UpdateProfileInput,
): Promise<ProfileResponse> {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.profileImage !== undefined ? { profile_image: input.profileImage } : {}),
    })
    .eq("id", user.id)
    .select("id, name, profile_image")
    .single();

  if (error || !profile) {
    throw new ApiError(404, "NOT_FOUND", "Profile not found");
  }
  return toProfileResponse(profile, user.email ?? null);
}

// FR-006 — disabled for Google-only accounts (no email identity); verifies
// the current password before updating.
export async function changePassword(user: User, input: ChangePasswordInput): Promise<void> {
  const hasEmailIdentity = user.identities?.some((i) => i.provider === "email");
  if (!hasEmailIdentity) {
    throw new ApiError(
      422,
      "OAUTH_ONLY_ACCOUNT",
      "Password change is disabled for accounts that signed up via Google only",
    );
  }

  // Throwaway anon-key client — doesn't touch the caller's session cookies.
  const verifier = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email!,
    password: input.currentPassword,
  });

  if (verifyError) {
    throw new ApiError(422, "CURRENT_PASSWORD_MISMATCH", "Current password is incorrect");
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password: input.newPassword,
  });

  if (updateError) {
    throw new ApiError(500, "UPDATE_FAILED", "Failed to update password");
  }
}
