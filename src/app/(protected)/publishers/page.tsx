import { createClient } from "@/lib/supabase/server";
import { PublishersClient } from "./publishers-client";
import type { Publisher } from "./components/publisher-form";

export const dynamic = "force-dynamic";

export default async function PublishersPage() {
  const supabase = await createClient();

  // Fetch company (first record)
  const { data: companyData } = await supabase
    .from("companies")
    .select("id")
    .limit(1)
    .maybeSingle();

  const companyId: string | null = companyData?.id ?? null;

  // Fetch publishers for this company
  let initialPublishers: Publisher[] = [];

  if (companyId) {
    const { data, error } = await supabase
      .from("publishers")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      initialPublishers = data as Publisher[];
    }
  }

  return (
    <PublishersClient
      initialPublishers={initialPublishers}
      companyId={companyId}
    />
  );
}
