import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";
import { CURRENCY_SYMBOLS } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { LOGO_URL } from "@/lib/api";
import { toast } from "sonner";

export default function Settings() {
  const { settings, save, refresh } = useSettings();
  const { user } = useAuth();
  const [agencyName, setAgencyName] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAgencyName(settings.agency_name || "");
    setCurrency(settings.currency || "INR");
  }, [settings]);

  const submit = async () => {
    setSaving(true);
    try {
      await save({ agency_name: agencyName, currency });
      refresh();
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl" data-testid="settings-page">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">Configure your agency preferences</p>
      </div>

      <div className="rounded-lg border border-[#27272A] bg-[#09090B] p-6 space-y-5">
        <div className="flex items-center gap-4 pb-4 border-b border-[#27272A]">
          <img src={LOGO_URL} alt="logo" className="h-16 w-16 rounded-md object-contain" />
          <div>
            <div className="text-sm font-semibold text-white">Agency Logo</div>
            <div className="text-xs text-zinc-500">Official MARKLENCEMEDIA logo (used across the CRM & invoices)</div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">Agency Name</label>
          <input data-testid="settings-agency-name" value={agencyName} onChange={(e) => setAgencyName(e.target.value)}
            className="w-full rounded-md bg-black border border-[#27272A] px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-gold focus:outline-none" />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">Currency</label>
          <select data-testid="settings-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-md bg-black border border-[#27272A] px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-gold focus:outline-none">
            <option value="INR" className="bg-[#09090B]">INR — Indian Rupee ({CURRENCY_SYMBOLS.INR})</option>
            <option value="USD" className="bg-[#09090B]">USD — US Dollar ({CURRENCY_SYMBOLS.USD})</option>
            <option value="EUR" className="bg-[#09090B]">EUR — Euro ({CURRENCY_SYMBOLS.EUR})</option>
          </select>
        </div>

        <div className="pt-2">
          <button data-testid="settings-save" onClick={submit} disabled={saving}
            className="rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#c99d2a] transition-colors disabled:opacity-60">
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-[#27272A] bg-[#09090B] p-6">
        <div className="text-sm font-semibold text-white mb-3">User Profile</div>
        <div className="text-sm text-zinc-400">Signed in as <span className="text-white font-medium">{user?.email}</span></div>
        <div className="text-xs text-zinc-500 mt-1">Role: {user?.role}</div>
      </div>
    </div>
  );
}
