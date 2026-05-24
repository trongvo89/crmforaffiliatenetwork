import { createClient } from "@/lib/supabase/server";
import { PLClient } from "./pl-client";
import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/access-denied";

export const dynamic = "force-dynamic";

export default async function PLPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Permission check
  const { data: userPerms } = await supabase
    .from("user_permissions")
    .select("is_super_admin, allowed_modules")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!userPerms?.is_super_admin && !userPerms?.allowed_modules?.includes("pl")) {
    return <AccessDenied label="P&L & Dòng tiền" />;
  }

  // Fetch company record
  const { data: companies, error: companyError } = await supabase
    .from("companies")
    .select("*")
    .limit(1);

  if (companyError) {
    console.error("Error fetching company:", companyError);
  }

  const company = companies && companies.length > 0 ? companies[0] : null;

  if (!company) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">P&L & Dòng tiền</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý P&L, dòng tiền và phân tích hiệu quả tài chính
          </p>
        </div>
        <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-gray-200 bg-white">
          <p className="text-gray-500 font-medium">Cần cấu hình công ty trước</p>
          <p className="text-sm text-gray-400">
            Vui lòng tạo thông tin công ty để bắt đầu sử dụng module P&L
          </p>
          <a
            href="/settings"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Đến trang Cài đặt
          </a>
        </div>
      </div>
    );
  }

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  const fromDate = sixMonthsAgo.toISOString().split("T")[0];

  // Fetch all independent data in parallel
  const [
    { data: plMonthly },
    { data: campaigns },
    { data: advertisers },
    { data: employees },
    { data: apiConnections },
  ] = await Promise.all([
    supabase
      .from("pl_monthly")
      .select("*")
      .eq("company_id", company.id)
      .gte("period_month", fromDate)
      .order("period_month", { ascending: true }),

    supabase
      .from("crm_campaigns")
      .select("*, advertisers (id, name)")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false }),

    supabase
      .from("advertisers")
      .select("id, name")
      .eq("company_id", company.id)
      .eq("is_active", true)
      .order("name"),

    supabase
      .from("employees")
      .select("id, name, role, base_salary, is_active")
      .eq("company_id", company.id)
      .eq("is_active", true),

    supabase
      .from("api_connections")
      .select("id, name, type, base_url, is_active, last_sync_at")
      .eq("company_id", company.id)
      .eq("is_active", true)
      .order("created_at"),
  ]);

  // These depend on the results above — run them in parallel with each other
  const advertiserIds = (advertisers ?? []).map((a) => a.id);
  const campaignIds = (campaigns ?? []).map((c) => c.id);

  const [{ data: offers }, { data: cpl }] = await Promise.all([
    advertiserIds.length > 0
      ? supabase
          .from("offers")
          .select("id, name, advertiser_id, status")
          .in("advertiser_id", advertiserIds)
          .order("name")
      : Promise.resolve({ data: [] }),

    campaignIds.length > 0
      ? supabase
          .from("campaign_pl")
          .select("id, campaign_id, period_month, revenue, publisher_cost")
          .in("campaign_id", campaignIds)
          .gte("period_month", fromDate)
          .order("period_month", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <PLClient
      company={company}
      plMonthly={plMonthly ?? []}
      campaigns={campaigns ?? []}
      advertisers={advertisers ?? []}
      offers={offers ?? []}
      campaignPL={cpl ?? []}
      employees={employees ?? []}
      apiConnections={apiConnections ?? []}
    />
  );
}
