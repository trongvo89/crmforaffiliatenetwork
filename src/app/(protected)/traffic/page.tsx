import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TrafficClient } from "./traffic-client";

export const dynamic = "force-dynamic";

export default async function TrafficPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (!company) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Traffic Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Theo dõi và phân tích traffic từ publisher
          </p>
        </div>
        <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-gray-200 bg-white">
          <p className="font-medium text-gray-500">Cần cấu hình công ty trước</p>
          <p className="text-sm text-gray-400">
            Vui lòng tạo thông tin công ty để bắt đầu sử dụng Traffic Monitor
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

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const { data: metrics } = await supabase
    .from("daily_metrics")
    .select("*, publishers(id, name, tier)")
    .eq("company_id", company.id)
    .gte("date", thirtyDaysAgo)
    .order("date", { ascending: false });

  const { data: publishers } = await supabase
    .from("publishers")
    .select("id, name, tier")
    .eq("company_id", company.id)
    .eq("is_active", true)
    .order("name");

  const { data: connections } = await supabase
    .from("api_connections")
    .select("*")
    .eq("company_id", company.id);

  return (
    <TrafficClient
      initialMetrics={metrics ?? []}
      publishers={publishers ?? []}
      apiConnections={connections ?? []}
      companyId={company.id}
      company={company}
    />
  );
}
