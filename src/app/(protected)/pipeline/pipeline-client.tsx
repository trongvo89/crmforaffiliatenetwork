"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
  X,
  Pencil,
  Loader2,
  Phone,
  Mail,
  Users,
  CalendarDays,
  Archive,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PipelineActivity {
  id: string;
  pipeline_contact_id: string;
  type: "call" | "email" | "meeting" | "note" | "proposal";
  title: string;
  notes: string | null;
  outcome: string | null;
  activity_date: string;
  created_at: string;
}

interface PipelineContact {
  id: string;
  company_id: string;
  name: string;
  type: "publisher" | "advertiser";
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  stage: "lead" | "contacted" | "negotiating" | "proposal" | "signed" | "rejected";
  owner_id: string | null;
  notes: string | null;
  estimated_value: number | null;
  expected_close_date: string | null;
  is_active: boolean;
  created_at: string;
  employees?: { id: string; name: string; role: string } | null;
  pipeline_activities?: PipelineActivity[];
}

interface Employee {
  id: string;
  name: string;
  role: string;
}

// ─── Stage config ──────────────────────────────────────────────────────────────

const STAGES: {
  id: PipelineContact["stage"];
  label: string;
  color: string;
  headerBg: string;
  badgeClass: string;
}[] = [
  {
    id: "lead",
    label: "Lead mới",
    color: "border-gray-300",
    headerBg: "bg-gray-100 text-gray-700",
    badgeClass: "bg-gray-100 text-gray-700 border-gray-200",
  },
  {
    id: "contacted",
    label: "Đã liên hệ",
    color: "border-blue-300",
    headerBg: "bg-blue-50 text-blue-700",
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
  },
  {
    id: "negotiating",
    label: "Đàm phán",
    color: "border-yellow-300",
    headerBg: "bg-yellow-50 text-yellow-700",
    badgeClass: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  {
    id: "proposal",
    label: "Đề xuất",
    color: "border-purple-300",
    headerBg: "bg-purple-50 text-purple-700",
    badgeClass: "bg-purple-100 text-purple-700 border-purple-200",
  },
  {
    id: "signed",
    label: "Đã ký",
    color: "border-green-300",
    headerBg: "bg-green-50 text-green-700",
    badgeClass: "bg-green-100 text-green-700 border-green-200",
  },
  {
    id: "rejected",
    label: "Từ chối",
    color: "border-red-300",
    headerBg: "bg-red-50 text-red-700",
    badgeClass: "bg-red-100 text-red-700 border-red-200",
  },
];

// ─── Activity type config ──────────────────────────────────────────────────────

const ACTIVITY_TYPES: {
  id: PipelineActivity["type"];
  label: string;
  icon: string;
}[] = [
  { id: "call", label: "Cuộc gọi", icon: "📞" },
  { id: "email", label: "Email", icon: "📧" },
  { id: "meeting", label: "Cuộc họp", icon: "🤝" },
  { id: "note", label: "Ghi chú", icon: "📝" },
  { id: "proposal", label: "Đề xuất", icon: "📄" },
];

const ACTIVITY_ICON: Record<PipelineActivity["type"], string> = {
  call: "📞",
  email: "📧",
  meeting: "🤝",
  note: "📝",
  proposal: "📄",
};

const ACTIVITY_LABEL: Record<PipelineActivity["type"], string> = {
  call: "Cuộc gọi",
  email: "Email",
  meeting: "Cuộc họp",
  note: "Ghi chú",
  proposal: "Đề xuất",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrencyVN(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  return value.toLocaleString("vi-VN");
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getLastActivityDate(activities?: PipelineActivity[]): string | null {
  if (!activities || activities.length === 0) return null;
  const sorted = [...activities].sort(
    (a, b) => new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime()
  );
  return sorted[0].activity_date;
}

function getStageMeta(stageId: PipelineContact["stage"]) {
  return STAGES.find((s) => s.id === stageId) ?? STAGES[0];
}

// ─── Empty form states ─────────────────────────────────────────────────────────

const EMPTY_CONTACT_FORM = {
  name: "",
  type: "publisher" as PipelineContact["type"],
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  owner_id: "",
  stage: "lead" as PipelineContact["stage"],
  notes: "",
  estimated_value: "",
  expected_close_date: "",
};

const EMPTY_ACTIVITY_FORM = {
  type: "call" as PipelineActivity["type"],
  title: "",
  notes: "",
  outcome: "",
  activity_date: new Date().toISOString().slice(0, 16),
};

type ContactFormState = typeof EMPTY_CONTACT_FORM;
type ActivityFormState = typeof EMPTY_ACTIVITY_FORM;

// ─── Contact Card ──────────────────────────────────────────────────────────────

interface ContactCardProps {
  contact: PipelineContact;
  onClick: () => void;
}

function ContactCard({ contact, onClick }: ContactCardProps) {
  const lastActivity = getLastActivityDate(contact.pipeline_activities);
  const stageMeta = getStageMeta(contact.stage);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border-l-4 bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md",
        stageMeta.color
      )}
    >
      {/* Name + type */}
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-900 leading-snug line-clamp-1">{contact.name}</p>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
            contact.type === "publisher"
              ? "bg-blue-100 text-blue-700"
              : "bg-orange-100 text-orange-700"
          )}
        >
          {contact.type === "publisher" ? "Publisher" : "Advertiser"}
        </span>
      </div>

      {/* Owner */}
      {contact.employees && (
        <div className="mb-1 flex items-center gap-1 text-xs text-gray-500">
          <Users className="h-3 w-3 shrink-0" />
          <span className="truncate">{contact.employees.name}</span>
        </div>
      )}

      {/* Last activity */}
      {lastActivity && (
        <div className="mb-1 flex items-center gap-1 text-xs text-gray-400">
          <CalendarDays className="h-3 w-3 shrink-0" />
          <span>Hoạt động: {formatDate(lastActivity)}</span>
        </div>
      )}

      {/* Estimated value */}
      {contact.estimated_value != null && (
        <div className="mt-1.5 text-xs font-medium text-emerald-700">
          {formatCurrencyVN(contact.estimated_value)}
        </div>
      )}
    </button>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface PipelineClientProps {
  initialContacts: PipelineContact[];
  employees: Employee[];
  companyId: string;
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function PipelineClient({
  initialContacts,
  employees,
  companyId,
}: PipelineClientProps) {
  const { toast } = useToast();
  const supabase = createClient();

  // ── State ──────────────────────────────────────────────────────────────────

  const [contacts, setContacts] = React.useState<PipelineContact[]>(initialContacts);
  const [selectedContact, setSelectedContact] = React.useState<PipelineContact | null>(null);
  const [drawerTab, setDrawerTab] = React.useState<"info" | "activity">("info");

  const [showContactForm, setShowContactForm] = React.useState(false);
  const [editingContact, setEditingContact] = React.useState<PipelineContact | null>(null);
  const [contactForm, setContactForm] = React.useState<ContactFormState>(EMPTY_CONTACT_FORM);
  const [savingContact, setSavingContact] = React.useState(false);

  const [showActivityForm, setShowActivityForm] = React.useState(false);
  const [activityForm, setActivityForm] = React.useState<ActivityFormState>(EMPTY_ACTIVITY_FORM);
  const [savingActivity, setSavingActivity] = React.useState(false);

  const [changingStageId, setChangingStageId] = React.useState<string | null>(null);
  const [archivingId, setArchivingId] = React.useState<string | null>(null);

  const [filterType, setFilterType] = React.useState<"all" | "publisher" | "advertiser">("all");
  const [filterOwner, setFilterOwner] = React.useState<"all" | string>("all");

  // ── Sync selected contact when contacts list updates ───────────────────────

  React.useEffect(() => {
    if (selectedContact) {
      const updated = contacts.find((c) => c.id === selectedContact.id);
      if (updated) setSelectedContact(updated);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts]);

  // ── Filtered contacts ──────────────────────────────────────────────────────

  const filteredContacts = React.useMemo(() => {
    return contacts.filter((c) => {
      if (filterType !== "all" && c.type !== filterType) return false;
      if (filterOwner !== "all" && c.owner_id !== filterOwner) return false;
      return true;
    });
  }, [contacts, filterType, filterOwner]);

  // ── Contact Form helpers ───────────────────────────────────────────────────

  function openCreateContact() {
    setEditingContact(null);
    setContactForm(EMPTY_CONTACT_FORM);
    setShowContactForm(true);
  }

  function openEditContact(contact: PipelineContact) {
    setEditingContact(contact);
    setContactForm({
      name: contact.name,
      type: contact.type,
      contact_name: contact.contact_name ?? "",
      contact_email: contact.contact_email ?? "",
      contact_phone: contact.contact_phone ?? "",
      owner_id: contact.owner_id ?? "",
      stage: contact.stage,
      notes: contact.notes ?? "",
      estimated_value: contact.estimated_value != null ? String(contact.estimated_value) : "",
      expected_close_date: contact.expected_close_date ?? "",
    });
    setShowContactForm(true);
  }

  function setContactField<K extends keyof ContactFormState>(
    key: K,
    value: ContactFormState[K]
  ) {
    setContactForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSaveContact() {
    if (!contactForm.name.trim()) {
      toast({ title: "Vui lòng nhập tên contact", variant: "destructive" });
      return;
    }

    setSavingContact(true);
    try {
      const payload = {
        name: contactForm.name.trim(),
        type: contactForm.type,
        contact_name: contactForm.contact_name.trim() || null,
        contact_email: contactForm.contact_email.trim() || null,
        contact_phone: contactForm.contact_phone.trim() || null,
        owner_id: contactForm.owner_id || null,
        stage: contactForm.stage,
        notes: contactForm.notes.trim() || null,
        estimated_value: contactForm.estimated_value
          ? Number(contactForm.estimated_value)
          : null,
        expected_close_date: contactForm.expected_close_date || null,
      };

      if (editingContact) {
        const { data, error } = await supabase
          .from("pipeline_contacts")
          .update(payload)
          .eq("id", editingContact.id)
          .select("*, employees!owner_id(id, name, role), pipeline_activities(id, type, title, activity_date, notes, outcome, pipeline_contact_id, created_at)")
          .single();

        if (error) throw error;

        const updated = data as PipelineContact;
        setContacts((prev) =>
          prev.map((c) => (c.id === editingContact.id ? updated : c))
        );
        if (selectedContact?.id === editingContact.id) {
          setSelectedContact(updated);
        }
        toast({ title: "Đã cập nhật contact" });
      } else {
        const { data, error } = await supabase
          .from("pipeline_contacts")
          .insert({ ...payload, company_id: companyId, is_active: true })
          .select("*, employees!owner_id(id, name, role), pipeline_activities(id, type, title, activity_date, notes, outcome, pipeline_contact_id, created_at)")
          .single();

        if (error) throw error;

        setContacts((prev) => [data as PipelineContact, ...prev]);
        toast({ title: "Đã tạo contact mới" });
      }

      setShowContactForm(false);
      setEditingContact(null);
    } catch (err) {
      console.error(err);
      toast({
        title: "Lưu thất bại",
        description: err instanceof Error ? err.message : "Có lỗi xảy ra.",
        variant: "destructive",
      });
    } finally {
      setSavingContact(false);
    }
  }

  // ── Stage change ───────────────────────────────────────────────────────────

  async function handleChangeStage(
    contactId: string,
    newStage: PipelineContact["stage"]
  ) {
    setChangingStageId(contactId);
    try {
      const { error } = await supabase
        .from("pipeline_contacts")
        .update({ stage: newStage })
        .eq("id", contactId);

      if (error) throw error;

      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, stage: newStage } : c))
      );
      if (selectedContact?.id === contactId) {
        setSelectedContact((prev) => (prev ? { ...prev, stage: newStage } : prev));
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Cập nhật giai đoạn thất bại", variant: "destructive" });
    } finally {
      setChangingStageId(null);
    }
  }

  // ── Archive ────────────────────────────────────────────────────────────────

  async function handleArchive(contact: PipelineContact) {
    if (!window.confirm(`Lưu trữ contact "${contact.name}"?`)) return;

    setArchivingId(contact.id);
    try {
      const { error } = await supabase
        .from("pipeline_contacts")
        .update({ is_active: false })
        .eq("id", contact.id);

      if (error) throw error;

      setContacts((prev) => prev.filter((c) => c.id !== contact.id));
      if (selectedContact?.id === contact.id) {
        setSelectedContact(null);
      }
      toast({ title: "Đã lưu trữ contact" });
    } catch (err) {
      console.error(err);
      toast({ title: "Lưu trữ thất bại", variant: "destructive" });
    } finally {
      setArchivingId(null);
    }
  }

  // ── Activity form helpers ──────────────────────────────────────────────────

  function openActivityForm() {
    setActivityForm({
      ...EMPTY_ACTIVITY_FORM,
      activity_date: new Date().toISOString().slice(0, 16),
    });
    setShowActivityForm(true);
  }

  function setActivityField<K extends keyof ActivityFormState>(
    key: K,
    value: ActivityFormState[K]
  ) {
    setActivityForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSaveActivity() {
    if (!selectedContact) return;
    if (!activityForm.title.trim()) {
      toast({ title: "Vui lòng nhập tiêu đề hoạt động", variant: "destructive" });
      return;
    }

    setSavingActivity(true);
    try {
      const { error } = await supabase.from("pipeline_activities").insert({
        pipeline_contact_id: selectedContact.id,
        type: activityForm.type,
        title: activityForm.title.trim(),
        notes: activityForm.notes.trim() || null,
        outcome: activityForm.outcome.trim() || null,
        activity_date: new Date(activityForm.activity_date).toISOString(),
      });

      if (error) throw error;

      // Refetch activities for this contact
      const { data: updatedActivities, error: fetchError } = await supabase
        .from("pipeline_activities")
        .select("id, type, title, notes, outcome, activity_date, pipeline_contact_id, created_at")
        .eq("pipeline_contact_id", selectedContact.id)
        .order("activity_date", { ascending: false });

      if (fetchError) throw fetchError;

      const activities = (updatedActivities ?? []) as PipelineActivity[];

      setContacts((prev) =>
        prev.map((c) =>
          c.id === selectedContact.id
            ? { ...c, pipeline_activities: activities }
            : c
        )
      );
      setSelectedContact((prev) =>
        prev ? { ...prev, pipeline_activities: activities } : prev
      );

      toast({ title: "Đã ghi hoạt động" });
      setShowActivityForm(false);
    } catch (err) {
      console.error(err);
      toast({
        title: "Ghi hoạt động thất bại",
        description: err instanceof Error ? err.message : "Có lỗi xảy ra.",
        variant: "destructive",
      });
    } finally {
      setSavingActivity(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý quan hệ đối tác và khách hàng tiềm năng
          </p>
        </div>
        <Button onClick={openCreateContact} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Thêm contact
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Loại:</span>
          <Select
            value={filterType}
            onValueChange={(v) => setFilterType(v as "all" | "publisher" | "advertiser")}
          >
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="publisher">Publisher</SelectItem>
              <SelectItem value="advertiser">Advertiser</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Phụ trách:</span>
          <Select
            value={filterOwner}
            onValueChange={(v) => setFilterOwner(v)}
          >
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
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

        <div className="ml-auto text-sm text-gray-400">
          {filteredContacts.length} contact
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex h-full gap-3" style={{ minWidth: "960px" }}>
          {STAGES.map((stage) => {
            const stageContacts = filteredContacts.filter(
              (c) => c.stage === stage.id
            );

            return (
              <div
                key={stage.id}
                className="flex w-56 shrink-0 flex-col rounded-xl border-2 bg-gray-50"
                style={{ borderColor: stage.color.replace("border-", "") }}
              >
                {/* Column header */}
                <div
                  className={cn(
                    "flex items-center justify-between rounded-t-[10px] px-3 py-2.5",
                    stage.headerBg
                  )}
                >
                  <span className="text-sm font-semibold">{stage.label}</span>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/70 text-xs font-bold">
                    {stageContacts.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                  {stageContacts.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                      <Users className="mb-2 h-7 w-7 text-gray-300" />
                      <p className="text-xs text-gray-400">Không có contact</p>
                    </div>
                  ) : (
                    stageContacts.map((contact) => (
                      <ContactCard
                        key={contact.id}
                        contact={contact}
                        onClick={() => {
                          setSelectedContact(contact);
                          setDrawerTab("info");
                        }}
                      />
                    ))
                  )}
                </div>

                {/* Quick add */}
                <div className="p-2 pt-0">
                  <button
                    type="button"
                    onClick={openCreateContact}
                    className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-gray-300 py-1.5 text-xs text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-600"
                  >
                    <Plus className="h-3 w-3" />
                    Thêm
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Detail Drawer ──────────────────────────────────────────────────── */}

      {selectedContact && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setSelectedContact(null)}
          />

          {/* Drawer panel */}
          <div className="fixed inset-y-0 right-0 z-50 flex w-96 flex-col border-l bg-white shadow-2xl">
            {/* Drawer header */}
            <div className="flex items-start justify-between gap-2 border-b px-4 py-3">
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-gray-900 text-base truncate">
                  {selectedContact.name}
                </h2>
                <div className="mt-1">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                      getStageMeta(selectedContact.stage).badgeClass
                    )}
                  >
                    {getStageMeta(selectedContact.stage).label}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 text-xs"
                  onClick={() => {
                    openEditContact(selectedContact);
                  }}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Sửa
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setSelectedContact(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Stage row */}
            <div className="border-b px-4 py-2">
              <p className="mb-1.5 text-xs font-medium text-gray-500">Chuyển giai đoạn:</p>
              <div className="flex flex-wrap gap-1">
                {STAGES.map((stage) => {
                  const isActive = selectedContact.stage === stage.id;
                  const isChanging = changingStageId === selectedContact.id;
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      disabled={isActive || isChanging}
                      onClick={() =>
                        handleChangeStage(selectedContact.id, stage.id)
                      }
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors",
                        isActive
                          ? cn(stage.badgeClass, "cursor-default")
                          : "border-gray-200 bg-white text-gray-500 hover:border-gray-400 hover:text-gray-700",
                        isChanging && !isActive && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {stage.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b">
              {(["info", "activity"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDrawerTab(tab)}
                  className={cn(
                    "flex-1 py-2.5 text-sm font-medium transition-colors",
                    drawerTab === tab
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {tab === "info" ? "Thông tin" : "Hoạt động"}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-4">
              {drawerTab === "info" ? (
                <InfoTab contact={selectedContact} employees={employees} />
              ) : (
                <ActivityTab
                  contact={selectedContact}
                  onAddActivity={openActivityForm}
                />
              )}
            </div>

            {/* Archive footer */}
            <div className="border-t px-4 py-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-red-500 hover:bg-red-50 hover:text-red-600"
                disabled={archivingId === selectedContact.id}
                onClick={() => handleArchive(selectedContact)}
              >
                {archivingId === selectedContact.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Archive className="mr-2 h-4 w-4" />
                )}
                Lưu trữ contact
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ── Contact Form Dialog ─────────────────────────────────────────────── */}

      <Dialog
        open={showContactForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowContactForm(false);
            setEditingContact(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingContact ? "Chỉnh sửa contact" : "Thêm contact mới"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="c-name">
                Tên công ty / đối tác <span className="text-red-500">*</span>
              </Label>
              <Input
                id="c-name"
                placeholder="Nhập tên..."
                value={contactForm.name}
                onChange={(e) => setContactField("name", e.target.value)}
              />
            </div>

            {/* Type + Stage */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Loại</Label>
                <Select
                  value={contactForm.type}
                  onValueChange={(v) =>
                    setContactField("type", v as PipelineContact["type"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="publisher">Publisher</SelectItem>
                    <SelectItem value="advertiser">Advertiser</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Giai đoạn</Label>
                <Select
                  value={contactForm.stage}
                  onValueChange={(v) =>
                    setContactField("stage", v as PipelineContact["stage"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Contact name */}
            <div className="space-y-1.5">
              <Label htmlFor="c-contact-name">Người liên hệ</Label>
              <Input
                id="c-contact-name"
                placeholder="Tên người liên hệ..."
                value={contactForm.contact_name}
                onChange={(e) => setContactField("contact_name", e.target.value)}
              />
            </div>

            {/* Email + Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-email">Email</Label>
                <Input
                  id="c-email"
                  type="email"
                  placeholder="email@..."
                  value={contactForm.contact_email}
                  onChange={(e) =>
                    setContactField("contact_email", e.target.value)
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-phone">Điện thoại</Label>
                <Input
                  id="c-phone"
                  type="tel"
                  placeholder="0900..."
                  value={contactForm.contact_phone}
                  onChange={(e) =>
                    setContactField("contact_phone", e.target.value)
                  }
                />
              </div>
            </div>

            {/* Owner */}
            <div className="space-y-1.5">
              <Label>Phụ trách (BD/PM)</Label>
              <Select
                value={contactForm.owner_id || "__none__"}
                onValueChange={(v) =>
                  setContactField("owner_id", v === "__none__" ? "" : v)
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

            {/* Estimated value + Close date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-value">Giá trị ước tính (VNĐ)</Label>
                <Input
                  id="c-value"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={contactForm.estimated_value}
                  onChange={(e) =>
                    setContactField("estimated_value", e.target.value)
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-close-date">Ngày dự kiến ký</Label>
                <Input
                  id="c-close-date"
                  type="date"
                  value={contactForm.expected_close_date}
                  onChange={(e) =>
                    setContactField("expected_close_date", e.target.value)
                  }
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="c-notes">Ghi chú</Label>
              <Textarea
                id="c-notes"
                placeholder="Ghi chú thêm..."
                rows={3}
                value={contactForm.notes}
                onChange={(e) => setContactField("notes", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowContactForm(false);
                setEditingContact(null);
              }}
              disabled={savingContact}
            >
              Hủy
            </Button>
            <Button onClick={handleSaveContact} disabled={savingContact}>
              {savingContact && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingContact ? "Lưu thay đổi" : "Tạo contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Activity Form Dialog ────────────────────────────────────────────── */}

      <Dialog
        open={showActivityForm}
        onOpenChange={(open) => {
          if (!open) setShowActivityForm(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ghi hoạt động</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Type */}
            <div className="space-y-1.5">
              <Label>Loại hoạt động</Label>
              <Select
                value={activityForm.type}
                onValueChange={(v) =>
                  setActivityField("type", v as PipelineActivity["type"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.icon} {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="a-title">
                Tiêu đề <span className="text-red-500">*</span>
              </Label>
              <Input
                id="a-title"
                placeholder="Nhập tiêu đề hoạt động..."
                value={activityForm.title}
                onChange={(e) => setActivityField("title", e.target.value)}
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label htmlFor="a-date">Thời gian</Label>
              <Input
                id="a-date"
                type="datetime-local"
                value={activityForm.activity_date}
                onChange={(e) =>
                  setActivityField("activity_date", e.target.value)
                }
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="a-notes">Nội dung</Label>
              <Textarea
                id="a-notes"
                placeholder="Nội dung chi tiết..."
                rows={3}
                value={activityForm.notes}
                onChange={(e) => setActivityField("notes", e.target.value)}
              />
            </div>

            {/* Outcome */}
            <div className="space-y-1.5">
              <Label htmlFor="a-outcome">Kết quả</Label>
              <Textarea
                id="a-outcome"
                placeholder="Kết quả / hành động tiếp theo..."
                rows={2}
                value={activityForm.outcome}
                onChange={(e) => setActivityField("outcome", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowActivityForm(false)}
              disabled={savingActivity}
            >
              Hủy
            </Button>
            <Button onClick={handleSaveActivity} disabled={savingActivity}>
              {savingActivity && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Lưu hoạt động
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Info Tab ──────────────────────────────────────────────────────────────────

function InfoTab({
  contact,
  employees,
}: {
  contact: PipelineContact;
  employees: Employee[];
}) {
  const owner = employees.find((e) => e.id === contact.owner_id);

  return (
    <div className="space-y-4">
      {/* Type badge */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
            contact.type === "publisher"
              ? "bg-blue-100 text-blue-700"
              : "bg-orange-100 text-orange-700"
          )}
        >
          {contact.type === "publisher" ? "Publisher" : "Advertiser"}
        </span>
      </div>

      {/* Contact person */}
      {contact.contact_name && (
        <InfoRow label="Người liên hệ" value={contact.contact_name} />
      )}

      {/* Email */}
      {contact.contact_email && (
        <div className="flex items-center gap-2 text-sm">
          <Mail className="h-4 w-4 shrink-0 text-gray-400" />
          <a
            href={`mailto:${contact.contact_email}`}
            className="text-blue-600 hover:underline truncate"
          >
            {contact.contact_email}
          </a>
        </div>
      )}

      {/* Phone */}
      {contact.contact_phone && (
        <div className="flex items-center gap-2 text-sm">
          <Phone className="h-4 w-4 shrink-0 text-gray-400" />
          <a
            href={`tel:${contact.contact_phone}`}
            className="text-blue-600 hover:underline"
          >
            {contact.contact_phone}
          </a>
        </div>
      )}

      {/* Owner */}
      {owner && <InfoRow label="Phụ trách" value={owner.name} />}

      {/* Estimated value */}
      {contact.estimated_value != null && (
        <InfoRow
          label="Giá trị ước tính"
          value={formatCurrencyVN(contact.estimated_value) + " VNĐ"}
        />
      )}

      {/* Expected close date */}
      {contact.expected_close_date && (
        <InfoRow
          label="Ngày dự kiến ký"
          value={formatDate(contact.expected_close_date)}
        />
      )}

      {/* Created at */}
      <InfoRow label="Ngày tạo" value={formatDate(contact.created_at)} />

      {/* Notes */}
      {contact.notes && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500">Ghi chú</p>
          <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">
            {contact.notes}
          </p>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="shrink-0 text-xs font-medium text-gray-500">{label}</span>
      <span className="text-right text-sm text-gray-900">{value}</span>
    </div>
  );
}

// ─── Activity Tab ──────────────────────────────────────────────────────────────

function ActivityTab({
  contact,
  onAddActivity,
}: {
  contact: PipelineContact;
  onAddActivity: () => void;
}) {
  const activities = React.useMemo(() => {
    if (!contact.pipeline_activities) return [];
    return [...contact.pipeline_activities].sort(
      (a, b) =>
        new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime()
    );
  }, [contact.pipeline_activities]);

  return (
    <div className="space-y-4">
      <Button size="sm" onClick={onAddActivity} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Ghi hoạt động
      </Button>

      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <CalendarDays className="mb-2 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-400">Chưa có hoạt động nào</p>
          <p className="text-xs text-gray-300">
            Nhấn nút trên để ghi hoạt động đầu tiên
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((act) => (
            <div
              key={act.id}
              className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm"
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="text-base">{ACTIVITY_ICON[act.type]}</span>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {ACTIVITY_LABEL[act.type]}
                </span>
                <span className="ml-auto text-xs text-gray-400">
                  {formatDateTime(act.activity_date)}
                </span>
              </div>
              <p className="font-medium text-gray-900 text-sm">{act.title}</p>
              {act.notes && (
                <p className="mt-1 text-xs text-gray-600 whitespace-pre-wrap">
                  {act.notes}
                </p>
              )}
              {act.outcome && (
                <div className="mt-2 rounded bg-green-50 px-2 py-1">
                  <p className="text-xs font-medium text-green-700">
                    Kết quả: {act.outcome}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
