import { currentAdmin } from "@/features/auth/session";
import { ORDER_COLUMNS, paymentAdmin } from "@/features/payments/server/repository";
import { json } from "@/features/payments/server/http";
export async function GET(request: Request) {
  try {
    if (!await currentAdmin()) return json({ error: "Akses ditolak." }, 403);
    if (new URL(request.url).searchParams.get("watch") === "1") {
      const { data, error } = await paymentAdmin().database.from("duitku_orders")
        .select("id,created_at").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1);
      if (error) throw new Error("DATABASE_UNAVAILABLE");
      return json({ latest: data?.[0] ?? null });
    }
    const { data, error } = await paymentAdmin().database.from("duitku_orders").select(`${ORDER_COLUMNS},whatsapp,customer_name`).order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error("DATABASE_UNAVAILABLE"); return json({ orders: data });
  } catch { return json({ error: "Pesanan belum dapat dimuat." }, 503); }
}
