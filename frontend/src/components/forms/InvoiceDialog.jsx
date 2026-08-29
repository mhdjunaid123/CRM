import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Field, TextInput, TextArea, DateInput, SelectInput, NumberInput } from "@/components/FormControls";
import { api, formatApiErrorDetail } from "@/lib/api";
import { INVOICE_STATUSES } from "@/lib/format";
import { useSettings } from "@/context/SettingsContext";
import { money } from "@/lib/format";
import { toast } from "sonner";

function today() { return new Date().toISOString().slice(0, 10); }
function plusDays(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function toDateInput(iso) { if (!iso) return ""; try { return new Date(iso).toISOString().slice(0, 10); } catch { return ""; } }

export default function InvoiceDialog({ open, onOpenChange, clientId, services, preselectServiceId, invoice, onSaved }) {
  const { currency } = useSettings();
  const editing = !!invoice;
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (invoice) {
      setForm({
        service_id: invoice.service_id, billing_month: invoice.billing_month || "",
        invoice_date: toDateInput(invoice.invoice_date), due_date: toDateInput(invoice.due_date),
        description: invoice.description || "", subtotal: invoice.subtotal ?? 0,
        discount: invoice.discount ?? 0, tax: invoice.tax ?? 0, status: invoice.status || "PENDING", notes: invoice.notes || "",
      });
    } else {
      const sid = preselectServiceId || (services?.[0]?.id ?? "");
      const svc = services?.find((s) => s.id === sid);
      setForm({
        service_id: sid, billing_month: svc?.billing_type === "MONTHLY" ? new Date().toISOString().slice(0, 7) : "",
        invoice_date: today(), due_date: plusDays(7),
        description: svc ? svc.service_name : "", subtotal: svc?.price ?? 0,
        discount: 0, tax: 0, status: "PENDING", notes: "",
      });
    }
  }, [open, invoice, preselectServiceId, services]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onServiceChange = (e) => {
    const svc = services?.find((s) => s.id === e.target.value);
    setForm((f) => ({
      ...f, service_id: e.target.value,
      description: svc ? svc.service_name : f.description,
      subtotal: svc ? svc.price : f.subtotal,
      billing_month: svc?.billing_type === "MONTHLY" ? (f.billing_month || new Date().toISOString().slice(0, 7)) : "",
    }));
  };

  const total = useMemo(
    () => Number(form.subtotal || 0) - Number(form.discount || 0) + Number(form.tax || 0),
    [form.subtotal, form.discount, form.tax]
  );

  const submit = async () => {
    if (!form.service_id) { toast.error("Select a service"); return; }
    setSaving(true);
    try {
      const payload = {
        client_id: clientId, service_id: form.service_id,
        billing_month: form.billing_month || null,
        invoice_date: form.invoice_date ? new Date(form.invoice_date).toISOString() : null,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        description: form.description, subtotal: Number(form.subtotal || 0),
        discount: Number(form.discount || 0), tax: Number(form.tax || 0),
        status: form.status, notes: form.notes,
      };
      const res = editing ? await api.put(`/invoices/${invoice.id}`, payload) : await api.post("/invoices", payload);
      toast.success(editing ? "Invoice updated" : "Invoice created");
      onSaved?.(res.data);
      onOpenChange(false);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const svcOptions = services || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#09090B] border-[#27272A] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-white">{editing ? "Edit Invoice" : "Create Invoice"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Service" className="sm:col-span-2">
            <select data-testid="invoice-service-select" value={form.service_id || ""} onChange={onServiceChange} disabled={editing}
              className="w-full rounded-md bg-black border border-[#27272A] px-3 py-2 text-sm text-white focus:ring-2 focus:ring-gold focus:outline-none disabled:opacity-60">
              {svcOptions.length === 0 && <option value="">No services</option>}
              {svcOptions.map((s) => <option key={s.id} value={s.id} className="bg-[#09090B]">{s.service_name} ({s.billing_type})</option>)}
            </select>
          </Field>
          <Field label="Billing Month">
            <input type="month" data-testid="invoice-month-input" value={form.billing_month || ""} onChange={set("billing_month")}
              className="w-full rounded-md bg-black border border-[#27272A] px-3 py-2 text-sm text-white [color-scheme:dark] focus:ring-2 focus:ring-gold focus:outline-none" />
          </Field>
          <Field label="Status"><SelectInput options={INVOICE_STATUSES} value={form.status || "PENDING"} onChange={set("status")} /></Field>
          <Field label="Invoice Date"><DateInput value={form.invoice_date || ""} onChange={set("invoice_date")} /></Field>
          <Field label="Due Date"><DateInput value={form.due_date || ""} onChange={set("due_date")} /></Field>
          <Field label="Description" className="sm:col-span-2"><TextInput testId="invoice-desc-input" value={form.description || ""} onChange={set("description")} /></Field>
          <Field label="Subtotal"><NumberInput testId="invoice-subtotal-input" value={form.subtotal} onChange={set("subtotal")} /></Field>
          <Field label="Discount"><NumberInput value={form.discount} onChange={set("discount")} /></Field>
          <Field label="Tax"><NumberInput value={form.tax} onChange={set("tax")} /></Field>
          <div className="flex items-end">
            <div className="w-full rounded-md border border-gold/30 bg-gold/10 px-3 py-2">
              <div className="text-xs text-zinc-400 uppercase">Total</div>
              <div className="text-lg font-bold text-gold" data-testid="invoice-total-display">{money(total, currency)}</div>
            </div>
          </div>
          <Field label="Notes" className="sm:col-span-2"><TextArea value={form.notes || ""} onChange={set("notes")} /></Field>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="rounded-md border border-[#27272A] px-4 py-2 text-sm text-zinc-300 hover:bg-[#18181B] transition-colors">Cancel</button>
          <button data-testid="invoice-save-button" onClick={submit} disabled={saving} className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-[#c99d2a] transition-colors disabled:opacity-60">{saving ? "Saving..." : "Save Invoice"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
