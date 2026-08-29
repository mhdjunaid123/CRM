import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { money, fmtDate, SERVICE_STATUS_STYLES, INVOICE_STATUS_STYLES } from "@/lib/format";
import { useSettings } from "@/context/SettingsContext";
import { StatusBadge } from "@/components/StatusBadge";

export default function ActiveServices() {
  const { currency } = useSettings();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);

  const load = useCallback(() => {
    api.get("/services", { params: { status: "ACTIVE_VIEW" } }).then((r) => setRows(r.data)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6" data-testid="active-services-page">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Active Services</h1>
        <p className="text-sm text-zinc-500 mt-1">Services that are ACTIVE or IN PROGRESS</p>
      </div>

      <div className="rounded-lg border border-[#27272A] bg-[#09090B] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#27272A] text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Billing</th>
                <th className="px-4 py-3 font-medium text-right">Price</th>
                <th className="px-4 py-3 font-medium">Current Month</th>
                <th className="px-4 py-3 font-medium">Current Invoice</th>
                <th className="px-4 py-3 font-medium text-right">Balance</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Service</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-zinc-600">No active services</td></tr>
              ) : rows.map((s) => {
                const ci = s.current_invoice;
                return (
                  <tr key={s.id} data-testid={`active-service-row-${s.id}`} onClick={() => navigate(`/clients/${s.client_id}`)}
                    className="border-b border-[#18181B] hover:bg-[#18181B] cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{s.client_name}</div>
                      <div className="text-xs text-zinc-500">{s.business_name}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-200">{s.service_name}</td>
                    <td className="px-4 py-3 text-zinc-400">{s.billing_type}</td>
                    <td className="px-4 py-3 text-right text-gold">{money(s.price, currency)}{s.billing_type === "MONTHLY" ? "/mo" : ""}</td>
                    <td className="px-4 py-3 text-zinc-400">{ci?.billing_month_label || "—"}</td>
                    <td className="px-4 py-3 text-zinc-300">{ci?.invoice_number || "—"}</td>
                    <td className="px-4 py-3 text-right text-orange-400">{ci ? money(ci.balance, currency) : "—"}</td>
                    <td className="px-4 py-3">{ci ? <StatusBadge label={ci.status} styleMap={INVOICE_STATUS_STYLES} /> : <span className="text-xs text-zinc-600">No invoice</span>}</td>
                    <td className="px-4 py-3"><StatusBadge label={s.status} styleMap={SERVICE_STATUS_STYLES} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
