import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Field, TextInput, TextArea, DateInput, SelectInput } from "@/components/FormControls";
import { api, formatApiErrorDetail } from "@/lib/api";
import { CLIENT_STATUSES } from "@/lib/format";
import { toast } from "sonner";

const empty = {
  client_name: "", business_name: "", contact_person: "", phone: "", whatsapp: "",
  email: "", business_category: "", location: "", website: "", lead_source: "",
  status: "ACTIVE", start_date: "", notes: "",
};

function toDateInput(iso) {
  if (!iso) return "";
  try { return new Date(iso).toISOString().slice(0, 10); } catch { return ""; }
}

export default function ClientDialog({ open, onOpenChange, client, onSaved }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const editing = !!client;

  useEffect(() => {
    if (open) {
      setForm(client ? { ...empty, ...client, start_date: toDateInput(client.start_date) } : empty);
    }
  }, [open, client]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.client_name.trim()) { toast.error("Client name is required"); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.start_date) payload.start_date = new Date(payload.start_date).toISOString();
      else delete payload.start_date;
      const res = editing
        ? await api.put(`/clients/${client.id}`, payload)
        : await api.post("/clients", payload);
      toast.success(editing ? "Client updated" : "Client added");
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
      <DialogContent className="bg-[#09090B] border-[#27272A] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-white">{editing ? "Edit Client" : "Add Client"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Client Name"><TextInput testId="client-name-input" value={form.client_name} onChange={set("client_name")} /></Field>
          <Field label="Business Name"><TextInput testId="client-business-input" value={form.business_name} onChange={set("business_name")} /></Field>
          <Field label="Contact Person"><TextInput value={form.contact_person} onChange={set("contact_person")} /></Field>
          <Field label="Phone"><TextInput testId="client-phone-input" value={form.phone} onChange={set("phone")} /></Field>
          <Field label="WhatsApp"><TextInput value={form.whatsapp} onChange={set("whatsapp")} /></Field>
          <Field label="Email"><TextInput testId="client-email-input" value={form.email} onChange={set("email")} /></Field>
          <Field label="Business Category"><TextInput value={form.business_category} onChange={set("business_category")} /></Field>
          <Field label="Location"><TextInput value={form.location} onChange={set("location")} /></Field>
          <Field label="Website"><TextInput value={form.website} onChange={set("website")} /></Field>
          <Field label="Lead Source"><TextInput value={form.lead_source} onChange={set("lead_source")} /></Field>
          <Field label="Status"><SelectInput testId="client-status-select" options={CLIENT_STATUSES} value={form.status} onChange={set("status")} /></Field>
          <Field label="Client Start Date"><DateInput value={form.start_date} onChange={set("start_date")} /></Field>
          <Field label="Notes" className="sm:col-span-2"><TextArea value={form.notes} onChange={set("notes")} /></Field>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="rounded-md border border-[#27272A] px-4 py-2 text-sm text-zinc-300 hover:bg-[#18181B] transition-colors">Cancel</button>
          <button data-testid="client-save-button" onClick={submit} disabled={saving} className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-black hover:bg-[#c99d2a] transition-colors disabled:opacity-60">{saving ? "Saving..." : "Save Client"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
