import { createClient } from "@/lib/supabase/server";
import { ContractsClient } from "./contracts-client";
import type { Contract } from "./contracts-client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch company id
  const { data: companyData } = await supabase
    .from("companies")
    .select("id")
    .limit(1)
    .maybeSingle();

  const companyId: string | null = companyData?.id ?? null;

  // Fetch contracts scoped by company
  let initialContracts: Contract[] = [];

  if (companyId) {
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      initialContracts = data as Contract[];
    }
  }

  return (
    <ContractsClient
      initialContracts={initialContracts}
      companyId={companyId ?? ""}
    />
  );
}
