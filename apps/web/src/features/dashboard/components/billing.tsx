"use client";

import { useCallback, useEffect, useState } from "react";
import { Layers, Loader2, Plus, Wallet } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@gleans/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@gleans/ui/dialog";
import { BillingRequestError, billingRequest } from "@/features/payments/billing/client";
import { BILLING_ID, MAX_TOPUP, MIN_TOPUP, type BillingSnapshot, type BillingTransaction } from "@/features/payments/billing/types";
import { formatRupiah } from "@/lib/format";
import { PLANS } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { Choice, dateLabel, Empty, fieldClass, Heading, Panel } from "./shared";

type Plan = (typeof PLANS)[number];
type Intent =
  | { kind: "topup"; requestId: string; amount: number }
  | { kind: "package"; requestId: string; planId: Plan["id"]; method: "qris" | "balance"; expectedAmount: number };

const methods = [{ value: "qris", label: "QRIS" }, { value: "balance", label: "Saldo Gleans" }];
const methodLabels = { qris: "QRIS", balance: "Saldo Gleans", quota: "Kuota Shield" };
const statuses = {
  creating: "Transaksi belum dikonfirmasi",
  pending: "Menunggu pembayaran",
  paid: "Berhasil",
  failed: "Gagal",
  expired: "Kedaluwarsa",
};

function transactionTitle(transaction: BillingTransaction) {
  if (transaction.kind === "topup") return "Top-up Saldo Gleans";
  if (transaction.kind === "shield") return "Pesanan Gleans Shield";
  return `Paket Shield ${PLANS.find(plan => plan.id === transaction.plan_id)?.name ?? ""}`.trim();
}

