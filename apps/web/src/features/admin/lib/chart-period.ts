export type ChartRange = { from: string; to: string };
export type ChartPreset = "last7" | "last14" | "last30" | "last90" | "custom";

export const CHART_PRESETS = [
  { value: "last7", label: "7 hari terakhir" },
  { value: "last14", label: "14 hari terakhir" },
  { value: "last30", label: "30 hari terakhir" },
  { value: "last90", label: "90 hari terakhir" },
  { value: "custom", label: "Kustom" },
] as const;

export function jakartaToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function shiftDate(date: string, days: number) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function monthStart(date: string) { return `${date.slice(0, 7)}-01`; }

export function shiftMonth(date: string, months: number) {
  const next = new Date(`${monthStart(date)}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next.toISOString().slice(0, 10);
}

export function presetRange(preset: Exclude<ChartPreset, "custom">, today: string): ChartRange {
  switch (preset) {
    case "last7": return { from: shiftDate(today, -6), to: today };
    case "last14": return { from: shiftDate(today, -13), to: today };
    case "last30": return { from: shiftDate(today, -29), to: today };
    case "last90": return { from: shiftDate(today, -89), to: today };
  }
}

export function rangeDates({ from, to }: ChartRange) {
  const dates: string[] = [];
  for (let date = from; date <= to; date = shiftDate(date, 1)) dates.push(date);
  return dates;
}

export function rangeLabel({ from, to }: ChartRange) {
  const formatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "UTC" });
  return formatter.formatRange(new Date(`${from}T00:00:00Z`), new Date(`${to}T00:00:00Z`));
}

export function chartHistory(orders: readonly { date: string; payment: string; amount: number }[], range: ChartRange) {
  const totals = new Map<string, { orders: number; income: number }>();
  for (const order of orders) {
    if (order.date < range.from || order.date > range.to) continue;
    const total = totals.get(order.date) ?? { orders: 0, income: 0 };
    total.orders++;
    if (order.payment === "Berhasil") total.income += order.amount;
    totals.set(order.date, total);
  }
  return rangeDates(range).map(date => ({ date, ...(totals.get(date) ?? { orders: 0, income: 0 }) }));
}
