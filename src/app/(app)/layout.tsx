import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile/profile.service";
import { Navbar } from "@/components/layout/Navbar";

// Defense in depth: proxy.ts already redirects unauthenticated requests away
// from this route group, but Next.js docs recommend re-checking auth here
// too, since a matcher change could silently remove proxy coverage.
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getProfile(user);

  return (
    <div className="min-h-screen">
      <Navbar displayName={profile.name || profile.email || "Account"} />
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
