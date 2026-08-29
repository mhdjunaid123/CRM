import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { money, fmtDate, INVOICE_STATUS_STYLES } from "@/lib/format";
import { useSettings } from "@/context/SettingsContext";
import { StatusBadge } from "@/components/StatusBadge";
import { downloadInvoicePdf } from "@/lib/pdf";
import { Download, CreditCard, CheckCircle2 } from "lucide-react";
import PaymentDialog from "@/components/forms/PaymentDialog";
import { toast } from "sonner";

export default function InvoiceViewDialog({ invoiceId, open, onOpenChange, onChanged }) {
  const { currency } = useSettings();
  const [inv, setInv] = useState(null);
  const [payOpen, setPayOpen] = useState(false);

  const load = useCallback(() => {
    if (!invoiceId) return;
    api.get(`/invoices/${invoiceId}`).then((r) => setInv(r.data)).catch(() => {});
  }, [invoiceId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const markPaid = async () => {
    try {
      await api.post(`/invoices/${invoiceId}/mark-paid`);
      toast.success("Invoice marked as paid");
      load();
      onChanged?.();
    } catch {
      toast.error("Failed to update");
    }
  };

  if (!inv) return null;
  const c = inv.client || {};

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-[#09090B] border-[#27272A] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-white">
              {inv.invoice_number}
              <StatusBadge label={inv.status} styleMap={INVOICE_STATUS_STYLES} />
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-zinc-500 uppercase mb-1">Bill To</div>
                <div className="text-white font-medium">{c.client_name}</div>
                <div className="text-zinc-400">{c.business_name}</div>
                {c.phone && <div className="text-zinc-500 text-xs mt-1">{c.phone}</div>}
                {c.email && <div className="text-zinc-500 text-xs">{c.email}</div>}
              </div>
              <div className="text-right">
                <div className="text-xs text-zinc-500">Invoice Date: <span className="text-zinc-300">{fmtDate(inv.invoice_date)}</span></div>
                <div className="text-xs text-zinc-500">Due Date: <span className="text-zinc-300">{fmtDate(inv.due_date)}</span></div>
                {inv.billing_month_label && <div className="text-xs text-zinc-500">Billing Month: <span className="text-zinc-300">{inv.billing_month_label}</span></div>}
              </div>
            </div>

            <div className="rounded-md border border-[#27272A] overflow-hidden">
              <div className="flex justify-between bg-black px-4 py-2 text-xs uppercase text-zinc-500">
                <span>Description</span><span>Amount</span>
              </div>
              <div className="flex justify-between px-4 py-3 text-sm">
                <span className="text-zinc-200">{inv.description || inv.service?.service_name}</span>
                <span className="text-white">{money(inv.subtotal, currency)}</span>
              </div>
            </div>

            <div className="ml-auto w-full sm:w-64 space-y-1.5 text-sm">
              <Row label="Subtotal" value={money(inv.subtotal, currency)} />
              <Row label="Discount" value={"- " + money(inv.discount, currency)} />
              <Row label="Tax" value={money(inv.tax, currency)} />
              <div className="border-t border-[#27272A] my-1" />
              <Row label="Total" value={money(inv.total_amount, currency)} bold />
              <Row label="Paid" value={money(inv.amount_paid, currency)} className="text-green-400" />
              <Row label="Balance" value={money(inv.balance, currency)} bold className={inv.balance > 0 ? "text-orange-400" : "text-green-400"} />
            </div>

            {inv.payments?.length > 0 && (
              <div>
                <div className="text-xs text-zinc-500 uppercase mb-2">Payment History</div>
                <div className="space-y-1">
                  {inv.payments.map((p) => (
                    <div key={p.id} className="flex justify-between text-sm rounded-md bg-black px-3 py-2">
                      <span className="text-zinc-400">{fmtDate(p.payment_date)} · {p.payment_method}</span>
                      <span className="text-green-400 font-medium">{money(p.amount, currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {inv.balance > 0 && inv.status !== "CANCELLED" && (
                <button data-testid="invoice-record-payment" onClick={() => setPayOpen(true)} className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-[#c99d2a] transition-colors">
                  <CreditCard className="h-4 w-4" /> Record Payment
                </button>
              )}
              {inv.balance > 0 && inv.status !== "CANCELLED" && (
                <button data-testid="invoice-mark-paid" onClick={markPaid} className="inline-flex items-center gap-2 rounded-md border border-green-500/30 text-green-400 px-4 py-2 text-sm font-medium hover:bg-green-500/10 transition-colors">
                  <CheckCircle2 className="h-4 w-4" /> Mark as Paid
                </button>
              )}
              <button data-testid="invoice-download-pdf" onClick={() => downloadInvoicePdf(inv.id, inv.invoice_number)} className="inline-flex items-center gap-2 rounded-md border border-[#27272A] px-4 py-2 text-sm text-zinc-300 hover:bg-[#18181B] transition-colors">
                <Download className="h-4 w-4" /> Download PDF
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} invoices={[inv]} preselectInvoiceId={inv.id}
        onSaved={() => { load(); onChanged?.(); }} />
    </>
  );
}

function Row({ label, value, bold, className = "" }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className={`${bold ? "font-bold" : ""} ${className || "text-white"}`}>{value}</span>
    </div>
  );
}
