"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Copy, ImageIcon, RotateCcw, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { Button } from "@gleans/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@gleans/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@gleans/ui/tabs";
import type { AdminMedia } from "../lib/media";
import { editorRequest, uploadEditorMedia } from "../lib/editor-client";
import { useAdmin } from "./provider";
import { WhatsAppSettings } from "./whatsapp-settings";
import { GptzeroUsage } from "./gptzero-usage";

type Activity = { id: number; at: string; actor: string; action: string; object: string };
const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export function AdminSettings() {
  const { adminEmail } = useAdmin();
  const params = useSearchParams();
  const tab = params.get("tab");
  return <>
    <div className="mb-7">
      <h1 className="text-2xl font-semibold sm:text-3xl">Pengaturan</h1>
      <p className="mt-2 text-sm text-muted-foreground">Kelola akun admin, notifikasi, penggunaan API, aktivitas, dan pustaka media Gleans.</p>
    </div>
    <Tabs defaultValue={tab === "media" || tab === "activity" || tab === "notifications" || tab === "api" ? tab : "admin"} className="min-w-0 gap-7">
      <TabsList className="h-10 max-w-full overflow-x-auto group-data-horizontal/tabs:h-10 rounded-full bg-surface p-1">
        <TabsTrigger className="rounded-full px-5 py-2" value="admin">Admin</TabsTrigger>
        <TabsTrigger className="rounded-full px-5 py-2" value="notifications">Notifikasi</TabsTrigger>
        <TabsTrigger className="rounded-full px-5 py-2" value="api">API</TabsTrigger>
        <TabsTrigger className="rounded-full px-5 py-2" value="activity">Aktivitas</TabsTrigger>
        <TabsTrigger className="rounded-full px-5 py-2" value="media">Media</TabsTrigger>
      </TabsList>
      <TabsContent value="admin">
        <section className="rounded-[24px] border p-5">
          <h2 className="font-semibold">Daftar admin</h2>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0"><p className="text-sm font-semibold">Gleans</p><p className="mt-1 break-all text-xs text-muted-foreground">{adminEmail}</p></div>
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-accent px-3 py-1 text-xs text-primary">Owner</span><span className="rounded-full bg-surface px-3 py-1 text-xs text-muted-foreground">Aktif</span></div>
          </div>
        </section>
      </TabsContent>
      <TabsContent value="notifications"><WhatsAppSettings /></TabsContent>
      <TabsContent value="api"><GptzeroUsage /></TabsContent>
      <TabsContent value="activity"><ActivityList /></TabsContent>
      <TabsContent value="media"><MediaLibrary /></TabsContent>
    </Tabs>
  </>;
}

