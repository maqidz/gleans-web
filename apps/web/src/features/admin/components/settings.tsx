"use client";
import { useAdmin } from "./provider";
export function AdminSettings() { const { adminEmail } = useAdmin(); return <section><h1 className="text-2xl font-semibold">Pengaturan</h1><div className="mt-6 rounded-[24px] border p-5"><h2 className="font-medium">Akun admin</h2><p className="mt-2 text-sm text-muted-foreground">{adminEmail}</p><p className="mt-4 text-sm text-muted-foreground">Akses admin dikelola melalui konfigurasi server. Pengaturan tampilan dan suara tersedia di menu profil.</p></div></section>; }
