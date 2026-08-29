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
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [income, setIncome] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { api.get("/dashboard").then((r) => setData(r.data)).catch(() => {}); }, []);
  useEffect(() => { api.get(`/dashboard/income?month=${month}`).then((r) => setIncome(r.data)).catch(() => {}); }, [month]);

  const monthLabel = (m) => {
    if (!m) return "";
    const [y, mm] = m.split("-");
    return new Date(Number(y), Number(mm) - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  };

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

      <div className="rounded-xl border border-[#27272A] bg-[#0C0C0E] p-5" data-testid="income-report">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-semibold text-white">Income Report</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Invoiced vs received, by month and by client</p>
          </div>
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} data-testid="income-month-picker"
            className="bg-[#18181B] border border-[#27272A] rounded-md px-3 py-2 text-sm text-white focus:border-gold outline-none [color-scheme:dark]" />
        </div>
        {!income ? <EmptyRow text="Loading..." /> : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <PeriodCard label={`Invoiced · ${monthLabel(month)}`} value={money(income.period_invoiced, currency)} testId="income-invoiced" />
              <PeriodCard label="Received" value={money(income.period_received, currency)} valueClass="text-green-400" testId="income-received" />
              <PeriodCard label="Outstanding" value={money(income.period_outstanding, currency)} valueClass="text-gold" testId="income-outstanding" />
            </div>

            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Monthly Income Trend · last 12 months</span>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm border border-gold/70" />Invoiced</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-gold" />Received</span>
                </div>
              </div>
              {(() => {
                const max = Math.max(1, ...income.trend.flatMap((t) => [t.invoiced, t.received]));
                return (
                  <div className="flex items-end gap-2 h-40 border-b border-[#27272A]" data-testid="income-trend-chart">
                    {income.trend.map((t) => (
                      <button key={t.month} onClick={() => setMonth(t.month)}
                        title={`${monthLabel(t.month)} — Invoiced ${money(t.invoiced, currency)}, Received ${money(t.received, currency)}`}
                        className="group flex-1 flex items-end justify-center gap-0.5 h-full">
                        <div className="w-1/3 min-h-[2px] rounded-t-sm border border-gold/70 group-hover:border-gold transition-all" style={{ height: `${(t.invoiced / max) * 100}%` }} />
                        <div className={`w-1/3 min-h-[2px] rounded-t-sm bg-gold/80 group-hover:bg-gold transition-all ${t.month === month ? "ring-2 ring-white/70" : ""}`} style={{ height: `${(t.received / max) * 100}%` }} />
                      </button>
                    ))}
                  </div>
                );
              })()}
              <div className="flex gap-2 mt-2">
                {income.trend.map((t) => (
                  <div key={t.month} className={`flex-1 text-center text-[10px] ${t.month === month ? "text-gold font-semibold" : "text-zinc-600"}`}>
                    {new Date(Number(t.month.split("-")[0]), Number(t.month.split("-")[1]) - 1, 1).toLocaleString("en-US", { month: "short" })}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Income by Client · {monthLabel(month)}</span>
              <div className="mt-3 overflow-x-auto">
                {income.income_by_client.length === 0 ? <EmptyRow text="No income recorded this month" /> : (
                  <table className="w-full text-sm" data-testid="income-by-client-table">
                    <thead>
                      <tr className="text-left text-xs uppercase text-zinc-500 border-b border-[#27272A]">
                        <th className="py-2 pr-4 font-medium">Client</th>
                        <th className="py-2 px-4 font-medium text-right">Invoiced</th>
                        <th className="py-2 px-4 font-medium text-right">Received</th>
                        <th className="py-2 pl-4 font-medium text-right">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {income.income_by_client.map((r) => (
                        <tr key={r.client_id || r.client_name} onClick={() => r.client_id && navigate(`/clients/${r.client_id}`)}
                          className="border-b border-[#18181B] hover:bg-[#18181B] cursor-pointer transition-colors">
                          <td className="py-2.5 pr-4">
                            <div className="font-medium text-white">{r.client_name}</div>
                            <div className="text-xs text-zinc-500">{r.business_name || "—"}</div>
                          </td>
                          <td className="py-2.5 px-4 text-right text-white">{money(r.invoiced, currency)}</td>
                          <td className="py-2.5 px-4 text-right text-green-400">{money(r.received, currency)}</td>
                          <td className="py-2.5 pl-4 text-right text-gold">{money(r.outstanding, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
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

function PeriodCard({ label, value, valueClass = "text-white", testId }) {
  return (
    <div data-testid={testId} className="rounded-lg border border-[#27272A] bg-[#111113] px-4 py-3.5">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1.5 text-xl font-bold ${valueClass}`}>{value}</div>
    </div>
  );
}
