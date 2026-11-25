type PaymentUpload = { ticket: string; uploadUrl: string; fields: Record<string, string> };

export async function preparePaymentUpload(file: File, purpose: "document" | "report" = "document", orderId?: string): Promise<PaymentUpload> {
  const prepared = await fetch("/api/payments/uploads", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, bytes: file.size, purpose, ...(orderId ? { orderId } : {}) }) });
  const upload = await prepared.json();
  if (!prepared.ok) throw new Error(upload.error || "Unggahan belum dapat disiapkan.");
  return upload;
}

export async function finishPaymentUpload(file: File, upload: PaymentUpload, report?: { aiScore: number }): Promise<string> {
  const form = new FormData();
  for (const [key, value] of Object.entries(upload.fields)) form.append(key, String(value));
  form.append("file", file);
  if (!(await fetch(upload.uploadUrl, { method: "POST", body: form })).ok) throw new Error("Dokumen belum dapat diunggah. Silakan coba kembali.");
  const confirmed = await fetch(`/api/payments/uploads/${encodeURIComponent(upload.ticket)}`, { method: "POST", credentials: "same-origin", ...(report ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(report) } : {}) });
  const result = await confirmed.json();
  if (!confirmed.ok) throw new Error(result.error || "Unggahan belum dapat dikonfirmasi.");
  return upload.ticket;
}

export async function uploadPaymentFile(file: File, purpose: "document" | "report" = "document", orderId?: string, report?: { aiScore: number }): Promise<string> {
  return finishPaymentUpload(file, await preparePaymentUpload(file, purpose, orderId), report);
}

export function prepareCheckoutUpload(file: File, previous?: Promise<unknown> | null) {
  let confirmed: { ticket: string; at: number } | undefined;
  let pending: Promise<string> | undefined;

  function getTicket(): Promise<string> {
    if (confirmed && Date.now() - confirmed.at < 10 * 60_000) return Promise.resolve(confirmed.ticket);
    if (!pending) {
      // First-time guest cookies must settle before another file starts uploading.
      pending = Promise.resolve(previous).catch(() => undefined)
        .then(() => uploadPaymentFile(file))
        .then(ticket => {
          confirmed = { ticket, at: Date.now() };
          return ticket;
        })
        .finally(() => { pending = undefined; });
    }
    return pending;
  }

  // Start on file selection, not when checkout requests the ticket.
  const ready = getTicket();
  void ready.catch(() => undefined);
  return { ready, getTicket };
}
