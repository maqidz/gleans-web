import { currentAdmin } from "@/features/auth/session";
import { z } from "zod";
import { after } from "next/server";
import { dispatchReportNotifications } from "@/features/whatsapp/server/dispatch";
import { fonnteConfigured } from "@/features/whatsapp/server/fonnte";
import { guestSession } from "@/features/payments/server/guest";
import { findUpload, freezeUpload } from "@/features/payments/server/uploads";
import { findOrder, paymentAdmin } from "@/features/payments/server/repository";
import { json, sameOrigin } from "@/features/payments/server/http";
export const runtime = "nodejs";
export const maxDuration = 60;
const reportDetails = z.object({ aiScore: z.number().min(0).max(100).multipleOf(0.01) }).strict();
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return json({ error: "Permintaan tidak diizinkan." }, 403);
  try {
    const { id } = await context.params;
    if (!/^[a-f0-9-]{36}$/.test(id)) return json({ error: "Unggahan tidak ditemukan." }, 404);
    const guest = await guestSession(); const ticket = await findUpload(id);
    if (!guest || !ticket || ticket.guest_hash !== guest.hash || Date.parse(ticket.expires_at) <= Date.now()) return json({ error: "Unggahan tidak ditemukan atau telah kedaluwarsa. Unggah kembali." }, 404);
    if (ticket.purpose === "report" && !await currentAdmin()) return json({ error: "Akses ditolak." }, 403);
    let aiScore: number | undefined;
    if (ticket.purpose === "report") {
      const raw = await request.text();
      if (raw.length > 256) return json({ error: "Data laporan terlalu besar." }, 413);
      const parsed = reportDetails.safeParse(JSON.parse(raw || "{}"));
      if (!parsed.success) return json({ error: "Isi skor AI antara 0 dan 100, maksimal dua desimal." }, 400);
      aiScore = parsed.data.aiScore;
    }
    await freezeUpload(ticket);
    if (ticket.purpose === "report") {
      const order = await findOrder(ticket.order_id!);
      if (!order || order.status !== "paid") return json({ error: "Pembayaran belum terverifikasi." }, 409);
      if (order.fulfillment_status !== "completed") {
        const stored = (await findUpload(id))!; const now = Date.now();
        const { error } = await paymentAdmin().database.from("duitku_orders").update({ ai_score: aiScore, fulfillment_status: "completed", report_key: stored.final_key, report_url: stored.document_url, report_name: stored.document_name, completed_at: new Date(now).toISOString(), report_expires_at: new Date(now + 86400000).toISOString() }).eq("id", order.id).eq("status", "paid").neq("fulfillment_status", "completed");
        if (error) throw new Error("REPORT_UNAVAILABLE");
      }
      if (fonnteConfigured()) after(async () => {
        try { await dispatchReportNotifications(); }
        catch { console.error("Shield WhatsApp dispatch deferred; check notification queue."); }
      });
    }
    return json({ ticket: id, confirmed: true });
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Data laporan tidak valid." }, 400);
    const invalid = error instanceof Error && error.message === "INVALID_DOCUMENT_FORMAT";
    return json({ error: invalid ? "Isi dokumen tidak sesuai format file. Silakan unggah file yang valid." : "Dokumen belum dapat dikonfirmasi. Silakan unggah kembali." }, invalid ? 400 : 503);
  }
}
