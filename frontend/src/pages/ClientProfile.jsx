import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, CreditCard, UserX, Pencil, ChevronDown, ChevronUp,
  FileText, RefreshCw, Phone, Mail, MapPin,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Field, TextArea, DateInput } from "@/components/FormControls";
import { api, formatApiErrorDetail } from "@/lib/api";
import { money, fmtDate, CLIENT_STATUS_STYLES, SERVICE_STATUS_STYLES, INVOICE_STATUS_STYLES } from "@/lib/format";
import { useSettings } from "@/context/SettingsContext";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/StatCard";
import ServiceDialog from "@/components/forms/ServiceDialog";
import InvoiceDialog from "@/components/forms/InvoiceDialog";
import PaymentDialog from "@/components/forms/PaymentDialog";
import InvoiceViewDialog from "@/components/InvoiceViewDialog";
import { downloadInvoicePdf } from "@/lib/pdf";
import { toast } from "sonner";

function ServiceCard({ service, currency, onEdit, onCreateInvoice, onGenerateNext, onViewInvoice }) {
  const [open, setOpen] = useState(false);
  const invoices = service.invoices || [];
  const isMonthly = service.billing_type === "MONTHLY";
  const current = invoices.length ? invoices[invoices.length - 1] : null;

  return (
    <div className="rounded-lg border border-[#27272A] bg-black" data-testid={`service-card-${service.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-white">{service.service_name}</span>
            <StatusBadge label={service.status} styleMap={SERVICE_STATUS_STYLES} />
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-zinc-500">
            <span>{service.service_type}</span>
            <span>·</span>
            <span>{service.billing_type}</span>
            <span>·</span>
            <span>Started {fmtDate(service.start_date)}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-gold">{money(service.price, currency)}{isMonthly ? "/mo" : ""}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 px-4 pb-4">
        <button data-testid={`service-edit-${service.id}`} onClick={() => onEdit(service)}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#27272A] px-3 py-1.5 text-xs text-zinc-300 hover:bg-[#18181B] transition-colors">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
        <button data-testid={`service-create-invoice-${service.id}`} onClick={() => onCreateInvoice(service)}
          className="inline-flex items-center gap-1.5 rounded-md border border-gold/30 text-gold px-3 py-1.5 text-xs hover:bg-gold/10 transition-colors">
          <FileText className="h-3.5 w-3.5" /> Create Invoice
        </button>
        {isMonthly && (
          <button data-testid={`service-generate-next-${service.id}`} onClick={() => onGenerateNext(service)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#27272A] px-3 py-1.5 text-xs text-zinc-300 hover:bg-[#18181B] transition-colors">
            <RefreshCw className="h-3.5 w-3.5" /> Generate Next Month Invoice
          </button>
        )}
        {invoices.length > 0 && (
          <button data-testid={`service-toggle-history-${service.id}`} onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors">
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {isMonthly ? "Billing History" : "Invoices"} ({invoices.length})
          </button>
        )}
      </div>

      {isMonthly && current && (
        <div className="mx-4 mb-3 rounded-md border border-gold/20 bg-gold/5 px-3 py-2">
          <div className="text-[10px] uppercase text-zinc-500">Current Bill · {current.billing_month_label}</div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-sm text-white">{current.invoice_number} — {money(current.balance, currency)} due</span>
            <StatusBadge label={current.status} styleMap={INVOICE_STATUS_STYLES} />
          </div>
        </div>
      )}

      {open && invoices.length > 0 && (
        <div className="border-t border-[#27272A] p-3 space-y-2" data-testid={`service-history-${service.id}`}>
          {invoices.map((inv) => (
            <button key={inv.id} onClick={() => onViewInvoice(inv.id)}
              className="flex w-full items-center justify-between rounded-md bg-[#09090B] px-3 py-2 hover:bg-[#18181B] transition-colors text-left">
              <div>
                <div className="text-sm font-medium text-white">{inv.billing_month_label || inv.invoice_number}</div>
                <div className="text-xs text-zinc-500">{inv.invoice_number} · {money(inv.total_amount, currency)} · Paid {money(inv.amount_paid, currency)}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-orange-400">{money(inv.balance, currency)}</span>
                <StatusBadge label={inv.status} styleMap={INVOICE_STATUS_STYLES} />
                <span onClick={(e) => { e.stopPropagation(); downloadInvoicePdf(inv.id, inv.invoice_number); }}
                  className="text-zinc-500 hover:text-gold"><FileText className="h-4 w-4" /></span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currency } = useSettings();
  const [client, setClient] = useState(null);
  const [services, setServices] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [activities, setActivities] = useState([]);

  const [serviceOpen, setServiceOpen] = useState(false);
  const [editService, setEditService] = useState(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [preselectService, setPreselectService] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [viewId, setViewId] = useState(null);
  const [exitOpen, setExitOpen] = useState(false);

  const load = useCallback(() => {
    api.get(`/clients/${id}`).then((r) => setClient(r.data)).catch(() => {});
    api.get(`/clients/${id}/services`).then((r) => setServices(r.data)).catch(() => {});
    api.get(`/clients/${id}/invoices`).then((r) => setInvoices(r.data)).catch(() => {});
    api.get(`/clients/${id}/activities`).then((r) => setActivities(r.data)).catch(() => {});
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const generateNext = async (service) => {
    try {
      await api.post(`/services/${service.id}/generate-next-invoice`);
      toast.success("Next month invoice generated");
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to generate"); }
  };

  if (!client) return <div className="text-zinc-500">Loading client...</div>;
  const s = client.summary || {};
  const openInvoices = invoices.filter((i) => i.balance > 0 && i.status !== "CANCELLED");

  return (
    <div className="space-y-6" data-testid="client-profile-page">
      <button onClick={() => navigate("/clients")} className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Clients
      </button>

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white tracking-tight">{client.client_name}</h1>
            <StatusBadge label={client.status} styleMap={CLIENT_STATUS_STYLES} />
          </div>
          <div className="text-base text-zinc-400 mt-0.5">{client.business_name}</div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
            <span>Client since {fmtDate(client.start_date)}</span>
            {client.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {client.phone}</span>}
            {client.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {client.email}</span>}
            {client.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {client.location}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {client.status !== "EXITED" && (
            <button data-testid="mark-exited-button" onClick={() => setExitOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-red-500/30 text-red-400 px-3 py-2 text-sm hover:bg-red-500/10 transition-colors">
              <UserX className="h-4 w-4" /> Mark as Exited
            </button>
          )}
          <button data-testid="record-payment-button" onClick={() => setPaymentOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-[#27272A] px-3 py-2 text-sm text-zinc-200 hover:bg-[#18181B] transition-colors">
            <CreditCard className="h-4 w-4" /> Record Payment
          </button>
          <button data-testid="add-service-button" onClick={() => { setEditService(null); setServiceOpen(true); }}
            className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-sm font-semibold text-black hover:bg-[#c99d2a] transition-colors">
            <Plus className="h-4 w-4" /> Add Service / Project
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard testId="profile-active-services" label="Active Services" value={s.active_services ?? 0} />
        <StatCard testId="profile-completed-projects" label="Completed Projects" value={s.completed_projects ?? 0} />
        <StatCard testId="profile-total-invoiced" label="Total Invoiced" value={money(s.total_invoiced, currency)} />
        <StatCard testId="profile-total-received" label="Total Received" value={money(s.total_received, currency)} />
        <StatCard testId="profile-outstanding" label="Outstanding" value={money(s.total_outstanding, currency)} accent />
        <StatCard testId="profile-recurring" label="Monthly Recurring" value={money(s.monthly_recurring_value, currency)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Services & Projects</h2>
          {services.length === 0 ? (
            <div className="rounded-lg border border-[#27272A] bg-[#09090B] px-4 py-10 text-center text-sm text-zinc-600">No services yet. Add one to get started.</div>
          ) : services.map((svc) => (
            <ServiceCard key={svc.id} service={svc} currency={currency}
              onEdit={(x) => { setEditService(x); setServiceOpen(true); }}
              onCreateInvoice={(x) => { setPreselectService(x.id); setInvoiceOpen(true); }}
              onGenerateNext={generateNext}
              onViewInvoice={(iid) => setViewId(iid)} />
          ))}
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Activity History</h2>
          <div className="rounded-lg border border-[#27272A] bg-[#09090B] p-4">
            {activities.length === 0 ? (
              <div className="text-sm text-zinc-600 py-4 text-center">No activity yet</div>
            ) : (
              <div className="space-y-4" data-testid="activity-timeline">
                {activities.map((a) => (
                  <div key={a.id} className="relative pl-5">
                    <div className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-gold" />
                    <div className="text-xs text-zinc-500">{fmtDate(a.date)}</div>
                    <div className="text-sm text-zinc-200">{a.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ServiceDialog open={serviceOpen} onOpenChange={setServiceOpen} clientId={id} service={editService} onSaved={load} />
      <InvoiceDialog open={invoiceOpen} onOpenChange={setInvoiceOpen} clientId={id} services={services}
        preselectServiceId={preselectService} onSaved={load} />
      <PaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen} invoices={openInvoices} onSaved={load} />
      <InvoiceViewDialog invoiceId={viewId} open={!!viewId} onOpenChange={(v) => !v && setViewId(null)} onChanged={load} />
      <ExitDialog open={exitOpen} onOpenChange={setExitOpen} clientId={id} onSaved={load} />
    </div>
  );
}

function ExitDialog({ open, onOpenChange, clientId, onSaved }) {
  const [form, setForm] = useState({ exit_date: new Date().toISOString().slice(0, 10), exit_reason: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      await api.post(`/clients/${clientId}/exit`, {
        exit_date: form.exit_date ? new Date(form.exit_date).toISOString() : null,
        exit_reason: form.exit_reason, notes: form.notes,
      });
      toast.success("Client marked as exited");
      onSaved?.();
      onOpenChange(false);
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail)); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#09090B] border-[#27272A] text-white max-w-lg">
        <DialogHeader><DialogTitle className="text-white">Mark Client as Exited</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Field label="Exit Date"><DateInput value={form.exit_date} onChange={(e) => setForm((f) => ({ ...f, exit_date: e.target.value }))} /></Field>
          <Field label="Exit Reason"><TextArea testId="exit-reason-input" value={form.exit_reason} onChange={(e) => setForm((f) => ({ ...f, exit_reason: e.target.value }))} /></Field>
          <Field label="Notes"><TextArea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></Field>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="rounded-md border border-[#27272A] px-4 py-2 text-sm text-zinc-300 hover:bg-[#18181B] transition-colors">Cancel</button>
          <button data-testid="exit-confirm-button" onClick={submit} disabled={saving} className="rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-60">{saving ? "Saving..." : "Confirm Exit"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
