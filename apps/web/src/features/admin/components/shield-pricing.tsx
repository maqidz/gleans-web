"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FileText, Files, Layers, Save, ShieldCheck } from "lucide-react";
import { Button } from "@gleans/ui/button";
import { Input } from "@gleans/ui/input";
import { formatRupiah } from "@/lib/format";
import { MAX_SHIELD_PRICE, PLANS, type ShieldPricing } from "@/lib/plans";

const packageIcons = { starter: FileText, standart: Files, premium: Layers };
const priceColumns = "sm:grid-cols-[minmax(0,1fr)_8rem_minmax(9rem,12rem)] sm:gap-6";

function makeDraft({ price, packages }: ShieldPricing) {
  return { price: String(price), starter: String(packages.starter), standart: String(packages.standart), premium: String(packages.premium) };
}

export function AdminShieldPricing() {
  const [pricing, setPricing] = useState<ShieldPricing | null>(null);
  const [draft, setDraft] = useState({ price: "", starter: "", standart: "", premium: "" });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsReload, setNeedsReload] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/shield-pricing", { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (signal?.aborted) return;
      setPricing(data);
      setDraft(makeDraft(data));
      setNeedsReload(false);
    } catch (reason) {
      if (!signal?.aborted) setError(reason instanceof Error ? reason.message : "Harga Shield belum dapat dimuat.");
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const next: ShieldPricing = {
    price: Number(draft.price),
    packages: { starter: Number(draft.starter), standart: Number(draft.standart), premium: Number(draft.premium) },
  };
  const changed = pricing != null && (next.price !== pricing.price || PLANS.some(plan => next.packages[plan.id] !== pricing.packages[plan.id]));
  const canSave = changed && !busy && !needsReload
    && [next.price, ...Object.values(next.packages)].every(value => Number.isInteger(value) && value >= 1 && value <= MAX_SHIELD_PRICE);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/shield-pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricing: next, previous: pricing }),
      });
      const data = await response.json();
      if (response.status === 409) setNeedsReload(true);
      if (!response.ok) throw new Error(data.error);
      setPricing(data);
      setDraft(makeDraft(data));
      setNotice("Tarif Shield berhasil disimpan.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Harga Shield belum dapat disimpan.");
    } finally {
      setBusy(false);
    }
  }

  const rates = pricing ? [
    { key: "price" as const, name: "Tarif per dokumen", detail: "1 pemeriksaan", price: pricing.price, icon: ShieldCheck, label: "Harga per dokumen (Rp)" },
    ...PLANS.map(plan => ({
      key: plan.id,
      name: plan.name,
      detail: plan.checks + " pemeriksaan",
      price: pricing.packages[plan.id],
      icon: packageIcons[plan.id],
      label: "Harga " + plan.name + " (Rp)",
    })),
  ] : [];

  return <>
    <header className="mb-7">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Paket &amp; Harga</h1>
      <p className="mt-2 text-sm text-muted-foreground">Kelola tarif satuan dan paket pemeriksaan Gleans Shield.</p>
    </header>
    <section aria-labelledby="shield-pricing-title" className="overflow-hidden rounded-[24px] border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b px-4 py-5 sm:px-6">
        <div className="min-w-0">
          <h2 id="shield-pricing-title" className="font-semibold">Harga Gleans Shield</h2>
          <p className="mt-1 text-sm text-muted-foreground">Harga yang disimpan berlaku untuk pembelian baru.</p>
          {notice && <p role="status" className="mt-2 text-sm text-primary">{notice}</p>}
          {!notice && changed && <p className="mt-2 text-sm text-muted-foreground">Ada perubahan yang belum disimpan.</p>}
        </div>
        {pricing != null && <div className="ml-auto flex flex-wrap items-center gap-2">
          {changed && !needsReload && <Button type="button" variant="ghost" size="pill-sm" disabled={busy} onClick={() => { setDraft(makeDraft(pricing)); setError(""); }}>Batal</Button>}
          <Button type="submit" form="shield-pricing-form" size="pill-sm" disabled={!canSave}><Save aria-hidden="true" />{busy ? "Menyimpan…" : "Simpan harga"}</Button>
        </div>}
      </div>
      {pricing == null && busy && <p role="status" className="px-5 py-8 text-sm text-muted-foreground">Memuat tarif Shield…</p>}
      {pricing != null && <form id="shield-pricing-form" onSubmit={save}>
        <div aria-hidden="true" className={"hidden items-center border-b bg-surface px-6 py-3 text-xs font-medium text-muted-foreground sm:grid " + priceColumns}>
          <span>Layanan</span><span>Harga aktif</span><span>Harga baru</span>
        </div>
        <ul className="divide-y">
          {rates.map(rate => <li key={rate.key} className={"grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-4 px-4 py-4 sm:px-6 " + priceColumns}>
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <rate.icon aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{rate.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{rate.detail}</p>
              </div>
            </div>
            <p className="text-right text-sm font-semibold whitespace-nowrap tabular-nums sm:text-left">
              <span className="mb-0.5 block text-xs font-normal text-muted-foreground sm:hidden">Harga aktif</span>
              {formatRupiah(rate.price)}
            </p>
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor={"rate-" + rate.key} className="mb-1.5 block text-xs font-medium text-muted-foreground sm:sr-only">
                <span className="sm:hidden" aria-hidden="true">Harga baru</span><span className="sr-only">{rate.label}</span>
              </label>
              <div className="relative">
                <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
                <Input id={"rate-" + rate.key} type="number" inputMode="numeric" min={1} max={MAX_SHIELD_PRICE} step={1} required value={draft[rate.key]}
                  onChange={event => { setDraft(current => ({ ...current, [rate.key]: event.target.value })); setNotice(""); }}
                  disabled={busy || needsReload} className="h-11 rounded-full bg-background pl-9 pr-3 tabular-nums" />
              </div>
            </div>
          </li>)}
        </ul>
      </form>}
      {error && <div className="flex flex-wrap items-center gap-3 border-t px-4 py-4 sm:px-6">
        <p role="alert" className="text-sm text-destructive">{error}</p>
        {(pricing == null || needsReload) && <Button variant="outline" size="pill-sm" disabled={busy} onClick={() => void load()}>Muat ulang harga</Button>}
      </div>}
    </section>
  </>;
}
