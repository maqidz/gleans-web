import { z } from "zod";

export const TEMPLATE_VARIABLES = [
  { key: "nama", label: "Nama pelanggan" },
  { key: "nama_file", label: "Nama dokumen" },
  { key: "skor_ai", label: "Skor AI (%)" },
  { key: "link_hasil", label: "Tautan hasil" },
  { key: "diskon", label: "Diskon promo (%)" },
  { key: "kode_promo", label: "Kode promo" },
  { key: "masa_berlaku", label: "Masa berlaku promo" },
  { key: "invoice", label: "Nomor invoice" },
  { key: "batas_unduh", label: "Batas unduh (WIB)" },
] as const;
export type TemplateValues = Record<typeof TEMPLATE_VARIABLES[number]["key"] | "dokumen" | "tautan_hasil", string>;
export const TEMPLATE_PATTERN = /\{(nama|nama_file|skor_ai|link_hasil|diskon|kode_promo|masa_berlaku|invoice|dokumen|tautan_hasil|batas_unduh)\}/g;
export const usesPromo = (value: string) => /\{(diskon|kode_promo|masa_berlaku)\}/.test(value);
export type WhatsAppPromo = { id: string; code: string; discount: number; endsOn: string };

export const DEFAULT_REPORT_TEMPLATE = `Halo {nama}! ✅ Dokumen *{nama_file}* sudah selesai dicek.

📊 Skor AI: *{skor_ai}%*
🔗 Unduh laporan: {link_hasil}

Skor masih tinggi? Jangan khawatir, revisi bagian yang ditandai lalu cek ulang dengan *diskon {diskon}%* pakai kode *{kode_promo}* (berlaku {masa_berlaku}).

Revisi, cek ulang, lalu kumpulkan dengan tenang. Cek ulang sekarang di www.gleans.my.id 🚀`;

export const SIMPLE_REPORT_TEMPLATE = `Halo {nama}! ✅ Dokumen *{nama_file}* sudah selesai dicek.

📊 Skor AI: *{skor_ai}%*
🔗 Unduh laporan: {link_hasil}

Terima kasih sudah menggunakan Gleans! 🚀`;

export const templateNameSchema = z.string().trim().min(1, "Isi nama template.").max(80, "Nama template maksimal 80 karakter.");
export type WhatsAppSavedTemplate = { id: string; name: string; template: string; promoId: string | null };

export function templateError(value: string) {
  if (!value.trim()) return "Isi template pesan terlebih dahulu.";
  if (value.length > 4000) return "Template maksimal 4.000 karakter.";
  const remainder = value.replace(TEMPLATE_PATTERN, "");
  if (/[{}]/.test(remainder)) return "Gunakan variabel yang tersedia di bawah editor.";
  if (!value.includes("{link_hasil}") && !value.includes("{tautan_hasil}")) return "Template harus memuat {link_hasil}.";
  return "";
}

export const reportTemplateSchema = z.string().trim().max(4000).superRefine((value, context) => {
  const message = templateError(value);
  if (message) context.addIssue({ code: "custom", message });
});

export function renderReportTemplate(template: string, values: TemplateValues) {
  return template.replace(TEMPLATE_PATTERN, (_match, key: keyof TemplateValues) => values[key]);
}

export const PREVIEW_VALUES: TemplateValues = {
  nama: "Alya Putri", invoice: "GLS-A1B2C3D4E5F6", dokumen: "Skripsi - Bab 1.pdf", nama_file: "Skripsi - Bab 1.pdf", skor_ai: "35",
  link_hasil: "https://www.gleans.my.id/cek-pesanan/GLS-A1B2C3D4E5F6", diskon: "50", kode_promo: "HEMAT5RIBU", masa_berlaku: "sampai 31 Desember 2027",
  tautan_hasil: "https://www.gleans.my.id/cek-pesanan/GLS-A1B2C3D4E5F6", batas_unduh: "25 November 2026 pukul 10.00 WIB",
};

export type WhatsAppTemplateSettings = { template: string; revision: number; promoId: string | null; activeTemplateId: string; enabled: boolean };
export type WhatsAppConnection = { configured: boolean; connected: boolean | null };
