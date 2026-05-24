import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PermissionsClient } from "./permissions-client";
import type { UserPermissions } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function PermissionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Only super admins can access this page
  const { data: myPerms } = await supabase
    .from("user_permissions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!myPerms?.is_super_admin) {
    redirect("/dashboard");
  }

  // Fetch all user permission records
  const { data: allPerms } = await supabase
    .from("user_permissions")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <PermissionsClient
      currentUserId={user.id}
      allPerms={(allPerms ?? []) as UserPermissions[]}
    />
  );
}
