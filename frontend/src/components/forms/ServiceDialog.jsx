import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Field, TextInput, TextArea, DateInput, SelectInput, NumberInput } from "@/components/FormControls";
import { api, formatApiErrorDetail } from "@/lib/api";
import { SERVICE_TYPES, BILLING_TYPES, SERVICE_STATUSES } from "@/lib/format";
import { toast } from "sonner";

const empty = {
  service_name: "", service_type: "PROJECT", billing_type: "ONE-TIME", price: "",
  start_date: "", expected_completion_date: "", actual_completion_date: "",
  status: "ACTIVE", recurring_enabled: false, invoice_day: 1, notes: "",
};

function toDateInput(iso) {
  if (!iso) return "";
  try { return new Date(iso).toISOString().slice(0, 10); } catch { return ""; }
}

export default function ServiceDialog({ open, onOpenChange, clientId, service, onSaved }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const editing = !!service;

  useEffect(() => {
    if (open) {
      setForm(service ? {
        ...empty, ...service,
        start_date: toDateInput(service.start_date),
        expected_completion_date: toDateInput(service.expected_completion_date),
        actual_completion_date: toDateInput(service.actual_completion_date),
      } : empty);
    }
  }, [open, service]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.service_name.trim()) { toast.error("Service name is required"); return; }
    setSaving(true);
    try {
      const payload = { ...form, price: Number(form.price || 0), invoice_day: Number(form.invoice_day || 1) };
      ["start_date", "expected_completion_date", "actual_completion_date"].forEach((k) => {
        if (payload[k]) payload[k] = new Date(payload[k]).toISOString();
        else payload[k] = null;
      });
      let res;
      if (editing) {
        res = await api.put(`/services/${service.id}`, payload);
      } else {
        res = await api.post("/services", { ...payload, client_id: clientId });
      }
      toast.success(editing ? "Service updated" : "Service added");
      onSaved?.(res.data);
      onOpenChange(false);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#09090B] border-[#27272A] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-white">{editing ? "Edit Service / Project" : "Add Service / Project"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Service Name" className="sm:col-span-2"><TextInput testId="service-name-input" value={form.service_name} onChange={set("service_name")} /></Field>
          <Field label="Service Type"><SelectInput testId="service-type-select" options={SERVICE_TYPES} value={form.service_type} onChange={set("service_type")} /></Field>
          <Field label="Billing Type"><SelectInput testId="service-billing-select" options={BILLING_TYPES} value={form.billing_type} onChange={set("billing_type")} /></Field>
          <Field label="Price"><NumberInput testId="service-price-input" value={form.price} onChange={set("price")} /></Field>
          <Field label="Status"><SelectInput testId="service-status-select" options={SERVICE_STATUSES} value={form.status} onChange={set("status")} /></Field>
          <Field label="Start Date"><DateInput value={form.start_date} onChange={set("start_date")} /></Field>
          <Field label="Expected Completion"><DateInput value={form.expected_completion_date} onChange={set("expected_completion_date")} /></Field>
          <Field label="Actual Completion"><DateInput value={form.actual_completion_date} onChange={set("actual_completion_date")} /></Field>
          {form.billing_type === "MONTHLY" && (
            <Field label="Invoice Generation Day"><NumberInput value={form.invoice_day} min={1} max={28} step={1} onChange={set("invoice_day")} /></Field>
          )}
          {form.billing_type === "MONTHLY" && (
            <Field label="Recurring Invoices">
              <label className="flex items-center gap-2 mt-2 text-sm text-zinc-300">
                <input type="checkbox" data-testid="service-recurring-toggle" checked={!!form.recurring_enabled}
                  onChange={(e) => setForm((f) => ({ ...f, recurring_enabled: e.target.checked }))}
                  className="h-4 w-4 accent-[#E0B230]" />
                Enable recurring monthly invoices
              </label>
            </Field>
          )}
          <Field label="Notes" className="sm:col-span-2"><TextArea value={form.notes} onChange={set("notes")} /></Field>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="rounded-md border border-[#27272A] px-4 py-2 text-sm text-zinc-300 hover:bg-[#18181B] transition-colors">Cancel</button>
          <button data-testid="service-save-button" onClick={submit} disabled={saving} className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-[#c99d2a] transition-colors disabled:opacity-60">{saving ? "Saving..." : "Save Service"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
