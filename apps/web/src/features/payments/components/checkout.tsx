"use client";
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Check, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@gleans/ui/button";
import { PRODUCTS } from "@/config/site";
import { formatRupiah } from "@/lib/format";
import type { PaymentOrder } from "../types";
import { clearCheckoutTransition, getCheckoutTransition, requestPaymentAction, ShieldPriceChanged, startCheckoutTransition, type CheckoutPreview } from "../checkout-transition";
const labels = { draft: "Belum dibayar", creating: "Transaksi belum dikonfirmasi", pending: "Menunggu Pembayaran", paid: "Pembayaran Berhasil", failed: "Pembayaran Gagal", expired: "Pembayaran Kedaluwarsa" };
export function PaymentCheckout() {
  const params = useSearchParams();
  const id = params.get("order");
  const requestId = params.get("checkout");
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [requotedAmount, setRequotedAmount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    if (!id) { setLoaded(true); return; }
    try {
      const code = new URLSearchParams(window.location.hash.slice(1)).get("access");
      if (code) {
        const restored = await fetch(`/api/payments/orders/${encodeURIComponent(id)}/access`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
        if (!restored.ok) throw new Error("Tautan akses tidak valid. Gunakan kode akses yang disimpan saat memesan.");
        window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
      }
      const response = await fetch(`/api/payments/orders/${encodeURIComponent(id)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setOrder(body.order); setError("");

    } catch (error) { setError(error instanceof Error ? error.message : "Tidak dapat memuat pembayaran."); }
    finally { setLoaded(true); }
  }, [id]);
  useEffect(() => {
    // Explicit recovery links always run through access verification.
    const transition = window.location.hash ? undefined : getCheckoutTransition(id, requestId);
    if (!transition) {
      setPreview(null);
      if (!id && requestId) {
        setError("Buka kembali formulir untuk melanjutkan pesanan.");
        setLoaded(true);
        setBusy(false);
      } else {
        void load();
      }
      return;
    }
    let active = true;
    setPreview(transition.preview);
    setBusy(true);
    setError("");
    setRequotedAmount(null);
    if (!id) {
      void transition.reservation.then(reserved => {
        if (!active) return;
        setOrder(reserved);
        window.history.replaceState(null, "", `/pembayaran?order=${encodeURIComponent(reserved.id)}`);
      }, error => {
        if (!active) return;
        if (error instanceof ShieldPriceChanged) setRequotedAmount(error.amount);
        setError(error instanceof Error ? error.message : "Tidak dapat membuka pembayaran.");
        setBusy(false);
      });
      return () => { active = false; };
    }
    setOrder(transition.order ?? null);
    setLoaded(true);
    void transition.result.then(async result => {
      if (!active) return;
      clearCheckoutTransition(id);
      if ("order" in result && result.order.status !== "paid") {
        setOrder({ ...result.order, access_code: transition.order?.access_code });
      } else {
        await load();
        if (active && "error" in result) setError(result.error);
      }
      if (active) setBusy(false);
    });
    return () => { active = false; };
  }, [id, requestId, attempt, load]);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(value => value - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  function retryReservation() {
    const transition = getCheckoutTransition(null, requestId);
    if (!transition || busy) return;
    startCheckoutTransition(transition.requestId, { ...transition.preview, amount: requotedAmount ?? transition.preview.amount }, transition.reserve);
    setAttempt(value => value + 1);
  }
  async function act(action: "pay" | "check") {
    if (!id || busy) return;
    setBusy(true); setError("");
    try {
      const updated = await requestPaymentAction(id, action);
      if (updated.status === "paid") {
        setOrder({ ...updated, access_code: order?.access_code, has_access: order?.has_access, can_download: order?.can_download });
        await load();
      } else {
        setOrder({ ...updated, access_code: order?.access_code, has_access: order?.has_access });
      }
      if (action === "check") setCooldown(30);
    } catch (error) {
      if (action === "pay") await load();
      setError(error instanceof Error ? error.message : "Tidak dapat memproses pembayaran.");
    }
    finally { setBusy(false); }
  }
  async function restoreAccess() {
    if (!id || busy) return; setBusy(true); setError("");
    try {
      const response = await fetch(`/api/payments/orders/${encodeURIComponent(id)}/access`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: recoveryCode.trim() }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error); await load(); setRecoveryCode(""); setNotice("Akses unduh tersimpan di browser ini.");
    } catch (error) { setError(error instanceof Error ? error.message : "Kode akses tidak valid."); } finally { setBusy(false); }
  }
  async function copyAccess() {
    if (!order?.access_code) return;
    try { await navigator.clipboard.writeText(`${window.location.origin}/pembayaran?order=${encodeURIComponent(order.id)}#access=${encodeURIComponent(order.access_code)}`); setNotice("Tautan akses disalin. Simpan secara pribadi untuk mengunduh hasil di perangkat lain."); }
    catch { setNotice(`Simpan kode akses ini secara pribadi: ${order.access_code}`); }
  }
  const summary = order ?? (preview && { ...preview, amount: requotedAmount ?? preview.amount });
  const method = order?.payment_method ?? preview?.method;
  const wallet = method === "balance" || method === "quota";
  const qrCode = order?.status === "pending" ? order.qr_string : null;
  const waitingForQr = !wallet && !error && (
    (!order && !loaded && Boolean(id || requestId)) ||
    (busy && (!order || order.status === "draft"))
  );
  return (
    <PaymentLayout
      title={wallet ? "Pembayaran Gleans Shield" : undefined}
      total={summary ? method === "quota" ? "1 kuota Shield" : formatRupiah(summary.amount) : undefined}
      panelTitle={order?.status === "paid" ? "Hasil pemeriksaan" : wallet ? "Pembayaran" : "Kode QRIS"}
      summary={<>
        {summary && (
          <section aria-labelledby="order-summary-title">
            <h2 id="order-summary-title" className="text-sm font-semibold">Ringkasan Pesanan</h2>
            <dl className="mt-3 space-y-2.5 text-xs sm:text-[13px]">
              <SummaryRow label="Dokumen">{summary.document_name}</SummaryRow>
              <SummaryRow label="Nomor Invoice">{order?.id ?? "—"}</SummaryRow>
              <SummaryRow label="Status">
                <span role="status">{labels[order?.status ?? "draft"]}</span>
              </SummaryRow>
              {order?.expires_at && (
                <SummaryRow label="Batas pembayaran">{new Date(order.expires_at).toLocaleString("id-ID")}</SummaryRow>
              )}
            </dl>
          </section>
        )}
        {!id && !requestId && <p className="text-sm text-muted-foreground">Buat pesanan terlebih dahulu untuk melanjutkan pembayaran.</p>}
        <Link href={order ? "/cek-pesanan" : "/deteksi-ai"} className="self-center text-xs font-medium text-primary hover:underline">
          {order ? "Lihat pesanan saya" : "Buat pesanan"}
        </Link>
      </>}
    >
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="break-all text-sm text-primary">{notice}</p>}
      {wallet && busy && order?.status !== "paid" && !error && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" /> Memverifikasi pembayaran
        </p>
      )}
      {(qrCode || waitingForQr) && (
        <div className="mx-auto w-full max-w-[218px] rounded-2xl border bg-white p-2">
          <div className="grid aspect-square place-items-center">
            {qrCode ? (
              <QRCodeSVG
                value={qrCode}
                size={200}
                marginSize={4}
                level="M"
                title="QRIS pembayaran Sandbox Duitku"
                role="img"
                className="h-auto w-full"
              />
            ) : (
              <div role="status">
                <Loader2 aria-hidden="true" className="size-8 text-primary motion-safe:animate-spin" />
                <span className="sr-only">Memuat kode QRIS</span>
              </div>
            )}
          </div>
        </div>
      )}
      {order?.status === "creating" && (
        <p className="text-sm text-muted-foreground">Transaksi belum dikonfirmasi. Periksa status atau hubungi support dengan nomor invoice.</p>
      )}
      {order?.status === "paid" && (
        <div className="space-y-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-emerald-700">
            <Check className="size-5" aria-hidden="true" /> Pembayaran terverifikasi
          </p>
          <p className="font-medium">{order.fulfillment_status === "completed" ? "Pemeriksaan selesai" : order.fulfillment_status === "processing" ? "Dokumen sedang diperiksa" : order.fulfillment_status === "failed" ? "Pemeriksaan perlu ditinjau" : "Menunggu pemeriksaan"}</p>
          {order.report_expires_at && <p className="text-xs text-muted-foreground">Batas unduh: {new Date(order.report_expires_at).toLocaleString("id-ID")}</p>}
          {order.can_download && <Button asChild size="pill-sm" className="w-full"><a href={`/api/payments/orders/${encodeURIComponent(order.id)}/report`}>Unduh hasil PDF</a></Button>}
          {order.fulfillment_status === "completed" && order.report_expires_at && Date.parse(order.report_expires_at) <= Date.now() && <p className="text-xs text-destructive">Masa unduh 24 jam telah berakhir.</p>}
          {order.access_code ? (
            <Button variant="outline" size="pill-sm" onClick={() => void copyAccess()}>Salin tautan akses</Button>
          ) : order.fulfillment_status === "completed" && !order.has_access && (
            <div className="space-y-2">
              <label htmlFor="order-access" className="block text-xs">Kode akses pesanan (untuk unduh di perangkat lain)</label>
              <input id="order-access" type="password" maxLength={43} spellCheck={false} autoComplete="off" value={recoveryCode} onChange={event => setRecoveryCode(event.target.value)} className="h-10 w-full rounded-xl border bg-white px-3 text-sm" />
              <Button size="pill-sm" variant="outline" disabled={busy || !recoveryCode.trim()} onClick={() => void restoreAccess()}>Buka akses unduh</Button>
            </div>
          )}
          {order.fulfillment_status !== "completed" && <Button variant="outline" size="pill-sm" className="w-full" onClick={() => void load()}>Perbarui status pemeriksaan</Button>}
        </div>
      )}
      {order?.status === "draft" && !busy && <Button size="pill-sm" className="w-full" onClick={() => void act("pay")}>Tampilkan QRIS</Button>}
      {order?.status === "pending" && order.payment_url && (
        <Button asChild size="pill-sm" className="w-full"><a href={order.payment_url} target="_blank" rel="noopener noreferrer">Buka Halaman QRIS Duitku</a></Button>
      )}
      {(order?.status === "pending" || order?.status === "creating") && (
        <Button variant="outline" size="pill-sm" className="w-full" disabled={busy || cooldown > 0} onClick={() => void act("check")}>
          <RotateCcw aria-hidden="true" className={busy ? "motion-safe:animate-spin" : ""} />
          {cooldown ? `Periksa lagi dalam ${cooldown} detik` : "Periksa Status Pembayaran"}
        </Button>
      )}
      {!id && requestId && preview && error && <Button variant={requotedAmount == null ? "outline" : "default"} className="w-full" onClick={retryReservation}>
        {requotedAmount == null ? "Coba Lagi" : `Setujui total ${formatRupiah(requotedAmount)}`}
      </Button>}
      {!order && id && loaded && (
        <Button variant="outline" className="w-full" onClick={() => {
          setError("");
          setLoaded(false);
          void load();
        }}>Muat Ulang</Button>
      )}
    </PaymentLayout>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

export function PaymentLayout({
  summary,
  title = "Pembayaran QRIS",
  total,
  panelTitle = "Kode QRIS",
  children,
}: {
  summary?: React.ReactNode;
  title?: string;
  total?: React.ReactNode;
  panelTitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="container-page flex justify-center py-6 sm:py-8">
      <div className="w-full min-w-0 max-w-[460px] overflow-hidden rounded-[24px] border bg-background">
        <header className="flex flex-col items-center px-5 py-5 text-center sm:px-6">
          <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-primary">
            <Image src={PRODUCTS[0].icon} alt="" width={16} height={16} className="size-4" />
            {PRODUCTS[0].tag}
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {total && <div className="mt-3">
            <p className="text-xs text-muted-foreground">Total pembayaran</p>
            <p className="mt-1 text-[28px] leading-tight font-semibold tracking-tight tabular-nums">{total}</p>
          </div>}
        </header>
        <section aria-labelledby="qris-panel-title" className="flex min-w-0 flex-col gap-3 border-t bg-surface/60 px-5 py-4 sm:px-6">
          <h2 id="qris-panel-title" className="text-center text-sm font-medium">{panelTitle}</h2>
          {children ?? <div className="mx-auto grid aspect-square w-full max-w-[218px] place-items-center rounded-2xl border bg-white" role="status">
            <Loader2 aria-hidden="true" className="size-8 text-primary motion-safe:animate-spin" />
            <span className="sr-only">Memuat pembayaran</span>
          </div>}
        </section>
        {summary && <div className="flex min-w-0 flex-col gap-4 border-t px-5 py-4 sm:px-6">{summary}</div>}
      </div>
    </div>
  );
}
