"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, CircleAlert, ClipboardList, Clock3, Eye, FileText, Search, StickyNote, UserRound, X, type LucideIcon } from "lucide-react";
import { Button } from "@gleans/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@gleans/ui/dialog";
import { formatRupiah } from "@/lib/format";
import { normalizeAdminOrderId, type AdminState } from "@/features/admin/lib/model";
import { useAdmin } from "./provider";
import { shieldAccess } from "@/lib/shield-retention";
import { summaryDemo } from "@/features/admin/lib/summary-demo";
import { card } from "./overview";

type Order = AdminState["orders"][number];
type Customer = AdminState["customers"][number];
const control = "h-10 w-full min-w-0 rounded-xl border-0 bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary";
const cell = "px-4 py-5 text-left align-top";

function Status({ value }: { value: string }) {
  const color = ["Berhasil", "Selesai", "Terkirim"].includes(value)
    ? "bg-emerald-50 text-emerald-700"
    : ["Gagal", "Gagal dikirim", "Kedaluwarsa"].includes(value)
      ? "bg-red-50 text-red-700"
      : ["Antre", "Diproses", "Menunggu"].includes(value)
        ? "bg-accent text-primary"
        : "bg-surface text-muted-foreground";
  return <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${color}`}>{value}</span>;
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-2 break-words text-sm font-medium">{children}</dd></div>;
}

function date(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(`${value}T00:00:00+07:00`));
}

export function AdminRecordsTable({ module }: { module: "pesanan" | "pelanggan" }) {
  const { state } = useAdmin();
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const router = useRouter();
  const params = useSearchParams();
  const opened = useRef<string | null>(null);
  const [query, setQuery] = useState("");
  const [payment, setPayment] = useState("Semua");
  const [processing, setProcessing] = useState(params.get("status") === "proses" ? "Berjalan" : params.get("status") === "selesai" ? "Selesai" : params.get("status") === "retry" ? "Retry" : "Semua");
  const [delivery, setDelivery] = useState("Semua");
  const [attention, setAttention] = useState(params.get("status") === "gagal");
  const [selected, setSelected] = useState<string | null>(null);
  const isOrder = module === "pesanan";
  const title = isOrder ? "Pesanan" : "Pelanggan";
  const customerFor = (id: string) => state.customers.find(c => c.id === id);
  const order = isOrder ? state.orders.find(o => o.id === selected) : undefined;
  const customer = isOrder ? customerFor(order?.customerId || "") : customerFor(selected || "");

  useEffect(() => {
    const rawId = params.get("detail");
    const id = rawId && isOrder ? normalizeAdminOrderId(rawId) : rawId;
    if (!id) opened.current = null;
    if (id && opened.current !== id) { opened.current = id; setSelected(id); }
  }, [params, isOrder]);

  function close() {
    setSelected(null);
    if (params.get("detail")) {
      const next = new URLSearchParams(params.toString());
      next.delete("detail");
      router.replace(`/admin/${module}${next.size ? `?${next}` : ""}`, { scroll: false });
    }
  }
  const needle = query.trim().toLowerCase();
  const orders = state.orders.filter(o => {
    const c = customerFor(o.customerId);
    return [o.id, o.document, c?.name, c?.email, c?.whatsapp].join(" ").toLowerCase().includes(needle)
      && (payment === "Semua" || o.payment === payment)
      && (processing === "Semua" || o.processing === processing || processing === "Berjalan" && ["Antre", "Diproses"].includes(o.processing) || processing === "Retry" && o.failureReason === "rate_limit" && o.processing === "Antre")
      && (delivery === "Semua" || o.delivery === delivery)
      && (!attention || o.processing === "Gagal" || o.delivery === "Gagal dikirim");
  });
  const customers = state.customers.filter(c => [c.id, c.name, c.email, c.whatsapp].join(" ").toLowerCase().includes(needle));
  const count = isOrder ? orders.length : customers.length;
  const metrics = isOrder ? [
    ["TOTAL PENDAPATAN", formatRupiah(summaryDemo.income)],
    ["TOTAL PESANAN", new Intl.NumberFormat("id-ID").format(summaryDemo.orders)],
    ["TOTAL ANTREAN", summaryDemo.queue],
    ["TOTAL GAGAL", state.orders.filter(o => o.processing === "Gagal" || o.delivery === "Gagal dikirim").length],
  ] : [
    ["TOTAL PELANGGAN", state.customers.length],
    ["TOTAL SALDO", formatRupiah(state.customers.reduce((sum, c) => sum + c.balance, 0))],
    ["TOTAL KUOTA", state.customers.reduce((sum, c) => sum + c.quota, 0)],
    ["PELANGGAN DENGAN PESANAN", state.customers.filter(c => state.orders.some(o => o.customerId === c.id)).length],
  ];

  return <>
    <div className="mb-7"><h1 className="text-2xl font-semibold sm:text-3xl">{isOrder ? "Contoh pesanan" : title}</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{isOrder ? "Data demo untuk melihat contoh status. Proses pesanan asli melalui bagian Pesanan Shield di atas." : "Lihat profil, saldo, kuota, dan riwayat pesanan pelanggan."}</p></div>
    <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value]) => <section key={label} className={card}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-4 break-words text-2xl font-semibold">{value}</p></section>)}</div>
    <div className="min-w-0 w-full">
      <div className="mb-5 grid gap-3">
        <div className={`flex ${isOrder ? "h-10" : "h-11"} min-w-0 items-center gap-2 rounded-xl bg-surface px-4`}><Search className="size-4 shrink-0 text-muted-foreground"/><input aria-label={`Cari ${title}`} placeholder={isOrder ? "Cari ID, dokumen, nama, atau WhatsApp…" : "Cari nama, email, ID, atau WhatsApp…"} value={query} onChange={e => setQuery(e.target.value)} className="w-full min-w-0 bg-transparent text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"/></div>
        {isOrder && <div className="grid gap-3 sm:grid-cols-3">
          <select aria-label="Filter pembayaran" value={payment} onChange={e => setPayment(e.target.value)} className={control}><option value="Semua">Semua pembayaran</option>{["Menunggu", "Berhasil", "Kedaluwarsa", "Refund"].map(x => <option key={x}>{x}</option>)}</select>
          <select aria-label="Filter pemeriksaan" value={processing} onChange={e => setProcessing(e.target.value)} className={control}><option value="Semua">Semua pemeriksaan</option><option value="Berjalan">Antre & diproses</option><option value="Retry">Perlu tindak lanjut</option>{["Belum diproses", "Antre", "Diproses", "Selesai", "Gagal"].map(x => <option key={x}>{x}</option>)}</select>
          <select aria-label="Filter laporan" value={delivery} onChange={e => setDelivery(e.target.value)} className={control}><option value="Semua">Semua laporan</option>{["Belum dikirim", "Terkirim", "Gagal dikirim"].map(x => <option key={x}>{x}</option>)}</select>
        </div>}
        {isOrder && <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={attention} onChange={e => setAttention(e.target.checked)}/>Hanya yang perlu tindakan</label>}
      </div>
      <div className="mb-3 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><p>{count} {title.toLowerCase()} ditemukan</p><p className="sm:hidden">Geser tabel untuk melihat semua kolom.</p></div>
      <div role="region" aria-label={`Tabel ${title.toLowerCase()}`} tabIndex={0} className={`overflow-x-auto rounded-2xl border outline-none focus-visible:ring-2 focus-visible:ring-primary`}>
        <table className={`w-full text-sm ${isOrder ? "min-w-[1060px]" : "min-w-[840px]"}`}>
          <caption className="sr-only">Daftar {title.toLowerCase()} demo. Gunakan tombol Detail untuk melihat informasi.</caption>
          <thead className="bg-surface text-xs text-muted-foreground"><tr>{(isOrder ? ["PESANAN", "PELANGGAN", "DOKUMEN", "TOTAL", "PEMBAYARAN", "PEMERIKSAAN", "LAPORAN", "AKSI"] : ["PELANGGAN", "KONTAK", "SALDO", "KUOTA", "PESANAN", "AKSI"]).map(x => <th key={x} scope="col" className={`whitespace-nowrap px-4 py-4 text-left font-medium ${x === "AKSI" ? "sticky right-0 bg-surface" : ""}`}>{x}</th>)}</tr></thead>
          <tbody className="divide-y">
            {isOrder ? orders.map(o => {const c = customerFor(o.customerId); return <tr key={o.id} className="hover:bg-surface/50">
              <td className={cell}><p className="whitespace-nowrap font-medium">{o.id}</p><p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">{date(o.date)}</p></td>
              <td className={cell}><p className="font-medium">{c?.name || o.customerId}</p><p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">{c?.whatsapp || "—"}</p></td>
              <td className={cell+" max-w-64 break-words"}>{o.document}{o.processing === "Selesai" && <Retention order={o} now={now}/>}</td><td className={cell+" whitespace-nowrap"}>{formatRupiah(o.amount)}</td>
              <td className={cell}><Status value={o.payment}/></td><td className={cell}><Status value={o.processing}/></td><td className={cell}><Status value={o.delivery}/></td>
              <td className={cell+" sticky right-0 bg-white"}><Button variant="outline" size="icon" className="rounded-[10px] shadow-none" aria-label={`Detail pesanan ${o.id}`} onClick={() => setSelected(o.id)}><Eye className="size-4"/></Button></td>
            </tr>;}) : customers.map(c => <tr key={c.id} className="hover:bg-surface/50">
              <td className={cell}><p className="font-medium">{c.name}</p><p className="mt-1 text-xs text-muted-foreground">{c.id}</p></td>
              <td className={cell}><p>{c.email}</p><p className="mt-1 text-xs text-muted-foreground">{c.whatsapp || "—"}</p></td>
              <td className={cell+" whitespace-nowrap"}>{formatRupiah(c.balance)}</td><td className={cell}>{c.quota}</td><td className={cell}>{state.orders.filter(o => o.customerId === c.id).length}</td>
              <td className={cell+" sticky right-0 border-l bg-white"}><Button variant="outline" size="icon" className="rounded-[10px] shadow-none" aria-label={`Detail pelanggan ${c.name}`} onClick={() => setSelected(c.id)}><Eye className="size-4"/></Button></td>
            </tr>)}
            {!count && <tr><td colSpan={isOrder ? 8 : 6} className="px-4 py-12 text-center text-muted-foreground">Tidak ada hasil. Coba kata kunci atau filter lain.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
    <Dialog open={!!selected} onOpenChange={v => {if (!v) close();}}><DialogContent showCloseButton={!isOrder} className={isOrder ? "flex max-h-[min(82dvh,720px)] max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden rounded-[28px] p-0 sm:max-w-[640px]" : "max-h-[85dvh] overflow-y-auto rounded-[24px] sm:max-w-2xl"}>
      <DialogHeader className={isOrder ? "shrink-0 px-5 pt-5 pb-4 sm:px-6 sm:pt-6" : undefined}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><DialogTitle className={isOrder ? "text-xl leading-tight sm:text-2xl" : undefined}>{isOrder ? "Detail pesanan" : "Detail pelanggan"}</DialogTitle><DialogDescription className={isOrder ? "mt-1.5 text-sm" : "mt-2"}>{isOrder ? "Informasi pesanan dan status pemeriksaan." : "Informasi demo untuk dilihat."}</DialogDescription></div>
          {isOrder && <DialogClose asChild><Button variant="ghost" size="icon-sm" className="shrink-0 rounded-full text-muted-foreground" aria-label="Tutup detail pesanan"><X className="size-4"/></Button></DialogClose>}
        </div>
      </DialogHeader>
      <div className={isOrder ? "min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6" : undefined}>
        {isOrder && order ? <OrderDetail order={order} customer={customer} now={now}/> : !isOrder && customer ? <CustomerDetail customer={customer} orders={state.orders.filter(o => o.customerId === customer.id)}/> : <p className="py-6 text-sm text-muted-foreground">Data tidak ditemukan.</p>}
      </div>
      <div className={isOrder ? "flex shrink-0 justify-end px-5 py-4 sm:px-6 sm:pb-6" : "flex justify-end border-t pt-4"}><Button variant="outline" size="pill-sm" className="rounded-full shadow-none" onClick={close}>Tutup</Button></div>
    </DialogContent></Dialog>
  </>;
}

function DetailCard({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return <section className="rounded-[18px] border border-border bg-white p-4 sm:p-5">
    <div className="mb-4 flex items-center gap-3"><span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Icon className="size-4"/></span><h3 className="text-sm font-medium sm:text-base">{title}</h3></div>
    {children}
  </section>;
}

function OrderDetail({ order, customer, now }: { order: Order; customer?: Customer; now: number }) {
  return <div className="space-y-3">
    <section className="rounded-[18px] border border-border bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600"><FileText className="size-4"/></span>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0"><h3 className="break-words text-base font-medium leading-relaxed">{order.document}</h3><p className="mt-1 break-all text-xs text-muted-foreground">{order.id}</p><p className="mt-1 text-xs text-muted-foreground">{date(order.date)}</p></div>
          <p className="justify-self-end whitespace-nowrap text-right text-xl font-semibold">{formatRupiah(order.amount)}</p>
        </div>
      </div>
    </section>
    <DetailCard title="Pelanggan" icon={UserRound}><dl className="grid grid-cols-1 gap-4 sm:grid-cols-2"><DetailItem label="Nama">{customer?.name || order.customerId}</DetailItem><DetailItem label="ID pelanggan">{order.customerId}</DetailItem><DetailItem label="Email">{customer?.email || "—"}</DetailItem><DetailItem label="WhatsApp">{customer?.whatsapp || "—"}</DetailItem></dl></DetailCard>
    <DetailCard title="Status pesanan" icon={ClipboardList}><dl className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-3"><DetailItem label="Pembayaran"><Status value={order.payment}/></DetailItem><DetailItem label="Pemeriksaan"><Status value={order.processing}/></DetailItem><DetailItem label="Status laporan"><Status value={order.delivery}/></DetailItem></dl></DetailCard>
    {order.processing === "Selesai" && <DetailCard title="Akses dokumen dan laporan" icon={Clock3}><Retention order={order} now={now} detail/></DetailCard>}
    {order.failureReason && <DetailCard title={order.failureReason === "rate_limit" ? "Menunggu pemeriksaan admin" : "Penyebab kegagalan"} icon={CircleAlert}><p className="text-sm leading-relaxed text-muted-foreground">{failureLabels[order.failureReason]}</p></DetailCard>}
    <DetailCard title="Catatan operator" icon={StickyNote}><p className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${order.note ? "" : "text-muted-foreground"}`}>{order.note || "Belum ada catatan."}</p></DetailCard>
  </div>;
}

