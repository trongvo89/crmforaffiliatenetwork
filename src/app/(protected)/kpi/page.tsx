import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { KpiClient } from "./kpi-client";

export const dynamic = "force-dynamic";

export default async function KpiPage() {
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
          <h1 className="text-2xl font-bold text-gray-900">KPI & Bonus</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý KPI nhân viên và tính toán bonus hàng tháng
          </p>
        </div>
        <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-gray-200 bg-white">
          <p className="text-gray-500 font-medium">Cần cấu hình công ty trước</p>
          <p className="text-sm text-gray-400">
            Vui lòng tạo thông tin công ty để bắt đầu sử dụng module KPI
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

  // Fetch active employees scoped by company_id
  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .eq("company_id", company.id)
    .eq("is_active", true)
    .order("name");

  // Fetch pl_monthly for the current month
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const currentMonthFirst = `${year}-${month}-01`;

  const { data: plRecords } = await supabase
    .from("pl_monthly")
    .select("*")
    .eq("company_id", company.id)
    .eq("period_month", currentMonthFirst)
    .limit(1);

  const initialPlRecord = plRecords && plRecords.length > 0 ? plRecords[0] : null;

  return (
    <KpiClient
      employees={employees ?? []}
      company={company}
      companyId={company.id}
      initialPlRecord={initialPlRecord}
    />
  );
}
