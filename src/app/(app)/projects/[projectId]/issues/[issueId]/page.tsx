import type { Metadata } from "next";
import { IssueDetailClient } from "./IssueDetailClient";

export const metadata: Metadata = {
  title: "Issue — TechValley Jira Lite",
};

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; issueId: string }>;
}) {
  const { projectId, issueId } = await params;
  return <IssueDetailClient projectId={projectId} issueId={issueId} />;
}
