import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTeam } from "@/lib/team/team.service";
import { ApiError } from "@/lib/utils/errors";
import { TeamTabs } from "@/components/team/TeamTabs";
import { getT } from "@/lib/i18n/server";

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

  const t = await getT();
  const canManage = team.myRole === "OWNER" || team.myRole === "ADMIN";
  const tabs = [
    { key: "overview", label: t("teams.tabOverview"), href: `/teams/${teamId}` },
    { key: "members", label: t("teams.tabMembers"), href: `/teams/${teamId}/members` },
    { key: "activity", label: t("teams.tabActivity"), href: `/teams/${teamId}/activity` },
    { key: "statistics", label: t("teams.tabStatistics"), href: `/teams/${teamId}/statistics` },
    ...(canManage
      ? [{ key: "settings", label: t("teams.tabSettings"), href: `/teams/${teamId}/settings` }]
      : []),
  ];

  return (
    <div className="p-6 pb-10">
      <div className="mb-4 flex items-center gap-2">
        <Link href="/teams" className="text-sm text-neutral-400 hover:underline">
          {t("teams.title")}
        </Link>
        <span className="text-sm text-neutral-300">/</span>
        <h1 className="text-xl font-bold tracking-tight">{team.name}</h1>
      </div>
      <TeamTabs tabs={tabs} />
      {children}
    </div>
  );
}
