import { EDITOR_IMAGE_LIMIT, type AdminMedia } from "./media";

export async function editorRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Perubahan belum dapat diproses.");
  return data;
}

export function uploadEditorMedia(file: File) {
  if (!file.size) throw new Error("Pilih gambar terlebih dahulu.");
  if (file.size > EDITOR_IMAGE_LIMIT) throw new Error("Ukuran gambar maksimal 4 MB.");
  const body = new FormData();
  body.set("file", file);
  return editorRequest<{ media: AdminMedia & { src: string } }>("/api/admin/site-media", { method: "POST", body });
}

export function saveEditorRecord<T>(kind: "blog" | "promo", record: T) {
  return editorRequest<{ record: T }>("/api/admin/site-editor", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, record }),
  });
}
