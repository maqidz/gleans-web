export const BILLING_ID = /^GLB-[0-9A-F]{24}$/;
export const MIN_TOPUP = 10_000;
export const MAX_TOPUP = 1_000_000;

export type BillingTransaction = {
  id: string;
  kind: "topup" | "package" | "shield";
  method: "qris" | "balance" | "quota";
  amount: number;
  plan_id: string | null;
  quota: number;
  status: "creating" | "pending" | "paid" | "failed" | "expired";
  payment_url: string | null;
  qr_string: string | null;
  created_at: string;
};

export type BillingTotals = { balance: number; quota: number };
export type BillingSnapshot = BillingTotals & { transactions: BillingTransaction[] };
