import type { AdminState } from "./model";

export type AdminOrderRow = {
  id: string; owner_id: string | null; customer_name: string; whatsapp: string;
  email?: string | null;
  document_name: string; amount: number; status: string;
  fulfillment_status: string; created_at: string; completed_at: string | null;
};
export function emptyAdminState(): AdminState {
  return { demoVersion: 0, admins: [], customers: [], orders: [], plans: [], blogs: [], promos: [], transactions: [], activity: [],
    settings: { email: "team@gleans.my.id", whatsapp: "6281995473482", maxMb: 25, minWords: 1, maxWords: 25000, shieldPrice: 10000, shield: true, cite: true, file: true } };
}
export function mapAdminOrders(rows: AdminOrderRow[]): AdminState {
  const state = emptyAdminState();
  const customers = new Map<string, AdminState["customers"][number]>();
  for (const row of rows) {
    // Account identity is authoritative. Guest contacts are not proof of account ownership.
    const phone = row.whatsapp.replace(/\D/g, "").replace(/^0/, "62");
    const customerId = row.owner_id || `guest:${phone || row.id}`;
    if (!customers.has(customerId)) customers.set(customerId, {
      id: customerId, name: row.customer_name || "Pelanggan tamu", whatsapp: row.whatsapp,
      email: row.owner_id ? row.email || "" : "", balance: 0, quota: 0,
    });
    state.orders.push({ id: row.id, customerId, document: row.document_name, amount: row.amount,
      payment: row.status === "paid" ? "Berhasil" : row.status === "expired" ? "Kedaluwarsa" : row.status === "failed" ? "Gagal" : "Menunggu",
      processing: row.status !== "paid" ? "Belum diproses" : row.fulfillment_status === "completed" ? "Selesai" : row.fulfillment_status === "processing" ? "Diproses" : row.fulfillment_status === "failed" ? "Gagal" : "Antre",
      delivery: "Belum dikirim", note: "", completedAt: row.completed_at || undefined,
      date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(row.created_at)),
    });
  }
  state.customers = [...customers.values()];
  return state;
}
