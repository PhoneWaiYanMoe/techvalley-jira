"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfileSchema } from "@/validation/profile.schema";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  );
}

export function ProfileForm({
  initialName,
  initialProfileImage,
  email,
}: {
  initialName: string;
  initialProfileImage: string | null;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [profileImage, setProfileImage] = useState(initialProfileImage ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setNotice(null);

    const parsed = updateProfileSchema.safeParse({
      name,
      profileImage: profileImage || undefined,
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[issue.path[0] as string] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setFormError(body?.error?.message ?? "Failed to update profile");
      return;
    }

    setNotice("Profile updated");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Avatar src={profileImage} initials={getInitials(name)} size={56} className="text-lg" />
      <Input id="email" label="Email" value={email} disabled />
      <Input
        id="name"
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        maxLength={50}
        required
      />
      <Input
        id="profileImage"
        label="Profile image URL"
        value={profileImage}
        onChange={(e) => setProfileImage(e.target.value)}
        error={fieldErrors.profileImage}
        placeholder="https://…"
      />
      {formError && <p className="text-sm text-red-600">{formError}</p>}
      {notice && <p className="text-sm text-green-600">{notice}</p>}
      <Button type="submit" disabled={submitting} className="self-start">
        {submitting ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
