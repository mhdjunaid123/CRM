import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Field, TextArea, DateInput, SelectInput, NumberInput } from "@/components/FormControls";
import { api, formatApiErrorDetail } from "@/lib/api";
import { PAYMENT_METHODS, money } from "@/lib/format";
import { useSettings } from "@/context/SettingsContext";
import { toast } from "sonner";

function today() { return new Date().toISOString().slice(0, 10); }

export default function PaymentDialog({ open, onOpenChange, invoices, preselectInvoiceId, onSaved }) {
  const { currency } = useSettings();
  const [form, setForm] = useState({ invoice_id: "", amount: "", payment_date: today(), payment_method: "UPI", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const iid = preselectInvoiceId || (invoices?.[0]?.id ?? "");
    const inv = invoices?.find((i) => i.id === iid);
    setForm({ invoice_id: iid, amount: inv ? inv.balance : "", payment_date: today(), payment_method: "UPI", notes: "" });
  }, [open, preselectInvoiceId, invoices]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onInvoiceChange = (e) => {
    const inv = invoices?.find((i) => i.id === e.target.value);
    setForm((f) => ({ ...f, invoice_id: e.target.value, amount: inv ? inv.balance : f.amount }));
  };

  const submit = async () => {
    if (!form.invoice_id) { toast.error("Select an invoice"); return; }
    if (!(Number(form.amount) > 0)) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    try {
      const res = await api.post("/payments", {
        invoice_id: form.invoice_id, amount: Number(form.amount),
        payment_date: form.payment_date ? new Date(form.payment_date).toISOString() : null,
        payment_method: form.payment_method, notes: form.notes,
      });
      toast.success("Payment recorded");
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
      <DialogContent className="bg-[#09090B] border-[#27272A] text-white max-w-lg">
        <DialogHeader><DialogTitle className="text-white">Record Payment</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-4">
          <Field label="Invoice">
            <select data-testid="payment-invoice-select" value={form.invoice_id} onChange={onInvoiceChange}
              className="w-full rounded-md bg-black border border-[#27272A] px-3 py-2 text-sm text-white focus:ring-2 focus:ring-gold focus:outline-none">
              {(!invoices || invoices.length === 0) && <option value="">No invoices</option>}
              {invoices?.map((i) => (
                <option key={i.id} value={i.id} className="bg-[#09090B]">
                  {i.invoice_number} — {money(i.balance, currency)} due ({i.status})
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount"><NumberInput testId="payment-amount-input" value={form.amount} onChange={set("amount")} /></Field>
            <Field label="Payment Date"><DateInput value={form.payment_date} onChange={set("payment_date")} /></Field>
          </div>
          <Field label="Payment Method"><SelectInput testId="payment-method-select" options={PAYMENT_METHODS} value={form.payment_method} onChange={set("payment_method")} /></Field>
          <Field label="Notes"><TextArea value={form.notes} onChange={set("notes")} /></Field>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="rounded-md border border-[#27272A] px-4 py-2 text-sm text-zinc-300 hover:bg-[#18181B] transition-colors">Cancel</button>
          <button data-testid="payment-save-button" onClick={submit} disabled={saving} className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-[#c99d2a] transition-colors disabled:opacity-60">{saving ? "Saving..." : "Record Payment"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
