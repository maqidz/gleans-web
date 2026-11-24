"use client";

import { useState } from "react";
import { BarChart3, Eye, EyeOff, Gauge, KeyRound, Layers3, PlugZap, Unplug } from "lucide-react";
import { Button } from "@gleans/ui/button";

const metrics = [
  { label: "TOTAL KATA TERPAKAI", icon: BarChart3 },
  { label: "TOTAL KUOTA KATA", icon: Layers3 },
  { label: "TOTAL SISA KUOTA KATA", icon: Gauge },
];

export function GptzeroUsage() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  return <div className="min-w-0 space-y-5">
    <section className="min-w-0 rounded-[24px] border bg-background p-4 sm:p-5" aria-labelledby="gptzero-config-title">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-primary" aria-hidden="true"><KeyRound className="size-5" /></span>
        <div><h2 id="gptzero-config-title" className="font-semibold">Konfigurasi GPTZero</h2><p className="mt-1 text-xs text-muted-foreground">Hubungkan API key untuk memantau penggunaan GPTZero.</p></div>
      </div>
      <div className="mt-5">
        <label htmlFor="gptzero-api-key" className="mb-2 block text-sm font-medium">API key</label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <input id="gptzero-api-key" type={showKey ? "text" : "password"} value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="Masukkan API key GPTZero" autoComplete="off" autoCapitalize="none" spellCheck={false} className="h-11 w-full rounded-full border bg-background pl-4 pr-12 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" />
            <button type="button" aria-label={showKey ? "Sembunyikan API key" : "Tampilkan API key"} aria-pressed={showKey} onClick={() => setShowKey(value => !value)} className="absolute inset-y-0 right-1 my-auto grid size-9 place-items-center rounded-full text-muted-foreground outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-primary">{showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
          </div>
          <Button type="button" size="pill-sm" className="h-11" disabled title="Penerapan API belum tersedia"><PlugZap aria-hidden="true" />Terapkan API</Button>
        </div>
      </div>
    </section>
    <section className="min-w-0 overflow-hidden rounded-[24px] border bg-background" aria-labelledby="gptzero-usage-title">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b p-4 sm:p-5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-primary" aria-hidden="true"><Gauge className="size-5" /></span>
        <div className="min-w-0"><h2 id="gptzero-usage-title" className="font-semibold">Penggunaan API GPTZero</h2><p className="mt-1 text-xs text-muted-foreground">Pantau pemakaian dan kuota kata pada periode berjalan.</p></div>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs text-muted-foreground"><Unplug className="size-3.5" aria-hidden="true" />Belum terhubung</span>
    </div>
    <div className="space-y-5 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {metrics.map(({ label, icon: Icon }) => <div key={label} className="min-w-0 rounded-2xl bg-surface p-4">
          <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{label}</p><Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /></div>
          <p className="mt-4 text-2xl font-semibold" aria-label={`${label}: 0, API belum terhubung`}>0</p>
        </div>)}
      </div>
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-medium">Pemakaian kuota</span><span className="text-muted-foreground">Belum tersedia</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true" />
      </div>

    </div>
    </section>
  </div>;
}
