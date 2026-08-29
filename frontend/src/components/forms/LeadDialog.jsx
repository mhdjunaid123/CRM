import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Field, TextInput, TextArea, SelectInput, NumberInput } from "@/components/FormControls";
import { api, formatApiErrorDetail } from "@/lib/api";
import { PIPELINE_STAGES } from "@/lib/format";
import { toast } from "sonner";

const empty = {
  business_name: "", contact_person: "", phone: "", email: "",
  potential_service: "", expected_value: "", lead_source: "", stage: "NEW LEAD", notes: "",
};

export default function LeadDialog({ open, onOpenChange, lead, defaultStage, onSaved }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const editing = !!lead;

  useEffect(() => {
    if (open) setForm(lead ? { ...empty, ...lead } : { ...empty, stage: defaultStage || "NEW LEAD" });
  }, [open, lead, defaultStage]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.business_name.trim()) { toast.error("Business name is required"); return; }
    setSaving(true);
    try {
      const payload = { ...form, expected_value: Number(form.expected_value || 0) };
      const res = editing ? await api.put(`/leads/${lead.id}`, payload) : await api.post("/leads", payload);
      toast.success(editing ? "Lead updated" : "Lead added");
      onSaved?.(res.data);
      onOpenChange(false);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#09090B] border-[#27272A] text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-white">{editing ? "Edit Lead" : "Add Lead"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Business Name" className="sm:col-span-2"><TextInput testId="lead-business-input" value={form.business_name} onChange={set("business_name")} /></Field>
          <Field label="Contact Person"><TextInput value={form.contact_person} onChange={set("contact_person")} /></Field>
          <Field label="Phone"><TextInput value={form.phone} onChange={set("phone")} /></Field>
          <Field label="Email"><TextInput value={form.email} onChange={set("email")} /></Field>
          <Field label="Potential Service"><TextInput value={form.potential_service} onChange={set("potential_service")} /></Field>
          <Field label="Expected Value"><NumberInput value={form.expected_value} onChange={set("expected_value")} /></Field>
          <Field label="Lead Source"><TextInput value={form.lead_source} onChange={set("lead_source")} /></Field>
          <Field label="Stage"><SelectInput testId="lead-stage-select" options={PIPELINE_STAGES} value={form.stage} onChange={set("stage")} /></Field>
          <Field label="Notes" className="sm:col-span-2"><TextArea value={form.notes} onChange={set("notes")} /></Field>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="rounded-md border border-[#27272A] px-4 py-2 text-sm text-zinc-300 hover:bg-[#18181B] transition-colors">Cancel</button>
          <button data-testid="lead-save-button" onClick={submit} disabled={saving} className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-[#c99d2a] transition-colors disabled:opacity-60">{saving ? "Saving..." : "Save Lead"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
