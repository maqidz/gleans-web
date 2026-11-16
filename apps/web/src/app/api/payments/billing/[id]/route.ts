import { dashboardUser } from "@/features/auth/server";
import { billingError, checkBilling, findBillingTransaction } from "@/features/payments/billing/server";
import { BILLING_ID } from "@/features/payments/billing/types";
import { duitkuConfig } from "@/features/payments/server/duitku";
import { json, sameOrigin } from "@/features/payments/server/http";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return json({ error: "Permintaan tidak diizinkan." }, 403);
  try {
    const account = await dashboardUser();
    if (!account) return json({ error: "Masuk untuk memeriksa transaksi." }, 401);
    duitkuConfig();
    const { id } = await context.params;
    const transaction = BILLING_ID.test(id) ? await findBillingTransaction(id, account.id) : null;
    if (!transaction) return json({ error: "Transaksi tidak ditemukan." }, 404);
    return json({ transaction: await checkBilling(transaction, account.id) });
  } catch (error) {
    return billingError(error);
  }
}
