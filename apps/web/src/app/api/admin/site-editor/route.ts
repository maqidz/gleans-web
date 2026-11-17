import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { currentAdmin } from "@/features/auth/session";
import { blogSchema, promoSchema } from "@/features/admin/lib/model";
import { BLOG_TAG, PROMOTION_TAG, isEditorMediaUrl, listEditorActivity, listEditorMedia, listEditorRecords, removePromotion, saveArticle, savePromotion } from "@/features/admin/lib/site-editor";
import { json, sameOrigin } from "@/features/payments/server/http";

const identifier = z.string().min(1).max(160).regex(/^[a-zA-Z0-9-]+$/);
const safePath = /^(?:\/(?![\\/])[^\s\\]*)?$/;
const blogEdit = blogSchema.extend({ id: identifier, slug: blogSchema.shape.slug.max(140) });
const promoEdit = promoSchema.extend({ id: identifier, start: z.iso.date(), end: z.iso.date() });
const edit = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("blog"), record: blogEdit }),
  z.object({ kind: z.literal("promo"), record: promoEdit }),
]);

export async function GET(request: Request) {
  try {
    if (!await currentAdmin()) return json({ error: "Akses ditolak." }, 403);
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind");
    if (kind === "activity") return json({ activity: await listEditorActivity() });
    if (kind === "media") return json({ media: await listEditorMedia(searchParams.get("includeHidden") === "1") });
    if (kind !== "blog" && kind !== "promo") return json({ error: "Jenis konten tidak valid." }, 400);
    return json({ records: await listEditorRecords(kind, searchParams.get("id") ?? undefined) });
  } catch {
    return json({ error: "Konten belum dapat dimuat. Coba lagi." }, 503);
  }
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Permintaan tidak diizinkan." }, 403);
  try {
    const admin = await currentAdmin();
    if (!admin) return json({ error: "Akses ditolak." }, 403);
    const raw = await request.text();
    if (raw.length > 100_000) return json({ error: "Isi terlalu panjang." }, 413);
    const input = edit.safeParse(JSON.parse(raw));
    if (!input.success) return json({ error: "Periksa kembali judul, isi, dan format isian." }, 400);
    if (input.data.kind === "blog") {
      const record = input.data.record;
      if ((record.status === "Terbit" || record.status === "Terjadwal") && !record.content.trim()) return json({ error: "Isi artikel sebelum menerbitkannya." }, 400);
      if (record.status === "Terjadwal" && (!record.publishAt || Date.parse(record.publishAt) <= Date.now())) return json({ error: "Pilih waktu publikasi mendatang." }, 400);
      if (record.coverId && !/^\/images\/[a-zA-Z0-9._-]+$/.test(record.coverId) && !await isEditorMediaUrl(record.coverId)) {
        return json({ error: "Pilih gambar dari pustaka media." }, 400);
      }
      const saved = await saveArticle(record, admin.email);
      revalidateTag(BLOG_TAG);
      revalidatePath("/");
      revalidatePath("/blog");
      revalidatePath("/blog/[slug]", "page");
      return json({ record: saved });
    }
    const record = input.data.record;
    if (record.end < record.start) return json({ error: "Tanggal selesai harus sama atau setelah tanggal mulai." }, 400);
    if (!safePath.test(record.href ?? "")) return json({ error: "Tautan harus diawali dengan / dan mengarah ke halaman Gleans." }, 400);
    if (record.imageUrl && (record.type !== "Banner" || !await isEditorMediaUrl(record.imageUrl))) {
      return json({ error: "Pilih gambar banner dari pustaka media." }, 400);
    }
    record.code = record.type === "Kode promo" ? record.code.trim().toUpperCase() : "";
    if (record.type === "Kode promo" && (!/^[A-Z0-9-]{2,40}$/.test(record.code) || record.discount < 1 || (record.discountType === "percentage" && record.discount > 100))) {
      return json({ error: "Masukkan kode dan diskon yang valid." }, 400);
    }
    const saved = await savePromotion(record, admin.email);
    revalidateTag(PROMOTION_TAG);
    revalidatePath("/");
    return json({ record: saved });
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Data tidak valid." }, 400);
    if ((error as { code?: string } | null)?.code === "23505") return json({ error: "Slug artikel atau kode promo sudah digunakan." }, 409);
    return json({ error: "Konten belum dapat disimpan. Coba lagi." }, 503);
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Permintaan tidak diizinkan." }, 403);
  try {
    const admin = await currentAdmin();
    if (!admin) return json({ error: "Akses ditolak." }, 403);
    const { searchParams } = new URL(request.url);
    const id = identifier.safeParse(searchParams.get("id"));
    if (searchParams.get("kind") !== "promo" || !id.success) return json({ error: "Promosi tidak valid." }, 400);
    const result = await removePromotion(id.data, admin.email);
    if (result === "missing") return json({ error: "Promosi tidak ditemukan." }, 404);
    if (result === "changed") return json({ error: "Promosi baru saja berubah. Coba hapus lagi." }, 409);
    revalidateTag(PROMOTION_TAG);
    revalidatePath("/");
    return json({ id: id.data });
  } catch {
    return json({ error: "Promosi belum dapat dihapus. Coba lagi." }, 503);
  }
}
