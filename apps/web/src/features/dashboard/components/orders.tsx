"use client";

import Link from "next/link";
import { useState } from "react";
import { FileText, Plus, Search } from "lucide-react";
import { Button } from "@gleans/ui/button";
import { FilterDropdown } from "@gleans/ui/filter-dropdown";
import { formatRupiah } from "@/lib/format";
import { OrderDetailDialog } from "@/features/orders/components/order-detail";
import type { AccountOrder } from "@/features/payments/types";
import { useDashboard } from "./provider";
import { Heading, Empty, OrderHistoryError, Status, dateLabel } from "./shared";

const filters = [
  { value: "all", label: "Semua status" },
  { value: "pending", label: "Menunggu pembayaran" },
  { value: "active", label: "Sedang diproses" },
  { value: "completed", label: "Selesai" },
  { value: "failed", label: "Gagal / kedaluwarsa" },
];

function matchesStatus(order: AccountOrder, filter: string) {
  switch (filter) {
    case "pending": return order.status === "draft" || order.status === "creating" || order.status === "pending";
    case "active": return order.status === "paid" && (order.fulfillment_status === "pending" || order.fulfillment_status === "processing");
    case "completed": return order.status === "paid" && order.fulfillment_status === "completed";
    case "failed": return order.status === "failed" || order.status === "expired" || order.fulfillment_status === "failed";
    default: return true;
  }
}

export function DashboardOrders() {
  const { history, orders } = useDashboard();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const term = query.trim().toLowerCase();
  const matches = orders.filter(order =>
    matchesStatus(order, filter) && (order.id.toLowerCase().includes(term) || order.document_name.toLowerCase().includes(term)),
  );

  return <>
    <Heading title="Pesananmu" description="Pantau pembayaran dan progres pemeriksaan Shield." action={
      <Button asChild size="pill-sm"><Link href="/deteksi-ai"><Plus />Buat Pesanan</Link></Button>
    } />
    <div className="mb-5 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <div className="flex h-11 min-w-0 items-center gap-2 rounded-full bg-surface px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input aria-label="Cari pesanan" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari dokumen atau nomor pesanan…" className="w-full min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </div>
      <FilterDropdown className="h-11 max-w-[160px] px-3 sm:max-w-none sm:px-4" label="Status pesanan" value={filter} onChange={setFilter} options={filters} />
    </div>
    <section aria-label="Daftar pesanan" className="min-w-0 space-y-4">
      {history.isPending && <p role="status" className="text-sm text-muted-foreground">Memuat pesanan…</p>}
      {history.isError && <OrderHistoryError retry={() => {
        if (history.isFetchNextPageError) void history.fetchNextPage();
        else void history.refetch();
      }} />}
      {matches.length > 0 && <ul className="space-y-3">
        {matches.map(order => <li key={order.id}>
          <OrderDetailDialog invoice={order.id}>
            <button type="button" className="flex w-full min-w-0 cursor-pointer flex-col items-stretch gap-3 rounded-2xl border bg-white p-4 text-left hover:ring-1 hover:ring-primary focus-visible:ring-2 focus-visible:ring-primary sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><FileText className="size-5" /></span>
                <span className="min-w-0">
                  <span className="block break-words text-sm font-medium">{order.document_name}</span>
                  <span className="mt-1 block break-words text-xs text-muted-foreground">{order.id} · {dateLabel(order.created_at)}</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center justify-between gap-2 sm:flex-col sm:items-end">
                <Status order={order} />
                <span className="text-xs text-muted-foreground">{order.payment_method === "quota" ? "1 kuota" : formatRupiah(order.amount)}</span>
              </span>
            </button>
          </OrderDetailDialog>
        </li>)}
      </ul>}
      {history.isSuccess && matches.length === 0 && (orders.length > 0 && history.hasNextPage
        ? <p className="text-sm text-muted-foreground">Belum ada hasil pada pesanan yang sudah dimuat.</p>
        : <Empty
            title={orders.length ? "Pesanan tidak ditemukan" : "Belum ada pesanan"}
            description={orders.length ? "Coba kata kunci atau status lain." : "Buat pesanan untuk memeriksa dokumen dengan Gleans Shield."}
          />)}
      {history.hasNextPage && !history.isFetchNextPageError && <Button variant="outline" size="pill-sm" disabled={history.isFetching} onClick={() => void history.fetchNextPage()}>
        {history.isFetchingNextPage ? "Memuat…" : "Muat pesanan lainnya"}
      </Button>}
    </section>
  </>;
}
