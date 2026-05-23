import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FraudClient } from "./fraud-client";

export const dynamic = "force-dynamic";

export default async function FraudPage() {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch company
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (!company) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Phát hiện Gian lận</h1>
        <div className="flex min-h-48 items-center justify-center rounded-xl border-2 border-dashed border-amber-200 bg-amber-50">
          <p className="font-medium text-amber-800">Chưa cấu hình công ty</p>
        </div>
      </div>
    );
  }

  // Fetch fraud flags with publisher info
  const { data: flagsData } = await supabase
    .from("fraud_flags")
    .select("*, publishers(id, name, tier)")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  // Fetch active publishers
  const { data: publishersData } = await supabase
    .from("publishers")
    .select("id, name, tier")
    .eq("company_id", company.id)
    .eq("is_active", true)
    .order("name");

  // Fetch last 7 days of daily_metrics
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  const { data: metricsData } = await supabase
    .from("daily_metrics")
    .select("*, publishers(id, name, tier)")
    .eq("company_id", company.id)
    .gte("date", sevenDaysAgoStr);

  return (
    <FraudClient
      initialFlags={flagsData ?? []}
      publishers={publishersData ?? []}
      recentMetrics={metricsData ?? []}
      companyId={company.id}
      company={company}
    />
  );
}
