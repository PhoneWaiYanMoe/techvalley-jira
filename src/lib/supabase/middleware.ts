import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Public, but redirect AWAY if already logged in (no reason to see a login form
// while authenticated).
const AUTH_ONLY_PATHS = ["/login", "/signup", "/forgot-password"];

// Always accessible regardless of auth state — never redirected either
// direction. /reset-password needs this because clicking the emailed reset
// link gives the browser a temporary Supabase "recovery" session, which would
// otherwise make the `user && isAuthOnlyPath` branch below bounce the user to
// /dashboard before they can set a new password. /auth/callback needs this so
// the OAuth code-exchange route isn't redirected before it runs.
const ALWAYS_ACCESSIBLE_PATHS = ["/reset-password", "/auth/callback"];

// Refreshes the Supabase session cookie on every request and redirects
// unauthenticated users away from protected routes. Called from proxy.ts
// (Next.js 16 renamed middleware.ts -> proxy.ts, see CLAUDE.md).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (ALWAYS_ACCESSIBLE_PATHS.some((path) => pathname.startsWith(path))) {
    return response;
  }

  const isAuthOnlyPath = AUTH_ONLY_PATHS.some((path) => pathname.startsWith(path));

  if (!user && !isAuthOnlyPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthOnlyPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
