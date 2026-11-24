import "server-only";
import { paymentAdmin } from "@/features/payments/server/repository";
import { reportTemplateSchema, type WhatsAppTemplateSettings, type WhatsAppPromo, type WhatsAppSavedTemplate } from "../template";

export async function readWhatsAppSettings(): Promise<WhatsAppTemplateSettings> {
  const { data, error } = await paymentAdmin().database.from("whatsapp_settings").select("template,revision,promo_id,active_template_id,enabled").eq("id", true).single();
  if (error || !data) throw new Error("WHATSAPP_SETTINGS_UNAVAILABLE");
  return { template: reportTemplateSchema.parse(data.template), revision: Number(data.revision), promoId: data.promo_id ?? null, activeTemplateId: String(data.active_template_id), enabled: data.enabled === true };
}

export async function readWhatsAppLibrary(): Promise<{ settings: WhatsAppTemplateSettings; templates: WhatsAppSavedTemplate[] }> {
  const { data, error } = await paymentAdmin().database.rpc("read_whatsapp_template_library");
  if (error || !data) throw new Error("WHATSAPP_SETTINGS_UNAVAILABLE");
  const result = data as { settings: WhatsAppTemplateSettings; templates: WhatsAppSavedTemplate[] };
  reportTemplateSchema.parse(result.settings.template);
  result.templates.forEach(item => reportTemplateSchema.parse(item.template));
  return result;
}

export async function saveWhatsAppTemplate(input: WhatsAppSavedTemplate & { revision: number; activate: boolean }, actor: string) {
  const { data, error } = await paymentAdmin().database.rpc("save_whatsapp_message_template", {
    p_id: input.id, p_name: input.name, p_template: input.template, p_promo: input.promoId,
    p_revision: input.revision, p_activate: input.activate, p_actor: actor,
  });
  if (error) throw error;
  return data === true;
}

export async function listWhatsAppPromos(): Promise<WhatsAppPromo[]> {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const { data, error } = await paymentAdmin().database.from("site_promotions").select("id,record,ends_on")
    .eq("kind", "Kode promo").eq("active", true).lte("starts_on", today).gte("ends_on", today).order("id").limit(100);
  if (error) throw new Error("WHATSAPP_PROMO_UNAVAILABLE");
  return (data ?? []).flatMap(row => {
    const record = row.record as { discountType?: string; discount?: number; code?: string; removedAt?: string };
    if (record.removedAt || record.discountType !== "percentage" || !record.code || !record.discount || record.discount < 1 || record.discount > 100) return [];
    return [{ id: String(row.id), code: record.code, discount: record.discount, endsOn: String(row.ends_on).slice(0, 10) }];
  });
}

export async function setWhatsAppEnabled(enabled: boolean, revision: number, actor: string) {
  const { data, error } = await paymentAdmin().database.rpc("set_whatsapp_enabled", { p_enabled: enabled, p_revision: revision, p_actor: actor });
  if (error) throw error;
  return data === true;
}

export async function deleteWhatsAppTemplate(id: string, revision: number, actor: string) {
  const { data, error } = await paymentAdmin().database.rpc("delete_whatsapp_message_template", { p_id: id, p_revision: revision, p_actor: actor });
  if (error) throw error;
  return data === true;
}
