import { randomUUID } from "node:crypto";
import { z } from "zod";
import { currentAdmin } from "@/features/auth/session";
import { MEDIA_BUCKET, setEditorMediaVisibility } from "@/features/admin/lib/site-editor";
import { EDITOR_IMAGE_LIMIT } from "@/features/admin/lib/media";
import { json, sameOrigin } from "@/features/payments/server/http";
import { paymentAdmin } from "@/features/payments/server/repository";

const visibility = z.object({
  id: z.string().min(1).max(80).regex(/^[a-zA-Z0-9-]+$/),
  hidden: z.boolean(),
}).strict();

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Permintaan tidak diizinkan." }, 403);
  try {
    const admin = await currentAdmin();
    if (!admin) return json({ error: "Akses ditolak." }, 403);
    const raw = await request.text();
    const valid = raw.length <= 512 && visibility.safeParse(JSON.parse(raw));
    if (!valid || !valid.success) return json({ error: "Data media tidak valid." }, 400);
    const { id, hidden } = valid.data;
    if (!await setEditorMediaVisibility(id, hidden, admin.email)) return json({ error: "Gambar tidak ditemukan." }, 404);
    return json({ id, hidden });
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Data media tidak valid." }, 400);
    return json({ error: "Pustaka media belum dapat diperbarui. Coba lagi." }, 503);
  }
}

function imageType(header: Buffer) {
  if (header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return ["png", "image/png"];
  if (header[0] === 255 && header[1] === 216 && header[2] === 255) return ["jpg", "image/jpeg"];
  if (/^GIF8[79]a$/.test(header.toString("ascii", 0, 6))) return ["gif", "image/gif"];
  if (header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WEBP") return ["webp", "image/webp"];
  return null;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Permintaan tidak diizinkan." }, 403);
  try {
    const admin = await currentAdmin();
    if (!admin) return json({ error: "Akses ditolak." }, 403);
    if (Number(request.headers.get("content-length")) > EDITOR_IMAGE_LIMIT + 16_384) return json({ error: "Ukuran gambar maksimal 4 MB." }, 413);
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || !file.size) return json({ error: "Pilih gambar terlebih dahulu." }, 400);
    if (file.size > EDITOR_IMAGE_LIMIT) return json({ error: "Ukuran gambar maksimal 4 MB." }, 413);
    const type = imageType(Buffer.from(await file.slice(0, 12).arrayBuffer()));
    if (!type) return json({ error: "Gunakan gambar PNG, JPG, WebP, atau GIF." }, 400);

    const sdk = paymentAdmin();
    const bucket = sdk.storage.from(MEDIA_BUCKET);
    const id = randomUUID();
    const key = id + "." + type[0];
    const asset = new File([file], key, { type: type[1] });
    const { data: uploaded, error: uploadError } = await bucket.upload(key, asset);
    if (uploadError || !uploaded?.url || !uploaded.key) throw new Error("UPLOAD_UNAVAILABLE");
    const name = file.name.trim().slice(0, 180) || key;
    const { error } = await sdk.database.from("site_media").insert([{
      id, name, storage_key: uploaded.key, url: uploaded.url, bytes: file.size, edited_by: admin.email,
    }]);
    if (error) {
      await bucket.remove(uploaded.key);
      throw error;
    }
    return json({ media: { id, name, alt: name, size: file.size, src: uploaded.url } }, 201);
  } catch {
    return json({ error: "Gambar belum dapat disimpan. Coba lagi." }, 503);
  }
}
