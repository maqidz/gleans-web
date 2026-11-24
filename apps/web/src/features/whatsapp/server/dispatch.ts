import "server-only";
import { findOrder, paymentAdmin } from "@/features/payments/server/repository";
import { FonnteError, fonnteConfigured, sendWhatsApp } from "./fonnte";
import { reportReadyMessage } from "./messages";
import { listWhatsAppPromos, readWhatsAppSettings } from "./settings";
import { usesPromo } from "../template";
import { PAYMENT_DOCUMENT_BUCKET } from "@/features/payments/types";

type Notification = { id: string; order_id: string; claim_token: string; attempts: number };
type Outcome = "accepted" | "pending" | "failed" | "uncertain" | "skipped";

export async function dispatchReportNotifications() {
  const empty = { checked: 0, accepted: 0, retried: 0, failed: 0, uncertain: 0, skipped: 0 };
  const settings = await readWhatsAppSettings();
  if (!settings.enabled) return empty;
  if (!fonnteConfigured()) throw new Error("FONNTE_NOT_CONFIGURED");
  const origin = process.env.WHATSAPP_PUBLIC_URL || process.env.DUITKU_PUBLIC_URL;
  if (!origin || new URL(origin).protocol !== "https:") throw new Error("WHATSAPP_PUBLIC_URL_REQUIRED");
  const { template, promoId } = settings;
  const promo = usesPromo(template) ? (await listWhatsAppPromos()).find(item => item.id === promoId) : undefined;
  if (usesPromo(template) && !promo) throw new Error("WHATSAPP_PROMO_UNAVAILABLE");
  const admin = paymentAdmin();
  const { data, error } = await admin.database.rpc("claim_shield_whatsapp", { p_limit: 5 });
  if (error || !Array.isArray(data)) throw new Error("WHATSAPP_QUEUE_UNAVAILABLE");
  const counts = { checked: data.length, accepted: 0, retried: 0, failed: 0, uncertain: 0, skipped: 0 };
  for (const item of data as Notification[]) {
    let state: Outcome = "skipped";
    let failure: string | null = null;
    let providerId: string | null = null;
    let sending = false;
    try {
      const order = await findOrder(item.order_id);
      if (order?.status === "paid" && order.fulfillment_status === "completed" && order.report_key &&
          order.report_expires_at && Date.parse(order.report_expires_at) > Date.now()) {
        let downloadUrl: string | undefined;
        if (template.includes("{link_hasil}")) {
          const remaining = Math.floor((Date.parse(order.report_expires_at) - Date.now()) / 1000);
          if (remaining < 1) throw new Error("WHATSAPP_REPORT_EXPIRED");
          const { data: signed, error: signError } = await admin.storage.from(PAYMENT_DOCUMENT_BUCKET)
            .createSignedUrl(order.report_key, Math.min(86400, remaining));
          if (signError || !signed?.signedUrl) throw new Error("WHATSAPP_REPORT_URL_UNAVAILABLE");
          downloadUrl = signed.signedUrl;
        }
        const message = reportReadyMessage({ ...order, report_expires_at: order.report_expires_at }, origin, template, promo, downloadUrl);
        // Recheck after preparing the report so disabling also stops claimed jobs.
        if ((await readWhatsAppSettings()).enabled) {
          sending = true;
          providerId = await sendWhatsApp(order.whatsapp, message);
          state = "accepted";
        } else { failure = "NOTIFICATIONS_DISABLED"; }
      } else { failure = "REPORT_UNAVAILABLE_OR_EXPIRED"; }
    } catch (error) {
      failure = error instanceof FonnteError ? error.code : "WHATSAPP_PROCESSING_FAILED";
      state = error instanceof FonnteError && error.uncertain || sending && !(error instanceof FonnteError)
        ? "uncertain" : failure === "INVALID_RECIPIENT" || item.attempts >= 5 ? "failed" : "pending";
    }
    const { data: finished, error: saveError } = await admin.database.rpc("finish_shield_whatsapp", {
      p_id: item.id, p_claim: item.claim_token, p_state: state, p_provider: providerId, p_failure: failure,
    });
    // Leave the lease intact on a save failure; expiry goes to uncertain, never blind resend.
    if (saveError || !finished) throw new Error("WHATSAPP_QUEUE_SAVE_FAILED");
    if (state === "pending") counts.retried++;
    else counts[state]++;
  }
  return counts;
}
