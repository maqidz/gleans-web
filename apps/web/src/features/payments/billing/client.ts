"use client";

import { useEffect, useState } from "react";
import type { BillingTotals } from "./types";

class BillingRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function billingRequest<T>(path = "", options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/payments/billing${path}`, { cache: "no-store", ...options });
  const data = await response.json();
  if (!response.ok) throw new BillingRequestError(data.error || "Paket & Saldo belum dapat dimuat.", response.status);
  return data;
}

export function useBillingTotals(enabled: boolean) {
  const [totals, setTotals] = useState<BillingTotals | null>(null);
  const [error, setError] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void billingRequest<BillingTotals>("?totals=1", { signal: controller.signal }).then(
      data => {
        if (controller.signal.aborted) return;
        setTotals(data);
        setError("");
        setAuthRequired(false);
      },
      reason => {
        if (controller.signal.aborted) return;
        setTotals(null);
        setError(reason instanceof Error ? reason.message : "Saldo belum dapat dimuat.");
        setAuthRequired(reason instanceof BillingRequestError && reason.status === 401);
      },
    );
    return () => controller.abort();
  }, [enabled]);
  return { totals, error, authRequired };
}
