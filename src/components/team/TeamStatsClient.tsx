"use client";

import { useCallback, useState } from "react";
import type { TeamStatsResponse, StatsPeriod } from "@/types/api";
import { LineChart } from "@/components/dashboard/LineChart";
import { BarChart } from "@/components/projects/BarChart";
import { useI18n } from "@/lib/i18n/client";

const AVATAR_COLORS = ["#6366f1", "#0ea5e9", "#e0982e", "#f43f5e", "#8b5cf6", "#10b981", "#14b8a6"];

// Default statuses are seeded without a color (schema.sql); fall back to the
// same palette used elsewhere for them. Custom statuses keep their own color.
const DEFAULT_STATUS_COLORS: Record<string, string> = {
  Backlog: "#94a3b8",
  "In Progress": "#6366f1",
  "In Review": "#e0982e",
  Done: "#10b981",
};

function statusColor(name: string, color: string | null): string {
  return color ?? DEFAULT_STATUS_COLORS[name] ?? "#94a3b8";
}

function avatarColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

const PERIODS: StatsPeriod[] = [7, 30, 90];

export function TeamStatsClient({
  teamId,
  initialStats,
}: {
  teamId: string;
  initialStats: TeamStatsResponse;
}) {
  const { t } = useI18n();
  const [stats, setStats] = useState(initialStats);
  const [period, setPeriod] = useState<StatsPeriod>(initialStats.period);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changePeriod = useCallback(
    async (next: StatsPeriod) => {
      if (next === period) return;
      setPeriod(next);
      setLoading(true);
      try {
        const res = await fetch(`/api/teams/${teamId}/stats?period=${next}`);
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error?.message ?? t("stats.loadFailed"));
        }
        setStats(await res.json());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("common.error"));
      } finally {
        setLoading(false);
      }
    },
    [period, teamId, t],
  );

  const {
    creationTrend,
    completionTrend,
    assignedPerMember,
    completedPerMember,
    statusPerProject,
  } = stats;

  const totalCreated = creationTrend.reduce((sum, p) => sum + p.count, 0);
  const totalCompleted = completionTrend.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-neutral-200 bg-white p-1 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => void changePeriod(p)}
              disabled={loading}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                period === p
                  ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
                  : "text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              }`}
            >
              {t("stats.lastNDays", { n: p })}
            </button>
          ))}
        </div>
        {loading && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-indigo-600" />
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 px-3 py-2.5 text-[12px] font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* Trend charts */}
      <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[13.5px] font-bold">{t("stats.issuesCreated")}</div>
            <span className="text-xs font-semibold text-neutral-400">
              {t("stats.total", { n: totalCreated })}
            </span>
          </div>
          <LineChart points={creationTrend} color="#6366f1" />
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[13.5px] font-bold">{t("stats.issuesCompleted")}</div>
            <span className="text-xs font-semibold text-neutral-400">
              {t("stats.total", { n: totalCompleted })}
            </span>
          </div>
          <LineChart points={completionTrend} color="#10b981" />
        </div>
      </div>

      {/* Per-member breakdowns */}
      <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4 text-[13.5px] font-bold">{t("stats.assignedPerMember")}</div>
          <BarChart
            items={assignedPerMember.map((m, i) => ({
              label: m.name,
              value: m.count,
              color: avatarColor(i),
              prefix: (
                <div
                  className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: avatarColor(i) }}
                >
                  {m.initials}
                </div>
              ),
            }))}
            maxValue={Math.max(1, ...assignedPerMember.map((m) => m.count))}
          />
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4 text-[13.5px] font-bold">{t("stats.completedPerMember")}</div>
          <BarChart
            items={completedPerMember.map((m, i) => ({
              label: m.name,
              value: m.count,
              color: avatarColor(i),
              prefix: (
                <div
                  className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: avatarColor(i) }}
                >
                  {m.initials}
                </div>
              ),
            }))}
            maxValue={Math.max(1, ...completedPerMember.map((m) => m.count))}
          />
        </div>
      </div>

      {/* Status per project */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4 text-[13.5px] font-bold">{t("stats.statusPerProject")}</div>
        {statusPerProject.length > 0 ? (
          <div className="flex flex-col gap-3.5">
            {statusPerProject.map((p) => {
              const total = p.statuses.reduce((sum, s) => sum + s.count, 0);
              return (
                <div key={p.projectId} className="border-t border-neutral-100 pt-3.5 first:border-t-0 first:pt-0 dark:border-neutral-800">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[12.8px] font-semibold">{p.projectName}</span>
                    <span className="text-[11px] text-neutral-400">
                      {t("stats.issuesCount", { n: total })}
                    </span>
                  </div>
                  {total > 0 ? (
                    <div className="flex h-2 overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-800">
                      {p.statuses.map((s) => (
                        <div
                          key={s.name}
                          title={`${s.name}: ${s.count}`}
                          style={{
                            width: `${(s.count / total) * 100}%`,
                            backgroundColor: statusColor(s.name, s.color),
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-400">{t("stats.noIssues")}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1">
                    {p.statuses.map((s) => (
                      <div key={s.name} className="flex items-center gap-1.5 text-[11px]">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: statusColor(s.name, s.color) }}
                        />
                        <span className="text-neutral-500">{s.name}</span>
                        <span className="font-mono text-neutral-400">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-3.5 text-xs text-neutral-400">{t("stats.noProjects")}</p>
        )}
      </div>
    </div>
  );
}
