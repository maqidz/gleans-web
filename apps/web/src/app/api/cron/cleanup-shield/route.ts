import { timingSafeEqual } from "node:crypto";
import { cleanupExpiredFiles } from "@/features/payments/server/cleanup";
import { json } from "@/features/payments/server/http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return json({ error: "Cleanup is not configured." }, 503);
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return json({ error: "Unauthorized" }, 401);
  try {
    const result = await cleanupExpiredFiles();
    return json(result, result.failed ? 503 : 200);
  } catch { return json({ error: "Cleanup failed." }, 503); }
}
