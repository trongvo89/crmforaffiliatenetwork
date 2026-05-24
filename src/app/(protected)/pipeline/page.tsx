import { createClient } from "@/lib/supabase/server";
import { PipelineClient } from "./pipeline-client";
import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
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

  if (!userPerms?.is_super_admin && !userPerms?.allowed_modules?.includes("pipeline")) {
    return <AccessDenied label="Pipeline BD/PM" />;
  }

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (!company) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-amber-200 bg-amber-50">
        <p className="font-medium text-amber-800">Chưa cấu hình công ty</p>
        <p className="mt-1 text-sm text-amber-600">
          Vui lòng thiết lập thông tin công ty trong mục Cài đặt.
        </p>
      </div>
    );
  }

  const { data: contacts } = await supabase
    .from("pipeline_contacts")
    .select(
      "*, employees!owner_id(id, name, role), pipeline_activities(id, type, title, activity_date)"
    )
    .eq("company_id", company.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, role")
    .eq("company_id", company.id)
    .eq("is_active", true)
    .order("name");

  return (
    <PipelineClient
      initialContacts={contacts ?? []}
      employees={employees ?? []}
      companyId={company.id}
    />
  );
}
