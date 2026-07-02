import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Sign up — TechValley Jira Lite",
};

export default function SignupPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Create your account</h1>
      <SignupForm />
    </div>
  );
}
