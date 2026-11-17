"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button } from "@gleans/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@gleans/ui/dialog";
import type { AdminState } from "../lib/model";
import { editorRequest, saveEditorRecord } from "../lib/editor-client";
import { AdminContentTable } from "./content-table";
import { AdminFilterDropdown } from "./filter-dropdown";

type Blog = AdminState["blogs"][number];
type Promo = AdminState["promos"][number];
type EditorialRecord = Blog | Promo;

export function AdminEditorialList({ module }: { module: "blog" | "promosi" }) {
  const kind = module === "blog" ? "blog" : "promo";
  const router = useRouter();
  const [records, setRecords] = useState<EditorialRecord[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Semua");
  const [preview, setPreview] = useState<Blog | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Promo | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const title = kind === "blog" ? "Blog" : "Promosi";
  const options = kind === "blog" ? ["Semua", "Draft", "Terbit", "Terjadwal", "Arsip"] : ["Semua", "Banner", "Kode promo"];

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await editorRequest<{ records: EditorialRecord[] }>("/api/admin/site-editor?kind=" + kind, { signal });
      if (!signal?.aborted) { setRecords(data.records); setError(""); }
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Konten belum dapat dimuat.");
    } finally {
      if (!signal?.aborted) setReady(true);
    }
  }, [kind]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const recordsShown = records.map(item =>
    "slug" in item && item.status === "Terjadwal" && item.publishAt && Date.parse(item.publishAt) <= Date.now()
      ? { ...item, status: "Terbit" as const }
      : item,
  ).filter(item => {
    const text = "slug" in item ? item.title + " " + item.slug : item.name + " " + item.title + " " + item.code;
    return text.toLowerCase().includes(query.trim().toLowerCase()) && (filter === "Semua" || ("slug" in item ? item.status : item.type) === filter);
  });

  async function save(record: EditorialRecord) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await saveEditorRecord(kind, record);
      setRecords(current => [result.record, ...current.filter(item => item.id !== result.record.id)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Konten belum dapat disimpan.");
    } finally {
      setBusy(false);
    }
  }

  function open(item: EditorialRecord) {
    setError("");
    router.push("/admin/" + module + "/" + encodeURIComponent(item.id));
  }

  async function remove() {
    if (!pendingDelete || busy) return;
    setBusy(true);
    setDeleteError("");
    try {
      const { id } = await editorRequest<{ id: string }>(`/api/admin/site-editor?kind=promo&id=${encodeURIComponent(pendingDelete.id)}`, { method: "DELETE" });
      setRecords(current => current.filter(item => item.id !== id));
      setPendingDelete(null);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "Promosi belum dapat dihapus.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <header className="mb-7">
      <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{kind === "blog" ? "Kelola artikel, jadwal terbit, dan artikel unggulan." : "Kelola banner dan kode promo Gleans Shield."}</p>
    </header>
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-surface px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input aria-label={"Cari " + title} placeholder="Cari nama, judul, atau kode…" className="w-full min-w-0 bg-transparent text-sm outline-none" value={query} onChange={event => setQuery(event.target.value)} />
      </div>
      <AdminFilterDropdown label={"Filter " + title} value={filter} options={options} onChange={setFilter} />
      <Button asChild size="pill-sm"><Link href={`/admin/${module}/baru`}><Plus />Tambah</Link></Button>
    </div>
    {error && <p role="alert" className="mb-4 text-sm text-destructive">{error} <button type="button" className="underline" onClick={() => void load()}>Muat ulang</button></p>}
    {ready ? <>
      <p className="mb-4 text-xs text-muted-foreground">{recordsShown.length} {kind === "blog" ? "artikel" : "promosi"} ditemukan</p>
      <AdminContentTable module={module} items={recordsShown} onEdit={open} onPreview={setPreview}
        onDelete={promo => { setDeleteError(""); setPendingDelete(promo); }} onToggle={item => {
        if ("featured" in item) void save({ ...item, featured: !item.featured });
        else if ("type" in item) void save({ ...item, active: !item.active });
      }} />
    </> : <p role="status" className="text-sm text-muted-foreground">Memuat konten…</p>}

    <Dialog open={!!preview} onOpenChange={open => { if (!open) setPreview(null); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-[24px] sm:max-w-xl">
        <DialogHeader><DialogTitle>{preview?.title}</DialogTitle><DialogDescription>Pratinjau artikel</DialogDescription></DialogHeader>
        {preview && <>
          <p className="text-sm text-muted-foreground">{preview.summary}</p>
          <p className="max-h-60 overflow-y-auto whitespace-pre-wrap text-sm leading-7">{preview.content}</p>
        </>}
      </DialogContent>
    </Dialog>
    <Dialog open={!!pendingDelete} onOpenChange={open => { if (!open && !busy) setPendingDelete(null); }}>
      <DialogContent className="rounded-[24px] p-5 sm:p-6">
        <DialogHeader className="pr-6">
          <DialogTitle>Hapus promosi?</DialogTitle>
          <DialogDescription>{pendingDelete?.type === "Kode promo"
            ? <>Kode <strong className="break-words">{pendingDelete.code}</strong> akan berhenti berlaku.</>
            : <>Banner <strong className="break-words">{pendingDelete?.name}</strong> akan dihapus dari beranda.</>}</DialogDescription>
        </DialogHeader>
        {deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="pill-sm" disabled={busy} onClick={() => setPendingDelete(null)}>Batal</Button>
          <Button type="button" variant="destructive" size="pill-sm" disabled={busy} onClick={() => void remove()}>{busy ? "Menghapus…" : "Hapus promosi"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
