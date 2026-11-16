import { dashboardUser } from "@/features/auth/server";
import { billingError, billingPurchaseSchema, billingSnapshot, billingTotals, buyBilling } from "@/features/payments/billing/server";
import { duitkuConfig } from "@/features/payments/server/duitku";
import { json, sameOrigin } from "@/features/payments/server/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const account = await dashboardUser();
    if (!account) return json({ error: "Masuk untuk melihat Saldo Gleans." }, 401);
    duitkuConfig();
    const totalsOnly = new URL(request.url).searchParams.get("totals") === "1";
    return json(totalsOnly ? await billingTotals(account.id) : await billingSnapshot(account.id));
  } catch (error) {
    return billingError(error);
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Permintaan tidak diizinkan." }, 403);
  try {
    const account = await dashboardUser();
    if (!account) return json({ error: "Masuk untuk melanjutkan transaksi." }, 401);
    duitkuConfig();
    const body = await request.text();
    if (body.length > 2048) return json({ error: "Data transaksi terlalu besar." }, 413);
    const input = billingPurchaseSchema.safeParse(JSON.parse(body));
    if (!input.success) return json({ error: "Data transaksi tidak valid." }, 400);
    const transaction = await buyBilling(account, input.data);
    return json({ transaction }, 201);
  } catch (error) {
    return billingError(error);
  }
}
