import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Set new password — TechValley Jira Lite",
};

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Set a new password</h1>
      <ResetPasswordForm />
    </div>
  );
}
