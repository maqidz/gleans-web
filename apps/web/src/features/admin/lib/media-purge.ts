import "server-only";
import { paymentAdmin } from "@/features/payments/server/repository";
import { MEDIA_BUCKET } from "./site-editor";

type PurgeEntry = { id: string; storageKey: string | null; cleaned: boolean };
type Prepared = { skippedIds: string[]; entries: PurgeEntry[] };

export async function purgeEditorMedia(ids: string[], actor: string) {
  const admin = paymentAdmin();
  const { data, error } = await admin.database.rpc("prepare_site_media_purge", { p_ids: ids, p_actor: actor });
  if (error || !data) throw new Error("MEDIA_PURGE_UNAVAILABLE");
  const { entries, skippedIds } = data as Prepared;
  const removedIds = entries.filter(item => item.cleaned).map(item => item.id);
  const pending = entries.filter(item => !item.cleaned);
  // Bound each request; the UI continues remaining batches without expanding the selection.
  for (const item of pending.slice(0, 10)) {
    if (!item.storageKey) continue;
    try {
      const { error: removeError } = await admin.storage.from(MEDIA_BUCKET).remove(item.storageKey);
      if (removeError && removeError.statusCode !== 404) continue;
      const { data: finished, error: saveError } = await admin.database.from("site_media_purges")
        .update({ cleaned_at: new Date().toISOString() }).eq("id", item.id).is("cleaned_at", null).select("id").maybeSingle();
      if (!saveError && finished) removedIds.push(item.id);
    } catch { /* Keep the tombstone pending so a failed storage cleanup can be retried. */ }
  }
  return { removedIds, skippedIds, pendingIds: pending.filter(item => !removedIds.includes(item.id)).map(item => item.id) };
}
