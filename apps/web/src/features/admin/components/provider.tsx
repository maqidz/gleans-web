"use client";
import { createContext, useContext, useEffect, useCallback, useState, type ReactNode } from "react";
import { type AdminState, type Collection, type RecordData } from "@/features/admin/lib/model";
import { emptyAdminState } from "../lib/live-data";
import { ORDER_ARRIVED_EVENT } from "../lib/order-alerts";
const Context = createContext<{ state: AdminState; adminEmail: string; ready: boolean; error: string; limited: boolean; refresh: () => Promise<void>; save: (collection: Collection, record: RecordData, reason?: string) => void; configure: (settings: AdminState["settings"]) => void; invite: (member:{name:string;email:string;role:"Editor"|"Operator"})=>void; log:(action:string,object:string)=>void; revoke:(id:string)=>void; clearActivity:()=>void; reset: () => void } | null>(null);
function unavailable(): never { throw new Error("Fitur ini belum terhubung ke server. Tidak ada perubahan yang disimpan."); }
export function AdminProvider({children,email}:{children:ReactNode;email:string}) {
  const [state,setState]=useState(emptyAdminState); const [ready,setReady]=useState(false); const [error,setError]=useState(""); const [limited,setLimited]=useState(false);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/overview", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Data admin belum dapat dimuat.");
      setState(data.state); setLimited(data.limited); setError("");
    } catch (cause) { setState(emptyAdminState()); setError(cause instanceof Error ? cause.message : "Data admin belum dapat dimuat."); }
    finally { setReady(true); }
  }, []);
  useEffect(() => { void refresh(); const listener = () => { void refresh(); }; window.addEventListener(ORDER_ARRIVED_EVENT, listener); return () => window.removeEventListener(ORDER_ARRIVED_EVENT, listener); }, [refresh]);
  return <Context.Provider value={{state,adminEmail:email,ready,error,limited,refresh,save:unavailable,configure:unavailable,revoke:unavailable,invite:unavailable,log:unavailable,clearActivity:unavailable,reset:unavailable}}>{children}</Context.Provider>;
}
export function useAdmin(){const value=useContext(Context);if(!value)throw new Error("Admin provider missing");return value;}
