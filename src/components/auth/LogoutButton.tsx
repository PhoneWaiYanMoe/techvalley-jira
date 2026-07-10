"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/client";

export function LogoutButton() {
  const router = useRouter();
  const { t } = useI18n();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="secondary" onClick={handleLogout}>
      {t("auth.logout")}
    </Button>
  );
}
