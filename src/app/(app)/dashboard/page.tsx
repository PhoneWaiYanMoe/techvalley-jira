import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — TechValley Jira Lite",
};

// Placeholder landing page for the authenticated shell. Full personal
// dashboard (FR-081: assigned issues, due soon/today, recent comments,
// teams/projects) is Day 6 scope per timeline.md.
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Personal dashboard coming soon.
      </p>
    </div>
  );
}
