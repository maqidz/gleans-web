"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bold, Italic, Strikethrough, Quote, List, ListOrdered, ChevronDown, ImageIcon, Send, Save } from "lucide-react";
import { Button } from "@gleans/ui/button";
import { Input } from "@gleans/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@gleans/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@gleans/ui/tabs";
import { ADMIN_BLOG_CATEGORIES, BLOG_AUTHOR, type AdminState } from "@/features/admin/lib/model";
import type { AdminMedia } from "@/features/admin/lib/media";
import { cn } from "@/lib/utils";
import { editorRequest, saveEditorRecord } from "../lib/editor-client";

type Blog = AdminState["blogs"][number];

const field = "h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";
const panel = "min-w-0 rounded-[24px] border bg-card";
const noCover = "none";
const categoryOptions = ADMIN_BLOG_CATEGORIES.map(category => ({ value: category, label: category }));
const toolbar = [
  { label: "Tebal", icon: Bold, before: "**", after: "**" },
  { label: "Miring", icon: Italic, before: "*", after: "*" },
  { label: "Coret", icon: Strikethrough, before: "~~", after: "~~" },
  { label: "Kutipan", icon: Quote, before: "> ", prefix: true },
  { label: "Daftar poin", icon: List, before: "- ", prefix: true },
  { label: "Daftar nomor", icon: ListOrdered, before: "1. ", prefix: true },
];

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function Label({ name, children }: { name: string; children: ReactNode }) {
  return <label className="block space-y-1.5 text-sm font-medium">
    <span>{name}</span>{children}
  </label>;
}

function ArticleSelect({ label, value, options, disabled, onChange }: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return <div className="space-y-1.5 text-sm font-medium">
    <label htmlFor={id} className="block">{label}</label>
    <Select value={value} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full gap-2 rounded-full bg-background px-4 py-0 font-normal data-[size=default]:h-11 data-[state=open]:[&>svg]:rotate-180 [&>svg]:transition-transform">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="w-(--radix-select-trigger-width) min-w-0 rounded-xl border p-1">
        {options.map(option => <SelectItem key={option.value} value={option.value}
          className="min-h-10 cursor-pointer rounded-lg pl-3 data-[state=checked]:bg-accent data-[state=checked]:text-primary">
          <span className="min-w-0 truncate">{option.label}</span>
        </SelectItem>)}
      </SelectContent>
    </Select>
  </div>;
}

function EditorSection({ title, children, open }: { title: string; children: ReactNode; open?: boolean }) {
  return <details open={open} className={cn(panel, "group")}>
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[24px] px-4 py-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
      {title}<ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground group-open:rotate-180" />
    </summary>
    <div className="space-y-4 px-4 pb-4">{children}</div>
  </details>;
}

function Inline({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~)/g).map((part, index) => {
    if (part.startsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith("~~")) return <s key={index}>{part.slice(2, -2)}</s>;
    return part;
  })}</>;
}

