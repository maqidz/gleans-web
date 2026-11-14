import { currentAdmin } from "@/features/auth/session";
import { paymentAdmin } from "@/features/payments/server/repository";
import { json } from "@/features/payments/server/http";
import { mapAdminOrders, type AdminOrderRow } from "@/features/admin/lib/live-data";

export async function GET() {
  try {
    if (!await currentAdmin()) return json({ error: "Akses ditolak." }, 403);
    const { data, error, count } = await paymentAdmin().database.from("duitku_orders")
      .select("id,owner_id,customer_name,whatsapp,document_name,amount,status,fulfillment_status,created_at,completed_at", { count: "exact" })
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(500);
    if (error || !data) throw new Error("DATABASE_UNAVAILABLE");
    return json({ state: mapAdminOrders(data as AdminOrderRow[]), limited: (count ?? data.length) > data.length });
  } catch { return json({ error: "Data admin belum dapat dimuat. Coba muat ulang." }, 503); }
}
