import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ModuleSlug } from "@/lib/permissions";

export async function POST(request: NextRequest) {
  // Verify current user is super admin
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
    return NextResponse.json({ error: "Không có quyền thực hiện thao tác này" }, { status: 403 });
  }

  const body = (await request.json()) as {
    email: string;
    display_name?: string;
    is_super_admin?: boolean;
    allowed_modules?: ModuleSlug[];
  };

  const { email, display_name, is_super_admin = false, allowed_modules = [] } = body;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email không hợp lệ" }, { status: 400 });
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY chưa được cấu hình. Vui lòng thêm vào Vercel environment variables." },
      { status: 500 }
    );
  }

  // Check if user already exists in user_permissions
  const { data: existingPerm } = await supabase
    .from("user_permissions")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();

  if (existingPerm) {
    return NextResponse.json(
      { error: `Email ${email} đã tồn tại trong hệ thống` },
      { status: 409 }
    );
  }

  // Invite via Supabase Admin — sends invitation email to the user
  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: display_name ?? "" },
      redirectTo: `${request.headers.get("origin")}/auth/callback?next=/dashboard`,
    });

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 });
  }

  // Pre-create user_permissions with the invited user's auth ID
  const { error: permError } = await adminClient.from("user_permissions").upsert(
    {
      user_id: inviteData.user.id,
      email: email,
      display_name: display_name ?? null,
      is_super_admin,
      allowed_modules,
    },
    { onConflict: "user_id" }
  );

  if (permError) {
    return NextResponse.json({ error: permError.message }, { status: 500 });
  }

  // Return the created permissions record so client can update state
  const { data: newPerm } = await adminClient
    .from("user_permissions")
    .select("*")
    .eq("user_id", inviteData.user.id)
    .single();

  return NextResponse.json({ success: true, perm: newPerm });
}
