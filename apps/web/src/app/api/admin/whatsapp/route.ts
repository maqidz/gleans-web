import { z } from "zod";
import { currentAdmin } from "@/features/auth/session";
import { json, sameOrigin } from "@/features/payments/server/http";
import { fonnteConfigured, fonnteDevice } from "@/features/whatsapp/server/fonnte";
import { listWhatsAppPromos, readWhatsAppLibrary, saveWhatsAppTemplate, setWhatsAppEnabled, deleteWhatsAppTemplate } from "@/features/whatsapp/server/settings";
import { reportTemplateSchema, templateNameSchema, usesPromo } from "@/features/whatsapp/template";

export const runtime = "nodejs";
const edit = z.object({ id: z.uuid(), name: templateNameSchema, template: reportTemplateSchema, revision: z.number().int().min(1).max(2147483646), promoId: z.string().max(160).nullable().default(null), activate: z.boolean().default(false) }).strict();

export async function GET() {
  try {
    if (!await currentAdmin()) return json({ error: "Akses ditolak." }, 403);
    const configured = fonnteConfigured();
    const [library, device, promos] = await Promise.all([
      readWhatsAppLibrary(), configured ? fonnteDevice().catch(() => null) : Promise.resolve(null), listWhatsAppPromos(),
    ]);
    return json({ ...library, promos, connection: { configured, connected: device?.connected ?? null } });
  } catch { return json({ error: "Pengaturan notifikasi belum dapat dimuat. Coba lagi." }, 503); }
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Permintaan tidak diizinkan." }, 403);
  try {
    const admin = await currentAdmin();
    if (!admin) return json({ error: "Akses ditolak." }, 403);
    const raw = await request.text();
    if (raw.length > 24000) return json({ error: "Template terlalu panjang." }, 413);
    const parsed = edit.safeParse(JSON.parse(raw));
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message || "Periksa template pesan." }, 400);
    if (usesPromo(parsed.data.template) && !(await listWhatsAppPromos()).some(promo => promo.id === parsed.data.promoId)) return json({ error: "Pilih kode promo persentase yang masih aktif." }, 400);
    const saved = await saveWhatsAppTemplate(parsed.data, admin.email);
    if (!saved) return json({ error: "Template sudah diubah di tempat lain. Muat ulang sebelum menyimpan." }, 409);
    return json(await readWhatsAppLibrary());
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Data tidak valid." }, 400);
    if ((error as { code?: string })?.code === "23505") return json({ error: "Nama template sudah digunakan. Pilih nama lain." }, 409);
    if ((error as { message?: string })?.message?.includes("WHATSAPP_TEMPLATE_LIMIT")) return json({ error: "Maksimal 20 template dapat disimpan." }, 400);
    return json({ error: "Template belum dapat disimpan. Coba lagi." }, 503);
  }
}

const revisionSchema = z.number().int().min(1).max(2147483646);
async function control(request: Request, action: "toggle" | "delete") {
  if (!sameOrigin(request)) return json({ error: "Permintaan tidak diizinkan." }, 403);
  try {
    const admin = await currentAdmin();
    if (!admin) return json({ error: "Akses ditolak." }, 403);
    const raw = await request.text();
    if (raw.length > 1000) return json({ error: "Data terlalu panjang." }, 413);
    const body = JSON.parse(raw);
    let saved: boolean;
    if (action === "toggle") {
      const parsed = z.object({ enabled: z.boolean(), revision: revisionSchema }).strict().safeParse(body);
      if (!parsed.success) return json({ error: "Pengaturan tidak valid." }, 400);
      saved = await setWhatsAppEnabled(parsed.data.enabled, parsed.data.revision, admin.email);
    } else {
      const parsed = z.object({ id: z.uuid(), revision: revisionSchema }).strict().safeParse(body);
      if (!parsed.success) return json({ error: "Template tidak valid." }, 400);
      saved = await deleteWhatsAppTemplate(parsed.data.id, parsed.data.revision, admin.email);
    }
    if (!saved) return json({ error: "Pengaturan sudah berubah. Muat ulang sebelum melanjutkan." }, 409);
    return json(await readWhatsAppLibrary());
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Data tidak valid." }, 400);
    if ((error as { message?: string })?.message?.includes("WHATSAPP_TEMPLATE_ACTIVE")) return json({ error: "Gunakan template lain sebelum menghapus template aktif." }, 409);
    return json({ error: "Pengaturan belum dapat diperbarui. Coba lagi." }, 503);
  }
}
export const PATCH = (request: Request) => control(request, "toggle");
export const DELETE = (request: Request) => control(request, "delete");
