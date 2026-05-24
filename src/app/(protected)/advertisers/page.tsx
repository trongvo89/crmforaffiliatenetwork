import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdvertisersClient } from "./advertisers-client";
import type { Advertiser } from "./components/advertiser-form";
import type { Offer } from "./components/offer-form";
import { AccessDenied } from "@/components/access-denied";

export const dynamic = "force-dynamic";

export default async function AdvertisersPage() {
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

  if (!userPerms?.is_super_admin && !userPerms?.allowed_modules?.includes("advertisers")) {
    return <AccessDenied label="Advertiser & Offer" />;
  }

  // ── 1. Fetch company_id (first company record) ────────────────────────────
  const { data: companyRow } = await supabase
    .from("companies")
    .select("id")
    .limit(1)
    .maybeSingle();

  const companyId: string = companyRow?.id ?? "";

  // ── 2. Fetch advertisers ──────────────────────────────────────────────────
  const { data: advertisersData, error: advError } = await supabase
    .from("advertisers")
    .select("*")
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  if (advError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Advertiser &amp; Offer</h1>
        </div>
        <div className="flex items-center justify-center rounded-xl border border-red-200 bg-red-50 p-8">
          <p className="text-sm text-red-700">
            Lỗi tải dữ liệu advertiser: {advError.message}
          </p>
        </div>
      </div>
    );
  }

  const advertisers: Advertiser[] = (advertisersData ?? []) as Advertiser[];
  const advertiserIds = advertisers.map((a) => a.id);

  // ── 3. Fetch all offers for those advertisers ─────────────────────────────
  let offers: Offer[] = [];
  if (advertiserIds.length > 0) {
    const { data: offersData, error: offError } = await supabase
      .from("offers")
      .select("*")
      .in("advertiser_id", advertiserIds)
      .order("created_at", { ascending: false });

    if (!offError) {
      offers = (offersData ?? []) as Offer[];
    }
  }

  // ── 4. Render ─────────────────────────────────────────────────────────────
  return (
    <AdvertisersClient
      initialAdvertisers={advertisers}
      initialOffers={offers}
      companyId={companyId}
    />
  );
}
