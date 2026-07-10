"use client";

import type { TeamResponse } from "@/types/api";
import { RoleBadge } from "@/components/team/RoleBadge";
import { useI18n } from "@/lib/i18n/client";
import type { TFunction } from "@/lib/i18n/translate";

function timeAgo(t: TFunction, dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return t("time.today");
  if (days < 7) return t("time.daysAgo", { n: days });
  if (days < 30) return t("time.weeksAgo", { n: Math.round(days / 7) });
  if (days < 365) return t("time.monthsAgo", { n: Math.round(days / 30) });
  return t("time.yearsAgo", { n: Math.round(days / 365) });
}

export function TeamCard({ team, onOpen }: { team: TeamResponse; onOpen: () => void }) {
  const { t } = useI18n();
  return (
    <div
      onClick={onOpen}
      className="group flex cursor-pointer flex-col rounded-xl border border-neutral-200 bg-white p-4.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-indigo-50 text-sm font-extrabold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
          {team.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold tracking-tight">{team.name}</span>
          <div className="mt-0.5 font-mono text-[11px] text-neutral-400">
            {t("teams.createdAgo", { when: timeAgo(t, team.createdAt) })}
          </div>
        </div>
        <RoleBadge role={team.myRole} />
      </div>

      <div className="mt-auto flex items-center gap-3.5 pt-1">
        <span className="text-xs text-neutral-500">
          <b className="font-mono text-neutral-900 dark:text-neutral-100">{team.memberCount}</b>{" "}
          {team.memberCount === 1 ? t("teams.memberOne") : t("teams.memberMany")}
        </span>
      </div>
    </div>
  );
}
