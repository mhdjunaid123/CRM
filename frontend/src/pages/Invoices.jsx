import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Download, Eye, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { money, fmtDate, INVOICE_STATUS_STYLES, INVOICE_STATUSES } from "@/lib/format";
import { useSettings } from "@/context/SettingsContext";
import { StatusBadge } from "@/components/StatusBadge";
import { downloadInvoicePdf } from "@/lib/pdf";
import InvoiceViewDialog from "@/components/InvoiceViewDialog";

export default function Invoices() {
  const { currency } = useSettings();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [viewId, setViewId] = useState(null);

  const load = useCallback(() => {
    api.get("/invoices", { params: { search, status } }).then((r) => setInvoices(r.data)).catch(() => {});
  }, [search, status]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  return (
    <div className="space-y-6" data-testid="invoices-page">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Invoices</h1>
        <p className="text-sm text-zinc-500 mt-1">All invoices across clients and services</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input data-testid="invoices-search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice number..."
            className="w-full rounded-md bg-[#09090B] border border-[#27272A] pl-10 pr-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-gold focus:outline-none" />
        </div>
        <select data-testid="invoices-status-filter" value={status} onChange={(e) => setStatus(e.target.value)}
          className="rounded-md bg-[#09090B] border border-[#27272A] px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-gold focus:outline-none">
          {["ALL", ...INVOICE_STATUSES].map((s) => <option key={s} value={s} className="bg-[#09090B]">{s}</option>)}
        </select>
      </div>

      <div className="rounded-lg border border-[#27272A] bg-[#09090B] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#27272A] text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Month</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-right">Paid</th>
                <th className="px-4 py-3 font-medium text-right">Balance</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-zinc-600">No invoices found</td></tr>
              ) : invoices.map((i) => (
                <tr key={i.id} data-testid={`invoice-row-${i.id}`} className="border-b border-[#18181B] hover:bg-[#18181B] transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{i.invoice_number}</td>
                  <td className="px-4 py-3 text-zinc-300">{i.client_name}</td>
                  <td className="px-4 py-3 text-zinc-400">{i.service_name}</td>
                  <td className="px-4 py-3 text-zinc-400">{i.billing_month_label || "—"}</td>
                  <td className="px-4 py-3 text-right text-white">{money(i.total_amount, currency)}</td>
                  <td className="px-4 py-3 text-right text-green-400">{money(i.amount_paid, currency)}</td>
                  <td className="px-4 py-3 text-right text-orange-400">{money(i.balance, currency)}</td>
                  <td className="px-4 py-3"><StatusBadge label={i.status} styleMap={INVOICE_STATUS_STYLES} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button data-testid={`invoice-view-${i.id}`} onClick={() => setViewId(i.id)} title="View" className="text-zinc-400 hover:text-gold transition-colors"><Eye className="h-4 w-4" /></button>
                      <button data-testid={`invoice-download-${i.id}`} onClick={() => downloadInvoicePdf(i.id, i.invoice_number)} title="Download PDF" className="text-zinc-400 hover:text-gold transition-colors"><Download className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <InvoiceViewDialog invoiceId={viewId} open={!!viewId} onOpenChange={(v) => !v && setViewId(null)} onChanged={load} />
    </div>
  );
}
