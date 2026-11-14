"use client";

import { useEffect, useState } from "react";
import { NotificationDialog, type NotificationItem } from "@/components/notifications/notification-dialog";
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
  const items: NotificationItem[] = ready && now ? state.orders.flatMap(order => {
    const access = shieldAccess(order.completedAt, now);
    const title = order.processing === "Gagal" ? "Pemeriksaan gagal" : order.failureReason === "rate_limit" ? "Menunggu pemeriksaan admin" : order.payment === "Menunggu" ? "Pembayaran menunggu" : order.processing === "Selesai" && access.status === "expired" ? "Masa unduh berakhir" : order.processing === "Selesai" && access.status === "available" ? "Hasil Shield tersedia" : "";
    if (!title) return [];
    const kind: NotificationItem["kind"] = order.processing === "Gagal" ? "failed" : order.failureReason === "rate_limit" ? "queued" : order.payment === "Menunggu" ? "payment" : access.status === "expired" ? "expired" : "ready";
    const description = kind === "failed" ? "Pemeriksaan mengalami kendala. Periksa detail pesanan untuk menindaklanjuti." : kind === "queued" ? "Unduh dokumen dan lakukan pemeriksaan manual di GPTZero." : kind === "payment" ? "Pesanan dapat diproses setelah pembayaran berhasil." : kind === "expired" ? "Masa unduh dokumen dan laporan selama 24 jam telah berakhir." : "Laporan pemeriksaan sudah tersedia untuk pelanggan.";
    const createdAt = kind === "expired" ? access.expiresAt! : order.completedAt || `${order.date}T00:00:00+07:00`;
    return [{ id: `${order.id}:${title}:${order.completedAt || order.date}`, href: `/admin/pesanan?detail=${order.id}`, title, description, createdAt, kind, document: `${order.id} · ${order.document}` }];
  }) : [];
  function mark(ids: string[]) {
    const next = [...new Set([...read, ...ids])]; setRead(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  }
  return <NotificationDialog items={items} read={read} now={now} open={open} onOpenChange={setOpen} onRead={mark} label="Notifikasi admin" triggerClassName="lg:fixed lg:left-[260px] lg:top-7 lg:z-20"/>;
}
