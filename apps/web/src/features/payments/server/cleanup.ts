import "server-only";
import { paymentAdmin } from "./repository";
import { PAYMENT_DOCUMENT_BUCKET } from "../types";

export type ExpiredFiles = { id: string; document_key: string; report_key: string | null; status: string; fulfillment_status: string; report_expires_at: string | null; files_deleted_at: string | null };
export function eligibleForCleanup(order: ExpiredFiles, now: number) {
  const expires = Date.parse(order.report_expires_at ?? "");
  return order.status === "paid" && order.fulfillment_status === "completed" &&
    !order.files_deleted_at && Number.isFinite(expires) && expires <= now && !!order.report_key;
}
export async function cleanupExpiredFiles(now = Date.now()) {
  const admin = paymentAdmin();
  const cutoff = new Date(now).toISOString();
  const { data, error } = await admin.database.from("duitku_orders")
    .select("id,document_key,report_key,status,fulfillment_status,report_expires_at,files_deleted_at")
    .eq("status", "paid").eq("fulfillment_status", "completed").is("files_deleted_at", null)
    .lte("report_expires_at", cutoff).order("report_expires_at", { ascending: true }).limit(25);
  if (error || !data) throw new Error("CLEANUP_QUERY_FAILED");
  let deleted = 0; let failed = 0;
  for (const order of data as ExpiredFiles[]) {
    if (!eligibleForCleanup(order, now)) continue;
    try {
      for (const key of new Set([order.document_key, order.report_key!])) {
        if (!key) throw new Error("MISSING_FILE_KEY");
        const { error: removeError } = await admin.storage.from(PAYMENT_DOCUMENT_BUCKET).remove(key);
        // A previous run may have deleted a file before its database update failed.
        if (removeError && Number(removeError.statusCode) !== 404) throw new Error("CLEANUP_STORAGE_FAILED");
      }
      const { error: saveError } = await admin.database.from("duitku_orders")
        .update({ files_deleted_at: cutoff }).eq("id", order.id).is("files_deleted_at", null);
      if (saveError) throw new Error("CLEANUP_RECORD_FAILED");
      deleted++;
    } catch { failed++; }
  }
  return { checked: data.length, deleted, failed };
}
