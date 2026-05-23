import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalysisResult {
  summary: string;
  key_terms: string[];
  risks: string[];
  recommendations: string[];
  analyzed_at: string;
}

// ─── POST /api/analyze-contract ───────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { contractId, companyId } = body as {
      contractId?: string;
      companyId?: string;
    };

    if (!contractId || !companyId) {
      return NextResponse.json(
        { error: "contractId và companyId là bắt buộc." },
        { status: 400 }
      );
    }

    // ── Auth guard ────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Fetch contract from Supabase ──────────────────────────────────────────

    const { data: contract, error: fetchError } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", contractId)
      .eq("company_id", companyId)
      .single();

    if (fetchError || !contract) {
      return NextResponse.json(
        { error: "Không tìm thấy hợp đồng." },
        { status: 404 }
      );
    }

    if (!contract.file_url) {
      return NextResponse.json(
        { error: "Hợp đồng này không có tệp đính kèm để phân tích." },
        { status: 400 }
      );
    }

    // ── Download file from Supabase Storage ───────────────────────────────────
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("contracts")
      .download(contract.file_url);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: "Không thể tải tệp hợp đồng từ kho lưu trữ." },
        { status: 500 }
      );
    }

    // Convert Blob → ArrayBuffer → base64
    const fileArrayBuffer = await fileData.arrayBuffer();
    const pdfBase64 = Buffer.from(fileArrayBuffer).toString("base64");

    // ── Call Claude API ───────────────────────────────────────────────────────
    const client = new Anthropic(); // uses ANTHROPIC_API_KEY env var

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system:
        "Bạn là chuyên gia phân tích hợp đồng. Trả lời bằng tiếng Việt dưới dạng JSON thuần túy (không có markdown).",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            },
            {
              type: "text",
              text: `Phân tích hợp đồng này và trả về JSON với các trường:
{
  "summary": "Tóm tắt 1-2 câu về hợp đồng",
  "key_terms": ["điều khoản quan trọng 1", "..."],
  "risks": ["rủi ro tiềm ẩn 1", "..."],
  "recommendations": ["khuyến nghị 1", "..."]
}`,
            },
          ],
        },
      ],
    });

    // ── Parse Claude response ──────────────────────────────────────────────────
    const rawText =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    let parsed: Omit<AnalysisResult, "analyzed_at">;

    try {
      // Extract first JSON object regardless of markdown fences or preamble text
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON object found in AI response");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json(
        {
          error: "Không thể phân tích phản hồi từ AI.",
          raw: rawText,
        },
        { status: 500 }
      );
    }

    const analysis: AnalysisResult = {
      summary: parsed.summary ?? "",
      key_terms: Array.isArray(parsed.key_terms) ? parsed.key_terms : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations
        : [],
      analyzed_at: new Date().toISOString(),
    };

    // ── Save ai_analysis to contracts table ───────────────────────────────────
    const { data: updated, error: updateError } = await supabase
      .from("contracts")
      .update({ ai_analysis: analysis })
      .eq("id", contractId)
      .eq("company_id", companyId)
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: "Phân tích xong nhưng không thể lưu kết quả." },
        { status: 500 }
      );
    }

    return NextResponse.json({ contract: updated });
  } catch (err) {
    console.error("[analyze-contract]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Lỗi máy chủ không xác định.",
      },
      { status: 500 }
    );
  }
}
