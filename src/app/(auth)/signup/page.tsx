import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/SignupForm";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export const metadata: Metadata = {
  title: "Sign up — TechValley Jira Lite",
};

export default function SignupPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Create your account</h1>
      <SignupForm />
      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
        or
        <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
      </div>
      <GoogleSignInButton />
    </div>
  );
}
