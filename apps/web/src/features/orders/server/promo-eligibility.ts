import "server-only";

import { cookies } from "next/headers";
import { paymentAdmin } from "@/features/payments/server/repository";
import { matchesAccess, validAccessCode } from "@/features/payments/server/guest";

type CustomerAccess = { userId?: string; guestHash?: string };

export async function hasCompletedShieldCheck({ userId, guestHash }: CustomerAccess) {
  const database = paymentAdmin().database;
  const completedOrders = () => database.from("duitku_orders")
    .select("id,access_hash").eq("status", "paid").eq("fulfillment_status", "completed");

  // Identity comes from validated auth and HttpOnly capabilities, never a supplied phone number.
  if (userId || guestHash) {
    const query = completedOrders();
    if (userId && guestHash) query.or(`owner_id.eq.${userId},guest_hash.eq.${guestHash}`);
    else if (userId) query.eq("owner_id", userId);
    else query.eq("guest_hash", guestHash!);
    const { data, error } = await query.limit(1).maybeSingle();
    if (error) throw new Error("DATABASE_UNAVAILABLE");
    if (data) return true;
  }

  // A guest following their report link on another browser can restore that order's access.
  const recovered = (await cookies()).getAll()
    .filter(cookie => /^gleans_access_GLS-[A-F0-9]{8}(?:[A-F0-9]{4})?$/.test(cookie.name) && validAccessCode(cookie.value))
    .slice(-20);
  if (!recovered.length) return false;
  const proofs = new Map(recovered.map(cookie => [cookie.name.slice("gleans_access_".length), cookie.value]));
  const { data, error } = await completedOrders().in("id", [...proofs.keys()]).limit(20);
  if (error) throw new Error("DATABASE_UNAVAILABLE");
  return (data ?? []).some(order => matchesAccess(proofs.get(order.id) ?? "", order.access_hash));
}
