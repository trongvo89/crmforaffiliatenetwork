import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TasksClient } from "./tasks-client";
import type { Task, Employee } from "./tasks-client";
import { AccessDenied } from "@/components/access-denied";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
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

  if (!userPerms?.is_super_admin && !userPerms?.allowed_modules?.includes("tasks")) {
    return <AccessDenied label="Công việc" />;
  }

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .limit(1)
    .maybeSingle();

  const companyId: string = company?.id ?? "";

  let initialTasks: Task[] = [];
  let employees: Employee[] = [];

  if (companyId) {
    const { data: tasksData } = await supabase
      .from("tasks")
      .select("*, employees!assigned_to(id, name, role), supervisor:employees!supervisor_id(id, name, role)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (tasksData) {
      initialTasks = tasksData as Task[];
    }

    const { data: employeesData } = await supabase
      .from("employees")
      .select("id, name, role")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("name");

    if (employeesData) {
      employees = employeesData as Employee[];
    }
  }

  return (
    <TasksClient
      initialTasks={initialTasks}
      employees={employees}
      companyId={companyId}
    />
  );
}
