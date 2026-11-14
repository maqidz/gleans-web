"use client";

import Link from "next/link";
import { Bell, CheckCheck, CircleAlert, Clock3, FileCheck2, Hourglass, Wallet, X } from "lucide-react";
import { Button } from "@gleans/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@gleans/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@gleans/ui/tabs";

export type NotificationItem = {
  id: string;
  href: string;
  title: string;
  description: string;
  document: string;
  createdAt: string;
  kind: "payment" | "ready" | "expired" | "failed" | "queued";
};

const appearance = {
  payment: { icon: Wallet, color: "bg-blue-50 text-blue-600" },
  ready: { icon: FileCheck2, color: "bg-lime-100 text-lime-700" },
  expired: { icon: Clock3, color: "bg-slate-100 text-slate-500" },
  failed: { icon: CircleAlert, color: "bg-rose-50 text-rose-600" },
  queued: { icon: Hourglass, color: "bg-amber-50 text-amber-600" },
};
const filters = [
  { value: "all", label: "Semua" },
  { value: "payment", label: "Pembayaran" },
  { value: "inspection", label: "Pemeriksaan" },
] as const;

function relativeTime(value: string, now: number) {
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return "";
  const minutes = Math.max(0, Math.floor((now - date) / 60000));
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} mnt`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} jam`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)} hari`;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(new Date(date));
}

export function NotificationDialog({ items, read, now, open, onOpenChange, onRead, label, triggerClassName = "" }: {
  items: NotificationItem[];
  read: string[];
  now: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRead: (ids: string[]) => void;
  label: string;
  triggerClassName?: string;
}) {
  const unread = items.filter(item => !read.includes(item.id)).length;
  const sorted = [...items].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  const filtered = (value: string) => sorted.filter(item => value === "all" || (value === "payment" ? item.kind === "payment" : item.kind !== "payment"));
  function visit(id: string) { onRead([id]); onOpenChange(false); }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogTrigger asChild>
      <Button variant="ghost" size="icon" className={`relative rounded-full ${triggerClassName}`} aria-label={`${label}${unread ? `, ${unread} belum dibaca` : ""}`}>
        <Bell className="size-5"/>
        {unread > 0 && <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
      </Button>
    </DialogTrigger>
    <DialogContent showCloseButton={false} className="flex max-h-[min(82dvh,720px)] max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden rounded-[28px] p-0 sm:max-w-[560px]">
      <DialogHeader className="shrink-0 px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle className="text-xl leading-tight sm:text-2xl">Notifikasi</DialogTitle>
            <DialogDescription className="mt-1.5 text-sm">{unread ? `${unread} belum dibaca` : "Semua telah dibaca"}</DialogDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" disabled={!unread} onClick={() => onRead(items.map(item => item.id))} aria-label="Tandai semua telah dibaca" className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-primary/10 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-45 sm:min-h-10 sm:text-sm">
              <CheckCheck className="hidden size-4 sm:block"/>Tandai semua
            </button>
            <DialogClose asChild><Button variant="ghost" size="icon-sm" className="shrink-0 rounded-full text-muted-foreground" aria-label="Tutup notifikasi"><X className="size-4"/></Button></DialogClose>
          </div>
        </div>
      </DialogHeader>
      <Tabs defaultValue="all" className="min-h-0 flex-1 gap-4 overflow-hidden px-3 pb-3 sm:px-4 sm:pb-4">
        <TabsList aria-label="Filter notifikasi" className="mx-2 grid w-auto shrink-0 grid-cols-3 rounded-2xl bg-surface p-1 group-data-horizontal/tabs:h-12">
          {filters.map(filter => <TabsTrigger key={filter.value} value={filter.value} className="h-full gap-1 rounded-xl border-0 px-1 text-xs font-normal data-active:shadow-sm sm:gap-2 sm:text-sm">
            {filter.label}<span className="rounded-md bg-muted-foreground/10 px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground sm:text-xs">{filtered(filter.value).length}</span>
          </TabsTrigger>)}
        </TabsList>
        {filters.map(filter => <TabsContent key={filter.value} value={filter.value} className="min-h-0 overflow-y-auto overscroll-contain px-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary">
          <ul aria-label={`Daftar notifikasi ${filter.label.toLowerCase()}`} className="space-y-2.5 sm:space-y-3">
            {filtered(filter.value).map(item => {
              const isUnread = !read.includes(item.id);
              const visual = appearance[item.kind];
              const Icon = visual.icon;
              return <li key={item.id} className="rounded-[18px] border border-border bg-white p-4 sm:p-5">
                <div className="flex items-start gap-3 sm:gap-4">
                  <span aria-hidden="true" className={`flex size-10 shrink-0 items-center justify-center rounded-full sm:size-12 ${visual.color}`}><Icon className="size-5 sm:size-6"/></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={item.href} onClick={() => visit(item.id)} className={`rounded-sm text-sm leading-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:text-base sm:leading-6 ${isUnread ? "font-medium" : "font-normal"}`}>{item.title}</Link>
                      <div className="flex shrink-0 items-center gap-2 pt-0.5">
                        <time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} className="whitespace-nowrap text-[10px] leading-5 text-muted-foreground sm:text-xs">{relativeTime(item.createdAt, now)}</time>
                        {isUnread && <span className="size-2 shrink-0 rounded-full bg-primary"><span className="sr-only">Belum dibaca</span></span>}
                      </div>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">{item.description}</p>
                    <p className="mt-2 truncate text-[11px] text-muted-foreground/80 sm:text-xs" title={item.document}>{item.document}</p>
                    <Button asChild variant="outline" size="pill-sm" className="mt-3 min-h-8 rounded-full border-border bg-white px-3 text-xs shadow-none sm:text-sm"><Link href={item.href} onClick={() => visit(item.id)}>Lihat pesanan</Link></Button>
                  </div>
                </div>
              </li>;
            })}
            {!filtered(filter.value).length && <li className="flex flex-col items-center gap-3 px-5 py-12 text-center"><span className="flex size-12 items-center justify-center rounded-full bg-white text-muted-foreground"><Bell className="size-5"/></span><p className="text-sm text-muted-foreground">{filter.value === "all" ? "Belum ada notifikasi." : `Belum ada notifikasi ${filter.label.toLowerCase()}.`}</p></li>}
          </ul>
        </TabsContent>)}
      </Tabs>
    </DialogContent>
  </Dialog>;
}
