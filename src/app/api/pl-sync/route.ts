import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface FieldMapping {
  endpoint?: string;
  auth_in?: "query" | "header";
  auth_param_name?: string;
  date_start_param?: string;
  date_end_param?: string;
  extra_params?: string;
  revenue_path?: string;
  cost_path?: string;
}

interface SyncConnection {
  base_url: string;
  api_key: string;
  type: "hasoffers" | "cake" | "custom";
  field_mapping: FieldMapping;
}

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function toNumber(val: unknown): number {
  const n = Number(val);
  return isFinite(n) ? n : 0;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json() as {
      connection: SyncConnection;
      period_month: string;
    };

    const { connection, period_month } = body;

    if (!connection?.base_url || !connection?.api_key || !period_month) {
      return NextResponse.json(
        { error: "Thiếu thông tin kết nối hoặc tháng." },
        { status: 400 }
      );
    }

    const mapping = connection.field_mapping ?? {};

    // Build date range for the month
    const [year, month] = period_month.split("-");
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;

    // Build URL
    const baseUrl = connection.base_url.replace(/\/$/, "");
    const endpoint = mapping.endpoint ?? "/api/Affiliate/getStats";
    const authIn = mapping.auth_in ?? "query";
    const authParamName = mapping.auth_param_name ?? "api_key";
    const dateStartParam = mapping.date_start_param ?? "data_start";
    const dateEndParam = mapping.date_end_param ?? "data_end";
    const extraParams = mapping.extra_params ?? "";

    const params = new URLSearchParams();
    if (authIn === "query") {
      params.set(authParamName, connection.api_key);
    }
    params.set(dateStartParam, startDate);
    params.set(dateEndParam, endDate);

    let urlString = `${baseUrl}${endpoint}?${params.toString()}`;
    if (extraParams) {
      urlString += `&${extraParams}`;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };
    if (authIn === "header") {
      headers["Authorization"] = `Bearer ${connection.api_key}`;
    }

    const externalRes = await fetch(urlString, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(15000),
    });

    if (!externalRes.ok) {
      const text = await externalRes.text().catch(() => "");
      return NextResponse.json(
        {
          error: `API trả về lỗi ${externalRes.status}: ${text.slice(0, 200)}`,
        },
        { status: 502 }
      );
    }

    const raw: unknown = await externalRes.json();

    const revenuePath = mapping.revenue_path ?? "data.totals.revenue";
    const costPath = mapping.cost_path ?? "data.totals.publisher_revenue";

    const revenue = toNumber(getNestedValue(raw, revenuePath));
    const publisher_cost = toNumber(getNestedValue(raw, costPath));

    return NextResponse.json({
      revenue,
      publisher_cost,
      raw,
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[pl-sync]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Lỗi máy chủ không xác định.",
      },
      { status: 500 }
    );
  }
}
