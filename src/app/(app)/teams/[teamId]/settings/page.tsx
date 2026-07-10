import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTeam } from "@/lib/team/team.service";
import { TeamSettingsForm } from "@/components/team/TeamSettingsForm";
import { DeleteTeamSection } from "@/components/team/DeleteTeamSection";
import { getT } from "@/lib/i18n/server";

export default async function TeamSettingsPage({
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

  // Defense in depth: the Settings tab is already hidden for non-managers in
  // the layout, but a direct URL visit should still be blocked (FR-011/012).
  if (team.myRole !== "OWNER" && team.myRole !== "ADMIN") {
    notFound();
  }

  const t = await getT();
  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="text-lg font-semibold">{t("teamSettings.teamName")}</h2>
        <div className="mt-4">
          <TeamSettingsForm teamId={teamId} initialName={team.name} />
        </div>
      </section>
      {team.myRole === "OWNER" && (
        <section>
          <DeleteTeamSection teamId={teamId} />
        </section>
      )}
    </div>
  );
}
