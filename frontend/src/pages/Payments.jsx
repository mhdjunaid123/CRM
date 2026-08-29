import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { money, fmtDate, PAYMENT_METHODS } from "@/lib/format";
import { useSettings } from "@/context/SettingsContext";

export default function Payments() {
  const { currency } = useSettings();
  const [payments, setPayments] = useState([]);
  const [method, setMethod] = useState("ALL");

  const load = useCallback(() => {
    api.get("/payments", { params: { payment_method: method } }).then((r) => setPayments(r.data)).catch(() => {});
  }, [method]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6" data-testid="payments-page">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Payments</h1>
        <p className="text-sm text-zinc-500 mt-1">All payments received against invoices</p>
      </div>

      <div className="flex gap-1 rounded-md border border-[#27272A] bg-[#09090B] p-1 w-fit">
        {["ALL", ...PAYMENT_METHODS].map((m) => (
          <button key={m} data-testid={`payment-filter-${m.toLowerCase().replace(" ", "-")}`} onClick={() => setMethod(m)}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${method === m ? "bg-gold text-black" : "text-zinc-400 hover:text-white"}`}>
            {m}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-[#27272A] bg-[#09090B] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#27272A] text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-600">No payments recorded</td></tr>
              ) : payments.map((p) => (
                <tr key={p.id} data-testid={`payment-row-${p.id}`} className="border-b border-[#18181B] hover:bg-[#18181B] transition-colors">
                  <td className="px-4 py-3 text-zinc-400">{fmtDate(p.payment_date)}</td>
                  <td className="px-4 py-3 text-white font-medium">{p.client_name}</td>
                  <td className="px-4 py-3 text-zinc-300">{p.invoice_number}</td>
                  <td className="px-4 py-3 text-zinc-400">{p.service_name}</td>
                  <td className="px-4 py-3"><span className="text-xs rounded border border-[#27272A] px-2 py-0.5 text-zinc-300">{p.payment_method}</span></td>
                  <td className="px-4 py-3 text-right font-semibold text-green-400">{money(p.amount, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
