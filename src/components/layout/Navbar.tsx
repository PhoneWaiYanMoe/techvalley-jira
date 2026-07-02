import Link from "next/link";
import { LogoutButton } from "@/components/auth/LogoutButton";

export function Navbar({ displayName }: { displayName: string }) {
  return (
    <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3 dark:border-neutral-800">
      <nav className="flex items-center gap-4">
        <Link href="/dashboard" className="font-semibold">
          TechValley Jira Lite
        </Link>
      </nav>
      <div className="flex items-center gap-4">
        <Link href="/profile" className="text-sm hover:underline">
          {displayName}
        </Link>
        <LogoutButton />
      </div>
    </header>
  );
}
