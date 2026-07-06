import type { User } from "@supabase/supabase-js";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/utils/errors";
import type {
  UpdateProfileInput,
  ChangePasswordInput,
  DeleteAccountInput,
} from "@/validation/profile.schema";
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

// Verifies a password via a throwaway anon-key client (doesn't touch the
// caller's session cookies). Throws 422 on mismatch.
async function verifyPassword(user: User, password: string): Promise<void> {
  const verifier = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error } = await verifier.auth.signInWithPassword({
    email: user.email!,
    password,
  });
  if (error) {
    throw new ApiError(422, "CURRENT_PASSWORD_MISMATCH", "Current password is incorrect");
  }
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

  await verifyPassword(user, input.currentPassword);

  const admin = createAdminClient();
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password: input.newPassword,
  });

  if (updateError) {
    throw new ApiError(500, "UPDATE_FAILED", "Failed to update password");
  }
}

// FR-007 — re-confirms password (OAuth-only users just need the request to
// arrive, no password field); blocks deletion if the user owns any
// non-deleted teams (409, "delete team or transfer ownership first"); soft
// deletes the profile and bans the auth user (can't hard-delete auth.users —
// profiles.id has ON DELETE CASCADE from it, which would destroy the very
// soft-delete row we're trying to keep).
export async function deleteAccount(user: User, input: DeleteAccountInput): Promise<void> {
  const hasEmailIdentity = user.identities?.some((i) => i.provider === "email");

  if (hasEmailIdentity) {
    if (!input.password) {
      throw new ApiError(422, "PASSWORD_REQUIRED", "Password is required to delete your account");
    }
    await verifyPassword(user, input.password);
  }

  const admin = createAdminClient();

  const { data: ownedTeams, error: teamsError } = await admin
    .from("teams")
    .select("id")
    .eq("owner_id", user.id)
    .is("deleted_at", null);

  if (teamsError) {
    throw new ApiError(500, "DB_ERROR", "Failed to check owned teams");
  }
  if (ownedTeams && ownedTeams.length > 0) {
    throw new ApiError(
      409,
      "OWNED_TEAMS_EXIST",
      "Please delete owned teams or transfer ownership first",
    );
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", user.id);

  if (profileError) {
    throw new ApiError(500, "DB_ERROR", "Failed to delete account");
  }

  // Ban indefinitely (~100 years) rather than hard-deleting the auth user, to
  // preserve the FK from profiles and avoid the ON DELETE CASCADE wiping the
  // soft-delete row we just wrote.
  const { error: banError } = await admin.auth.admin.updateUserById(user.id, {
    ban_duration: "876000h",
  });

  if (banError) {
    throw new ApiError(500, "DB_ERROR", "Failed to disable account");
  }
}
