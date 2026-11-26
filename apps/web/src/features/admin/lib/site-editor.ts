import "server-only";

import { unstable_cache } from "next/cache";
import { paymentAdmin } from "@/features/payments/server/repository";
import { calculatePromo, type AppliedPromo } from "@/features/orders/lib/pricing";
import { requiresCompletedCheck } from "@/features/orders/lib/promo-eligibility";
import type { Post } from "@/features/blog/lib/content";
import { BLOG_AUTHOR, type AdminState } from "./model";
import type { AdminMedia } from "./media";

export type BlogEntry = AdminState["blogs"][number];
export type Promotion = AdminState["promos"][number];
export const BLOG_TAG = "site-articles";
export const PROMOTION_TAG = "site-promotions";
export const MEDIA_BUCKET = "gleans-editor-media";

export function jakartaDate() {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date());
}

export async function listEditorRecords(kind: "blog" | "promo", id?: string) {
  const query = paymentAdmin().database.from(kind === "blog" ? "site_articles" : "site_promotions").select("record");
  if (kind === "promo") query.is("record->>removedAt", null);
  const result = id ? await query.eq("id", id).limit(1) : await query.order("updated_at", { ascending: false }).limit(200);
  if (result.error) throw result.error;
  return (result.data ?? []).map(row => {
    const record = row.record as BlogEntry | Promotion;
    return "type" in record && record.type === "Popup" ? { ...record, type: "Banner" as const } : record;
  });
}

export async function saveArticle(article: BlogEntry, actor: string) {
  const admin = paymentAdmin();
  const { data: existing, error: readError } = await admin.database.from("site_articles").select("record,publish_at").eq("id", article.id).maybeSingle();
  if (readError) throw readError;
  const wasPublished = existing?.publish_at && Date.parse(existing.publish_at) <= Date.now()
    && ["Terbit", "Terjadwal"].includes((existing.record as BlogEntry).status);
  const publishAt = article.status === "Terbit"
    ? wasPublished ? new Date(existing!.publish_at).toISOString() : new Date().toISOString()
    : article.status === "Terjadwal" ? article.publishAt : undefined;
  const record = { ...article, author: BLOG_AUTHOR, publishAt };
  const { error } = await admin.database.from("site_articles").upsert([{
    id: record.id, record, publish_at: publishAt ?? null, edited_by: actor, updated_at: new Date().toISOString(),
  }], { onConflict: "id" });
  if (error) throw error;
  return record;
}

export async function savePromotion(record: Promotion, actor: string) {
  const database = paymentAdmin().database;
  const values = { record, starts_on: record.start, ends_on: record.end, edited_by: actor, updated_at: new Date().toISOString() };
  const updated = await database.from("site_promotions").update(values)
    .eq("id", record.id).is("record->>removedAt", null).select("id").maybeSingle();
  if (updated.error) throw updated.error;
  if (!updated.data) {
    // Retaining a removed row's ID prevents a stale editor from recreating it.
    const inserted = await database.from("site_promotions").insert([{ id: record.id, ...values }]);
    if (inserted.error) throw inserted.error;
  }
  return record;
}

export async function removePromotion(id: string, actor: string) {
  const database = paymentAdmin().database;
  const { data, error } = await database.from("site_promotions").select("record,updated_at").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return "missing";
  const record = data.record as Promotion & { removedAt?: string };
  if (record.removedAt) return "removed";
  const now = new Date().toISOString();
  const removed = await database.from("site_promotions").update({
    record: { ...record, active: false, code: "", removedCode: record.code, removedAt: now },
    edited_by: actor,
    updated_at: now,
  }).eq("id", id).eq("updated_at", data.updated_at).is("record->>removedAt", null).select("id").maybeSingle();
  if (removed.error) throw removed.error;
  return removed.data ? "removed" : "changed";
}

