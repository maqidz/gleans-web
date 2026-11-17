"use client";

import type { ReactNode } from "react";
import { ReceiptText } from "lucide-react";
import { Button } from "@gleans/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@gleans/ui/select";
import { orderStatusLabels } from "@/features/orders/lib/lookup";
import type { AccountOrder } from "@/features/payments/types";
import { cn } from "@/lib/utils";

export const fieldClass = "h-11 w-full min-w-0 rounded-xl border bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary";
export function dateLabel(at: string) { return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(at)); }
export function Panel({ children, className }: { children: ReactNode; className?: string }) { return <section className={cn("min-w-0 rounded-[24px] bg-surface p-4 sm:p-5", className)}>{children}</section>; }
export function Heading({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p></div>{action}</div>; }
export function Empty({ title, description }: { title: string; description: string }) { return <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center"><ReceiptText className="size-8 text-primary" strokeWidth={1.5} /><p className="text-sm font-medium">{title}</p><p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p></div>; }
const fulfillmentLabels = {
  pending: "Menunggu pemeriksaan",
  processing: "Sedang diperiksa",
  completed: "Selesai",
  failed: "Pemeriksaan gagal",
};

export function Status({ order }: { order: AccountOrder }) {
  const paid = order.status === "paid";
  const completed = paid && order.fulfillment_status === "completed";
  const failed = order.status === "failed" || order.status === "expired" || (paid && order.fulfillment_status === "failed");
  const label = paid ? fulfillmentLabels[order.fulfillment_status] : orderStatusLabels[order.status];
  return <span className={cn("inline-flex rounded-full px-3 py-1 text-xs", completed ? "bg-green-50 text-green-700" : failed ? "bg-red-50 text-red-700" : "bg-accent text-primary")}>{label}</span>;
}

export function OrderHistoryError({ retry }: { retry: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
    Pesanan belum dapat dimuat.
    <Button variant="outline" size="pill-sm" onClick={retry}>Muat ulang</Button>
  </div>;
}

export function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return <Select value={value} onValueChange={onChange}>
    <SelectTrigger aria-label={label} className="justify-start gap-2 rounded-full bg-white px-4 data-[size=default]:h-11"><SelectValue /></SelectTrigger>
    <SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
  </Select>;
}
