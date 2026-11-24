import "server-only";

export class FonnteError extends Error {
  constructor(public readonly code: string, public readonly uncertain = false) { super(code); }
}

// A single Indonesian mobile number only; never allow Fonnte's comma/variable syntax.
export function whatsappTarget(value: string) {
  const cleaned = value.trim().replace(/[\s()-]/g, "");
  if (!/^(?:\+?62|0)8\d{7,12}$/.test(cleaned)) throw new FonnteError("INVALID_RECIPIENT");
  return cleaned.replace(/^\+/, "").replace(/^0/, "62");
}

export function fonnteConfigured() { return Boolean(process.env.FONNTE_TOKEN?.trim()); }

async function request(path: "send" | "device", body?: FormData) {
  const token = process.env.FONNTE_TOKEN?.trim();
  if (!token) throw new FonnteError("FONNTE_NOT_CONFIGURED");
  let response: Response;
  try {
    response = await fetch(`https://api.fonnte.com/${path}`, {
      method: "POST", headers: { Authorization: token }, body,
      signal: AbortSignal.timeout(8_000), cache: "no-store", redirect: "error",
    });
  } catch { throw new FonnteError("FONNTE_CONNECTION_UNKNOWN", path === "send"); }
  // A timeout/server error may occur after the provider accepted the message.
  if (!response.ok) throw new FonnteError(`FONNTE_HTTP_${response.status}`, path === "send" && response.status >= 500);
  let result: Record<string, unknown>;
  try { result = await response.json(); }
  catch { throw new FonnteError("FONNTE_RESPONSE_UNKNOWN", path === "send"); }
  if (!result || typeof result !== "object" || typeof result.status !== "boolean") {
    throw new FonnteError("FONNTE_RESPONSE_UNKNOWN", path === "send");
  }
  // Do not surface raw provider responses: they can contain recipients or credentials.
  if (!result.status) throw new FonnteError("FONNTE_REJECTED");
  return result;
}

export async function sendWhatsApp(target: string, message: string) {
  const body = new FormData();
  body.set("target", whatsappTarget(target));
  body.set("message", message);
  body.set("countryCode", "0");
  body.set("preview", "false");
  body.set("connectOnly", "true");
  const result = await request("send", body);
  // Accepted is not a delivery receipt. Never resend an accepted message automatically.
  const ids = result.id;
  return Array.isArray(ids) && ids.length && ["string", "number"].includes(typeof ids[0]) ? String(ids[0]).slice(0, 200) : null;
}

export async function fonnteDevice() {
  const result = await request("device");
  return { connected: result.device_status === "connect", device: typeof result.device === "string" ? result.device : null };
}
