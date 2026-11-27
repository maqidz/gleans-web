"use client";

import { useEffect, useRef, useState } from "react";
import { Popover } from "radix-ui";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@gleans/ui/button";
import { cn } from "@/lib/utils";
import { CHART_PRESETS, monthStart, presetRange, rangeLabel, shiftDate, shiftMonth, type ChartPreset, type ChartRange } from "../lib/chart-period";

type Props = { today: string; value: ChartRange; preset: ChartPreset; onChange: (range: ChartRange, preset: ChartPreset) => void };

export function ChartPeriodPicker({ today, value, preset, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ from: string; to?: string }>(value);
  const [customOpen, setCustomOpen] = useState(false);
  const [month, setMonth] = useState(monthStart(value.to));
  const customPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (customOpen) customPanel.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [customOpen]);
  const selectedLabel = preset === "custom" ? rangeLabel(value) : CHART_PRESETS.find(item => item.value === preset)!.label;
  function selectDate(date: string) {
    setDraft(previous => previous.to ? { from: date } : date < previous.from ? { from: date, to: previous.from } : { from: previous.from, to: date });
  }

  return <Popover.Root open={open} onOpenChange={next => {
    if (next) { setDraft(value); setCustomOpen(false); setMonth(monthStart(value.to)); }
    setOpen(next);
  }}>
    <Popover.Trigger asChild>
      <button type="button" aria-label={`Periode grafik: ${selectedLabel}`} className="inline-flex h-10 max-w-full items-center gap-2 rounded-full border bg-card px-4 text-sm outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-primary data-[state=open]:border-primary">
        <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <span className="hidden border-r pr-2 text-muted-foreground sm:inline">Periode</span>
        <span className="min-w-0 truncate">{selectedLabel}</span>
        <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content data-slot="popover-content" aria-label={customOpen ? "Pilih tanggal kustom" : "Pilih periode grafik"} align="end" sideOffset={8} collisionPadding={16} className={cn("z-50 max-h-[var(--radix-popover-content-available-height)] overflow-y-auto rounded-[24px] border bg-popover text-popover-foreground shadow-xl outline-none", customOpen ? "w-[min(664px,calc(100vw-32px))]" : "w-52 p-1.5")}>
        {!customOpen ? <div role="group" aria-label="Pilihan periode" className="flex flex-col gap-1">
          {CHART_PRESETS.map(item => <button key={item.value} type="button" aria-pressed={preset === item.value} onClick={() => {
            if (item.value === "custom") setCustomOpen(true);
            else { onChange(presetRange(item.value, today), item.value); setOpen(false); }
          }} className={cn("flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary", preset === item.value && "bg-accent font-medium text-primary")}>
            {item.label}{preset === item.value && <Check aria-hidden="true" className="size-4 shrink-0" />}
          </button>)}
        </div> : <div ref={customPanel} className="min-w-0 p-3 sm:p-4">
          <div className="relative">
            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between">
              <Button type="button" variant="ghost" size="icon" aria-label="Bulan sebelumnya" className="pointer-events-auto" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Bulan berikutnya" className="pointer-events-auto" disabled={month >= monthStart(today)} onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight /></Button>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="hidden md:block"><MonthCalendar month={shiftMonth(month, -1)} today={today} range={draft} onSelect={selectDate} /></div>
              <MonthCalendar month={month} today={today} range={draft} onSelect={selectDate} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p aria-live="polite" className="text-xs text-muted-foreground">{draft.to ? rangeLabel({ from: draft.from, to: draft.to }) : "Pilih tanggal akhir."}</p>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" size="pill-sm" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="button" size="pill-sm" disabled={!draft.to} onClick={() => { if (draft.to) { onChange({ from: draft.from, to: draft.to }, "custom"); setOpen(false); } }}>Terapkan</Button>
            </div>
          </div>
        </div>}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}

function MonthCalendar({ month, today, range, onSelect }: { month: string; today: string; range: { from: string; to?: string }; onSelect: (date: string) => void }) {
  const first = new Date(`${month}T00:00:00Z`);
  const count = Number(shiftDate(shiftMonth(month, 1), -1).slice(-2));
  const cells = Array.from({ length: Math.ceil((first.getUTCDay() + count) / 7) * 7 }, (_, index) => {
    const day = index - first.getUTCDay() + 1;
    return day >= 1 && day <= count ? `${month.slice(0, 7)}-${String(day).padStart(2, "0")}` : null;
  });
  const name = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const dateName = new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: "UTC" });
  return <table className="w-full table-fixed border-collapse text-center text-sm" aria-label={name}>
    <caption className="mb-3 h-8 px-8 pt-1 text-sm font-medium capitalize">{name}</caption>
    <thead><tr>{["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map(day => <th scope="col" key={day} className="h-9 text-xs font-normal text-muted-foreground">{day}</th>)}</tr></thead>
    <tbody>{Array.from({ length: cells.length / 7 }, (_, week) => <tr key={week}>
      {cells.slice(week * 7, week * 7 + 7).map((date, index) => {
        const endpoint = date !== null && (date === range.from || date === range.to);
        const inside = date !== null && range.to !== undefined && date >= range.from && date <= range.to;
        return <td key={date ?? `empty-${index}`} className={cn("h-10 p-0", inside && "bg-accent", date === range.from && "rounded-l-full", date === range.to && "rounded-r-full")}>
          {date && <button type="button" aria-label={dateName.format(new Date(`${date}T00:00:00Z`))} aria-pressed={endpoint || inside} aria-current={date === today ? "date" : undefined} disabled={date > today} onClick={() => onSelect(date)} className={cn("relative mx-auto grid size-9 place-items-center rounded-full outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-25", endpoint && "bg-primary text-primary-foreground hover:bg-primary/90", date === today && "font-semibold after:absolute after:bottom-1 after:size-1 after:rounded-full after:bg-current")}>
            {Number(date.slice(-2))}
          </button>}
        </td>;
      })}
    </tr>)}</tbody>
  </table>;
}
