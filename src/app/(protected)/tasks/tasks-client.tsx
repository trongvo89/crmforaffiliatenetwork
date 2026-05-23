"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  User,
  Link2,
  ClipboardList,
  Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "high" | "medium" | "low";
  assigned_to: string | null;
  due_date: string | null;
  related_type: "publisher" | "advertiser" | "contract" | "pipeline" | null;
  related_id: string | null;
  related_name: string | null;
  created_at: string;
  updated_at: string;
  employees?: { id: string; name: string; role: string } | null;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
}

// ─── Column config ────────────────────────────────────────────────────────────

const COLUMNS: { id: Task["status"]; label: string; color: string; headerColor: string }[] = [
  { id: "todo", label: "Cần làm", color: "bg-gray-100", headerColor: "bg-gray-200 text-gray-700" },
  { id: "in_progress", label: "Đang làm", color: "bg-blue-50", headerColor: "bg-blue-100 text-blue-700" },
  { id: "review", label: "Đang review", color: "bg-yellow-50", headerColor: "bg-yellow-100 text-yellow-700" },
  { id: "done", label: "Hoàn thành", color: "bg-green-50", headerColor: "bg-green-100 text-green-700" },
];

const COLUMN_IDS = COLUMNS.map((c) => c.id);

// ─── Priority helpers ─────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<
  Task["priority"],
  { label: string; className: string }
