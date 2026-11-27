"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleCheck, Layers, Loader2, Plus, QrCode, Wallet } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@gleans/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@gleans/ui/dialog";
import { BillingRequestError, billingRequest } from "@/features/payments/billing/client";
import { BILLING_ID, MAX_TOPUP, MIN_TOPUP, type BillingSnapshot, type BillingTransaction } from "@/features/payments/billing/types";
import { formatRupiah } from "@/lib/format";
import { PLANS, planBenefits, type PackagePrices } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { Choice, dateLabel, Empty, fieldClass, Heading, Panel } from "./shared";

type Plan = (typeof PLANS)[number];
type Intent =
  | { kind: "topup"; requestId: string; amount: number }
  | { kind: "package"; requestId: string; planId: Plan["id"]; method: "qris" | "balance"; expectedAmount: number };

const methods = [{ value: "qris", label: "QRIS", icon: QrCode }, { value: "balance", label: "Saldo Gleans", icon: Wallet }] as const;
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

export function DashboardBilling({ initialPackagePrices }: { initialPackagePrices: PackagePrices }) {
  const params = useSearchParams();
  const returnedId = params.get("billing");
  const [snapshot, setSnapshot] = useState<BillingSnapshot | null>(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
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
  const insufficientBalance = intent?.kind === "package" && intent.method === "balance" && (snapshot?.balance ?? 0) < intent.expectedAmount;

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
    if (!intent || busy || insufficientBalance) return;
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
      {loadError && <div className="mb-5 flex flex-wrap items-center gap-3" role="alert"><span className="text-sm text-destructive">{loadError}</span><Button size="pill-sm" variant="outline" onClick={() => void refresh()}>Muat ulang</Button></div>}
      <div className="grid gap-4 md:grid-cols-2">
        <Panel className="border bg-white">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Wallet aria-hidden="true" className="size-5" />TOTAL SALDO</div>
          <p className="mt-4 text-3xl font-semibold">{formatRupiah(snapshot?.balance ?? 0)}</p>
          <Button size="pill-sm" className="mt-5" onClick={() => openTopup()}><Plus aria-hidden="true" />Isi saldo</Button>
        </Panel>
        <Panel className="border bg-white">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Layers aria-hidden="true" className="size-5" />TOTAL KUOTA</div>
          <p className="mt-4 text-2xl font-semibold">{snapshot?.quota ?? 0}</p>
        </Panel>
      </div>
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">Pilih paket Shield</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map(item => {
            const price = snapshot?.packagePrices[item.id] ?? initialPackagePrices[item.id];
            return (
              <Panel key={item.id} className="flex flex-col border bg-white">
                <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{item.name}</h3><span className="text-xs text-primary">{item.checks}x cek</span></div>
                <p className="mt-6 text-2xl font-semibold">{formatRupiah(price)}</p>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">{item.blurb}</p>
                <ul aria-label={`Benefit paket ${item.name}`} className="mt-5 space-y-1.5 text-xs leading-relaxed">
                  {planBenefits(item).map(benefit => (
                    <li key={benefit} className="flex items-start gap-2">
                      <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 fill-primary text-white" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
                <Button size="pill-sm" className="mt-6" onClick={() => {
                  setActionError("");
                  setIntent({ kind: "package", requestId: crypto.randomUUID(), planId: item.id, method: "qris", expectedAmount: price });
                }}>Pilih {item.name}</Button>
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
        {snapshot && <div role="region" aria-label="Tabel riwayat transaksi" tabIndex={0} className="overflow-x-auto rounded-[24px] border bg-white outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <table className="w-full min-w-[900px] text-left text-sm">
            <caption className="sr-only">Riwayat top-up, pembelian paket, dan penggunaan saldo atau kuota Gleans.</caption>
            <thead className="bg-surface text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-4 font-medium">TRANSAKSI</th>
                <th scope="col" className="px-4 py-4 font-medium">TANGGAL</th>
                <th scope="col" className="px-4 py-4 font-medium">METODE</th>
                <th scope="col" className="px-4 py-4 text-right font-medium">NOMINAL</th>
                <th scope="col" className="px-4 py-4 font-medium">STATUS</th>
                <th scope="col" className="px-4 py-4 text-right font-medium">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.map(item => (
                <tr key={item.id} className="hover:bg-surface/50">
                  <td className="px-4 py-4">
                    <p className="font-medium">{transactionTitle(item)}</p>
                    <p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">{item.id}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{dateLabel(item.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-4">{methodLabels[item.method]}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-right font-medium tabular-nums">{item.method === "quota" ? "−1 kuota" : formatRupiah(item.amount)}</td>
                  <td className="px-4 py-4">
                    <span className={cn("inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs", item.status === "paid" ? "bg-emerald-50 text-emerald-700" : item.status === "failed" || item.status === "expired" ? "bg-red-50 text-red-700" : item.status === "pending" ? "bg-accent text-primary" : "bg-surface text-muted-foreground")}>{statuses[item.status]}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right">
                    {item.method === "qris" && ["creating", "pending"].includes(item.status) && <Button size="pill-sm" variant="outline" onClick={() => { setActionError(""); setTransaction(item); }}>Lihat pembayaran</Button>}
                  </td>
                </tr>
              ))}
              {!history.length && <tr><td colSpan={6}><Empty title="Belum ada transaksi" description="Top-up, pembelian paket, dan penggunaan saldo atau kuota akan muncul di sini." /></td></tr>}
            </tbody>
          </table>
        </div>}
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
            <DialogDescription>{current ? current.id : plan ? `${plan.checks} kuota pemeriksaan Gleans Shield.` : "Pembayaran melalui QRIS Duitku Sandbox."}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3 text-sm font-semibold">
            <span>Total</span><span>{formatRupiah(current?.amount ?? (intent?.kind === "topup" ? intent.amount : intent?.expectedAmount ?? 0))}</span>
          </div>
          {!current && intent?.kind === "package" && <>
            <fieldset disabled={busy} aria-describedby={insufficientBalance ? "package-balance-error" : undefined} className="min-w-0 space-y-2">
              <legend className="mb-3 text-sm font-medium">Metode pembayaran</legend>
              {methods.map(option => (
                <label key={option.value} className={cn("flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-primary", intent.method === option.value ? "border-primary bg-accent" : "bg-white hover:bg-surface", busy && "cursor-wait opacity-60", option.value === "balance" && !snapshot && "cursor-wait opacity-60")}>
                  <option.icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{option.value === "balance" ? snapshot ? `Saldo tersedia ${formatRupiah(snapshot.balance)}` : "Memuat saldo…" : "Scan QRIS untuk membayar"}</span>
                  </span>
                  <input type="radio" name="package-payment-method" value={option.value} checked={intent.method === option.value} disabled={option.value === "balance" && !snapshot} onChange={() => {
                    setActionError("");
                    setIntent(previous => previous?.kind === "package" ? { ...previous, method: option.value } : previous);
                  }} className="size-4 shrink-0 accent-primary" />
                </label>
              ))}
            </fieldset>
            {insufficientBalance && <div className="rounded-2xl bg-surface p-3">
              <p id="package-balance-error" className="text-sm text-muted-foreground">Saldo belum cukup. Pilih QRIS atau isi saldo terlebih dahulu.</p>
              <Button size="pill-sm" variant="outline" className="mt-3" disabled={busy} onClick={() => {
                const shortfall = Math.max(MIN_TOPUP, intent.expectedAmount - (snapshot?.balance ?? 0));
                closePayment();
                openTopup(shortfall);
              }}>Isi saldo</Button>
            </div>}
          </>}
          {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
          {current ? (
            <>
              <p role="status" className="text-center text-sm">{statuses[current.status]}</p>
              {current.status === "pending" && current.qr_string && <QRCodeSVG value={current.qr_string} size={220} marginSize={4} title="QRIS pembayaran Sandbox Duitku" role="img" className="mx-auto h-auto max-w-full" />}
              {current.status === "pending" && current.payment_url && <Button asChild size="pill"><a href={current.payment_url} target="_blank" rel="noreferrer">Buka Halaman QRIS Duitku</a></Button>}
              {["pending", "creating"].includes(current.status) && <Button size="pill" variant="outline" disabled={busy} onClick={() => void check()}>{busy && <Loader2 aria-hidden="true" className="motion-safe:animate-spin" />}Periksa Status Pembayaran</Button>}
            </>
          ) : <Button size="pill" disabled={!intent || busy || insufficientBalance} onClick={() => void purchase()}>{busy && <Loader2 aria-hidden="true" className="motion-safe:animate-spin" />}Bayar Sekarang</Button>}
        </DialogContent>
      </Dialog>
    </>
  );
}
