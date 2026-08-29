import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { money, fmtDate, INVOICE_STATUS_STYLES } from "@/lib/format";
import { useSettings } from "@/context/SettingsContext";
import { StatusBadge } from "@/components/StatusBadge";

export default function CompletedProjects() {
  const { currency } = useSettings();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);

  const load = useCallback(() => {
    api.get("/services", { params: { service_type: "PROJECT", status: "COMPLETED" } }).then((r) => setRows(r.data)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6" data-testid="completed-projects-page">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Completed Projects</h1>
        <p className="text-sm text-zinc-500 mt-1">Projects marked as COMPLETED</p>
      </div>

      <div className="rounded-lg border border-[#27272A] bg-[#09090B] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#27272A] text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Started</th>
                <th className="px-4 py-3 font-medium">Completed</th>
                <th className="px-4 py-3 font-medium text-right">Price</th>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Payment</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-zinc-600">No completed projects</td></tr>
              ) : rows.map((s) => {
                const inv = s.invoices?.[0];
                return (
                  <tr key={s.id} data-testid={`completed-project-row-${s.id}`} onClick={() => navigate(`/clients/${s.client_id}`)}
                    className="border-b border-[#18181B] hover:bg-[#18181B] cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{s.client_name}</div>
                      <div className="text-xs text-zinc-500">{s.business_name}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-200">{s.service_name}</td>
                    <td className="px-4 py-3 text-zinc-400">{fmtDate(s.start_date)}</td>
                    <td className="px-4 py-3 text-zinc-400">{fmtDate(s.actual_completion_date)}</td>
                    <td className="px-4 py-3 text-right text-gold">{money(s.price, currency)}</td>
                    <td className="px-4 py-3 text-zinc-300">{inv?.invoice_number || "—"}</td>
                    <td className="px-4 py-3">{inv ? <StatusBadge label={inv.status} styleMap={INVOICE_STATUS_STYLES} /> : <span className="text-xs text-zinc-600">No invoice</span>}</td>
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
