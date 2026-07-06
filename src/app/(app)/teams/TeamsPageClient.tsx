"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { TeamResponse } from "@/types/api";
import { TeamCard } from "@/components/team/TeamCard";
import { CreateTeamModal } from "@/components/team/CreateTeamModal";

export function TeamsPageClient() {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    async function fetchTeams() {
      try {
        const res = await fetch("/api/teams");
        if (!res.ok) throw new Error("Failed to load teams");
        const data = await res.json();
        setTeams(data.data ?? []);
      } catch {
        // silently fail — UI shows empty state
      } finally {
        setLoading(false);
      }
    }
    fetchTeams();
  }, []);

  return (
    <div className="p-6 pb-10">
      {/* Top bar */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-xl font-bold tracking-tight">Teams</h1>
          <span className="font-mono text-sm text-neutral-400">{teams.length}</span>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-bold text-white shadow-sm transition-shadow hover:shadow-md"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New team
        </button>
      </div>

      {/* Team grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-indigo-600" />
        </div>
      ) : teams.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-4">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} onOpen={() => router.push(`/teams/${team.id}`)} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="text-[15px] font-bold text-neutral-900 dark:text-neutral-100">
            No teams yet
          </div>
          <div className="mt-1 text-[13px]">Create a team to start adding projects and members.</div>
        </div>
      )}

      {createOpen && (
        <CreateTeamModal
          onClose={() => setCreateOpen(false)}
          onCreated={(team) => {
            setTeams((prev) => [team, ...prev]);
            setCreateOpen(false);
            router.push(`/teams/${team.id}`);
          }}
        />
      )}
    </div>
  );
}
