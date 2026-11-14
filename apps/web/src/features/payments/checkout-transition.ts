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

type CheckoutTransition = {
  order: PaymentOrder;
  result: Promise<{ order: PaymentOrder } | { error: string }>;
};

// Share only the current browser navigation. Refreshes use the normal order API.
let transition: CheckoutTransition | undefined;

export function startCheckoutTransition(order: PaymentOrder) {
  if (transition?.order.id === order.id) return;
  const result = (order.status === "draft" ? requestPaymentAction(order.id, "pay") : Promise.resolve(order)).then(
    payment => ({ order: payment }),
    error => ({ error: error instanceof Error ? error.message : "QRIS belum dapat dikonfirmasi." }),
  );
  const current = { order, result };
  transition = current;
  setTimeout(() => { if (transition === current) transition = undefined; }, 60_000);
}

export function getCheckoutTransition(id: string | null) {
  return transition?.order.id === id ? transition : undefined;
}

export function clearCheckoutTransition(id: string) {
  if (transition?.order.id === id) transition = undefined;
}
