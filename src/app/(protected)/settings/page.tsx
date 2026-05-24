import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SettingsClient } from "./settings-client";
import { AccessDenied } from "@/components/access-denied";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Permission check
  const { data: userPerms } = await supabase
    .from("user_permissions")
    .select("is_super_admin, allowed_modules")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!userPerms?.is_super_admin && !userPerms?.allowed_modules?.includes("settings")) {
    return <AccessDenied label="Cài đặt" />;
  }

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .limit(1)
    .maybeSingle();

  return <SettingsClient initialCompany={company} />;
}
