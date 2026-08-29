import { useEffect, useState, useCallback } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import { Plus, ArrowRightCircle, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { money, PIPELINE_STAGES, fmtDate } from "@/lib/format";
import { useSettings } from "@/context/SettingsContext";
import LeadDialog from "@/components/forms/LeadDialog";
import { toast } from "sonner";

function Card({ lead, onEdit, onConvert, onDelete, currency }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} data-testid={`lead-card-${lead.id}`}
      className={`rounded-md border border-[#27272A] bg-black p-3 mb-2 ${isDragging ? "opacity-50" : ""}`}>
      <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing">
        <div className="text-sm font-semibold text-white">{lead.business_name}</div>
        {lead.contact_person && <div className="text-xs text-zinc-400">{lead.contact_person}</div>}
        {lead.phone && <div className="text-xs text-zinc-500">{lead.phone}</div>}
        {lead.potential_service && <div className="mt-1 text-xs text-zinc-400">{lead.potential_service}</div>}
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-gold">{money(lead.expected_value, currency)}</span>
          {lead.lead_source && <span className="text-[10px] text-zinc-600 uppercase">{lead.lead_source}</span>}
        </div>
        <div className="text-[10px] text-zinc-600 mt-1">{fmtDate(lead.created_at)}</div>
      </div>
      <div className="mt-2 flex items-center gap-2 border-t border-[#18181B] pt-2">
        <button data-testid={`lead-edit-${lead.id}`} onClick={() => onEdit(lead)} className="text-zinc-500 hover:text-gold transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
        <button data-testid={`lead-delete-${lead.id}`} onClick={() => onDelete(lead)} className="text-zinc-500 hover:text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
        {lead.stage === "WON" && !lead.converted_client_id && (
          <button data-testid={`lead-convert-${lead.id}`} onClick={() => onConvert(lead)}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-green-400 hover:text-green-300 transition-colors">
            <ArrowRightCircle className="h-3.5 w-3.5" /> Convert
          </button>
        )}
        {lead.converted_client_id && <span className="ml-auto text-[10px] text-green-500 uppercase">Converted</span>}
      </div>
    </div>
  );
}

function Column({ stage, leads, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div ref={setNodeRef} data-testid={`pipeline-column-${stage.toLowerCase().replace(/ /g, "-")}`}
      className={`w-72 shrink-0 rounded-lg border bg-[#09090B] ${isOver ? "border-gold" : "border-[#27272A]"}`}>
      <div className="flex items-center justify-between border-b border-[#27272A] px-3 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-white">{stage}</span>
        <span className="rounded bg-[#18181B] px-1.5 text-xs text-zinc-400">{leads.length}</span>
      </div>
      <div className="p-2 min-h-[120px] max-h-[calc(100vh-260px)] overflow-y-auto">{children}</div>
    </div>
  );
}

export default function Pipeline() {
  const { currency } = useSettings();
  const [leads, setLeads] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(() => { api.get("/leads").then((r) => setLeads(r.data)).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  const onDragEnd = async (e) => {
    const { active, over } = e;
    if (!over) return;
    const lead = leads.find((l) => l.id === active.id);
    if (!lead || lead.stage === over.id) return;
    setLeads((prev) => prev.map((l) => (l.id === active.id ? { ...l, stage: over.id } : l)));
    try { await api.put(`/leads/${active.id}`, { stage: over.id }); }
    catch { toast.error("Failed to move lead"); load(); }
  };

  const convert = async (lead) => {
    try {
      await api.post(`/leads/${lead.id}/convert`);
      toast.success("Lead converted to client");
      load();
    } catch (err) { toast.error(err.response?.data?.detail || "Failed to convert"); }
  };

  const del = async (lead) => {
    try { await api.delete(`/leads/${lead.id}`); toast.success("Lead deleted"); load(); }
    catch { toast.error("Failed to delete"); }
  };

  return (
    <div className="space-y-6" data-testid="pipeline-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Pipeline</h1>
          <p className="text-sm text-zinc-500 mt-1">Drag leads across stages</p>
        </div>
        <button data-testid="add-lead-button" onClick={() => { setEditLead(null); setDialogOpen(true); }}
          className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#c99d2a] transition-colors">
          <Plus className="h-4 w-4" /> Add Lead
        </button>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => (
            <Column key={stage} stage={stage} leads={leads.filter((l) => l.stage === stage)}>
              {leads.filter((l) => l.stage === stage).map((lead) => (
                <Card key={lead.id} lead={lead} currency={currency}
                  onEdit={(l) => { setEditLead(l); setDialogOpen(true); }}
                  onConvert={convert} onDelete={del} />
              ))}
            </Column>
          ))}
        </div>
      </DndContext>

      <LeadDialog open={dialogOpen} onOpenChange={setDialogOpen} lead={editLead} onSaved={load} />
    </div>
  );
}
