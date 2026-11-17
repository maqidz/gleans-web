import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { dashboardUser } from "@/features/auth/server";
import { DashboardProvider } from "@/features/dashboard/components/provider";
import { DashboardShell } from "@/features/dashboard/components/shell";
export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const account = await dashboardUser();
  if (!account) redirect("/masuk");
  return <DashboardProvider key={account.id} account={account}><DashboardShell>{children}</DashboardShell></DashboardProvider>;
}
