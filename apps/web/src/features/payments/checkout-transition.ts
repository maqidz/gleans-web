import type { PaymentOrder } from "./types";

export async function requestPaymentAction(id: string, action: "pay" | "check"): Promise<PaymentOrder> {
  const response = await fetch(`/api/payments/orders/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  const data = await response.json();
  if (!response.ok || !data.order) throw new Error(data.error || "Pembayaran belum dapat diproses.");
  return data.order;
}

export type CheckoutPreview = Pick<PaymentOrder, "document_name" | "amount"> & { method?: "qris" | "balance" | "quota" };

export class ShieldPriceChanged extends Error {
  constructor(message: string, readonly amount: number) { super(message); }
}

type CheckoutTransition = {
  requestId: string;
  preview: CheckoutPreview;
  reserve: (expectedAmount: number) => Promise<PaymentOrder>;
  order?: PaymentOrder;
  reservation: Promise<PaymentOrder>;
  result: Promise<{ order: PaymentOrder } | { error: string }>;
};

// Share only the current browser navigation. Refreshes use the normal order API.
let transition: CheckoutTransition | undefined;
let expiry: ReturnType<typeof setTimeout> | undefined;

export function startCheckoutTransition(requestId: string, preview: CheckoutPreview, reserve: CheckoutTransition["reserve"]) {
  const reservation = Promise.resolve().then(() => reserve(preview.amount));
  const current: CheckoutTransition = {
    requestId,
    preview,
    reserve,
    reservation,
    result: reservation.then(async order => {
      current.order = order;
      return { order: order.status === "draft" ? await requestPaymentAction(order.id, "pay") : order };
    }).catch(error => ({ error: error instanceof Error ? error.message : "QRIS belum dapat dikonfirmasi." })),
  };
  transition = current;
  clearTimeout(expiry);
  expiry = setTimeout(() => { transition = undefined; }, 15 * 60_000);
}

export function getCheckoutTransition(id: string | null, requestId?: string | null) {
  if (id) return transition?.order?.id === id ? transition : undefined;
  return requestId && transition?.requestId === requestId ? transition : undefined;
}

export function clearCheckoutTransition(id: string) {
  if (transition?.order?.id !== id) return;
  transition = undefined;
  clearTimeout(expiry);
}