function ActivityList() {
  const [items, setItems] = useState<Activity[] | null>(null);
  const [error, setError] = useState("");
  const [deleteThrough, setDeleteThrough] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void editorRequest<{ activity: Activity[] }>("/api/admin/site-editor?kind=activity", { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setItems(data.activity); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, []);

  async function clearHistory() {
    if (deleteThrough == null || busy) return;
    setBusy(true);
    setDeleteError("");
    try {
      const { deletedThrough } = await editorRequest<{ deletedThrough: number }>(`/api/admin/activity?through=${deleteThrough}`, { method: "DELETE" });
      setItems(current => current?.filter(item => item.id > deletedThrough) ?? null);
      setDeleteThrough(null);
      setNotice("Riwayat aktivitas berhasil dihapus.");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Riwayat aktivitas belum dapat dihapus.");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!items) return <p role="status" className="text-sm text-muted-foreground">Memuat aktivitas…</p>;
  return <section className="min-w-0">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{items.length} aktivitas terakhir</p>
      <Button type="button" variant="outline" size="pill-sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={!items.length || busy} onClick={() => { setDeleteError(""); setNotice(""); setDeleteThrough(Math.max(...items.map(item => item.id))); }}>
        <Trash2 aria-hidden="true" />Hapus riwayat
      </Button>
    </div>
    {notice && <p role="status" className="mb-4 text-sm text-primary">{notice}</p>}
    <div role="region" aria-label="Tabel aktivitas" tabIndex={0} className="overflow-x-auto rounded-2xl border focus-visible:ring-2 focus-visible:ring-primary">
      <table className="w-full min-w-[650px] text-left text-sm">
        <thead className="bg-surface text-xs text-muted-foreground"><tr>{["Waktu", "Pelaku", "Tindakan", "Objek"].map(label => <th key={label} scope="col" className="px-4 py-4 font-medium uppercase">{label}</th>)}</tr></thead>
        <tbody className="divide-y">{items.map(item => <tr key={item.id}>
          <td className="whitespace-nowrap px-4 py-4 text-xs">{date.format(new Date(item.at))} WIB</td>
          <td className="px-4 py-4">{item.actor}</td><td className="px-4 py-4">{item.action}</td><td className="px-4 py-4">{item.object}</td>
        </tr>)}{!items.length && <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">Belum ada aktivitas.</td></tr>}</tbody>
      </table>
    </div>
    <Dialog open={deleteThrough != null} onOpenChange={open => { if (!open && !busy) setDeleteThrough(null); }}>
      <DialogContent className="rounded-[24px] p-5 sm:p-6">
        <DialogHeader className="pr-6">
          <DialogTitle>Hapus riwayat aktivitas?</DialogTitle>
          <DialogDescription>Riwayat aktivitas admin akan dihapus permanen dan tidak dapat dipulihkan. Artikel, promosi, dan media tetap tersimpan.</DialogDescription>
        </DialogHeader>
        {deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="pill-sm" disabled={busy} onClick={() => setDeleteThrough(null)}>Batal</Button>
          <Button type="button" variant="destructive" size="pill-sm" disabled={busy} onClick={() => void clearHistory()}>{busy ? "Menghapus…" : "Hapus riwayat"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </section>;
}

function MediaLibrary() {
  const [items, setItems] = useState<AdminMedia[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [changing, setChanging] = useState<string | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [clearing, setClearing] = useState(false);
  const controlsBusy = busy || changing != null || clearing;
  useEffect(() => {
    const controller = new AbortController();
    void editorRequest<{ media: AdminMedia[] }>("/api/admin/site-editor?kind=media&includeHidden=1", { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setItems(data.media); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, []);

  async function upload(file: File) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const { media } = await uploadEditorMedia(file);
      setItems(current => [media, ...(current ?? [])]);
      setNotice("Gambar ditambahkan ke pustaka.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Gambar belum dapat disimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function changeVisibility(item: AdminMedia, hidden: boolean) {
    setChanging(item.id);
    setError("");
    setNotice("");
    try {
      await editorRequest("/api/admin/site-media", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, hidden }),
      });
      setItems(current => current?.map(candidate => candidate.id === item.id ? { ...candidate, hidden } : candidate) ?? null);
      setNotice(hidden ? item.name + " dihapus dari pustaka. Pulihkan dari bagian Media dihapus." : item.name + " dipulihkan ke pustaka.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Pustaka media belum dapat diperbarui.");
    } finally {
      setChanging(null);
    }
  }

  async function clearTrash() {
    if (!deleteIds || controlsBusy) return;
    setClearing(true); setDeleteError(""); setError(""); setNotice("");
    const removed = new Set<string>();
    const skipped = new Set<string>();
    let remaining = deleteIds;
    try {
      while (remaining.length) {
        const data = await editorRequest<{ removedIds: string[]; skippedIds: string[]; pendingIds: string[] }>("/api/admin/site-media", {
          method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: remaining }),
        });
        data.removedIds.forEach(id => removed.add(id));
        data.skippedIds.forEach(id => skipped.add(id));
        setItems(current => current?.filter(item => !removed.has(item.id)) ?? null);
        remaining = data.pendingIds;
        if (remaining.length && !data.removedIds.length) throw new Error("Sebagian file belum dapat dihapus. Coba lagi untuk melanjutkan.");
      }
      setDeleteIds(null);
      setNotice(`${removed.size} media dihapus permanen.${skipped.size ? ` ${skipped.size} media dilewati karena masih digunakan atau sudah dipulihkan.` : ""}`);
    } catch (error) {
      setDeleteIds(remaining);
      setDeleteError(error instanceof Error ? error.message : "Media belum dapat dihapus permanen.");
    } finally { setClearing(false); }
  }

  const visibleItems = items?.filter(item => !item.hidden) ?? [];
  const hiddenItems = items?.filter(item => item.hidden) ?? [];

  return <section>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold">Pustaka media</h2><p className="mt-2 text-xs text-muted-foreground">PNG, JPG, WebP, atau GIF, maksimal 2 MB.</p></div>
      <label className="relative inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-primary px-4 text-sm text-primary-foreground focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
        <Upload className="size-4" />{busy ? "Mengunggah…" : "Unggah"}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Unggah gambar media" className="sr-only" disabled={controlsBusy}
          onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
      </label>
    </div>
    {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="mb-4 text-sm text-primary">{notice}</p>}
    {!items && !error && <p role="status" className="text-sm text-muted-foreground">Memuat media…</p>}
    {items && !visibleItems.length && <div className="py-12 text-center"><ImageIcon className="mx-auto mb-3 size-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">Belum ada media di pustaka.</p></div>}
    {!!visibleItems.length && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visibleItems.map(item => <article key={item.id} className="overflow-hidden rounded-2xl border">
      {item.src && <Image unoptimized width={640} height={360} src={item.src} alt={item.alt} className="aspect-video w-full object-cover" />}
      <div className="flex items-center justify-between gap-3 p-4">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" aria-label={"Salin tautan " + item.name} title="Salin tautan" onClick={async () => {
            try { await navigator.clipboard.writeText(new URL(item.src ?? "", window.location.origin).href); setNotice("Tautan gambar disalin."); }
            catch { setError("Tautan belum dapat disalin."); }
          }}><Copy aria-hidden="true" /></Button>
          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label={"Hapus " + item.name + " dari pustaka"} title="Hapus dari pustaka" disabled={controlsBusy}
            onClick={() => void changeVisibility(item, true)}><Trash2 aria-hidden="true" /></Button>
        </div>
      </div>
    </article>)}</div>}
    {!!hiddenItems.length && <details className="group mt-6 rounded-2xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span>Media dihapus <span className="ml-1 text-muted-foreground">({hiddenItems.length})</span></span>
        <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground group-open:rotate-180" />
      </summary>
      <div className="flex justify-end border-t px-4 py-3"><Button type="button" variant="outline" size="pill-sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={controlsBusy} onClick={() => { setDeleteError(""); setDeleteIds(hiddenItems.map(item => item.id)); }}><Trash2 aria-hidden="true" />Hapus semua</Button></div>
      <ul className="divide-y border-t">{hiddenItems.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <span className="min-w-0 break-words text-sm">{item.name}</span>
        <Button type="button" variant="outline" size="pill-sm" aria-label={"Pulihkan " + item.name} disabled={controlsBusy}
          onClick={() => void changeVisibility(item, false)}><RotateCcw aria-hidden="true" />Pulihkan</Button>
      </li>)}</ul>
    </details>}
    <Dialog open={deleteIds !== null} onOpenChange={open => { if (!open && !clearing) { setDeleteIds(null); setDeleteError(""); } }}>
      <DialogContent className="rounded-[24px] p-5 sm:p-6" onEscapeKeyDown={event => { if (clearing) event.preventDefault(); }} onPointerDownOutside={event => { if (clearing) event.preventDefault(); }}>
        <DialogHeader className="pr-6"><DialogTitle>Hapus semua media di sampah?</DialogTitle><DialogDescription>{deleteIds?.length ?? 0} media akan dihapus permanen dan tidak dapat dipulihkan. Media yang masih digunakan artikel atau promosi akan tetap disimpan.</DialogDescription></DialogHeader>
        {deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" size="pill-sm" disabled={clearing} onClick={() => { setDeleteIds(null); setDeleteError(""); }}>Batal</Button><Button type="button" variant="destructive" size="pill-sm" disabled={clearing} onClick={() => void clearTrash()}><Trash2 aria-hidden="true" />{clearing ? "Menghapus…" : "Hapus permanen"}</Button></div>
      </DialogContent>
    </Dialog>
  </section>;
}
