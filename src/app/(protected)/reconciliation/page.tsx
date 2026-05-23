import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReconciliationClient } from "./reconciliation-client";
import type { ReconSession } from "./components/session-form";

export const dynamic = "force-dynamic";

export default async function ReconciliationPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch company
  const { data: companyRow } = await supabase
    .from("companies")
    .select("id")
    .limit(1)
    .maybeSingle();

  const companyId: string = companyRow?.id ?? "";

  if (!companyId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Đối soát</h1>
        <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
          <p className="text-muted-foreground">Cần cấu hình công ty trước tại trang Cài đặt.</p>
        </div>
      </div>
    );
  }

  // Fetch all recon sessions for this company (with advertiser name)
  const { data: sessionsData } = await supabase
    .from("recon_sessions")
    .select(`*, advertisers(id, name)`)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  // Fetch active advertisers for session creation form
  const { data: advertisersData } = await supabase
    .from("advertisers")
    .select("id, name")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("name");

  return (
    <ReconciliationClient
      initialSessions={(sessionsData ?? []) as ReconSession[]}
      advertisers={advertisersData ?? []}
      companyId={companyId}
    />
  );
}
