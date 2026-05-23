"use client";

import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  AlertTriangle,
  FileText,
  BarChart3,
  Target,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DashboardClientProps {
  user: User | null;
}

// Placeholder data
const plData = [
  { month: "Th12", revenue: 850, cost: 520, profit: 330 },
  { month: "Th1", revenue: 920, cost: 580, profit: 340 },
  { month: "Th2", revenue: 780, cost: 490, profit: 290 },
  { month: "Th3", revenue: 1050, cost: 640, profit: 410 },
  { month: "Th4", revenue: 980, cost: 610, profit: 370 },
  { month: "Th5", revenue: 1180, cost: 710, profit: 470 },
];

const kpiEmployees = [
  { name: "Nguyễn Văn A", role: "PM", score: 95, status: "good" },
  { name: "Trần Thị B", role: "BD", score: 82, status: "watch" },
  { name: "Lê Văn C", role: "AM", score: 67, status: "risk" },
  { name: "Phạm Thị D", role: "AM", score: 91, status: "good" },
];

const campaignData = [
  { name: "Campaign Alpha", margin: 42, revenue: "320M", status: "normal" },
  { name: "Campaign Beta", margin: 18, revenue: "180M", status: "warning" },
  { name: "Campaign Gamma", margin: 55, revenue: "420M", status: "normal" },
  { name: "Campaign Delta", margin: 8, revenue: "90M", status: "danger" },
];

const alerts = [
  { type: "traffic", message: "Revenue giảm 25% so avg 7 ngày - Campaign Beta", severity: "warning" },
  { type: "contract", message: "Hợp đồng ADV Shopee hết hạn trong 12 ngày", severity: "warning" },
  { type: "fraud", message: "CR tăng 60% - Publisher #P042 cần kiểm tra", severity: "danger" },
];

function KPIStatusBadge({ status, score }: { status: string; score: number }) {
  if (status === "good")
    return <Badge variant="success">{score}% - Tốt</Badge>;
  if (status === "watch")
    return <Badge variant="warning">{score}% - Cần theo dõi</Badge>;
  return <Badge variant="danger">{score}% - Nguy cơ</Badge>;
}

function StatCard({
  title,
  value,
  change,
  icon: Icon,
  positive,
}: {
  title: string;
  value: string;
  change: string;
  icon: React.ElementType;
  positive: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            <p className={`mt-1 flex items-center gap-1 text-sm ${positive ? "text-green-600" : "text-red-600"}`}>
              {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {change} so tháng trước
            </p>
          </div>
          <div className="rounded-full bg-blue-50 p-3">
            <Icon className="h-6 w-6 text-blue-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardClient({ user }: DashboardClientProps) {
  const greeting = user?.email ? `Xin chào, ${user.email}` : "Xin chào";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{greeting} · Tháng 5/2026</p>
      </div>

      {/* Row 1 — Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Doanh thu tháng"
          value="1.18 tỷ"
          change="↑ 20.4%"
          icon={DollarSign}
          positive={true}
        />
        <StatCard
          title="Chi phí Publisher"
          value="710M"
          change="↑ 16.4%"
          icon={Users}
          positive={false}
        />
        <StatCard
          title="Gross Profit"
          value="470M"
          change="↑ 27.0%"
          icon={TrendingUp}
          positive={true}
        />
        <StatCard
          title="Lợi nhuận ròng"
          value="285M"
          change="↑ 18.2%"
          icon={BarChart3}
          positive={true}
        />
        <StatCard
          title="KPI Team tổng thể"
          value="83.8%"
          change="↑ 3.2%"
          icon={Target}
          positive={true}
        />
      </div>

      {/* Row 2 — Alerts */}
      {alerts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-amber-800">
              <AlertTriangle className="h-5 w-5" />
              Cảnh báo hôm nay ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-md p-3 text-sm ${
                  alert.severity === "danger"
                    ? "bg-red-100 text-red-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{alert.message}</span>
                <Badge
                  variant={alert.severity === "danger" ? "danger" : "warning"}
                  className="ml-auto"
                >
                  {alert.severity === "danger" ? "Nguy hiểm" : "Cảnh báo"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Row 3 — Charts + KPI */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left — P&L chart + campaign table */}
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">P&L 6 tháng gần nhất</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={plData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}M`} />
                  <Tooltip formatter={(v) => `${v}M`} />
                  <Bar dataKey="revenue" name="Doanh thu" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cost" name="Chi phí pub" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="Lợi nhuận" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaign Margin</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Campaign</th>
                    <th className="pb-2 font-medium">Revenue</th>
                    <th className="pb-2 font-medium">Margin</th>
                    <th className="pb-2 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {campaignData.map((c) => (
                    <tr key={c.name} className="py-2">
                      <td className="py-2 font-medium">{c.name}</td>
                      <td className="py-2">{c.revenue}</td>
                      <td className="py-2">
                        <span
                          className={
                            c.margin < 15
                              ? "text-red-600 font-semibold"
                              : c.margin < 30
                              ? "text-amber-600 font-semibold"
                              : "text-green-600 font-semibold"
                          }
                        >
                          {c.margin}%
                        </span>
                      </td>
                      <td className="py-2">
                        {c.status === "danger" && <Badge variant="danger">Thấp</Badge>}
                        {c.status === "warning" && <Badge variant="warning">Cần xem</Badge>}
                        {c.status === "normal" && <Badge variant="success">Tốt</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Right — KPI team */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">KPI Team tháng này</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {kpiEmployees.map((emp) => (
                <div key={emp.name} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">{emp.role}</p>
                    </div>
                    <KPIStatusBadge status={emp.status} score={emp.score} />
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-gray-100">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        emp.status === "good"
                          ? "bg-green-500"
                          : emp.status === "watch"
                          ? "bg-amber-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${Math.min(emp.score, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Row 4 — Reconciliation pending */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" />
            Đối soát đang chờ xử lý
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Không có phiên đối soát nào đang chờ xử lý.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
