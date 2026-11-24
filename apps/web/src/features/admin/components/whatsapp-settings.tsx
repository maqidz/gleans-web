"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCheck, Loader2, MessageCircle, Pencil, Plus, RefreshCw, Save, Hand, Trash2 } from "lucide-react";
import { Button } from "@gleans/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@gleans/ui/dialog";
import { FilterDropdown } from "@gleans/ui/filter-dropdown";
import { editorRequest } from "../lib/editor-client";
import { SIMPLE_REPORT_TEMPLATE, PREVIEW_VALUES, TEMPLATE_VARIABLES, renderReportTemplate, templateError, templateNameSchema, usesPromo,
  type WhatsAppConnection, type WhatsAppTemplateSettings, type WhatsAppPromo, type WhatsAppSavedTemplate } from "@/features/whatsapp/template";

type Library = { settings: WhatsAppTemplateSettings; templates: WhatsAppSavedTemplate[] };
type Response = Library & { connection: WhatsAppConnection; promos: WhatsAppPromo[] };
const sameTemplate = (a: WhatsAppSavedTemplate | null, b: WhatsAppSavedTemplate | undefined) => Boolean(a && b && a.name === b.name && a.template === b.template && a.promoId === b.promoId);

export function WhatsAppSettings() {
  const [saved, setSaved] = useState<WhatsAppTemplateSettings | null>(null);
  const [templates, setTemplates] = useState<WhatsAppSavedTemplate[]>([]);
  const [editing, setEditing] = useState<WhatsAppSavedTemplate | null>(null);
  const [deleting, setDeleting] = useState<WhatsAppSavedTemplate | null>(null);
  const [promos, setPromos] = useState<WhatsAppPromo[]>([]);
  const [connection, setConnection] = useState<WhatsAppConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const editor = useRef<HTMLTextAreaElement>(null);
  const busy = busyId !== null;
  const stored = templates.find(item => item.id === editing?.id);
  const template = editing?.template ?? "";
  const promoId = editing?.promoId ?? "";
  const promo = promos.find(item => item.id === promoId);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    void editorRequest<Response>("/api/admin/whatsapp", { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) { setSaved(data.settings); setTemplates(data.templates); setPromos(data.promos); setConnection(data.connection); } })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  function updateDraft(values: Partial<WhatsAppSavedTemplate>) {
    setEditing(current => current ? { ...current, ...values } : current);
  }

  function addTemplate() {
    if (templates.length >= 20 || busy) return;
    let number = templates.length + 1;
    while (templates.some(item => item.name.trim().toLowerCase() === `template ${number}`)) number++;
    setError("");
    setEditing({ id: crypto.randomUUID(), name: `Template ${number}`, template: SIMPLE_REPORT_TEMPLATE, promoId: null });
  }

  async function persist(item: WhatsAppSavedTemplate, activate: boolean, closeEditor = false) {
    if (!saved || busy) return;
    setBusyId(item.id); setError("");
    try {
      const data = await editorRequest<Library>("/api/admin/whatsapp", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...item, revision: saved.revision, activate }),
      });
      setSaved(data.settings); setTemplates(data.templates);
      if (closeEditor) setEditing(null);
    } catch (error) { setError(error instanceof Error ? error.message : "Template belum dapat disimpan."); }
    finally { setBusyId(null); }
  }

  async function control(method: "PATCH" | "DELETE", values: { enabled: boolean } | { id: string }) {
    if (!saved || busy) return;
    setBusyId("id" in values ? values.id : "toggle"); setError("");
    try {
      const data = await editorRequest<Library>("/api/admin/whatsapp", {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, revision: saved.revision }),
      });
      setSaved(data.settings); setTemplates(data.templates); setDeleting(null);
    } catch (error) { setError(error instanceof Error ? error.message : "Pengaturan belum dapat diperbarui."); }
    finally { setBusyId(null); }
  }

  function insertVariable(key: string) {
    const field = editor.current;
    const start = field?.selectionStart ?? template.length;
    const end = field?.selectionEnd ?? start;
    const variable = `{${key}}`;
    if (template.length - (end - start) + variable.length > 4000) return;
    updateDraft({ template: template.slice(0, start) + variable + template.slice(end) });
    requestAnimationFrame(() => { field?.focus(); field?.setSelectionRange(start + variable.length, start + variable.length); });
  }

  const nameCheck = templateNameSchema.safeParse(editing?.name ?? "");
  const duplicateName = templates.some(item => item.id !== editing?.id && item.name.trim().toLowerCase() === editing?.name.trim().toLowerCase());
  const validation = editing ? (!nameCheck.success ? nameCheck.error.issues[0].message : duplicateName ? "Nama template sudah digunakan." : "") || templateError(template) || (usesPromo(template) && !promo ? "Pilih kode promo persentase yang masih aktif." : "") : "";
  const dirty = Boolean(editing && !sameTemplate(editing, stored));
  const connected = connection?.connected === true;

  return <section className="min-w-0">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="font-semibold">Notifikasi WhatsApp</h2><p className="mt-1.5 text-sm text-muted-foreground">Satu pesan otomatis saat hasil pemeriksaan Shield siap diunduh.</p></div>
      <Button type="button" size="pill-sm" disabled={loading || busy || !saved || templates.length >= 20} onClick={addTemplate}><Plus />Template baru</Button>
    </div>
    {error && !editing && !deleting && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive"><p>{error}</p><Button variant="outline" size="pill-sm" disabled={loading || busy} onClick={() => setReload(value => value + 1)}><RefreshCw />Muat ulang</Button></div>}
    {loading ? <p role="status" className="py-16 text-center text-sm text-muted-foreground">Memuat pengaturan notifikasi…</p> : saved && <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-accent text-primary"><MessageCircle className="size-5" /></span><div><p className="text-sm font-medium">Hubungkan Fonnte</p><p className="mt-0.5 text-xs text-muted-foreground">{!connection?.configured ? "Belum dikonfigurasi" : connected ? "Hasil pemeriksaan siap" : connection?.connected === false ? "Perangkat terputus" : "Koneksi belum dapat diperiksa"}</p></div></div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{saved.enabled ? "Aktif" : "Nonaktif"}</span>
          <button type="button" role="switch" aria-label="Aktifkan notifikasi WhatsApp" aria-checked={saved.enabled} disabled={busy || (!saved.enabled && !connection?.configured)}
            onClick={() => void control("PATCH", { enabled: !saved.enabled })}
            className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 ${saved.enabled ? "bg-primary" : "bg-muted"}`}>
            <span className={`size-5 rounded-full bg-white shadow-sm transition-transform ${saved.enabled ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
      </div>
      <section className="min-w-0 overflow-hidden rounded-[24px] border" aria-labelledby="template-history-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-5 sm:px-5"><h3 id="template-history-title" className="font-semibold">Riwayat template</h3><span className="text-xs text-muted-foreground">{templates.length} template</span></div>
        <div role="region" aria-label="Daftar template WhatsApp" tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-primary">
          <table className="w-full min-w-[740px] text-left text-sm">
            <thead className="bg-surface text-xs uppercase text-muted-foreground"><tr><th scope="col" className="w-[23%] px-4 py-4 font-medium">Nama template</th><th scope="col" className="px-4 py-4 font-medium">Pesan</th><th scope="col" className="px-4 py-4 font-medium">Status</th><th scope="col" className="px-4 py-4 text-right font-medium">Aksi</th></tr></thead>
            <tbody className="divide-y">{templates.map(item => {
              const active = item.id === saved.activeTemplateId;
              return <tr key={item.id} className="align-top hover:bg-surface/40">
                <td className="px-4 py-5"><p className="break-words font-medium">{item.name}</p></td>
                <td className="max-w-md px-4 py-5"><p className="line-clamp-3 break-words whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{item.template}</p></td>
                <td className="px-4 py-5"><span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${active ? "bg-accent text-primary" : "bg-surface text-muted-foreground"}`}>{active ? "Aktif" : "Tersimpan"}</span></td>
                <td className="sticky right-0 border-l bg-background px-4 py-4"><div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="outline" size="icon" disabled={busy} title="Edit template" aria-label={`Edit ${item.name}`} onClick={() => { setError(""); setEditing({ ...item }); }}><Pencil /></Button>
                  <Button type="button" variant={active ? "secondary" : "outline"} size="icon" disabled={busy || active} title={active ? "Template sedang aktif" : "Gunakan template"} aria-label={`Gunakan ${item.name}`} onClick={() => void persist(item, true)}>{busyId === item.id ? <Loader2 className="animate-spin" /> : <Hand />}</Button>
                  <span title={active ? "Gunakan template lain sebelum menghapus" : "Hapus template"}><Button type="button" variant="outline" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={busy || active} aria-label={`Hapus ${item.name}`} onClick={() => { setError(""); setDeleting(item); }}><Trash2 /></Button></span>
                </div></td>
              </tr>;
            })}{!templates.length && <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">Belum ada template tersimpan.</td></tr>}</tbody>
          </table>
        </div>
      </section>
    </>}
    <Dialog open={deleting !== null} onOpenChange={open => { if (!open && !busy) { setDeleting(null); setError(""); } }}>
      <DialogContent className="rounded-[24px]" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>Hapus template?</DialogTitle><DialogDescription>Template “{deleting?.name}” akan dihapus dari daftar.</DialogDescription></DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="outline" size="pill-sm" disabled={busy} onClick={() => { setDeleting(null); setError(""); }}>Batal</Button><Button variant="destructive" size="pill-sm" disabled={busy} onClick={() => deleting && void control("DELETE", { id: deleting.id })}>{busy ? <Loader2 className="animate-spin" /> : <Trash2 />}Hapus template</Button></div>
      </DialogContent>
    </Dialog>
    <Dialog open={editing !== null} onOpenChange={open => { if (!open && !busy) { setEditing(null); setError(""); } }}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden rounded-[24px] p-0 sm:max-w-5xl" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onPointerDownOutside={event => { if (busy) event.preventDefault(); }}>
        <DialogHeader className="shrink-0 border-b p-5 pr-12 sm:px-6"><DialogTitle>{stored ? "Edit template" : "Template baru"}</DialogTitle><DialogDescription className="sr-only">Atur nama, isi pesan, dan promo notifikasi WhatsApp.</DialogDescription></DialogHeader>
        <form className="flex min-h-0 flex-col" onSubmit={event => { event.preventDefault(); if (editing && !validation && dirty) void persist(editing, false, true); }}>
          <div className="min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6">
            {error && editing && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
            <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <div className="min-w-0 space-y-5">
                <label className="block text-sm font-medium" htmlFor="whatsapp-template-name">Nama template<input id="whatsapp-template-name" value={editing?.name ?? ""} maxLength={80} disabled={busy} onChange={event => updateDraft({ name: event.target.value })} className="mt-2 h-11 w-full rounded-full border bg-background px-4 font-normal outline-none focus-visible:ring-2 focus-visible:ring-primary/20" /></label>
                <div><div className="mb-2 flex items-center justify-between gap-2"><label htmlFor="whatsapp-template" className="text-sm font-medium">Pesan</label><span className="text-xs text-muted-foreground">{template.length.toLocaleString("id-ID")} / 4.000</span></div>
                  <textarea ref={editor} id="whatsapp-template" aria-label="Template pesan" value={template} disabled={busy} maxLength={4000} spellCheck={false} aria-invalid={Boolean(validation)} aria-describedby="whatsapp-template-help" className="min-h-[300px] w-full resize-y rounded-2xl border bg-background p-4 text-sm leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-60" onChange={event => updateDraft({ template: event.target.value })} />
                  <p id="whatsapp-template-help" className={`mt-2 text-xs ${validation ? "text-destructive" : "text-muted-foreground"}`}>{validation || "Klik variabel untuk menyisipkannya. Tautan hasil wajib ada."}</p>
                </div>
                <div className="min-w-0"><p className="mb-2.5 text-xs font-medium text-muted-foreground">Variabel pesan</p><div role="group" aria-label="Variabel pesan" tabIndex={0} className="flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain px-0.5 pb-2 focus-visible:outline-2 focus-visible:outline-primary">{TEMPLATE_VARIABLES.map(variable => <button key={variable.key} type="button" disabled={busy} title={variable.label} onClick={() => insertVariable(variable.key)} className="shrink-0 whitespace-nowrap rounded-full border bg-surface px-3 py-2 text-xs text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">{`{${variable.key}}`}</button>)}</div></div>
                {usesPromo(template) && <div className="space-y-2"><p className="text-sm font-medium">Promo cek ulang</p><fieldset disabled={busy}><FilterDropdown label="Promo cek ulang" value={promoId} options={[{ value: "", label: "Pilih kode promo" }, ...promos.map(item => ({ value: item.id, label: `${item.code} · ${item.discount}%` }))]} onChange={value => updateDraft({ promoId: value || null })} className="h-11 w-full justify-between" /></fieldset></div>}
              </div>
              <TemplatePreview template={template} promo={promo} />
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t px-5 py-4 sm:px-6"><Button type="button" variant="outline" size="pill-sm" disabled={busy} onClick={() => { setEditing(null); setError(""); }}>Batal</Button><Button type="submit" size="pill-sm" disabled={busy || !dirty || Boolean(validation)}>{busy ? <Loader2 className="animate-spin" /> : <Save />}{busy ? "Menyimpan…" : stored ? "Simpan perubahan" : "Simpan template"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </section>;
}

function TemplatePreview({ template, promo }: { template: string; promo?: WhatsAppPromo }) {
  const previewValues = { ...PREVIEW_VALUES, diskon: promo ? String(promo.discount) : "…", kode_promo: promo?.code || "…",
    masa_berlaku: promo ? `sampai ${new Date(`${promo.endsOn}T00:00:00+07:00`).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long" })}` : "…" };
  return <div className="min-w-0 rounded-2xl border bg-surface p-4 lg:sticky lg:top-0">
    <h3 className="mb-4 text-sm font-semibold">Pratinjau pesan</h3>
    <div className="overflow-hidden rounded-2xl border bg-[#ece5dd]">
      <div className="flex items-center gap-3 border-b bg-background p-4"><span className="grid size-9 place-items-center rounded-full bg-primary text-white"><MessageCircle className="size-4" /></span><div><p className="text-sm font-semibold">Gleans</p><p className="mt-0.5 text-xs text-muted-foreground">WhatsApp</p></div></div>
      <div className="p-3"><div className="ml-auto max-w-full rounded-2xl rounded-tr-sm bg-[#d9fdd3] p-3 text-sm leading-relaxed text-slate-900 shadow-sm"><p className="break-words whitespace-pre-wrap [overflow-wrap:anywhere]">{renderReportTemplate(template, previewValues).split(/(\*[^*\n]+\*)/g).map((part, index) => part.startsWith("*") && part.endsWith("*") ? <strong key={index}>{part.slice(1, -1)}</strong> : part)}</p><div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-slate-500"><span>10.00</span><CheckCheck className="size-3.5 text-sky-500" /></div></div></div>
    </div>
  </div>;
}
