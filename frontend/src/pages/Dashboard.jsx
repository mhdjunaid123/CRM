import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { money, fmtDate, INVOICE_STATUS_STYLES, SERVICE_STATUS_STYLES } from "@/lib/format";
import { useSettings } from "@/context/SettingsContext";
import { StatCard, SectionCard, EmptyRow } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";

export default function Dashboard() {
  const { currency } = useSettings();
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { api.get("/dashboard").then((r) => setData(r.data)).catch(() => {}); }, []);

  if (!data) return <div className="text-zinc-500">Loading dashboard...</div>;
  const s = data.stats;

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">Overview of your agency operations</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard testId="stat-total-clients" label="Total Clients" value={s.total_clients} />
        <StatCard testId="stat-active-clients" label="Active Clients" value={s.active_clients} />
        <StatCard testId="stat-pipeline" label="Pipeline" value={s.pipeline} />
        <StatCard testId="stat-exited-clients" label="Exited Clients" value={s.exited_clients} />
        <StatCard testId="stat-active-services" label="Active Services" value={s.active_services} />
        <StatCard testId="stat-completed-projects" label="Completed Projects" value={s.completed_projects} />
        <StatCard testId="stat-total-invoiced" label="Total Invoiced" value={money(s.total_invoiced, currency)} />
        <StatCard testId="stat-total-received" label="Total Received" value={money(s.total_received, currency)} />
        <StatCard testId="stat-total-outstanding" label="Total Outstanding" value={money(s.total_outstanding, currency)} accent />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Recent Clients" testId="section-recent-clients">
          {data.recent_clients.length === 0 ? <EmptyRow text="No clients yet" /> :
            data.recent_clients.map((c) => (
              <button key={c.id} onClick={() => navigate(`/clients/${c.id}`)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2.5 hover:bg-[#18181B] transition-colors text-left">
                <div>
                  <div className="text-sm font-medium text-white">{c.client_name}</div>
                  <div className="text-xs text-zinc-500">{c.business_name || "—"}</div>
                </div>
                <StatusBadge label={c.status} styleMap={{ ACTIVE: "bg-green-500/15 text-green-400 border-green-500/30", PIPELINE: "bg-gold/15 text-gold border-gold/30", "ON HOLD": "bg-orange-500/15 text-orange-400 border-orange-500/30", EXITED: "bg-red-500/15 text-red-400 border-red-500/30" }} />
              </button>
            ))}
        </SectionCard>

        <SectionCard title="Active Services" testId="section-active-services">
          {data.active_services.length === 0 ? <EmptyRow text="No active services" /> :
            data.active_services.map((s2) => (
              <div key={s2.id} className="flex items-center justify-between rounded-md px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium text-white">{s2.service_name}</div>
                  <div className="text-xs text-zinc-500">{s2.client_name}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gold">{money(s2.price, currency)}</div>
                  <StatusBadge label={s2.status} styleMap={SERVICE_STATUS_STYLES} />
                </div>
              </div>
            ))}
        </SectionCard>

        <SectionCard title="Pending Invoices" testId="section-pending-invoices">
          {data.pending_invoices.length === 0 ? <EmptyRow text="No pending invoices" /> :
            data.pending_invoices.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-md px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium text-white">{i.invoice_number} · {i.client_name}</div>
                  <div className="text-xs text-zinc-500">Due {fmtDate(i.due_date)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-white">{money(i.balance, currency)}</div>
                  <StatusBadge label={i.status} styleMap={INVOICE_STATUS_STYLES} />
                </div>
              </div>
            ))}
        </SectionCard>

        <SectionCard title="Overdue Invoices" testId="section-overdue-invoices">
          {data.overdue_invoices.length === 0 ? <EmptyRow text="No overdue invoices" /> :
            data.overdue_invoices.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-md px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium text-white">{i.invoice_number} · {i.client_name}</div>
                  <div className="text-xs text-red-400">Due {fmtDate(i.due_date)}</div>
                </div>
                <div className="text-sm font-semibold text-white">{money(i.balance, currency)}</div>
              </div>
            ))}
        </SectionCard>

        <SectionCard title="Recent Payments" testId="section-recent-payments">
          {data.recent_payments.length === 0 ? <EmptyRow text="No payments yet" /> :
            data.recent_payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium text-white">{p.client_name}</div>
                  <div className="text-xs text-zinc-500">{p.invoice_number} · {fmtDate(p.payment_date)}</div>
                </div>
                <div className="text-sm font-semibold text-green-400">{money(p.amount, currency)}</div>
              </div>
            ))}
        </SectionCard>

        <SectionCard title="Recently Completed Projects" testId="section-completed-projects">
          {data.recent_completed_projects.length === 0 ? <EmptyRow text="No completed projects" /> :
            data.recent_completed_projects.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium text-white">{p.service_name}</div>
                  <div className="text-xs text-zinc-500">{p.client_name} · {fmtDate(p.actual_completion_date)}</div>
                </div>
                <div className="text-sm font-semibold text-gold">{money(p.price, currency)}</div>
              </div>
            ))}
        </SectionCard>
      </div>
    </div>
  );
}
