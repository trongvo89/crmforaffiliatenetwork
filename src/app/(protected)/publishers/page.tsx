import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PublishersClient } from "./publishers-client";
import type { Publisher } from "./components/publisher-form";
import { AccessDenied } from "@/components/access-denied";

export const dynamic = "force-dynamic";

export default async function PublishersPage() {
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

  if (!userPerms?.is_super_admin && !userPerms?.allowed_modules?.includes("publishers")) {
    return <AccessDenied label="Publisher CRM" />;
  }

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
