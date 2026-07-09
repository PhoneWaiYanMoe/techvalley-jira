import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTeamStats } from "@/lib/dashboard/dashboard.service";
import { TeamStatsClient } from "@/components/team/TeamStatsClient";

export default async function TeamStatisticsPage({
  params,
}: {
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

  const initialStats = await getTeamStats(teamId, user.id, 30);

  return <TeamStatsClient teamId={teamId} initialStats={initialStats} />;
}
