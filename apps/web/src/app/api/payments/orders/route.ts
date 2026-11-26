import { reserveInvoice } from "@/features/payments/server/invoice";
import { z } from "zod";
import { dashboardUser, serverClient } from "@/features/auth/server";
import { readActivePromo } from "@/features/admin/lib/site-editor";
import { resolvePromo, whatsappSchema } from "@/features/orders/lib/pricing";
import { readShieldPrice } from "@/features/orders/lib/shield-pricing";
import { MAX_SHIELD_PRICE, SHIELD_PRICE } from "@/lib/plans";
import { duitkuConfig } from "@/features/payments/server/duitku";
import { ORDER_COLUMNS, paymentAdmin, publicOrder, type StoredOrder } from "@/features/payments/server/repository";
import { guestSession, accessDigest, orderAccessCode } from "@/features/payments/server/guest";
import { json, paymentError, sameOrigin } from "@/features/payments/server/http";
import { hasCompletedShieldCheck } from "@/features/orders/server/promo-eligibility";
import { RECHECK_PROMO_MESSAGE } from "@/features/orders/lib/promo-eligibility";
export const runtime = "nodejs";
const schema = z.object({ requestId: z.string().uuid(), ticketId: z.string().uuid(), words: z.number().int().min(0).max(25000), whatsapp: whatsappSchema, email: z.string().trim().email().max(50).optional(), name: z.string().trim().min(1).max(80).optional(), promo: z.string().max(40).optional(), method: z.enum(["qris", "balance", "quota"]).default("qris"), expectedAmount: z.number().int().min(1).max(MAX_SHIELD_PRICE).optional() }).strict();
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Permintaan tidak diizinkan." }, 403);
  try {
    duitkuConfig();
    const raw = await request.text(); if (raw.length > 4096) return json({ error: "Data pesanan terlalu besar." }, 413);
    const parsed = schema.safeParse(JSON.parse(raw)); if (!parsed.success) return json({ error: "Data pesanan tidak valid." }, 400);
    const input = parsed.data;
    const [user, guest, price] = await Promise.all([dashboardUser(), guestSession(), readShieldPrice()]);
    if (input.method !== "qris" && !user) return json({ error: "Masuk untuk menggunakan saldo atau kuota Gleans." }, 401);
    if (!guest) return json({ error: "Unggah dokumen terlebih dahulu." }, 400);
    const email = input.email || user?.email || "";
    const promo = input.promo ? await readActivePromo(input.promo, price) : null;
    const invalidPromo = Boolean(input.promo && !promo);
    const ineligiblePromo = Boolean(promo?.requiresCompletedCheck && !await hasCompletedShieldCheck({ userId: user?.id, guestHash: guest.hash }));
    const amount = price - (promo?.discount ?? 0);
    const admin = paymentAdmin();
    const created = (order: StoredOrder) => json({
      order: publicOrder(order),
      access_code: order.guest_hash === guest.hash ? orderAccessCode(guest.secret, order.id) : null,
    }, 201);
    const expectedAmount = input.expectedAmount ?? SHIELD_PRICE - (input.promo ? resolvePromo(input.promo, SHIELD_PRICE)?.discount ?? 0 : 0);
    if (invalidPromo || ineligiblePromo || (input.method !== "quota" && expectedAmount !== amount)) {
      // A retry of a request that already created an invoice keeps its original amount.
      const existing = admin.database.from("duitku_orders").select(`${ORDER_COLUMNS},guest_hash`).eq("request_key", input.requestId);
      const scoped = !user ? existing.eq("guest_hash", guest.hash)
        : input.method !== "qris" ? existing.eq("owner_id", user.id)
        : existing.or(`guest_hash.eq.${guest.hash},owner_id.eq.${user.id}`);
      const { data, error } = await scoped.limit(1).maybeSingle();
      if (error) throw new Error("DATABASE_UNAVAILABLE");
      if (data) {
        const existingMethod = data.payment_method === "balance" || data.payment_method === "quota" ? data.payment_method : "qris";
        if (existingMethod !== input.method) return json({ error: "Pesanan ini sudah memakai metode pembayaran lain." }, 409);
        return created(data as StoredOrder);
      }
      if (invalidPromo) return json({ error: "Kode promo sudah tidak berlaku. Kembali ke formulir untuk melanjutkan pesanan." }, 400);
      if (ineligiblePromo) return json({ error: RECHECK_PROMO_MESSAGE, code: "PROMO_REQUIRES_COMPLETED_CHECK" }, 403);
      return json({ error: "Tarif Shield berubah. Periksa total baru sebelum melanjutkan pembayaran.", code: "SHIELD_PRICE_CHANGED", amount }, 409);
    }
    const { data, error } = await reserveInvoice(id => {
      const args = {
        p_id: id, p_owner: user?.id ?? null, p_guest: guest.hash, p_access: accessDigest(orderAccessCode(guest.secret, id)), p_request: input.requestId, p_ticket: input.ticketId,
        p_email: email, p_name: input.name || user?.name || "Pelanggan Gleans", p_whatsapp: input.whatsapp,
        p_words: input.words, p_amount: amount, p_promo: promo?.code ?? null,
      };
      return input.method === "qris"
        ? admin.database.rpc("reserve_guest_order", args)
        : admin.database.rpc("reserve_billed_shield_order", { ...args, p_method: input.method });
    });
    if (error) {
      if (error.message.includes("INSUFFICIENT_BALANCE")) return json({ error: "Saldo Gleans belum cukup." }, 409);
      if (error.message.includes("INSUFFICIENT_QUOTA")) return json({ error: "Kuota Shield sudah habis." }, 409);
      if (error.message.includes("BILLING_REQUEST_CONFLICT")) return json({ error: "Pesanan ini sudah memakai metode pembayaran lain." }, 409);
      if (error.message.includes("RATE_LIMIT")) return json({ error: "Terlalu banyak pesanan. Lanjutkan pesanan yang sudah ada atau coba lagi nanti." }, 429);
      if (error.message.includes("INVALID_UPLOAD")) return json({ error: "Dokumen tidak valid atau telah digunakan. Silakan unggah kembali." }, 400);
      throw new Error("DATABASE_UNAVAILABLE");
    }
    const order = data as StoredOrder;
    if (input.method === "qris" && ["balance", "quota"].includes(order.payment_method ?? "")) {
      return json({ error: "Pesanan ini sudah memakai metode pembayaran lain." }, 409);
    }
    return created(order);
  } catch (error) { if (error instanceof SyntaxError) return json({ error: "Data tidak valid." }, 400); return paymentError(error); }
}
export async function GET(request: Request) {
  try {
    const user = await dashboardUser(); if (!user) return json({ error: "Silakan masuk terlebih dahulu." }, 401);
    const page = Number(new URL(request.url).searchParams.get("page") ?? "0");
    if (!Number.isSafeInteger(page) || page < 0 || page > 100_000) return json({ error: "Halaman pesanan tidak valid." }, 400);
    const pageSize = 30;
    const start = page * pageSize;
    const { data, error, count } = await (await serverClient()).database.from("duitku_orders")
      .select("id,document_name,amount,status,payment_method,created_at,fulfillment_status,completed_at,report_expires_at", { count: "exact" })
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(start, start + pageSize - 1);
    if (error || !data || count == null) return json({ error: "Pesanan belum dapat dimuat. Coba lagi." }, 503);
    return json({ orders: data, total: count, nextPage: data.length > 0 && start + data.length < count ? page + 1 : undefined });
  } catch { return json({ error: "Pesanan belum dapat dimuat. Coba lagi." }, 503); }
}
