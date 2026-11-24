import "server-only";
import { DEFAULT_REPORT_TEMPLATE, renderReportTemplate, usesPromo, type WhatsAppPromo } from "../template";

export function reportReadyMessage(order: { id: string; report_expires_at: string; customer_name?: string; document_name?: string; ai_score?: number | null }, origin: string, template = DEFAULT_REPORT_TEMPLATE, promo?: WhatsAppPromo, downloadUrl?: string) {
  const base = new URL(origin);
  if (base.protocol !== "https:") throw new Error("WHATSAPP_PUBLIC_URL_REQUIRED");
  const expiry = new Date(order.report_expires_at).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta", dateStyle: "long", timeStyle: "short",
  });
  const link = new URL(`/cek-pesanan/${encodeURIComponent(order.id)}`, base.origin);
  if (downloadUrl && new URL(downloadUrl).protocol !== "https:") throw new Error("WHATSAPP_REPORT_URL_INVALID");
  if (template.includes("{skor_ai}") && (order.ai_score == null || !Number.isFinite(order.ai_score) || order.ai_score < 0 || order.ai_score > 100)) throw new Error("WHATSAPP_SCORE_MISSING");
  if (usesPromo(template) && !promo) throw new Error("WHATSAPP_PROMO_UNAVAILABLE");
  return renderReportTemplate(template, { nama: order.customer_name || "Pelanggan Gleans", invoice: order.id,
    dokumen: order.document_name || "Dokumen Shield", nama_file: order.document_name || "Dokumen Shield",
    skor_ai: order.ai_score == null ? "" : order.ai_score.toLocaleString("id-ID", { maximumFractionDigits: 2 }),
    tautan_hasil: link.href, link_hasil: downloadUrl || link.href, batas_unduh: `${expiry} WIB`,
    diskon: promo ? String(promo.discount) : "", kode_promo: promo?.code ?? "",
    masa_berlaku: promo ? `sampai ${new Date(`${promo.endsOn}T00:00:00+07:00`).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long" })}` : "" });
}
