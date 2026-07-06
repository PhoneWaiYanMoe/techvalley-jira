import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// OAuth code-exchange endpoint (FR-004). Google redirects here (via
// Supabase's own callback) with a `code` param after consent; we exchange it
// for a session, then send the user on to the app. Supabase can also redirect
// here directly with error params instead of a code — e.g. a banned account
// (see FR-007 account deletion) never gets as far as issuing a code.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  const description = searchParams.get("error_description") ?? "Google sign-in failed";
  return NextResponse.redirect(
    `${origin}/login?error=oauth_failed&errorMessage=${encodeURIComponent(description)}`,
  );
}
