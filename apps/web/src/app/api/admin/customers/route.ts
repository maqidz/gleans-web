import { mapAdminOrders, type AdminOrderRow } from "@/features/admin/lib/live-data";
import { currentAdmin } from "@/features/auth/session";
import { json } from "@/features/payments/server/http";
import { paymentAdmin } from "@/features/payments/server/repository";

type BillingRow = {
  id: string;
  owner_id: string;
  kind: "topup" | "package" | "shield";
  method: "qris" | "balance" | "quota";
  amount: number;
  quota: number;
};

export async function GET() {
  try {
    if (!await currentAdmin()) return json({ error: "Akses ditolak." }, 403);
    const database = paymentAdmin().database;
    const { data, error, count } = await database.from("duitku_orders")
      .select("id,owner_id,customer_name,email,whatsapp,document_name,amount,status,fulfillment_status,created_at,completed_at", { count: "exact" })
      .not("owner_id", "is", null).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(500);
    if (error || !data) throw error ?? new Error("CUSTOMERS_UNAVAILABLE");

    const { customers, orders } = mapAdminOrders(data as AdminOrderRow[]);
    const byId = new Map(customers.map(customer => [customer.id, customer]));
    const owners = [...byId.keys()];

    // Match billing_totals. Load only paid ledger entries for the customers in this view.
    for (let offset = 0; offset < owners.length; offset += 100) {
      const group = owners.slice(offset, offset + 100);
      let cursor: string | undefined;
      while (true) {
        const query = database.from("billing_transactions").select("id,owner_id,kind,method,amount,quota")
          .in("owner_id", group).eq("status", "paid").order("id", { ascending: true }).limit(500);
        if (cursor) query.gt("id", cursor);
        const { data: entries, error: billingError } = await query;
        if (billingError || !entries) throw billingError ?? new Error("BILLING_UNAVAILABLE");
        const rows = entries as BillingRow[];
        if (!rows.length) break;
        for (const row of rows) {
          const customer = byId.get(row.owner_id);
          if (!customer) continue;
          if (row.kind === "topup") customer.balance += row.amount;
          else if (row.method === "balance") customer.balance -= row.amount;
          if (row.kind === "package") customer.quota += row.quota;
          else if (row.method === "quota") customer.quota -= 1;
        }
        cursor = rows[rows.length - 1].id;
      }
    }

    return json({ customers, orders, limited: (count ?? data.length) > data.length });
  } catch {
    return json({ error: "Data pelanggan belum dapat dimuat. Coba lagi." }, 503);
  }
}
