import type { Metadata } from "next";
import { PersonalDashboardClient } from "@/components/dashboard/PersonalDashboardClient";

export const metadata: Metadata = {
  title: "Dashboard — TechValley Jira Lite",
};

// Personal dashboard (FR-081) — my issues by status, due soon/today,
// recent comments, my teams/projects.
export default function DashboardPage() {
  return <PersonalDashboardClient />;
}
