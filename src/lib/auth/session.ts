import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/utils/errors";

// Shared "must be logged in" check for API routes (401 if not). Team-scoped
// authorization (404/403 per FR-070) is a separate concern that will live in
// lib/permissions/guard.ts once team-scoped resources exist.
export async function requireUser(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ApiError(401, "UNAUTHENTICATED", "Not authenticated");
  }
  return user;
}
