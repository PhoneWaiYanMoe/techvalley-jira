import type { Metadata } from "next";
import { NotificationsPageClient } from "./NotificationsPageClient";

export const metadata: Metadata = {
  title: "Notifications — TechValley Jira Lite",
};

export default function NotificationsPage() {
  return <NotificationsPageClient />;
}