export function DashboardBilling() {
  const params = useSearchParams();
  const returnedId = params.get("billing");
  const [snapshot, setSnapshot] = useState<BillingSnapshot | null>(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [method, setMethod] = useState<"qris" | "balance">("qris");
  const [filter, setFilter] = useState("all");
  const [topupOpen, setTopupOpen] = useState(false);
  const [amount, setAmount] = useState("25000");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [transaction, setTransaction] = useState<BillingTransaction | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await billingRequest<BillingSnapshot>("", { signal });
      if (!signal?.aborted) { setSnapshot(data); setLoadError(""); }
    } catch (error) {
      if (!signal?.aborted) setLoadError(error instanceof Error ? error.message : "Paket & Saldo belum dapat dimuat.");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    const loadOnFocus = () => void refresh();
    window.addEventListener("focus", loadOnFocus);
    return () => window.removeEventListener("focus", loadOnFocus);
  }, [refresh]);

  const returned = returnedId && BILLING_ID.test(returnedId) ? snapshot?.transactions.find(item => item.id === returnedId) : undefined;
  const current = transaction ?? returned;
  const plan = intent?.kind === "package" ? PLANS.find(item => item.id === intent.planId) : undefined;
  const history = snapshot?.transactions.filter(item => filter === "all" || item.kind === filter) ?? [];
  const amountNumber = Number(amount);
  const validTopup = Number.isInteger(amountNumber) && amountNumber >= MIN_TOPUP && amountNumber <= MAX_TOPUP;

  function openTopup(value = 25_000) {
    setActionError("");
    setAmount(String(value));
    setTopupOpen(true);
  }

  function closePayment() {
    if (busy) return;
    setIntent(null);
    setTransaction(null);
    setActionError("");
    if (returnedId) {
      const url = new URL(window.location.href);
      url.searchParams.delete("billing");
      window.history.replaceState(null, "", url);
    }
  }

  async function purchase() {
    if (!intent || busy) return;
    setBusy(true);
    setActionError("");
    try {
      const result = await billingRequest<{ transaction: BillingTransaction }>("", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(intent),
      });
      setIntent(null);
      setTransaction(result.transaction);
    } catch (error) {
      if (error instanceof BillingRequestError && error.updatedPrice != null && intent.kind === "package") {
        setIntent({ ...intent, expectedAmount: error.updatedPrice });
      }
      setActionError(error instanceof Error ? error.message : "Transaksi belum dapat diproses.");
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  async function check() {
    if (!current || busy) return;
    setBusy(true);
    setActionError("");
    try {
      const data = await billingRequest<{ transaction: BillingTransaction }>(`/${encodeURIComponent(current.id)}`, { method: "POST" });
      setTransaction(data.transaction);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Status belum dapat diperiksa.");
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  return (
    <>
      <Heading title="Paket & Saldo" description="Isi saldo atau beli kuota pemeriksaan Gleans Shield." />
      <p className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Duitku Sandbox. Saldo dan kuota di halaman ini hanya untuk pengujian.</p>
      {loadError && <div className="mb-5 flex flex-wrap items-center gap-3" role="alert"><span className="text-sm text-destructive">{loadError}</span><Button size="pill-sm" variant="outline" onClick={() => void refresh()}>Muat ulang</Button></div>}
      <div className="grid gap-4 md:grid-cols-2">
        <Panel className="border bg-white">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Wallet aria-hidden="true" className="size-5" />TOTAL SALDO</div>
          <p className="mt-4 text-3xl font-semibold">{snapshot ? formatRupiah(snapshot.balance) : "—"}</p>
          <Button size="pill-sm" className="mt-5" disabled={!snapshot} onClick={() => openTopup()}><Plus aria-hidden="true" />Isi saldo</Button>
        </Panel>
        <Panel className="border bg-white">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Layers aria-hidden="true" className="size-5" />TOTAL KUOTA</div>
          <p className="mt-4 text-2xl font-semibold">{snapshot ? `${snapshot.quota} pemeriksaan` : "—"}</p>
        </Panel>
      </div>
      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Pilih paket Shield</h2>
          <Choice label="Metode pembelian paket" value={method} onChange={value => setMethod(value === "balance" ? "balance" : "qris")} options={methods} />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map(item => {
            const price = snapshot?.packagePrices[item.id];
            const insufficient = snapshot && price != null && method === "balance" && snapshot.balance < price;
            return (
              <Panel key={item.id} className="flex flex-col border bg-white">
                <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{item.name}</h3><span className="text-xs text-primary">{item.checks}x cek</span></div>
                <p className="mt-6 text-2xl font-semibold">{price == null ? "—" : formatRupiah(price)}</p>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">{item.blurb}</p>
                {insufficient ? (
                  <>
                    <p className="mt-4 text-xs text-muted-foreground">Saldo belum cukup.</p>
                    <Button size="pill-sm" variant="outline" className="mt-3" onClick={() => openTopup(Math.max(MIN_TOPUP, price - snapshot.balance))}>Isi saldo</Button>
                  </>
                ) : (
                  <Button size="pill-sm" className="mt-6" disabled={price == null} onClick={() => {
                    if (price == null) return;
                    setActionError("");
                    setIntent({ kind: "package", requestId: crypto.randomUUID(), planId: item.id, method, expectedAmount: price });
                  }}>Pilih {item.name}</Button>
                )}
              </Panel>
            );
          })}
        </div>
      </section>
      <section aria-label="Riwayat transaksi" className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Riwayat transaksi</h2>
          <Choice label="Filter transaksi" value={filter} onChange={setFilter} options={[{ value: "all", label: "Semua" }, { value: "topup", label: "Top-up" }, { value: "package", label: "Paket" }, { value: "shield", label: "Pesanan Shield" }]} />
        </div>
        {!snapshot && !loadError && <p role="status" className="text-sm text-muted-foreground">Memuat riwayat transaksi…</p>}
        {snapshot && (history.length ? (
          <ul className="space-y-2">
            {history.map(item => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{transactionTitle(item)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{dateLabel(item.created_at)} · {methodLabels[item.method]}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-medium">{item.method === "quota" ? "−1 kuota" : formatRupiah(item.amount)}</p>
                    <p className="text-xs text-muted-foreground">{statuses[item.status]}</p>
                  </div>
                  {item.method === "qris" && ["creating", "pending"].includes(item.status) && <Button size="pill-sm" variant="outline" onClick={() => { setActionError(""); setTransaction(item); }}>Lihat pembayaran</Button>}
                </div>
              </li>
            ))}
          </ul>
        ) : <Empty title="Belum ada transaksi" description="Top-up, pembelian paket, dan penggunaan saldo atau kuota akan muncul di sini." />)}
      </section>
      <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
        <DialogContent className="rounded-[24px]">
          <DialogHeader><DialogTitle>Isi saldo</DialogTitle><DialogDescription>Top-up melalui QRIS Duitku Sandbox.</DialogDescription></DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {[25_000, 50_000, 100_000].map(value => <button type="button" aria-pressed={amountNumber === value} key={value} onClick={() => setAmount(String(value))} className={cn("rounded-xl border bg-white px-2 py-3 text-xs", amountNumber === value && "border-primary bg-accent text-primary")}>{formatRupiah(value)}</button>)}
          </div>
          <form className="space-y-3" onSubmit={event => {
            event.preventDefault();
            if (!validTopup) return;
            setTopupOpen(false);
            setIntent({ kind: "topup", amount: amountNumber, requestId: crypto.randomUUID() });
          }}>
            <label className="block text-sm" htmlFor="topup">Nominal lainnya</label>
            <input id="topup" type="number" min={MIN_TOPUP} max={MAX_TOPUP} step={1} required value={amount} onChange={event => setAmount(event.target.value)} className={fieldClass} />
            <Button type="submit" size="pill" className="w-full" disabled={!validTopup}>Lanjutkan</Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!intent || !!current} onOpenChange={open => { if (!open) closePayment(); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-[24px]" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>{current ? transactionTitle(current) : plan ? `Paket Shield ${plan.name}` : "Top-up Saldo Gleans"}</DialogTitle>
            <DialogDescription>{current ? current.id : plan && intent?.kind === "package" && intent.method === "balance" ? "Total akan dipotong dari Saldo Gleans Sandbox." : "Pembayaran melalui QRIS Duitku Sandbox."}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3 text-sm font-semibold">
            <span>Total</span><span>{formatRupiah(current?.amount ?? (intent?.kind === "topup" ? intent.amount : intent?.expectedAmount ?? 0))}</span>
          </div>
          {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
          {current ? (
            <>
              <p role="status" className="text-center text-sm">{statuses[current.status]}</p>
              {current.status === "pending" && current.qr_string && <QRCodeSVG value={current.qr_string} size={220} marginSize={4} title="QRIS pembayaran Sandbox Duitku" role="img" className="mx-auto h-auto max-w-full" />}
              {current.status === "pending" && current.payment_url && <Button asChild size="pill"><a href={current.payment_url} target="_blank" rel="noreferrer">Buka Halaman QRIS Duitku</a></Button>}
              {["pending", "creating"].includes(current.status) && <Button size="pill" variant="outline" disabled={busy} onClick={() => void check()}>{busy && <Loader2 aria-hidden="true" className="motion-safe:animate-spin" />}Periksa Status Pembayaran</Button>}
            </>
          ) : <Button size="pill" disabled={!intent || busy} onClick={() => void purchase()}>{busy && <Loader2 aria-hidden="true" className="motion-safe:animate-spin" />}Bayar Sekarang</Button>}
        </DialogContent>
      </Dialog>
    </>
  );
}
