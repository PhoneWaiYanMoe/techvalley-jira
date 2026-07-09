import type { Metadata } from "next";
import { InvitesPageClient } from "./InvitesPageClient";

export const metadata: Metadata = {
  title: "My invites — TechValley Jira Lite",
};

export default function InvitesPage() {
  return <InvitesPageClient />;
}
