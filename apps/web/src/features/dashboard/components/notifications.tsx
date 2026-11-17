"use client";

import { useEffect, useState } from "react";
import { NotificationDialog, type NotificationItem } from "@/components/notifications/notification-dialog";
import { useDashboard } from "./provider";

export function DashboardNotifications() {
  const { account, orders } = useDashboard();
  const storageKey = `gleans:dashboard-notifications:read:v1:${account.id}`;
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<string[]>([]);
  const [now, setNow] = useState(0);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(storageKey) || "[]"); if (Array.isArray(saved)) setRead(saved.filter(x => typeof x === "string")); } catch {}
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [storageKey]);
  const items: NotificationItem[] = now ? orders.flatMap(order => {
    let kind: NotificationItem["kind"];
    let createdAt = order.completed_at ?? order.created_at;
    if (order.status === "pending") {
      kind = "payment";
    } else if (order.status === "paid" && order.fulfillment_status === "failed") {
      kind = "failed";
    } else if (order.status === "paid" && order.fulfillment_status === "completed" && order.report_expires_at) {
      kind = Date.parse(order.report_expires_at) <= now ? "expired" : "ready";
      if (kind === "expired") createdAt = order.report_expires_at;
    } else {
      return [];
    }
    const { title, description } = messages[kind];
    return [{
      id: `${order.id}:${kind}:${createdAt}`, href: `/cek-pesanan/${encodeURIComponent(order.id)}`,
      title, description, createdAt, kind, document: `${order.id} · ${order.document_name}`,
    }];
  }) : [];
  function mark(ids: string[]) {
    const next = [...new Set([...read, ...ids])]; setRead(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
  }
  return <NotificationDialog items={items} read={read} now={now} open={open} onOpenChange={setOpen} onRead={mark} label="Notifikasi pengguna"/>;
}

const messages = {
  payment: { title: "Pembayaran menunggu", description: "Selesaikan pembayaran agar dokumenmu dapat diperiksa." },
  failed: { title: "Pemeriksaan gagal", description: "Pemeriksaan mengalami kendala. Buka pesanan untuk melihat detailnya." },
  expired: { title: "Masa unduh berakhir", description: "Masa unduh dokumen dan laporan telah berakhir." },
  ready: { title: "Hasil Shield tersedia", description: "Laporan pemeriksaanmu siap. Unduh sebelum masa akses berakhir." },
};
