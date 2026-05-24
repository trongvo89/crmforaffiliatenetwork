import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import type { UserPermissions } from "@/lib/permissions";

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? "";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch existing permissions record
  let { data: perms } = await supabase
    .from("user_permissions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  // Auto-create on first login
  if (!perms) {
    const isSuperAdmin =
      SUPER_ADMIN_EMAIL.length > 0 && user.email === SUPER_ADMIN_EMAIL;

    const { data: created } = await supabase
      .from("user_permissions")
      .insert({
        user_id: user.id,
        email: user.email ?? "",
        display_name: (user.user_metadata?.full_name as string) ?? null,
        is_super_admin: isSuperAdmin,
        allowed_modules: [],
      })
      .select("*")
      .single();

    perms = created;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar userPerms={perms as UserPermissions | null} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
