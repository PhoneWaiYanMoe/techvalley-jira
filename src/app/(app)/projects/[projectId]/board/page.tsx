import type { Metadata } from "next";
import { KanbanBoardPage } from "./KanbanBoardPage";

export const metadata: Metadata = {
  title: "Board — TechValley Jira Lite",
};

export default async function BoardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <KanbanBoardPage projectId={projectId} />;
}
