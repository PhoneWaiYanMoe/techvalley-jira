import type { Metadata } from "next";
import { IssuesPageClient } from "./IssuesPageClient";

export const metadata: Metadata = {
  title: "Issues — TechValley Jira Lite",
};

export default async function IssuesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <IssuesPageClient projectId={projectId} />;
}
