import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTeamMembership } from "@/lib/team/team.service";
import { listActivity } from "@/lib/activity-log/activity-log.service";
import { ActivityFeedClient } from "@/components/team/ActivityFeedClient";

export default async function TeamActivityPage({
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

  await requireTeamMembership(user.id, teamId);
  const { data, nextCursor } = await listActivity(teamId, null, 20);

  return <ActivityFeedClient teamId={teamId} initialData={data} initialCursor={nextCursor} />;
}