function CustomerDetail({ customer, orders }: { customer: Customer; orders: Order[] }) {
  return <div className="space-y-6">
    <section className="rounded-2xl bg-surface p-4"><p className="text-xs text-muted-foreground">{customer.id}</p><h3 className="mt-2 font-semibold">{customer.name}</h3></section>
    <dl className="grid gap-5 sm:grid-cols-2"><DetailItem label="Email">{customer.email}</DetailItem><DetailItem label="WhatsApp">{customer.whatsapp || "—"}</DetailItem><DetailItem label="Total saldo">{formatRupiah(customer.balance)}</DetailItem><DetailItem label="Total kuota">{customer.quota} pemeriksaan</DetailItem></dl>
    <section><h3 className="mb-3 text-sm font-semibold">Riwayat pesanan · {orders.length}</h3><div className="space-y-3">{orders.map(o => <a key={o.id} href={`/admin/pesanan?detail=${o.id}`} className="flex min-w-0 items-start justify-between gap-3 rounded-2xl border p-4 hover:border-primary"><div className="min-w-0"><p className="break-words text-sm font-medium">{o.document}</p><p className="mt-1 text-xs text-muted-foreground">{o.id} · {date(o.date)}</p><div className="mt-3"><Status value={o.processing}/></div></div><ArrowUpRight className="size-4 shrink-0 text-primary"/><span className="sr-only">Lihat detail pesanan {o.id}</span></a>)}</div>{!orders.length && <p className="py-4 text-sm text-muted-foreground">Belum ada pesanan.</p>}</section>
  </div>;
}

