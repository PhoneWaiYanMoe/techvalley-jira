import type { Metadata } from "next";
import { ProjectDashboardPage } from "./ProjectDashboardPage";

export const metadata: Metadata = {
  title: "Project Dashboard — TechValley Jira Lite",
};

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ProjectDashboardPage projectId={projectId} />;
}
