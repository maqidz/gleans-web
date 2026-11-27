import { DashboardBilling } from "@/features/dashboard/components/billing";
import { displayShieldPricing } from "@/features/orders/lib/shield-pricing";

export default async function Page() {
  const { packages } = await displayShieldPricing();
  return <DashboardBilling initialPackagePrices={packages} />;
}
