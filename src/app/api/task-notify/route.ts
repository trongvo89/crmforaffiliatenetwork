import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface NotifyPayload {
  taskId: string;
  taskTitle: string;
  priority: "high" | "medium" | "low";
  dueDate?: string | null;
  assignedToId?: string | null;
  supervisorId?: string | null;
  action: "created" | "updated";
}

const PRIORITY_LABEL: Record<string, string> = {
  high: "🔴 Cao",
  medium: "🟡 Trung bình",
  low: "🟢 Thấp",
};

async function sendTelegram(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch(() => {});
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json() as NotifyPayload;
    const { taskTitle, priority, dueDate, assignedToId, supervisorId, action } = body;

    if (!taskTitle) return NextResponse.json({ error: "Thiếu thông tin task." }, { status: 400 });

    const employeeIds = [assignedToId, supervisorId].filter(Boolean) as string[];
    if (employeeIds.length === 0) return NextResponse.json({ sent: 0 });

    const { data: employees } = await supabase
      .from("employees")
      .select("id, name, telegram_chat_id")
      .in("id", employeeIds);

    const empMap = new Map((employees ?? []).map((e) => [e.id, e]));
    const assignee = assignedToId ? empMap.get(assignedToId) : null;
    const supervisor = supervisorId ? empMap.get(supervisorId) : null;

    const actionLabel = action === "created" ? "mới được tạo" : "vừa được cập nhật";
    const dueLine = dueDate
      ? `📅 <b>Hạn:</b> ${new Date(dueDate).toLocaleDateString("vi-VN")}`
      : "";

    let sent = 0;

    // Notify assignee
    if (assignee?.telegram_chat_id) {
      const msg = [
        `🔔 <b>Task ${actionLabel} và được giao cho bạn!</b>`,
        ``,
        `📋 <b>Tiêu đề:</b> ${taskTitle}`,
        `📌 <b>Độ ưu tiên:</b> ${PRIORITY_LABEL[priority] ?? priority}`,
        supervisor ? `👁 <b>Giám sát:</b> ${supervisor.name}` : "",
        dueLine,
      ].filter(Boolean).join("\n");
      await sendTelegram(assignee.telegram_chat_id, msg);
      sent++;
    }

    // Notify supervisor (different message)
    if (supervisor?.telegram_chat_id && supervisor.id !== assignee?.id) {
      const msg = [
        `📢 <b>Task ${actionLabel} cần bạn giám sát!</b>`,
        ``,
        `📋 <b>Tiêu đề:</b> ${taskTitle}`,
        `📌 <b>Độ ưu tiên:</b> ${PRIORITY_LABEL[priority] ?? priority}`,
        assignee ? `👤 <b>Phụ trách:</b> ${assignee.name}` : "",
        dueLine,
      ].filter(Boolean).join("\n");
      await sendTelegram(supervisor.telegram_chat_id, msg);
      sent++;
    }

    return NextResponse.json({ sent });
  } catch (err) {
    console.error("[task-notify]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lỗi máy chủ." },
      { status: 500 }
    );
  }
}
