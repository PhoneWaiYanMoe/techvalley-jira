import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot password — TechValley Jira Lite",
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Reset your password</h1>
      <ForgotPasswordForm />
    </div>
  );
}
