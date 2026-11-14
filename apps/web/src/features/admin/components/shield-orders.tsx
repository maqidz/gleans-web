"use client";

import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, MoreVertical, Search, ChevronDown, Check, CircleAlert, Download, Eye, FileText, Upload, ClipboardList, type LucideIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@gleans/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@gleans/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@gleans/ui/dialog";
import { uploadPaymentFile } from "@/features/payments/upload-file";
import type { PaymentOrder } from "@/features/payments/types";
import { formatBytes, formatRupiah } from "@/lib/format";
import { ORDER_ARRIVED_EVENT } from "../lib/order-alerts";

type Order = PaymentOrder & { whatsapp: string; customer_name: string; document_bytes: number };
const paymentLabels = { draft: "Belum dibayar", creating: "Menyiapkan pembayaran", pending: "Menunggu", paid: "Berhasil", failed: "Gagal", expired: "Kedaluwarsa" };
const inspectionLabels = { pending: "Antre", processing: "Sedang diperiksa", completed: "Selesai", failed: "Perlu ditindaklanjuti" };
const card = "rounded-[18px] border border-border bg-background p-4 sm:p-5";

export function ShieldOrders() {
  const params = useSearchParams();
  useEffect(() => { const id = params.get("detail"); if (id) setSelectedId(id); }, [params]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const reportInput = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [payment, setPayment] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const selected = orders.find(order => order.id === selectedId);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/shield-orders", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setOrders(data.orders); setError("");
    } catch (error) { setError(error instanceof Error ? error.message : "Pesanan belum dapat dimuat."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const refresh = () => { void load(); };
    refresh(); window.addEventListener(ORDER_ARRIVED_EVENT, refresh);
    return () => window.removeEventListener(ORDER_ARRIVED_EVENT, refresh);
  }, [load]);
  async function process(id: string) {
    setBusy(id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/shield-orders/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "process" }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      await load(); setNotice("Pemeriksaan dimulai. Periksa dokumen secara manual di GPTZero.");
    } catch (error) { setError(error instanceof Error ? error.message : "Gagal memperbarui pesanan."); }
    finally { setBusy(null); }
  }
  async function report(id: string) {
    if (!file) return;
    setBusy(id); setError(""); setNotice("");
    try {
      await uploadPaymentFile(file, "report", id); setFile(null); await load();
      setNotice("Laporan tersimpan dan pemeriksaan selesai. WhatsApp belum dikirim; Fonnte belum terhubung.");
    } catch (error) { setError(error instanceof Error ? error.message : "Gagal mengunggah laporan."); }
    finally { setBusy(null); }
  }
  const visible = orders.filter(order => (filter === "all" || order.fulfillment_status === filter) && (payment === "all" || order.status === payment) && `${order.id} ${order.customer_name || ""} ${order.whatsapp} ${order.document_name}`.toLowerCase().includes(query.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(visible.length / 10));
  const currentPage = Math.min(page, pages);
  const pageNumbers = Array.from({length: pages}, (_, index) => index + 1).filter(number => pages <= 7 || number === 1 || number === pages || (currentPage <= 4 ? number <= 5 : currentPage >= pages - 3 ? number >= pages - 4 : Math.abs(number - currentPage) <= 1));
  const metrics = [["TOTAL PESANAN", orders.length], ["TOTAL ANTREAN", orders.filter(o => o.status === "paid" && o.fulfillment_status === "pending").length], ["TOTAL SELESAI", orders.filter(o => o.status === "paid" && o.fulfillment_status === "completed").length], ["PERLU TINDAKAN", orders.filter(o => o.status === "paid" && ["pending", "processing", "failed"].includes(o.fulfillment_status)).length]];
  return <section className="mb-8 min-w-0 space-y-5" aria-label="Pesanan Shield tersimpan">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold sm:text-3xl">Pesanan</h1><p className="mt-2 text-sm text-muted-foreground">Pantau pembayaran, pemeriksaan, dan pengiriman laporan.</p></div><Button variant="outline" size="pill-sm" className="shadow-none" onClick={() => void load()}>Muat ulang</Button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value]) => <section key={label} className={card}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-4 text-2xl font-semibold">{loading ? "—" : value}</p></section>)}</div>
    {error && !selected && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="overflow-hidden rounded-2xl border border-border">
      <div className="flex flex-col gap-4 border-b border-border p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="shrink-0"><p className="text-xs text-muted-foreground">Total hasil</p><p aria-live="polite" className="mt-1 text-sm font-medium">{loading ? "Memuat…" : `${visible.length} pesanan`}</p></div>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap xl:flex-nowrap">
          <div className="relative min-w-0 sm:flex-1 xl:flex-none"><select aria-label="Filter pembayaran" value={payment} onChange={e => {setPayment(e.target.value); setPage(1);}} className="h-10 w-full appearance-none rounded-full border border-border bg-background pl-3 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"><option value="all">Semua pembayaran</option>{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-3 size-4 text-muted-foreground"/></div>
          <div className="relative min-w-0 sm:flex-1 xl:flex-none"><select aria-label="Filter pemeriksaan" value={filter} onChange={e => {setFilter(e.target.value); setPage(1);}} className="h-10 w-full appearance-none rounded-full border border-border bg-background pl-3 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"><option value="all">Semua pemeriksaan</option>{Object.entries(inspectionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-3 size-4 text-muted-foreground"/></div>
          <div className="flex h-10 min-w-0 items-center gap-2 rounded-full bg-surface px-3 focus-within:ring-2 focus-within:ring-primary sm:w-full xl:w-56"><Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground"/><input aria-label="Cari ID, dokumen, nama, atau WhatsApp" placeholder="Cari pesanan…" value={query} onChange={e => {setQuery(e.target.value); setPage(1);}} className="w-full min-w-0 bg-transparent text-sm outline-none"/></div>
        </div>
      </div>
      <div role="region" aria-label="Tabel pesanan" tabIndex={0} className="overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-primary"><table className="w-full min-w-[1060px] text-sm"><caption className="sr-only">Pesanan Shield dari checkout pelanggan</caption><thead className="bg-surface text-xs text-muted-foreground"><tr>{["PESANAN", "PELANGGAN", "DOKUMEN", "TOTAL", "PEMBAYARAN", "PEMERIKSAAN", "LAPORAN", "AKSI"].map(label => <th key={label} scope="col" className="whitespace-nowrap px-4 py-4 text-left font-medium">{label}</th>)}</tr></thead><tbody className="divide-y">{visible.slice((currentPage - 1) * 10, currentPage * 10).map(order => <tr key={order.id} className="hover:bg-surface/50">
      <td className="px-4 py-5 align-top"><p className="whitespace-nowrap font-medium">{order.id}</p><p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString("id-ID", {day:"numeric",month:"short",year:"numeric"})}</p></td>
      <td className="px-4 py-5 align-top"><p className="font-medium">{order.customer_name || "Pelanggan tamu"}</p><p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">{order.whatsapp || "—"}</p></td>
      <td className="max-w-64 break-words px-4 py-5 align-top [overflow-wrap:anywhere]">{order.document_name}<p className="mt-1 text-xs text-muted-foreground">{formatBytes(order.document_bytes)}</p></td>
      <td className="whitespace-nowrap px-4 py-5 align-top">{formatRupiah(order.amount)}</td>
      <td className="px-4 py-5 align-top"><OrderBadge value={paymentLabels[order.status]}/></td><td className="px-4 py-5 align-top"><OrderBadge value={order.status === "paid" ? inspectionLabels[order.fulfillment_status] : "Belum diproses"}/></td><td className="px-4 py-5 align-top"><OrderBadge value="Belum dikirim"/></td>
      <td className="sticky right-0 bg-white px-4 py-5 align-top"><div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="rounded-[10px] shadow-none" aria-label={`Detail pesanan ${order.id}`} title="Detail pesanan" onClick={() => {setSelectedId(order.id); setFile(null); setNotice(""); setError("");}}><Eye className="size-4"/></Button>
        <Button asChild variant="outline" size="icon" className="rounded-[10px] shadow-none"><a href={`/api/admin/shield-orders/${order.id}`} target="_blank" rel="noreferrer" aria-label={`Unduh dokumen ${order.id}`} title="Unduh dokumen"><Download className="size-4"/></a></Button>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="rounded-[10px] shadow-none" aria-label={`Menu pesanan ${order.id}`} title="Menu pesanan"><MoreVertical className="size-4"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="rounded-xl">
          <DropdownMenuItem onSelect={() => {setSelectedId(order.id); setFile(null); setNotice(""); setError("");}}><FileText className="size-4"/>Kelola laporan</DropdownMenuItem>
          <DropdownMenuItem asChild><a href={`/cek-pesanan/${encodeURIComponent(order.id)}`} target="_blank" rel="noreferrer"><Eye className="size-4"/>Buka halaman pesanan</a></DropdownMenuItem>
        </DropdownMenuContent></DropdownMenu>
      </div></td>
    </tr>)}</tbody></table>{!visible.length && <p className="p-6 text-center text-sm text-muted-foreground">{loading ? "Memuat pesanan…" : error ? "Pesanan belum dapat dimuat." : "Tidak ada pesanan yang sesuai."}</p>}</div>
    {!loading && visible.length > 0 && <nav aria-label="Halaman pesanan" className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-t border-border p-4">
      <Button variant="outline" size="pill-sm" className="rounded-xl shadow-none" aria-label="Halaman sebelumnya" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ArrowLeft className="size-4"/><span className="hidden sm:inline">Sebelumnya</span></Button>
      <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">{pageNumbers.map((number, index) => <span key={number} className="contents">{index > 0 && number - pageNumbers[index - 1] > 1 && <span aria-hidden="true" className="px-1 text-muted-foreground">…</span>}<Button variant={number === currentPage ? "outline" : "ghost"} size="icon" className={`size-8 rounded-xl shadow-none sm:size-10 ${number === currentPage ? "text-foreground" : "text-muted-foreground"}`} aria-label={`Halaman ${number}`} aria-current={number === currentPage ? "page" : undefined} onClick={() => setPage(number)}>{number}</Button></span>)}</div>
      <Button variant="outline" size="pill-sm" className="rounded-xl shadow-none" aria-label="Halaman berikutnya" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><span className="hidden sm:inline">Berikutnya</span><ArrowRight className="size-4"/></Button>
    </nav>}
    </div>
    <Dialog open={!!selected} onOpenChange={open => {if (!open && !busy) {setSelectedId(null); setFile(null);}}}>
      <DialogContent className="flex max-h-[min(82dvh,720px)] max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden rounded-[28px] p-0 sm:max-w-[640px]">
        <DialogHeader className="shrink-0 px-5 pb-4 pt-6 sm:px-6"><DialogTitle className="text-xl sm:text-2xl">Detail pesanan</DialogTitle><DialogDescription>Informasi pesanan dan status pemeriksaan.</DialogDescription></DialogHeader>
        {selected && <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6">
          <section className={card}><div className="flex items-start gap-3"><span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600"><FileText className="size-4"/></span><div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><div className="min-w-0"><h3 className="break-words text-base font-medium leading-relaxed [overflow-wrap:anywhere]">{selected.document_name}</h3><p className="mt-1 break-all text-xs text-muted-foreground">{selected.id}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(selected.created_at).toLocaleDateString("id-ID", {day:"numeric", month:"short", year:"numeric"})} · {formatBytes(selected.document_bytes)}</p></div><div className="flex flex-col items-end gap-3 justify-self-end"><p className="whitespace-nowrap text-right text-xl font-semibold">{formatRupiah(selected.amount)}</p><Button asChild variant="outline" size="icon" className="size-8 rounded-[10px] shadow-none"><a href={`/api/admin/shield-orders/${selected.id}`} target="_blank" rel="noreferrer" aria-label={`Unduh dokumen ${selected.document_name}`} title="Unduh dokumen"><Download className="size-4"/></a></Button></div></div></div><dl className="mt-5 grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Nama</dt><dd className="mt-2 break-words text-sm font-medium">{selected.customer_name || "Pelanggan tamu"}</dd></div><div><dt className="text-xs text-muted-foreground">WhatsApp</dt><dd className="mt-2 text-sm font-medium">{selected.whatsapp || "—"}</dd></div></dl></section>
          <OrderDetailCard title="Status pesanan" icon={ClipboardList}><OrderProgress order={selected}/>{selected.status === "paid" && ["pending", "failed"].includes(selected.fulfillment_status) && <Button size="pill-sm" className="mt-4" disabled={!!busy} onClick={() => void process(selected.id)}>Mulai pemeriksaan</Button>}</OrderDetailCard>
          <OrderDetailCard title="Laporan hasil pemeriksaan" icon={Upload}>{selected.fulfillment_status === "completed" ? <p className="mt-2 text-sm">Laporan sudah tersimpan.{selected.report_expires_at && ` Batas unduh: ${new Date(selected.report_expires_at).toLocaleString("id-ID")}.`}</p> : <><div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface/40 p-5 text-center"><FileText aria-hidden="true" className="size-6 text-muted-foreground"/><p className="max-w-full break-words text-sm [overflow-wrap:anywhere]">{file ? file.name : "Laporan GPTZero"}</p><p className="text-xs text-muted-foreground">{file ? formatBytes(file.size) : "PDF, maksimal 25 MB"}</p><Button type="button" variant="outline" size="pill-sm" className="rounded-full shadow-none" disabled={!!busy || selected.status !== "paid"} onClick={() => reportInput.current?.click()}>{file ? "Ganti file" : "Pilih file"}</Button><input ref={reportInput} aria-label="Pilih laporan GPTZero" type="file" accept=".pdf,application/pdf" disabled={!!busy || selected.status !== "paid"} className="hidden" onChange={event => {const candidate = event.target.files?.[0]; setFile(null); if (!candidate) return; if (!/\.pdf$/i.test(candidate.name) || candidate.size === 0 || candidate.size > 26214400) {setError("Pilih laporan PDF berukuran maksimal 25 MB."); event.target.value = ""; return;} setError(""); setFile(candidate);}}/></div><Button size="pill-sm" className="mt-4" disabled={!file || !!busy || selected.status !== "paid"} onClick={() => void report(selected.id)}><Upload className="size-4"/>{busy === selected.id ? "Menyimpan…" : "Simpan laporan & selesaikan"}</Button></>}</OrderDetailCard>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{notice && <p role="status" className="text-sm text-primary">{notice}</p>}
        </div>}
        <div className="flex shrink-0 justify-end px-5 py-4 sm:px-6"><Button variant="outline" size="pill-sm" className="shadow-none" disabled={!!busy} onClick={() => setSelectedId(null)}>Tutup</Button></div>
      </DialogContent>
    </Dialog>
  </section>;
}

function OrderBadge({value}: {value: string}) {
  const color = ["Berhasil", "Selesai", "Terkirim"].includes(value) ? "bg-emerald-50 text-emerald-700" : ["Gagal", "Kedaluwarsa", "Perlu ditindaklanjuti"].includes(value) ? "bg-red-50 text-red-700" : ["Menunggu", "Antre", "Sedang diperiksa"].includes(value) ? "bg-accent text-primary" : "bg-surface text-muted-foreground";
  return <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${color}`}>{value}</span>;
}

function OrderDetailCard({title, icon: Icon, children}: {title: string; icon: LucideIcon; children: ReactNode}) {
  return <section className={card}><div className="mb-4 flex items-center gap-3"><span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Icon className="size-4"/></span><h3 className="text-sm font-medium sm:text-base">{title}</h3></div>{children}</section>;
}

function OrderProgress({order}: {order: Order}) {
  const paid = order.status === "paid";
  const complete = paid && order.fulfillment_status === "completed";
  const paymentFailed = ["failed", "expired"].includes(order.status);
  const inspectionFailed = paid && order.fulfillment_status === "failed";
  const steps = [
    {label: "Pembayaran", detail: paymentLabels[order.status], done: paid, active: !paid && !paymentFailed, failed: paymentFailed},
    {label: "Pemeriksaan", detail: paid ? inspectionLabels[order.fulfillment_status] : "Belum diproses", done: complete, active: paid && !complete && !inspectionFailed, failed: inspectionFailed},
    {label: "Laporan", detail: "Belum dikirim", done: false, active: complete, failed: false},
  ];
  return <ol aria-label="Progres pesanan" className="grid grid-cols-3 py-2">
    {steps.map((step, index) => <li key={step.label} aria-current={step.active || step.failed ? "step" : undefined} className="relative min-w-0 text-center">
      {index < steps.length - 1 && <span aria-hidden="true" className={`absolute left-1/2 top-[15px] h-0.5 w-full ${step.done ? "bg-primary" : "bg-border"}`}/>}
      <span aria-hidden="true" className={`relative z-10 mx-auto flex size-8 items-center justify-center rounded-full border-2 ${step.done ? "border-primary bg-primary text-white" : step.failed ? "border-red-600 bg-background text-red-600" : step.active ? "border-primary bg-background text-primary ring-4 ring-primary/10" : "border-border bg-background text-muted-foreground"}`}>
        {step.done ? <Check className="size-4"/> : step.failed ? <CircleAlert className="size-4"/> : step.active ? <span className="size-2.5 rounded-full bg-primary"/> : <span className="text-xs">{index + 1}</span>}
      </span>
      <p className="mt-3 px-1 text-xs font-medium sm:text-sm">{step.label}</p>
      <p className={`mt-1 px-1 text-[11px] leading-relaxed sm:text-xs ${step.failed ? "text-red-600" : step.active || step.done ? "text-primary" : "text-muted-foreground"}`}>{step.detail}</p>
    </li>)}
  </ol>;
}
