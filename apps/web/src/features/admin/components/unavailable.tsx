export function AdminUnavailable({ title }: { title: string }) {
  return <section className="rounded-[24px] border bg-background p-6"><h1 className="text-2xl font-semibold">{title}</h1><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Pengelolaan {title.toLowerCase()} melalui dashboard belum tersedia. Tidak ada data contoh atau perubahan lokal yang diterapkan ke website.</p></section>;
}
