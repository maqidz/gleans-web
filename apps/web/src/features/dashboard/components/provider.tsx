"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { DashboardUser } from "@/features/auth/types";
import type { AccountOrder, AccountOrderPage } from "@/features/payments/types";

function useAccountOrders(accountId: string) {
  return useInfiniteQuery({
    queryKey: ["dashboard", "orders", accountId],
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }): Promise<AccountOrderPage> => {
      const response = await fetch("/api/payments/orders?page=" + pageParam, { cache: "no-store", signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Pesanan belum dapat dimuat. Coba lagi.");
      return body;
    },
    getNextPageParam: (page: AccountOrderPage) => page.nextPage,
  });
}

const Context = createContext<{ account: DashboardUser; history: ReturnType<typeof useAccountOrders>; orders: AccountOrder[] } | null>(null);

export function DashboardProvider({ account, children }: { account: DashboardUser; children: ReactNode }) {
  const history = useAccountOrders(account.id);
  const orders = useMemo(() => {
    const byId = new Map<string, AccountOrder>();
    for (const page of history.data?.pages ?? []) {
      for (const order of page.orders) byId.set(order.id, order);
    }
    return Array.from(byId.values());
  }, [history.data]);
  return <Context.Provider value={{ account, history, orders }}>{children}</Context.Provider>;
}

export function useDashboard() {
  const dashboard = useContext(Context);
  if (!dashboard) throw new Error("Dashboard provider missing");
  return dashboard;
}