export async function listEditorActivity() {
  const { data, error } = await paymentAdmin().database.from("site_editor_activity").select("id,at,actor,action,object").order("id", { ascending: false }).limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function listEditorMedia(includeHidden = false): Promise<AdminMedia[]> {
  const query = paymentAdmin().database.from("site_editor_media_library").select("id,name,src,size,hidden")
    .order("updated_at", { ascending: false, nullsFirst: false }).order("id", { ascending: true }).limit(203);
  const { data, error } = await (includeHidden ? query : query.eq("hidden", false));
  if (error) throw error;
  return (data ?? []).map(row => ({ id: row.id, name: row.name, alt: row.name, size: row.size, src: row.src, hidden: row.hidden }));
}

export async function isEditorMediaUrl(src: string) {
  const { data, error } = await paymentAdmin().database.from("site_editor_media_library").select("id").eq("src", src).limit(1).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function setEditorMediaVisibility(id: string, hidden: boolean, actor: string) {
  const admin = paymentAdmin();
  const { data, error } = await admin.database.from("site_editor_media_library").select("id,hidden").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return false;
  if (data.hidden !== hidden) {
    const { error: updateError } = await admin.database.from("site_media_visibility").upsert([{ id, hidden, edited_by: actor }], { onConflict: "id" });
    if (updateError) throw updateError;
  }
  return true;
}

function articlePost(record: BlogEntry, publishAt: string): Post {
  return {
    slug: record.slug, title: record.title, excerpt: record.summary, content: record.content,
    author: BLOG_AUTHOR, category: record.category, date: publishAt,
    featured: record.featured, cover: record.coverId || undefined, coverAlt: record.coverAlt,
    readingMinutes: Math.max(1, Math.round(record.content.trim().split(/\s+/).length / 200)),
  };
}

export const listPublishedArticles = unstable_cache(async () => {
  const { data, error } = await paymentAdmin().database.from("site_articles")
    .select("record,publish_at").in("status", ["Terbit", "Terjadwal"]).lte("publish_at", new Date().toISOString())
    .order("publish_at", { ascending: false }).order("slug", { ascending: true }).limit(200);
  if (error) throw error;
  return (data ?? []).map(row => {
    const { content, ...meta } = articlePost(row.record as BlogEntry, row.publish_at);
    return meta;
  });
}, ["published-articles"], { tags: [BLOG_TAG], revalidate: 60 });

export const getPublishedArticle = unstable_cache(async (slug: string) => {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const { data, error } = await paymentAdmin().database.from("site_articles")
    .select("record,publish_at").eq("slug", slug).in("status", ["Terbit", "Terjadwal"])
    .lte("publish_at", new Date().toISOString()).maybeSingle();
  if (error) throw error;
  return data ? articlePost(data.record as BlogEntry, data.publish_at) : null;
}, ["published-article"], { tags: [BLOG_TAG], revalidate: 60 });

export const activeSitePromotions = unstable_cache(async () => {
  const today = jakartaDate();
  const { data, error } = await paymentAdmin().database.from("site_promotions").select("record,updated_at")
    .in("kind", ["Banner", "Popup"]).eq("active", true).lte("starts_on", today).gte("ends_on", today)
    .order("updated_at", { ascending: false }).order("id", { ascending: true }).limit(20);
  if (error) throw error;
  return (data ?? []).map(row => ({ ...row.record as Promotion, revision: String(row.updated_at) }));
}, ["active-site-promotions"], { tags: [PROMOTION_TAG], revalidate: 60 });

export async function readActivePromo(input: string, price: number): Promise<(AppliedPromo & { requiresCompletedCheck: boolean }) | null> {
  const code = input.trim().toUpperCase();
  const today = jakartaDate();
  const { data, error } = await paymentAdmin().database.from("site_promotions").select("record")
    .eq("kind", "Kode promo").eq("code", code).eq("active", true).lte("starts_on", today).gte("ends_on", today).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const promo = data.record as Promotion;
  return { ...calculatePromo(code, promo.discount, promo.discountType === "percentage", price), requiresCompletedCheck: requiresCompletedCheck(promo) };
}
