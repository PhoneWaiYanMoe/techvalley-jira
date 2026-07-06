import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTeam, listMembers } from "@/lib/team/team.service";
import { MembersPageClient } from "@/components/team/MembersPageClient";

export default async function TeamMembersPage({
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

  const team = await getTeam(teamId, user.id);
  const members = await listMembers(teamId, user.id);

  return (
    <MembersPageClient
      teamId={teamId}
      currentUserId={user.id}
      myRole={team.myRole}
      initialMembers={members}
    />
  );
}
