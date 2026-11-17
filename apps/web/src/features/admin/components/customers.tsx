"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, Copy, Eye, Search } from "lucide-react";
import { Button } from "@gleans/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@gleans/ui/dialog";
import { formatDate, formatNumber, formatRupiah } from "@/lib/format";
import type { AdminState } from "../lib/model";
import { editorRequest } from "../lib/editor-client";
import { ORDER_ARRIVED_EVENT } from "../lib/order-alerts";
import { card } from "./overview";

type Order = AdminState["orders"][number];
type CustomerDirectory = Pick<AdminState, "customers" | "orders"> & { limited: boolean };
const pageSize = 10;
const cell = "px-4 py-4";
const columns = ["Pelanggan", "Kontak", "Saldo", "Kuota", "Pesanan", "Aksi"];

export function AdminCustomers() {
  const [directory, setDirectory] = useState<CustomerDirectory | null>(null);
  const [error, setError] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void editorRequest<CustomerDirectory>("/api/admin/customers", { signal: controller.signal })
      .then(data => {
        if (controller.signal.aborted) return;
        setDirectory(data);
        setError("");
      })
      .catch(() => { if (!controller.signal.aborted) setError("Data pelanggan belum dapat dimuat."); });
    return () => controller.abort();
  }, [refreshCount]);

  useEffect(() => {
    const refresh = () => setRefreshCount(count => count + 1);
    window.addEventListener(ORDER_ARRIVED_EVENT, refresh);
    return () => window.removeEventListener(ORDER_ARRIVED_EVENT, refresh);
  }, []);

  const ordersByCustomer = new Map<string, Order[]>();
  for (const order of directory?.orders ?? []) {
    const orders = ordersByCustomer.get(order.customerId);
    if (orders) orders.push(order);
    else ordersByCustomer.set(order.customerId, [order]);
  }

  const customers = directory?.customers ?? [];

  const needle = query.trim().toLowerCase();
  const results = customers.filter(customer =>
    [customer.name, customer.email, customer.whatsapp, customer.id].join(" ").toLowerCase().includes(needle),
  );
  const metrics = [
    ["Total pelanggan", customers.length],
    ["Total saldo", formatRupiah(customers.reduce((sum, customer) => sum + customer.balance, 0))],
    ["Total kuota", formatNumber(customers.reduce((sum, customer) => sum + customer.quota, 0))],
    ["Total pesanan", directory?.orders.length ?? 0],
  ];
  const pages = Math.max(1, Math.ceil(results.length / pageSize));
  const current = Math.min(page, pages);
  const shown = results.slice((current - 1) * pageSize, current * pageSize);
  const customer = customers.find(customer => customer.id === selected);
  const customerOrders = customer ? ordersByCustomer.get(customer.id) ?? [] : [];

  return <>
    <header className="mb-7">
      <h1 className="text-2xl font-semibold sm:text-3xl">Pelanggan</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Lihat profil, saldo, kuota, dan riwayat pesanan pelanggan Gleans Shield.</p>
    </header>

    <div className="mb-7 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {metrics.map(([label, value]) => <section key={label} className={card}>
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p className="mt-4 break-words text-2xl font-semibold">{directory ? value : "—"}</p>
      </section>)}
    </div>

    <section className="min-w-0" aria-label="Daftar pelanggan">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-surface px-4 focus-within:ring-2 focus-within:ring-ring">
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <input aria-label="Cari pelanggan" placeholder="Cari nama, email, ID, atau WhatsApp…" value={query}
            onChange={event => { setQuery(event.target.value); setPage(1); }}
            className="w-full min-w-0 bg-transparent text-sm outline-none" />
        </div>
      </div>
      <div className="mb-3 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <p role="status">{error || (directory ? `${results.length} pelanggan ditemukan` : "Memuat pelanggan…")}</p>
        {error && <button type="button" className="text-primary underline underline-offset-4" onClick={() => { setError(""); setRefreshCount(count => count + 1); }}>Coba lagi</button>}
        {directory?.limited && <p>Berdasarkan 500 pesanan akun terbaru.</p>}
      </div>
      <div className="overflow-hidden rounded-2xl border">
        <div className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-ring" role="region" aria-label="Tabel pelanggan" tabIndex={0}>
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-muted-foreground">
              <tr>{columns.map(label => <th key={label} scope="col" className={label === "Aksi" ? "sticky right-0 w-px border-l bg-surface px-4 py-4 font-medium" : "whitespace-nowrap px-4 py-4 font-medium"}>{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {shown.map(row => <tr key={row.id} className="hover:bg-surface/50">
                <td className={cell + " w-[35%]"}>
                  <p className="break-words font-medium">{row.name}</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">{row.id}</p>
                </td>
                <td className={cell + " w-[25%]"}>
                  {row.email && <p className="break-all">{row.email}</p>}
                  <p className={row.email ? "mt-1 whitespace-nowrap text-xs text-muted-foreground" : "whitespace-nowrap"}>{row.whatsapp || "—"}</p>
                </td>
                <td className={cell + " whitespace-nowrap"}>{formatRupiah(row.balance)}</td>
                <td className={cell}>{formatNumber(row.quota)}</td>
                <td className={cell}>{ordersByCustomer.get(row.id)?.length ?? 0}</td>
                <td className={cell + " sticky right-0 border-l bg-background"}>
                  <Button variant="outline" size="icon" className="rounded-[10px] shadow-none" aria-label={`Detail pelanggan ${row.name}`} onClick={() => setSelected(row.id)}>
                    <Eye className="size-4" />
                  </Button>
                </td>
              </tr>)}
              {directory && !error && !shown.length && <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground">Tidak ada pelanggan yang sesuai.</td></tr>}
            </tbody>
          </table>
        </div>
        {pages > 1 && <nav aria-label="Halaman pelanggan" className="flex items-center justify-between gap-2 border-t p-4">
          <Button variant="outline" size="pill-sm" aria-label="Halaman sebelumnya" disabled={current === 1} onClick={() => setPage(current - 1)}><ArrowLeft /><span className="hidden sm:inline">Sebelumnya</span></Button>
          <span className="text-sm tabular-nums text-muted-foreground">{current} / {pages}</span>
          <Button variant="outline" size="pill-sm" aria-label="Halaman berikutnya" disabled={current === pages} onClick={() => setPage(current + 1)}><span className="hidden sm:inline">Berikutnya</span><ArrowRight /></Button>
        </nav>}
      </div>
    </section>

    <Dialog open={!!customer} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent className="max-h-[85dvh] gap-5 overflow-y-auto rounded-[24px] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detail pelanggan</DialogTitle>
          <DialogDescription>Kontak dan riwayat pesanan Gleans Shield.</DialogDescription>
        </DialogHeader>
        {customer && <>
          <section className="rounded-2xl bg-surface p-4">
            <p className="break-all text-xs text-muted-foreground">{customer.id}</p>
            <h3 className="mt-2 break-words font-semibold">{customer.name}</h3>
          </section>
          <dl className="grid grid-cols-2 gap-4">
            <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="mt-1 break-all text-sm font-medium">{customer.email || "—"}</dd></div>
            <div>
              <dt className="text-xs text-muted-foreground">WhatsApp</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium">
                {customer.whatsapp || "—"}
                {customer.whatsapp && <Button type="button" variant="ghost" size="icon-xs" aria-label="Salin nomor WhatsApp"
                  onClick={() => void navigator.clipboard.writeText(customer.whatsapp).catch(() => {})}><Copy /></Button>}
              </dd>
            </div>
            <div><dt className="text-xs text-muted-foreground">Total saldo</dt><dd className="mt-1 text-sm font-medium">{formatRupiah(customer.balance)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Total kuota</dt><dd className="mt-1 text-sm font-medium">{formatNumber(customer.quota)} pemeriksaan</dd></div>
          </dl>
          <section>
            <h3 className="mb-3 text-sm font-semibold">Riwayat pesanan · {customerOrders.length}</h3>
            <ul className="space-y-3">
              {customerOrders.map(order => <li key={order.id}>
                <Link href={`/admin/pesanan?detail=${encodeURIComponent(order.id)}`} className="flex min-w-0 items-start justify-between gap-3 rounded-2xl border p-4 hover:border-primary">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{order.document}</p>
                    <p className="mt-1 break-words text-xs text-muted-foreground">{order.id} · {formatDate(order.date, { dateStyle: "medium", timeZone: "Asia/Jakarta" })}</p>
                    <p className="mt-3 text-xs text-muted-foreground">{order.processing} · {formatRupiah(order.amount)}</p>
                  </div>
                  <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-primary" />
                </Link>
              </li>)}
            </ul>
          </section>
        </>}
        <div className="flex justify-end border-t pt-4"><DialogClose asChild><Button variant="outline" size="pill-sm">Tutup</Button></DialogClose></div>
      </DialogContent>
    </Dialog>
  </>;
}
