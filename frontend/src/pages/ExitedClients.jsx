import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { money, fmtDate } from "@/lib/format";
import { useSettings } from "@/context/SettingsContext";

export default function ExitedClients() {
  const { currency } = useSettings();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);

  const load = useCallback(() => {
    api.get("/clients", { params: { status: "EXITED" } }).then((r) => setRows(r.data)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6" data-testid="exited-clients-page">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Exited Clients</h1>
        <p className="text-sm text-zinc-500 mt-1">Clients who have exited — history preserved</p>
      </div>

      <div className="rounded-lg border border-[#27272A] bg-[#09090B] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#27272A] text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Exit Date</th>
                <th className="px-4 py-3 font-medium">Exit Reason</th>
                <th className="px-4 py-3 font-medium text-right">Total Invoiced</th>
                <th className="px-4 py-3 font-medium text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-zinc-600">No exited clients</td></tr>
              ) : rows.map((c) => (
                <tr key={c.id} data-testid={`exited-client-row-${c.id}`} onClick={() => navigate(`/clients/${c.id}`)}
                  className="border-b border-[#18181B] hover:bg-[#18181B] cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{c.client_name}</div>
                    <div className="text-xs text-zinc-500">{c.business_name}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{fmtDate(c.exit_date)}</td>
                  <td className="px-4 py-3 text-zinc-400">{c.exit_reason || "—"}</td>
                  <td className="px-4 py-3 text-right text-white">{money(c.total_invoiced, currency)}</td>
                  <td className="px-4 py-3 text-right text-orange-400">{money(c.total_outstanding, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
