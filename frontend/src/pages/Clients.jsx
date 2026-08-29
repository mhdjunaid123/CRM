import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import { money, CLIENT_STATUS_STYLES } from "@/lib/format";
import { useSettings } from "@/context/SettingsContext";
import { StatusBadge } from "@/components/StatusBadge";
import ClientDialog from "@/components/forms/ClientDialog";

const FILTERS = ["ALL", "ACTIVE", "ON HOLD", "EXITED"];

export default function Clients() {
  const { currency } = useSettings();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(() => {
    api.get("/clients", { params: { search, status } }).then((r) => setClients(r.data)).catch(() => {});
  }, [search, status]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  return (
    <div className="space-y-6" data-testid="clients-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Clients</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage all your agency clients</p>
        </div>
        <button data-testid="add-client-button" onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#c99d2a] transition-colors">
          <Plus className="h-4 w-4" /> Add Client
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input data-testid="clients-search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, business, phone, email..."
            className="w-full rounded-md bg-[#09090B] border border-[#27272A] pl-10 pr-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-gold focus:outline-none" />
        </div>
        <div className="flex gap-1 rounded-md border border-[#27272A] bg-[#09090B] p-1">
          {FILTERS.map((f) => (
            <button key={f} data-testid={`client-filter-${f.toLowerCase().replace(" ", "-")}`} onClick={() => setStatus(f)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${status === f ? "bg-gold text-black" : "text-zinc-400 hover:text-white"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[#27272A] bg-[#09090B] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#27272A] text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Services</th>
                <th className="px-4 py-3 font-medium">Since</th>
                <th className="px-4 py-3 font-medium text-right">Invoiced</th>
                <th className="px-4 py-3 font-medium text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-600">No clients found</td></tr>
              ) : clients.map((c) => (
                <tr key={c.id} data-testid={`client-row-${c.id}`} onClick={() => navigate(`/clients/${c.id}`)}
                  className="border-b border-[#18181B] hover:bg-[#18181B] cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{c.client_name}</div>
                    <div className="text-xs text-zinc-500">{c.business_name || "—"}</div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge label={c.status} styleMap={CLIENT_STATUS_STYLES} /></td>
                  <td className="px-4 py-3 text-zinc-300">{c.num_services}</td>
                  <td className="px-4 py-3 text-zinc-400">{c.start_date ? new Date(c.start_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                  <td className="px-4 py-3 text-right text-white">{money(c.total_invoiced, currency)}</td>
                  <td className="px-4 py-3 text-right font-medium" style={{ color: c.total_outstanding > 0 ? "#F97316" : "#22C55E" }}>{money(c.total_outstanding, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ClientDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={load} />
    </div>
  );
}
