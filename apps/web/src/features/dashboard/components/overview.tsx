"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Wallet, Layers, Clock3, ArrowUpRight, Plus } from "lucide-react";
import { Button } from "@gleans/ui/button";
import { PRODUCTS } from "@/config/site";
import { OrderDetailDialog } from "@/features/orders/components/order-detail";
import { useBillingTotals } from "@/features/payments/billing/client";
import { formatRupiah } from "@/lib/format";
import { useDashboard } from "./provider";
import { Panel, Status, Empty, OrderHistoryError, dateLabel } from "./shared";

export function DashboardOverview() {
  const { account, history, orders } = useDashboard();
  const { totals } = useBillingTotals(true);
  const [greeting, setGreeting] = useState("Selamat Datang");
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour >= 5 && hour < 11 ? "Selamat Pagi" : hour >= 11 && hour < 15 ? "Selamat Siang" : hour >= 15 && hour < 18 ? "Selamat Sore" : "Selamat Malam");
  }, []);
  const totalOrders = history.data?.pages[0]?.total;
  const stats = [
    { label: "TOTAL SALDO", value: formatRupiah(totals?.balance ?? 0), icon: Wallet, href: "/dashboard/paket-saldo", action: "Isi saldo" },
    { label: "TOTAL KUOTA", value: String(totals?.quota ?? 0), icon: Layers, href: "/dashboard/paket-saldo", action: "Lihat paket" },
    { label: "TOTAL PESANAN", value: (totalOrders ?? 0).toLocaleString("id-ID"), icon: Clock3, href: "/dashboard/pesanan", action: "Lihat pesanan" },
  ];

  return <>
    <section aria-label="Sapaan pengguna" className="relative mb-7 flex items-center justify-between gap-4 overflow-hidden rounded-[24px] bg-[#101D42] p-6 text-white sm:gap-8 sm:px-8 sm:py-6">
      <div className="relative z-10 min-w-0 flex-1">
        <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">{greeting}, {account.name}</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/75">Siap menyelesaikan tulisanmu? Mulai bersama Gleans.</p>
        <Button asChild size="pill-sm" className="mt-5"><Link href="/deteksi-ai"><Plus />Buat Pesanan</Link></Button>
      </div>
      <Image src="/images/gleans-illustration-720.webp" alt="" width={1340} height={980} className="w-28 shrink-0 object-contain sm:w-48 xl:w-60" priority />
    </section>
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map(stat => <Panel key={stat.label} className="border border-border bg-white">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{stat.label}</p>
          <stat.icon className="size-5" strokeWidth={1.5} />
        </div>
        <p className="mt-5 text-2xl font-semibold tracking-tight">{stat.value}</p>
        <Link href={stat.href} className="mt-6 flex items-center gap-1 text-sm text-primary">{stat.action}<ArrowUpRight className="size-4" /></Link>
      </Panel>)}
    </div>
    <div className="mt-8">
      <h2 className="mb-4 text-lg font-semibold">Apa yang ingin kamu kerjakan?</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PRODUCTS.filter(product => product.name !== "Gleans Writer").map(product => <div key={product.name} className="flex min-w-0 flex-col rounded-2xl border p-4">
          <Image src={product.icon} alt="" width={32} height={32} className="mb-4 size-8" />
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium">{product.name}</h3>
            {product.soon && <span className="text-[10px] text-muted-foreground">Segera hadir</span>}
          </div>
          <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">{product.name === "Gleans Shield" ? "Periksa dokumen melalui layanan Shield." : product.description}</p>
          {!product.soon && <Link href={product.href} className="mt-4 flex items-center gap-1 text-xs text-primary">Buka layanan<ArrowUpRight className="size-3.5" /></Link>}
        </div>)}
      </div>
    </div>
    <section aria-label="Pesanan terbaru" className="mt-8 min-w-0">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Pesanan terbaru</h2>
        <Link href="/dashboard/pesanan" className="text-xs text-primary">Lihat semua</Link>
      </div>
      {history.isPending && <p role="status" className="text-sm text-muted-foreground">Memuat pesanan…</p>}
      {history.isError && !history.data && <OrderHistoryError retry={() => void history.refetch()} />}
      {orders.length > 0 && <div className="flex flex-col gap-3">
        {orders.slice(0, 5).map(order => <OrderDetailDialog invoice={order.id} key={order.id}>
          <button type="button" className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4 text-left hover:ring-1 hover:ring-primary focus-visible:ring-2 focus-visible:ring-primary">
            <span className="min-w-0">
              <span className="block break-words text-sm font-medium">{order.document_name}</span>
              <span className="mt-1 block text-xs text-muted-foreground">Shield · {dateLabel(order.created_at)}</span>
            </span>
            <Status order={order} />
          </button>
        </OrderDetailDialog>)}
      </div>}
      {history.isSuccess && !orders.length && <Empty title="Belum ada pesanan" description="Buat pesanan untuk memeriksa dokumen dengan Gleans Shield." />}
    </section>
  </>;
}
