import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { data: myPerms } = await supabase
    .from("user_permissions")
    .select("is_super_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!myPerms?.is_super_admin) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const { userId, permId } = (await request.json()) as {
    userId: string;
    permId: string;
  };

  if (!userId || !permId) {
    return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 });
  }

  if (userId === user.id) {
    return NextResponse.json({ error: "Không thể xóa tài khoản của chính mình" }, { status: 400 });
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY chưa được cấu hình" },
      { status: 500 }
    );
  }

  // Delete user_permissions record first (FK constraint)
  const { error: permError } = await adminClient
    .from("user_permissions")
    .delete()
    .eq("id", permId);

  if (permError) {
    return NextResponse.json({ error: permError.message }, { status: 500 });
  }

  // Delete auth user
  const { error: authError } = await adminClient.auth.admin.deleteUser(userId);
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
