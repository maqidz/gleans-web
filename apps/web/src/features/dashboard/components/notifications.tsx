"use client";

import { useEffect, useState } from "react";
import { NotificationDialog, type NotificationItem } from "@/components/notifications/notification-dialog";
import { shieldAccess } from "@/lib/shield-retention";
import { useDashboard } from "./provider";

const storageKey = "gleans:dashboard-notifications:read:v1";
export function DashboardNotifications() {
  const { state, ready } = useDashboard();
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<string[]>([]);
  const [now, setNow] = useState(0);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(storageKey) || "[]"); if (Array.isArray(saved)) setRead(saved.filter(x => typeof x === "string")); } catch {}
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const items: NotificationItem[] = ready && now ? state.orders.flatMap(order => {
    const access = shieldAccess(order.completedAt, now);
    const title = order.processing === "failed" ? "Pemeriksaan gagal" : order.failureReason === "rate_limit" ? "Pemeriksaan menunggu layanan" : order.payment === "pending" ? "Pembayaran menunggu" : order.processing === "completed" && access.status === "expired" ? "Masa unduh berakhir" : order.processing === "completed" && access.status === "available" ? "Hasil Shield tersedia" : "";
    if (!title) return [];
    const kind: NotificationItem["kind"] = order.processing === "failed" ? "failed" : order.failureReason === "rate_limit" ? "queued" : order.payment === "pending" ? "payment" : access.status === "expired" ? "expired" : "ready";
    const description = kind === "failed" ? "Pemeriksaan mengalami kendala. Buka pesanan untuk melihat detailnya." : kind === "queued" ? "Dokumenmu tetap dalam antrean dan menunggu layanan tersedia." : kind === "payment" ? "Selesaikan pembayaran agar dokumenmu dapat diperiksa." : kind === "expired" ? "Masa unduh dokumen dan laporan selama 24 jam telah berakhir." : "Laporan pemeriksaanmu siap. Unduh sebelum masa akses berakhir.";
    const createdAt = kind === "expired" ? access.expiresAt! : order.completedAt || order.at;
    return [{ id: `${order.id}:${title}:${order.completedAt || order.at}`, href: `/dashboard/pesanan?detail=${order.id}`, title, description, createdAt, kind, document: `${order.id} · ${order.document}` }];
  }) : [];
  function mark(ids: string[]) {
    const next = [...new Set([...read, ...ids])]; setRead(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  }
  return <NotificationDialog items={items} read={read} now={now} open={open} onOpenChange={setOpen} onRead={mark} label="Notifikasi pengguna"/>;
}
