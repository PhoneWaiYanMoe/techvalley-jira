import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTeam } from "@/lib/team/team.service";
import { RoleBadge } from "@/components/team/RoleBadge";

export default async function TeamOverviewPage({
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

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
        <div className="rounded-xl border border-neutral-200 bg-white p-4.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
            Your role
          </div>
          <div className="mt-2">
            <RoleBadge role={team.myRole} />
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
            Members
          </div>
          <div className="mt-1 text-3xl font-extrabold">{team.memberCount}</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
            Created
          </div>
          <div className="mt-1 text-sm font-semibold">
            {new Date(team.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          href="/projects"
          className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-neutral-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
        >
          View projects
        </Link>
        <Link
          href={`/teams/${teamId}/members`}
          className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-neutral-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
        >
          View members
        </Link>
      </div>
    </div>
  );
}
