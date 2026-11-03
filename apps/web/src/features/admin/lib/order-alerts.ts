export type OrderMarker = { id: string; created_at: string };
export const ORDER_ARRIVED_EVENT = "gleans:admin-order-arrived";

// Establish a baseline first; refreshing the dashboard must not announce old orders.
export function createOrderWatcher() {
  let initialized = false;
  let latest: OrderMarker | null = null;
  return (next: OrderMarker | null): boolean => {
    if (!initialized) { initialized = true; latest = next; return false; }
    if (!next) return false;
    if (latest && (next.created_at < latest.created_at ||
      (next.created_at === latest.created_at && next.id <= latest.id))) return false;
    latest = next;
    return true;
  };
}