function Markdown({ content }: { content: string }) {
  return <div className="space-y-3 text-sm leading-7">{content.split("\n").map((line, index) => {
    if (/^### /.test(line)) return <h4 key={index} className="text-lg font-semibold"><Inline text={line.slice(4)} /></h4>;
    if (/^## /.test(line)) return <h3 key={index} className="text-xl font-semibold"><Inline text={line.slice(3)} /></h3>;
    if (/^# /.test(line)) return <h3 key={index} className="text-2xl font-semibold"><Inline text={line.slice(2)} /></h3>;
    if (/^> /.test(line)) return <blockquote key={index} className="border-l-2 border-primary pl-4 text-muted-foreground"><Inline text={line.slice(2)} /></blockquote>;
    if (/^[-*] /.test(line)) return <p key={index} className="pl-3">• <Inline text={line.slice(2)} /></p>;
    if (/^\d+\. /.test(line)) return <p key={index} className="pl-3"><Inline text={line} /></p>;
    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image && /^(https?:\/\/|\/images\/)/.test(image[2])) {
      return <Image key={index} src={image[2]} alt={image[1]} width={800} height={450} unoptimized className="h-auto max-w-full rounded-xl" />;
    }
    return line ? <p key={index} className="break-words"><Inline text={line} /></p> : <div key={index} className="h-2" />;
  })}</div>;
}

export function AdminBlogEditor({ id, existing }: { id: string; existing?: Blog }) {
  const router = useRouter();
  const isNew = id === "baru";
  const [draft, setDraft] = useState<Blog>(() => existing ? { ...existing } : {
    id: "BLOG-" + crypto.randomUUID().slice(0, 8), title: "", slug: "", summary: "", content: "",
    category: "Edukasi", author: BLOG_AUTHOR, coverId: "", coverAlt: "", status: "Draft", featured: false,
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [media, setMedia] = useState<AdminMedia[]>([]);
  const [busy, setBusy] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [publishTime, setPublishTime] = useState(() => draft.status === "Terjadwal" && draft.publishAt
    ? new Date(Date.parse(draft.publishAt) + 7 * 3600_000).toISOString().slice(0, 16)
    : "",
  );

  useEffect(() => {
    const controller = new AbortController();
    void editorRequest<{ media: AdminMedia[] }>("/api/admin/site-editor?kind=media", { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setMedia(data.media); })
      .catch(() => { if (!controller.signal.aborted) setMediaError("Pustaka media belum dapat dimuat."); });
    return () => controller.abort();
  }, []);

  if (!isNew && !existing) return <div className="py-12">
    <h1 className="text-2xl font-semibold">Artikel tidak ditemukan</h1>
    <Link href="/admin/blog" className="mt-4 inline-block text-primary">Kembali ke Blog</Link>
  </div>;

  function update<K extends keyof Blog>(key: K, value: Blog[K]) {
    setDraft(current => ({ ...current, [key]: value }));
    setNotice("");
  }

  function format(before: string, after = "", placeholder = "Teks", prefix = false) {
    const node = textarea.current;
    if (!node) return;
    const start = node.selectionStart;
    const end = node.selectionEnd;
    const selected = draft.content.slice(start, end) || placeholder;
    const replacement = prefix
      ? selected.split("\n").map((line, index) => (before === "1. " ? index + 1 + ". " : before) + line).join("\n")
      : before + selected + after;
    update("content", draft.content.slice(0, start) + replacement + draft.content.slice(end));
    requestAnimationFrame(() => {
      node.focus();
      node.setSelectionRange(start + before.length, start + replacement.length - after.length);
    });
  }

  async function persist(status: Blog["status"]) {
    if (busy) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const publishAt = status === "Terjadwal" && publishTime ? new Date(publishTime + ":00+07:00").toISOString() : undefined;
      const { record } = await saveEditorRecord("blog", { ...draft, status, publishAt });
      setDraft(record);
      if (status !== "Terjadwal") setPublishTime("");
      setNotice(status === "Terjadwal" ? "Jadwal publikasi disimpan." : status === "Terbit" ? "Artikel tersimpan dan terbit." : status === "Arsip" ? "Artikel diarsipkan." : "Draft disimpan.");
      if (isNew) router.replace("/admin/blog/" + record.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Artikel belum dapat disimpan.");
    } finally {
      setBusy(false);
    }
  }

  const cover = draft.coverId;
  const coverOptions = [
    { value: noCover, label: "Tanpa cover" },
    ...(cover && !media.some(item => item.src === cover) ? [{ value: cover, label: "Gambar saat ini" }] : []),
    ...media.flatMap(item => item.src ? [{ value: item.src, label: item.name }] : []),
  ];
  const published = draft.status === "Terbit";

  return <div className="min-w-0">
    <Link href="/admin/blog" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
      <ArrowLeft aria-hidden="true" className="size-4" />Semua artikel
    </Link>
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{isNew ? "Tambah artikel" : "Edit artikel"}</h1>
        <span className={cn("rounded-full px-3 py-1 text-xs font-medium", published ? "bg-accent text-accent-foreground" : "bg-surface text-muted-foreground")}>{draft.status}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {draft.status === "Draft" && <Button variant="outline" size="pill-sm" disabled={busy} onClick={() => void persist("Draft")}>Simpan draft</Button>}
        <Button size="pill-sm" disabled={busy} onClick={() => void persist("Terbit")}>
          {published ? <Save aria-hidden="true" /> : <Send aria-hidden="true" />}
          {published ? "Simpan perubahan" : "Terbitkan"}
        </Button>
      </div>
    </header>
    {error && <p role="alert" className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-xl bg-accent p-4 text-sm text-accent-foreground">{notice}</p>}

    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_17.5rem]">
      <section aria-label="Tulis artikel" className={cn(panel, "overflow-hidden")}>
        <div className="p-4 sm:p-5">
          <Label name="Judul">
            <Input className={cn(field, "rounded-full px-4 font-semibold")} value={draft.title} maxLength={200} disabled={busy} placeholder="Judul artikel"
              onChange={event => {
                const title = event.target.value;
                setDraft(current => ({ ...current, title, slug: !current.slug || (isNew && current.slug === slugify(current.title)) ? slugify(title) : current.slug }));
                setNotice("");
              }} />
          </Label>
        </div>

        <Tabs defaultValue="write" className="gap-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-y px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold">Isi artikel</h2>
            <TabsList aria-label="Mode editor" className="rounded-full bg-surface">
              <TabsTrigger value="write" className="rounded-full px-3 text-xs">Tulis</TabsTrigger>
              <TabsTrigger value="preview" className="rounded-full px-3 text-xs">Pratinjau</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="write">
            <div className="flex flex-wrap items-center gap-1 border-b bg-surface px-3 py-2 sm:px-4">
              <select aria-label="Gaya teks" className="h-8 rounded-lg px-2 text-sm text-foreground" value="" disabled={busy}
                onChange={event => format(event.target.value, "", "Judul", true)}>
                <option value="" disabled>Gaya teks</option><option value="# ">Judul 1</option><option value="## ">Judul 2</option><option value="### ">Judul 3</option>
              </select>
              <span aria-hidden="true" className="mx-1 h-5 border-l" />
              {toolbar.map(({ label, icon: Icon, before, after, prefix }) =>
                <Button key={label} variant="ghost" size="icon" aria-label={label} title={label} disabled={busy} onClick={() => format(before, after, "Teks", prefix)}><Icon /></Button>,
              )}
            </div>
            <textarea ref={textarea} aria-label="Isi artikel" className="block min-h-88 w-full resize-y bg-background p-4 font-mono text-sm leading-7 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset sm:p-5"
              value={draft.content} maxLength={30000} disabled={busy} onChange={event => update("content", event.target.value)} placeholder="Tulis isi artikel di sini." />
          </TabsContent>
          <TabsContent value="preview" className="min-h-88 space-y-4 bg-background p-4 sm:p-5">
            {cover && <Image src={cover} alt={draft.coverAlt} width={800} height={450} unoptimized className="aspect-video w-full rounded-xl object-cover" />}
            <div>
              <p className="mb-2 text-xs text-muted-foreground">{draft.category} · {BLOG_AUTHOR}</p>
              <h3 className="break-words text-2xl font-semibold">{draft.title || "Judul artikel"}</h3>
              {draft.summary && <p className="mt-2 text-sm text-muted-foreground">{draft.summary}</p>}
            </div>
            {draft.content ? <Markdown content={draft.content} /> : <p className="text-sm text-muted-foreground">Isi artikel belum ditulis.</p>}
          </TabsContent>
        </Tabs>
      </section>

      <aside aria-label="Pengaturan artikel" className="grid min-w-0 content-start gap-3">
        <EditorSection title="Detail artikel" open>
          <ArticleSelect label="Kategori" value={draft.category} options={categoryOptions} disabled={busy}
            onChange={value => update("category", value as Blog["category"])} />
          <Label name="Alamat artikel">
            <div className="relative">
              <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-normal text-muted-foreground">/blog/</span>
              <Input className={cn(field, "pl-14")} value={draft.slug} maxLength={140} disabled={busy} onChange={event => update("slug", event.target.value)} />
            </div>
          </Label>
        </EditorSection>

        <EditorSection title="Gambar cover">
          {cover
            ? <Image src={cover} alt={draft.coverAlt} width={560} height={315} unoptimized className="aspect-video w-full rounded-xl border object-cover" />
            : <div aria-hidden="true" className="grid min-h-22 place-items-center rounded-xl border border-dashed bg-surface text-muted-foreground"><ImageIcon className="size-6" /></div>}
          <ArticleSelect label="Pilih dari pustaka media" value={cover || noCover} options={coverOptions} disabled={busy}
            onChange={value => update("coverId", value === noCover ? "" : value)} />
          {cover && <Label name="Teks alternatif cover"><Input className={field} value={draft.coverAlt} maxLength={200} disabled={busy}
            onChange={event => update("coverAlt", event.target.value)} placeholder="Deskripsi gambar" /></Label>}
          {mediaError && <p role="status" className="text-xs text-destructive">{mediaError}</p>}
          <Link href="/admin/pengaturan?tab=media" className="inline-block text-xs font-medium text-primary hover:underline">Kelola pustaka media</Link>
        </EditorSection>

        <EditorSection title="Pengaturan terbit">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="size-4 accent-primary" checked={draft.featured} disabled={busy}
              onChange={event => update("featured", event.target.checked)} />
            Tampilkan sebagai unggulan
          </label>
          <Label name="Waktu publikasi (WIB)"><Input type="datetime-local" className={field} value={publishTime} disabled={busy} onChange={event => setPublishTime(event.target.value)} /></Label>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="pill-sm" disabled={busy || !publishTime} onClick={() => void persist("Terjadwal")}>Jadwalkan</Button>
            {draft.status !== "Draft" && <Button variant="ghost" size="pill-sm" disabled={busy} onClick={() => void persist("Draft")}>Jadikan draft</Button>}
            {!isNew && draft.status !== "Arsip" && <Button variant="ghost" size="pill-sm" disabled={busy} onClick={() => void persist("Arsip")}>Arsipkan</Button>}
          </div>
        </EditorSection>
      </aside>
    </div>
  </div>;
}
