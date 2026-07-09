import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTeam } from "@/lib/team/team.service";
import { ApiError } from "@/lib/utils/errors";
import { TeamTabs } from "@/components/team/TeamTabs";

export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let team;
  try {
    team = await getTeam(teamId, user.id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  const canManage = team.myRole === "OWNER" || team.myRole === "ADMIN";
  const tabs = [
    { key: "overview", label: "Overview", href: `/teams/${teamId}` },
    { key: "members", label: "Members", href: `/teams/${teamId}/members` },
    { key: "activity", label: "Activity", href: `/teams/${teamId}/activity` },
    { key: "statistics", label: "Statistics", href: `/teams/${teamId}/statistics` },
    ...(canManage ? [{ key: "settings", label: "Settings", href: `/teams/${teamId}/settings` }] : []),
  ];

  return (
    <div className="p-6 pb-10">
      <div className="mb-4 flex items-center gap-2">
        <Link href="/teams" className="text-sm text-neutral-400 hover:underline">
          Teams
        </Link>
        <span className="text-sm text-neutral-300">/</span>
        <h1 className="text-xl font-bold tracking-tight">{team.name}</h1>
      </div>
      <TeamTabs tabs={tabs} />
      {children}
    </div>
  );
}
