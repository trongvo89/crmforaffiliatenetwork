import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { HrClient } from "./hr-client";
import type { Employee } from "./hr-client";
import { AccessDenied } from "@/components/access-denied";

export const dynamic = "force-dynamic";

export default async function HrPage() {
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

  if (!userPerms?.is_super_admin && !userPerms?.allowed_modules?.includes("hr")) {
    return <AccessDenied label="HR & Org Chart" />;
  }

  const { data: companyRow } = await supabase
    .from("companies")
    .select("*")
    .limit(1)
    .maybeSingle();

  const companyId: string = companyRow?.id ?? "";

  if (!companyId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">HR & Org Chart</h1>
        <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-muted-foreground">Cần cấu hình công ty trước tại trang Cài đặt.</p>
        </div>
      </div>
    );
  }

  const { data: employeesData } = await supabase
    .from("employees")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  return (
    <HrClient
      initialEmployees={(employeesData ?? []) as Employee[]}
      companyId={companyId}
    />
  );
}
