import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile/profile.service";
import { Sidebar } from "@/components/layout/Sidebar";

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
  const displayName = profile.name || profile.email || "Account";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950">
      <Sidebar userName={displayName} userInitials={initials} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
