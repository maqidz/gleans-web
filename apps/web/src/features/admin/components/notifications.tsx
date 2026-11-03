"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@gleans/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@gleans/ui/dialog";
import { shieldAccess } from "@/lib/shield-retention";
import { useAdmin } from "./provider";
import { normalizeAdminOrderId } from "../lib/model";

const storageKey = "gleans:admin-notifications:read:v1";
export function AdminNotifications() {
  const { state, ready } = useAdmin();
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<string[]>([]);
  const [now, setNow] = useState(0);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(storageKey) || "[]"); if (Array.isArray(saved)) setRead(saved.filter(x => typeof x === "string").map(normalizeAdminOrderId)); } catch {}
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const items = ready && now ? state.orders.flatMap(order => {
    const access = shieldAccess(order.completedAt, now);
    const title = order.processing === "Gagal" ? "Pemeriksaan gagal" : order.failureReason === "rate_limit" ? "Pemeriksaan menunggu layanan" : order.payment === "Menunggu" ? "Pembayaran menunggu" : order.processing === "Selesai" && access.status === "expired" ? "Masa unduh berakhir" : order.processing === "Selesai" && access.status === "available" ? "Hasil Shield tersedia" : "";
    if (!title) return [];
    return [{ id: `${order.id}:${title}:${order.completedAt || order.date}`, href: `/admin/pesanan?detail=${order.id}`, title, document: `${order.id} · ${order.document}` }];
  }) : [];
  const unread = items.filter(x => !read.includes(x.id)).length;
  function mark(ids: string[]) {
    const next = [...new Set([...read, ...ids])]; setRead(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  }
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="ghost" size="icon" className="relative rounded-full lg:fixed lg:left-[260px] lg:top-7 lg:z-20" aria-label={`Notifikasi admin${unread ? `, ${unread} belum dibaca` : ""}`}><Bell className="size-5"/>{unread > 0 && <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}</Button></DialogTrigger>
    <DialogContent className="flex max-h-[75dvh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[420px]">
      <DialogHeader className="shrink-0 px-5 py-4 pr-12">
        <div className="flex min-h-6 items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <DialogTitle>Notifikasi</DialogTitle>
            {unread > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-primary">{unread}</span>}
          </div>
        </div>
        <DialogDescription className="sr-only">Pemberitahuan pesanan. Pilih notifikasi untuk melihat detailnya.</DialogDescription>
      </DialogHeader>
      <div className="flex shrink-0 justify-end px-5 pb-3">
        <button type="button" disabled={!unread} onClick={() => mark(items.map(x => x.id))} className="rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:cursor-default disabled:text-muted-foreground disabled:no-underline">Tandai semua telah dibaca</button>
      </div>
      <ul aria-label="Daftar notifikasi" tabIndex={0} className="min-h-0 max-h-[min(360px,calc(75dvh_-_8rem))] space-y-2 overflow-y-auto overscroll-contain px-4 pb-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary">
        {items.map(item => {
          const isUnread = !read.includes(item.id);
          return <li key={item.id}>
            <Link href={item.href} onClick={() => { mark([item.id]); setOpen(false); }} aria-label={`${item.title}, ${item.document}${isUnread ? ", belum dibaca" : ""}`} className="flex items-center gap-3 rounded-xl border px-4 py-4 transition-colors hover:bg-surface focus-visible:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary">
              <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${isUnread ? "bg-primary" : "bg-transparent"}`}/>
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${isUnread ? "font-medium" : "font-normal"}`}>{item.title}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground" title={item.document}>{item.document}</p>
              </div>
            </Link>
          </li>;
        })}
        {!items.length && <li className="px-5 py-12 text-center text-sm text-muted-foreground">Belum ada notifikasi.</li>}
      </ul>
    </DialogContent>
  </Dialog>;
}
