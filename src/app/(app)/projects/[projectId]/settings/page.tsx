import type { Metadata } from "next";
import { ProjectSettingsPage } from "./ProjectSettingsPage";

export const metadata: Metadata = {
  title: "Settings — TechValley Jira Lite",
};

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ProjectSettingsPage projectId={projectId} />;
}
