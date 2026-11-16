import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { DashboardUser } from "@/features/auth/types";
import { PLANS } from "@/lib/plans";
import { paymentAdmin } from "../server/repository";
import { callbackOrigin, createQrisInvoice, InvoiceRejected, transactionStatus } from "../server/duitku";
import { json, paymentError } from "../server/http";
import { MAX_TOPUP, MIN_TOPUP, type BillingTotals, type BillingTransaction } from "./types";

const transactionColumns = "id,kind,method,amount,plan_id,quota,status,payment_url,qr_string,created_at";
type StoredTransaction = BillingTransaction & { reference: string | null };
const publicTransaction = (transaction: StoredTransaction): BillingTransaction => ({
  id: transaction.id,
  kind: transaction.kind,
  method: transaction.method,
  amount: transaction.amount,
  plan_id: transaction.plan_id,
  quota: transaction.quota,
  status: transaction.status,
  payment_url: transaction.payment_url,
  qr_string: transaction.qr_string,
  created_at: transaction.created_at,
});

export const billingPurchaseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("topup"), requestId: z.string().uuid(), amount: z.number().int().min(MIN_TOPUP).max(MAX_TOPUP) }).strict(),
  z.object({ kind: z.literal("package"), requestId: z.string().uuid(), planId: z.enum(["starter", "standart", "premium"]), method: z.enum(["qris", "balance"]) }).strict(),
]);

export async function billingTotals(ownerId: string) {
  const { data, error } = await paymentAdmin().database.rpc("billing_totals", { p_owner: ownerId });
  if (error || !Array.isArray(data) || !data[0]) throw new Error("DATABASE_UNAVAILABLE");
  const totals = data[0] as BillingTotals;
  return { balance: Number(totals.balance), quota: Number(totals.quota) };
}

export async function billingSnapshot(ownerId: string) {
  const [totals, { data, error }] = await Promise.all([
    billingTotals(ownerId),
    paymentAdmin().database.from("billing_transactions").select(transactionColumns)
      .eq("owner_id", ownerId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50),
  ]);
  if (error) throw new Error("DATABASE_UNAVAILABLE");
  return { ...totals, transactions: data as BillingTransaction[] };
}

export async function findBillingTransaction(id: string, ownerId?: string) {
  const query = paymentAdmin().database.from("billing_transactions").select(`${transactionColumns},reference`).eq("id", id);
  const { data, error } = await (ownerId ? query.eq("owner_id", ownerId) : query).maybeSingle();
  if (error) throw new Error("DATABASE_UNAVAILABLE");
  return data as StoredTransaction | null;
}

export async function buyBilling(account: DashboardUser, input: z.infer<typeof billingPurchaseSchema>) {
  const plan = input.kind === "package" ? PLANS.find(item => item.id === input.planId) : undefined;
  const method = input.kind === "topup" ? "qris" : input.method;
  const amount = input.kind === "topup" ? input.amount : plan!.price;
  if (method === "qris") callbackOrigin();

  const admin = paymentAdmin();
  const { data, error } = await admin.database.rpc("reserve_billing_transaction", {
    p_id: `GLB-${randomBytes(12).toString("hex").toUpperCase()}`,
    p_owner: account.id,
    p_request: input.requestId,
    p_kind: input.kind,
    p_method: method,
    p_amount: amount,
    p_plan: plan?.id ?? null,
    p_quota: plan?.checks ?? 0,
  });
  if (error) throw error;
  const { transaction, created } = data as { transaction: StoredTransaction; created: boolean };
  if (!created || method === "balance") return publicTransaction(transaction);

  let invoice;
  try {
    invoice = await createQrisInvoice({
      id: transaction.id,
      amount,
      productName: plan ? `Paket Gleans Shield ${plan.name}` : "Top-up Saldo Gleans",
      returnPath: `/dashboard/paket-saldo?billing=${encodeURIComponent(transaction.id)}`,
    }, account);
  } catch (error) {
    if (error instanceof InvoiceRejected) {
      const { error: saveError } = await admin.database.from("billing_transactions").update({ status: "failed" })
        .eq("id", transaction.id).eq("status", "creating");
      if (saveError) throw new Error("DATABASE_UNAVAILABLE");
    }
    throw error;
  }

  const { data: saved, error: saveError } = await admin.database.from("billing_transactions")
    .update({ status: "pending", reference: invoice.reference, payment_url: invoice.paymentUrl, qr_string: invoice.qrString ?? null })
    .eq("id", transaction.id).eq("status", "creating").select(transactionColumns).maybeSingle();
  if (saveError) throw new Error("DATABASE_UNAVAILABLE");
  if (saved) return saved as BillingTransaction;

  // A callback or manual check may have won the status update during inquiry.
  const { data: reconciled, error: attachError } = await admin.database.from("billing_transactions")
    .update({ payment_url: invoice.paymentUrl, qr_string: invoice.qrString ?? null })
    .eq("id", transaction.id).eq("reference", invoice.reference).select(transactionColumns).maybeSingle();
  if (attachError || !reconciled) throw new Error("DATABASE_UNAVAILABLE");
  return reconciled as BillingTransaction;
}

export async function reconcileBilling(transaction: StoredTransaction, callbackReference?: string) {
  const result = await transactionStatus(transaction.id);
  const reference = transaction.reference ?? callbackReference;
  if (result.merchantOrderId !== transaction.id || Number(result.amount) !== transaction.amount || (reference && result.reference !== reference)) {
    throw new Error("PAYMENT_MISMATCH");
  }
  const { data, error } = await paymentAdmin().database.rpc("settle_billing_transaction", {
    p_id: transaction.id,
    p_amount: transaction.amount,
    p_reference: result.reference,
    p_status: { "00": "paid", "01": "pending", "02": "expired" }[result.statusCode],
  });
  if (error || !data) throw new Error("DATABASE_UNAVAILABLE");
  const settled = (Array.isArray(data) ? data[0] : data) as StoredTransaction;
  if (!settled) throw new Error("DATABASE_UNAVAILABLE");
  return publicTransaction(settled);
}

export async function checkBilling(transaction: StoredTransaction, ownerId: string) {
  if (transaction.method !== "qris" || !["pending", "creating"].includes(transaction.status)) return publicTransaction(transaction);
  const { data: claimed, error } = await paymentAdmin().database.rpc("claim_billing_check", { p_id: transaction.id, p_owner: ownerId });
  if (error) throw new Error("DATABASE_UNAVAILABLE");
  if (!claimed) {
    const current = await findBillingTransaction(transaction.id, ownerId);
    return publicTransaction(current ?? transaction);
  }
  return reconcileBilling(transaction);
}

export function billingError(error: unknown) {
  if (error instanceof SyntaxError) return json({ error: "Data transaksi tidak valid." }, 400);
  if (error instanceof InvoiceRejected) return json({ error: error.publicMessage }, 400);
  const message = (error as { message?: string } | null)?.message ?? "";
  if (message.includes("INSUFFICIENT_BALANCE")) return json({ error: "Saldo Gleans belum cukup." }, 409);
  if (message.includes("BILLING_REQUEST_CONFLICT")) return json({ error: "Transaksi ini sudah memakai pilihan lain. Buat transaksi baru." }, 409);
  if (message.includes("BILLING_LIMIT")) return json({ error: "Terlalu banyak transaksi. Coba kembali nanti." }, 429);
  return paymentError(error);
}
