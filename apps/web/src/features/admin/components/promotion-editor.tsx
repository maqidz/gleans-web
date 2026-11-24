"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ChevronDown, Upload } from "lucide-react";
import { Button } from "@gleans/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@gleans/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@gleans/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@gleans/ui/select";
import type { AdminState } from "../lib/model";
import { EDITOR_IMAGE_LIMIT, type AdminMedia } from "../lib/media";
import { editorRequest, saveEditorRecord, uploadEditorMedia } from "../lib/editor-client";

type Promotion = AdminState["promos"][number];
const input = "h-11 w-full min-w-0 rounded-full border bg-background px-3.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const columns = "grid gap-4 min-[400px]:grid-cols-2";
const optionStyle = "min-h-10 cursor-pointer rounded-lg px-3 pr-8 data-[state=checked]:bg-accent data-[state=checked]:font-medium data-[state=checked]:text-primary";
const menuWidth = "min-w-0 rounded-xl border p-1";
const triggerStyle = "w-full gap-2 rounded-full border-border bg-background pl-3.5 pr-3.5 text-sm font-normal data-[state=open]:[&>svg]:rotate-180 [&>svg]:transition-transform";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0 space-y-1.5 text-sm font-medium">
    <span>{label}</span>{children}
  </label>;
}

function PromotionSelect({ label, value, onChange, children, disabled }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled: boolean;
}) {
  const id = useId();
  return <div className="min-w-0 flex-1 space-y-1.5 text-sm font-medium">
    <label htmlFor={id} className="block">{label}</label>
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className={triggerStyle + " py-0 data-[size=default]:h-11"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="start" className={menuWidth + " w-(--radix-select-trigger-width)"}>
        {children}
      </SelectContent>
    </Select>
  </div>;
}

export function AdminPromotionEditor({ existing, today }: { existing?: Promotion; today: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Promotion>(() => existing ?? {
    id: "", type: "Banner", name: "", title: "", code: "", discount: 0, active: false, start: today, end: today,
  });
  const [media, setMedia] = useState<AdminMedia[]>([]);
  const [mediaStatus, setMediaStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const chosenMedia = media.find(item => item.src === draft.imageUrl);

  useEffect(() => {
    const controller = new AbortController();
    void editorRequest<{ media: AdminMedia[] }>("/api/admin/site-editor?kind=media", { signal: controller.signal })
      .then(data => {
        if (controller.signal.aborted) return;
        setMedia(current => [...current, ...data.media.filter(item => !current.some(candidate => candidate.id === item.id))]);
        setMediaStatus("ready");
      })
      .catch(() => { if (!controller.signal.aborted) setMediaStatus("error"); });
    return () => controller.abort();
  }, []);

  function change<K extends keyof Promotion>(key: K, value: Promotion[K]) {
    setDraft(current => ({ ...current, [key]: value }));
  }

  function close() {
    setOpen(false);
    router.replace("/admin/promosi", { scroll: false });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const id = draft.id || crypto.randomUUID();
    if (!draft.id) change("id", id);
    try {
      let imageUrl = draft.type === "Banner" ? draft.imageUrl : undefined;
      if (draft.type === "Banner" && bannerFile) {
        const { media: uploaded } = await uploadEditorMedia(bannerFile);
        imageUrl = uploaded.src;
        setMedia(current => [uploaded, ...current]);
        change("imageUrl", imageUrl);
        setBannerFile(null);
      }
      await saveEditorRecord("promo", {
        ...draft,
        id,
        imageUrl,
        buttonLabel: draft.type === "Banner" ? draft.buttonLabel : undefined,
        href: draft.type === "Kode promo" ? undefined : draft.href?.trim(),
      });
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Promosi belum dapat disimpan.");
      setBusy(false);
    }
  }

  return <Dialog open={open} onOpenChange={next => { if (!next && !busy) close(); }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-[24px] p-5 sm:max-w-lg sm:p-6">
      <DialogHeader className="pr-6">
        <DialogTitle>{existing ? "Edit promosi" : "Tambah promosi"}</DialogTitle>
        <DialogDescription>{existing?.name || "Isi informasi dan jadwal promosi."}</DialogDescription>
      </DialogHeader>
      <form onSubmit={event => void save(event)} className="min-w-0 space-y-4">
        {error && <p role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
        <fieldset disabled={busy} className="min-w-0 space-y-4">
          <legend className="sr-only">Pengaturan promosi</legend>
          <Field label="Nama kampanye"><input className={input} required maxLength={200} value={draft.name} onChange={event => change("name", event.target.value)} /></Field>
          <PromotionSelect label="Jenis promosi" value={draft.type} disabled={busy}
            onChange={value => change("type", value as Promotion["type"])}>
            <SelectItem className={optionStyle} value="Banner">Banner</SelectItem>
            <SelectItem className={optionStyle} value="Kode promo">Kode promo</SelectItem>
          </PromotionSelect>
          <Field label="Judul"><input className={input} required maxLength={200} value={draft.title} onChange={event => change("title", event.target.value)} /></Field>
          {draft.type === "Kode promo" ? <>
            <Field label="Kode promo"><input className={input} required maxLength={40} value={draft.code} onChange={event => change("code", event.target.value.toUpperCase())} /></Field>
            <div className={columns}>
              <PromotionSelect label="Jenis diskon" value={draft.discountType ?? "fixed"} disabled={busy}
                onChange={value => change("discountType", value as Promotion["discountType"])}>
                <SelectItem className={optionStyle} value="fixed">Rupiah</SelectItem>
                <SelectItem className={optionStyle} value="percentage">Persen</SelectItem>
              </PromotionSelect>
              <Field label="Diskon"><input className={input} type="number" required min={1} max={draft.discountType === "percentage" ? 100 : 1000000} value={draft.discount} onChange={event => change("discount", Number(event.target.value))} /></Field>
            </div>
          </> : <>
            <Field label="Deskripsi"><textarea className="min-h-24 w-full rounded-2xl border bg-background p-3.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" maxLength={500} value={draft.description ?? ""} onChange={event => change("description", event.target.value)} /></Field>
            {draft.type === "Banner" && <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Gambar banner</p>
                <Link href="/admin/pengaturan?tab=media" target="_blank" rel="noopener" className="text-xs text-primary hover:underline">Kelola media</Link>
              </div>
              <div className="flex items-center gap-3">
                {!bannerFile && draft.imageUrl && <Image src={draft.imageUrl} alt="" width={80} height={45} unoptimized
                  className="aspect-video w-20 shrink-0 rounded-lg border bg-surface object-contain" />}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" aria-label="Pilih gambar banner" disabled={busy}
                      className={triggerStyle + " flex h-11 min-w-0 flex-1 items-center justify-between border outline-none focus-visible:ring-2 focus-visible:ring-ring"}>
                      <span className="min-w-0 truncate">{bannerFile?.name ?? chosenMedia?.name ?? (draft.imageUrl ? "Gambar tersimpan" : "Pilih dari file")}</span>
                      <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={6} className={menuWidth + " w-(--radix-dropdown-menu-trigger-width)"}>
                    <DropdownMenuItem className={optionStyle} onSelect={() => fileInput.current?.click()}><Upload aria-hidden="true" />Pilih dari file</DropdownMenuItem>
                    {(media.length > 0 || mediaStatus === "loading" || draft.imageUrl) && <DropdownMenuSeparator />}
                    {mediaStatus === "loading" && <DropdownMenuItem disabled>Memuat pustaka media…</DropdownMenuItem>}
                    <DropdownMenuRadioGroup value={bannerFile ? "" : draft.imageUrl ?? ""} onValueChange={value => {
                      setBannerFile(null);
                      change("imageUrl", value);
                    }}>
                      {draft.imageUrl && !chosenMedia && <DropdownMenuRadioItem className={optionStyle} value={draft.imageUrl}>Gambar tersimpan</DropdownMenuRadioItem>}
                      {media.map(item => item.src && <DropdownMenuRadioItem className={optionStyle} key={item.id} value={item.src}>
                        <span className="min-w-0 truncate">{item.name}</span>
                      </DropdownMenuRadioItem>)}
                    </DropdownMenuRadioGroup>
                    {(bannerFile || draft.imageUrl) && <DropdownMenuItem className={optionStyle} onSelect={() => {
                      setBannerFile(null);
                      change("imageUrl", "");
                    }}>Hapus pilihan gambar</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
                <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden
                  onChange={event => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    if (!file.size || file.size > EDITOR_IMAGE_LIMIT) {
                      setError(!file.size ? "File gambar kosong." : "Ukuran gambar maksimal 2 MB.");
                      return;
                    }
                    setError("");
                    setBannerFile(file);
                  }} />
              </div>
              {mediaStatus === "error" && <p role="status" className="text-xs text-muted-foreground">Pustaka media belum dapat dimuat.</p>}
            </div>}
            <div className={draft.type === "Banner" ? columns : undefined}>
              {draft.type === "Banner" && <Field label="Teks tombol"><input className={input} maxLength={60} placeholder="Lihat promo" value={draft.buttonLabel ?? ""} onChange={event => change("buttonLabel", event.target.value)} /></Field>}
              <Field label="Tautan tujuan"><input className={input} maxLength={400} placeholder="/deteksi-ai" value={draft.href ?? ""} onChange={event => change("href", event.target.value)} /></Field>
            </div>
          </>}
          <div className={columns}>
            <Field label="Mulai (WIB)"><input className={input} type="date" required value={draft.start} onChange={event => change("start", event.target.value)} /></Field>
            <Field label="Selesai (WIB)"><input className={input} type="date" required min={draft.start} value={draft.end} onChange={event => change("end", event.target.value)} /></Field>
          </div>
          <label className="flex items-center justify-between gap-3 border-t pt-4 text-sm font-medium">
            Aktifkan promosi
            <input type="checkbox" role="switch" className="peer sr-only" checked={draft.active} onChange={event => change("active", event.target.checked)} />
            <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-border transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2" />
          </label>
        </fieldset>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="pill-sm" disabled={busy} onClick={close}>Batal</Button>
          <Button type="submit" size="pill-sm" disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