> = {
  high: { label: "Cao", className: "bg-red-100 text-red-700 border-red-200" },
  medium: { label: "Trung bình", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  low: { label: "Thấp", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

function PriorityBadge({ priority }: { priority: Task["priority"] }) {
  const { label, className } = PRIORITY_CONFIG[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      {label}
    </span>
  );
}

// ─── Related type helpers ─────────────────────────────────────────────────────

const RELATED_TYPE_LABELS: Record<NonNullable<Task["related_type"]>, string> = {
  publisher: "Publisher",
  advertiser: "Advertiser",
  contract: "Hợp đồng",
  pipeline: "Pipeline",
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function isOverdue(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

// ─── Initials avatar ──────────────────────────────────────────────────────────

function InitialsAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-semibold text-white">
      {initials}
    </span>
  );
}

// ─── Empty form state ─────────────────────────────────────────────────────────

const EMPTY_FORM = {
  title: "",
  description: "",
  priority: "medium" as Task["priority"],
  assigned_to: "",
  due_date: "",
  related_type: "" as Task["related_type"] | "",
  related_name: "",
};

type FormState = typeof EMPTY_FORM;

// ─── Task card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  colIndex: number;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onMove: (task: Task, newStatus: Task["status"]) => void;
  movingId: string | null;
  deletingId: string | null;
}

function TaskCard({
  task,
  colIndex,
  onEdit,
  onDelete,
  onMove,
  movingId,
  deletingId,
}: TaskCardProps) {
  const canMovePrev = colIndex > 0;
  const canMoveNext = colIndex < COLUMNS.length - 1;
  const isMoving = movingId === task.id;
  const isDeleting = deletingId === task.id;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      {/* Title + priority */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="font-medium text-gray-900 leading-snug">{task.title}</p>
        <PriorityBadge priority={task.priority} />
      </div>

      {/* Description preview */}
      {task.description && (
        <p className="mb-2 line-clamp-2 text-xs text-gray-500">{task.description}</p>
      )}

      {/* Assignee */}
      {task.employees && (
        <div className="mb-1.5 flex items-center gap-1.5 text-xs text-gray-600">
          <InitialsAvatar name={task.employees.name} />
          <span>{task.employees.name}</span>
        </div>
      )}

      {/* Due date */}
      {task.due_date && (
        <div
          className={cn(
            "mb-1.5 flex items-center gap-1 text-xs",
            isOverdue(task.due_date) ? "text-red-600 font-medium" : "text-gray-500"
          )}
        >
          <CalendarDays className="h-3 w-3" />
          <span>{formatDate(task.due_date)}</span>
          {isOverdue(task.due_date) && <span className="ml-0.5">(Quá hạn)</span>}
        </div>
      )}

      {/* Related */}
      {task.related_name && task.related_type && (
        <div className="mb-2 flex items-center gap-1 text-xs text-gray-500">
          <Link2 className="h-3 w-3 shrink-0" />
          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-600">
            {RELATED_TYPE_LABELS[task.related_type]}
          </span>
          <span className="truncate">{task.related_name}</span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
        {/* Move buttons */}
        <div className="flex items-center gap-1">
          <button
            disabled={!canMovePrev || isMoving}
            onClick={() => onMove(task, COLUMN_IDS[colIndex - 1])}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded border text-xs transition-colors",
              canMovePrev && !isMoving
                ? "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                : "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300"
            )}
            title="Lùi cột"
          >
            {isMoving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ChevronLeft className="h-3 w-3" />
            )}
          </button>
          <button
            disabled={!canMoveNext || isMoving}
            onClick={() => onMove(task, COLUMN_IDS[colIndex + 1])}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded border text-xs transition-colors",
              canMoveNext && !isMoving
                ? "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                : "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300"
            )}
            title="Tiến cột"
          >
            {isMoving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        </div>

        {/* Edit + Delete */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(task)}
            className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
            title="Sửa"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            disabled={isDeleting}
            onClick={() => onDelete(task)}
            className="flex h-6 w-6 items-center justify-center rounded border border-red-100 bg-white text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
            title="Xóa"
          >
            {isDeleting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TasksClientProps {
  initialTasks: Task[];
  employees: Employee[];
  companyId: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TasksClient({ initialTasks, employees, companyId }: TasksClientProps) {
  const { toast } = useToast();
  const supabase = createClient();

  const [tasks, setTasks] = React.useState<Task[]>(initialTasks);
  const [showForm, setShowForm] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | null>(null);
  const [filterAssignee, setFilterAssignee] = React.useState<"all" | string>("all");
  const [filterPriority, setFilterPriority] = React.useState<"all" | "high" | "medium" | "low">("all");

  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [movingId, setMovingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // ── Filtered tasks ─────────────────────────────────────────────────────────

  const filteredTasks = React.useMemo(() => {
    return tasks.filter((t) => {
      if (filterAssignee !== "all" && t.assigned_to !== filterAssignee) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      return true;
    });
  }, [tasks, filterAssignee, filterPriority]);

  // ── Open form ──────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description ?? "",
      priority: task.priority,
      assigned_to: task.assigned_to ?? "",
      due_date: task.due_date ?? "",
      related_type: task.related_type ?? "",
      related_name: task.related_name ?? "",
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingTask(null);
  }

  // ── Form field helpers ─────────────────────────────────────────────────────

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Build payload ──────────────────────────────────────────────────────────

  function buildPayload() {
    return {
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      assigned_to: form.assigned_to || null,
      due_date: form.due_date || null,
      related_type: (form.related_type as Task["related_type"]) || null,
      related_name: form.related_type && form.related_name.trim() ? form.related_name.trim() : null,
      related_id: null,
    };
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.title.trim()) {
      toast({ title: "Vui lòng nhập tiêu đề task", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();

      if (editingTask) {
        const { data, error } = await supabase
          .from("tasks")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingTask.id)
          .select("*, employees!assigned_to(id, name, role)")
          .single();

        if (error) throw error;

        setTasks((prev) =>
          prev.map((t) => (t.id === editingTask.id ? (data as Task) : t))
        );
        toast({ title: "Đã cập nhật task" });
      } else {
        const { data, error } = await supabase
          .from("tasks")
          .insert({ ...payload, company_id: companyId, status: "todo" })
          .select("*, employees!assigned_to(id, name, role)")
          .single();

        if (error) throw error;

        setTasks((prev) => [data as Task, ...prev]);
        toast({ title: "Đã tạo task mới" });
      }

      closeForm();
    } catch (err) {
      console.error(err);
      toast({
        title: "Lưu thất bại",
        description: err instanceof Error ? err.message : "Có lỗi xảy ra.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete(task: Task) {
    const confirmed = window.confirm(`Bạn có chắc muốn xóa task "${task.title}"?`);
    if (!confirmed) return;

    setDeletingId(task.id);
    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", task.id);

      if (error) throw error;

      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      toast({ title: "Đã xóa task" });
    } catch (err) {
      console.error(err);
      toast({
        title: "Xóa thất bại",
        description: err instanceof Error ? err.message : "Có lỗi xảy ra.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  }

  // ── Move status ────────────────────────────────────────────────────────────

  async function handleMove(task: Task, newStatus: Task["status"]) {
    setMovingId(task.id);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", task.id);

      if (error) throw error;

      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
      );
    } catch (err) {
      console.error(err);
      toast({
        title: "Cập nhật trạng thái thất bại",
        variant: "destructive",
      });
    } finally {
      setMovingId(null);
    }
  }

  // ── Column counts ──────────────────────────────────────────────────────────

  const columnCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const col of COLUMNS) {
      counts[col.id] = filteredTasks.filter((t) => t.status === col.id).length;
    }
    return counts;
  }, [filteredTasks]);

  // ── No company ────────────────────────────────────────────────────────────

  if (!companyId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Task Board</h1>
        <div className="flex min-h-48 items-center justify-center rounded-xl border-2 border-dashed border-amber-200 bg-amber-50">
          <div className="text-center">
            <ClipboardList className="mx-auto mb-2 h-8 w-8 text-amber-400" />
            <p className="font-medium text-amber-800">Chưa cấu hình công ty</p>
            <p className="mt-1 text-sm text-amber-600">
              Vui lòng thiết lập thông tin công ty trong mục Cài đặt.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Task Board</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý công việc theo trạng thái
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Tạo task
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Phụ trách:</span>
          <Select
            value={filterAssignee}
            onValueChange={(v) => setFilterAssignee(v as "all" | string)}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Tất cả" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Độ ưu tiên:</span>
          <Select
            value={filterPriority}
            onValueChange={(v) =>
              setFilterPriority(v as "all" | "high" | "medium" | "low")
            }
          >
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Tất cả" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="high">Cao</SelectItem>
              <SelectItem value="medium">Trung bình</SelectItem>
              <SelectItem value="low">Thấp</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto text-sm text-gray-400">
          {filteredTasks.length} task{filteredTasks.length !== 1 ? "" : ""}
        </div>
      </div>

      {/* Kanban board */}
      <div className="grid flex-1 grid-cols-4 gap-3 pb-4">
        {COLUMNS.map((col, colIndex) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.id);

          return (
            <div
              key={col.id}
              className={cn("flex flex-col rounded-xl", col.color)}
            >
              {/* Column header */}
              <div
                className={cn(
                  "flex items-center justify-between rounded-t-xl px-3 py-2.5",
                  col.headerColor
                )}
              >
                <span className="text-sm font-semibold">{col.label}</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/70 text-xs font-bold">
                  {columnCounts[col.id]}
                </span>
              </div>

              {/* Task list */}
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                {colTasks.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                    <ClipboardList className="mb-2 h-7 w-7 text-gray-300" />
                    <p className="text-xs text-gray-400">Không có task</p>
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      colIndex={colIndex}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onMove={handleMove}
                      movingId={movingId}
                      deletingId={deletingId}
                    />
                  ))
                )}
              </div>

              {/* Quick add button at bottom of column */}
              <div className="p-2 pt-0">
                <button
                  onClick={openCreate}
                  className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-gray-300 py-1.5 text-xs text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-600"
                >
                  <Plus className="h-3 w-3" />
                  Thêm task
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTask ? "Chỉnh sửa task" : "Tạo task mới"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="task-title">
                Tiêu đề <span className="text-red-500">*</span>
              </Label>
              <Input
                id="task-title"
                placeholder="Nhập tiêu đề task..."
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="task-description">Mô tả</Label>
              <Textarea
                id="task-description"
                placeholder="Mô tả chi tiết công việc..."
                rows={3}
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
              />
            </div>

            {/* Priority + Assigned (2 columns) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Độ ưu tiên</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setField("priority", v as Task["priority"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">Cao</SelectItem>
                    <SelectItem value="medium">Trung bình</SelectItem>
                    <SelectItem value="low">Thấp</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Phụ trách</Label>
                <Select
                  value={form.assigned_to || "__none__"}
                  onValueChange={(v) =>
                    setField("assigned_to", v === "__none__" ? "" : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chưa giao" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Chưa giao</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Due date */}
            <div className="space-y-1.5">
              <Label htmlFor="task-due">Ngày hết hạn</Label>
              <Input
                id="task-due"
                type="date"
                value={form.due_date}
                onChange={(e) => setField("due_date", e.target.value)}
              />
            </div>

            {/* Related type */}
            <div className="space-y-1.5">
              <Label>Liên kết tới</Label>
              <Select
                value={form.related_type || "__none__"}
                onValueChange={(v) =>
                  setField("related_type", v === "__none__" ? "" : (v as Task["related_type"]))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Không liên kết" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Không liên kết</SelectItem>
                  <SelectItem value="publisher">Publisher</SelectItem>
                  <SelectItem value="advertiser">Advertiser</SelectItem>
                  <SelectItem value="contract">Hợp đồng</SelectItem>
                  <SelectItem value="pipeline">Pipeline</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Related name — only shown when related_type is set */}
            {form.related_type && (
              <div className="space-y-1.5">
                <Label htmlFor="task-related-name">
                  Tên{" "}
                  {form.related_type
                    ? RELATED_TYPE_LABELS[form.related_type as NonNullable<Task["related_type"]>]
                    : ""}
                </Label>
                <Input
                  id="task-related-name"
                  placeholder={`Nhập tên ${
                    form.related_type
                      ? RELATED_TYPE_LABELS[form.related_type as NonNullable<Task["related_type"]>]
                      : ""
                  }...`}
                  value={form.related_name}
                  onChange={(e) => setField("related_name", e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeForm} disabled={saving}>
              Hủy
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingTask ? "Lưu thay đổi" : "Tạo task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
