import type { Metadata } from "next";
import { TeamsPageClient } from "./TeamsPageClient";

export const metadata: Metadata = {
  title: "Teams — TechValley Jira Lite",
};

export default function TeamsPage() {
  return <TeamsPageClient />;
}
