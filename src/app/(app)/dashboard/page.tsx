import { redirect } from "next/navigation";

// Redirect /dashboard → /projects (the new home for the workspace)
export default function DashboardPage() {
  redirect("/projects");
}
