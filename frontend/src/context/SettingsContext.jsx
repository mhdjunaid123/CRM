import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({ agency_name: "MARKLENCEMEDIA Advertising & Ad Agency", currency: "INR" });

  const refresh = useCallback(() => {
    api.get("/settings").then((r) => setSettings(r.data)).catch(() => {});
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = async (updates) => {
    const { data } = await api.put("/settings", updates);
    setSettings(data);
    return data;
  };

  return (
    <SettingsContext.Provider value={{ settings, currency: settings.currency || "INR", save, refresh }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
