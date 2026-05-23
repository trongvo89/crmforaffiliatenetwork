import { createClient } from "@/lib/supabase/server";
import { PLClient } from "./pl-client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PLPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
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

  // Fetch last 6 months of P&L data
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  const fromDate = sixMonthsAgo.toISOString().split("T")[0];

  const { data: plMonthly } = await supabase
    .from("pl_monthly")
    .select("*")
    .eq("company_id", company.id)
    .gte("period_month", fromDate)
    .order("period_month", { ascending: true });

  // Fetch campaigns with advertiser info
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select(`
      *,
      advertisers (id, name)
    `)
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  // Fetch advertisers for form
  const { data: advertisers } = await supabase
    .from("advertisers")
    .select("id, name")
    .eq("company_id", company.id)
    .eq("is_active", true)
    .order("name");

  // Fetch all offers
  const { data: offers } = await supabase
    .from("offers")
    .select("id, name, advertiser_id, status")
    .order("name");

  // Fetch campaign P&L for last 6 months
  const campaignIds = (campaigns ?? []).map((c) => c.id);
  let campaignPL: Array<{
    id: string;
    campaign_id: string;
    period_month: string;
    revenue: number;
    publisher_cost: number;
  }> = [];

  if (campaignIds.length > 0) {
    const { data: cpl } = await supabase
      .from("campaign_pl")
      .select("*")
      .in("campaign_id", campaignIds)
      .gte("period_month", fromDate)
      .order("period_month", { ascending: true });
    campaignPL = cpl ?? [];
  }

  // Fetch employees (active) for bonus calculation
  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, role, base_salary, is_active")
    .eq("company_id", company.id)
    .eq("is_active", true);

  return (
    <PLClient
      company={company}
      plMonthly={plMonthly ?? []}
      campaigns={campaigns ?? []}
      advertisers={advertisers ?? []}
      offers={offers ?? []}
      campaignPL={campaignPL}
      employees={employees ?? []}
    />
  );
}