const failureLabels = { api_quota: "Akses GPTZero perlu diperiksa oleh admin", rate_limit: "Menunggu pemeriksaan manual oleh admin", timeout: "Pemeriksaan manual belum berhasil diselesaikan", invalid_document: "Dokumen tidak dapat dibaca" };
function Retention({ order, now, detail = false }: { order: Order; now: number; detail?: boolean }) {
  if (!now) return null;
  const access = shieldAccess(order.completedAt, now);
  const stamp = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value)) + " WIB";
  return <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
    <p className={access.status === "expired" ? "text-red-700" : "text-amber-700"}>{access.status === "expired" ? "Masa unduh berakhir" : access.status === "available" ? `Tersedia · sisa ${Math.ceil(access.remainingMs / 3600000)} jam` : "Waktu selesai belum tercatat"}</p>
    {detail && <>{order.completedAt && <p className="mt-2">Selesai: {stamp(order.completedAt)}</p>}{access.expiresAt && <p className="mt-1">Batas unduh: {stamp(access.expiresAt)}</p>}<p className="mt-2">{access.status === "expired" ? "Dokumen dan hasil pemeriksaan tidak lagi tersedia setelah 24 jam. Riwayat pesanan tetap tersimpan." : "Pelanggan memiliki waktu 24 jam setelah proses berhasil untuk mengunduh dokumen dan hasil pemeriksaan."}</p></>}
  </div>;
}
