import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile/profile.service";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { PasswordChangeForm } from "@/components/profile/PasswordChangeForm";

export const metadata: Metadata = {
  title: "Profile — TechValley Jira Lite",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getProfile(user);
  const hasEmailIdentity = user.identities?.some((i) => i.provider === "email") ?? false;

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h1 className="text-xl font-semibold">Profile</h1>
        <div className="mt-4 max-w-md">
          <ProfileForm
            initialName={profile.name}
            initialProfileImage={profile.profileImage}
            email={profile.email ?? ""}
          />
        </div>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Change password</h2>
        <div className="mt-4 max-w-md">
          <PasswordChangeForm disabled={!hasEmailIdentity} />
        </div>
      </section>
    </div>
  );
}
