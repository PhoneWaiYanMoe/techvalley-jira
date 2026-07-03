import type { Metadata } from "next";
import { ProjectsPageClient } from "./ProjectsPageClient";

export const metadata: Metadata = {
  title: "Projects — TechValley Jira Lite",
};

export default function ProjectsPage() {
  return <ProjectsPageClient />;
}
