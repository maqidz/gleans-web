import { Suspense } from "react";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/navbar";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PaymentCheckout, PaymentLayout } from "@/features/payments/components/checkout";

export const metadata: Metadata = { title: "Pembayaran Gleans Shield" };

export default function PaymentPage() {
  return <div className="flex min-h-dvh flex-col bg-white">
    <Navbar />
    <Breadcrumb items={[{ label: "Gleans Shield", href: "/deteksi-ai" }, { label: "Pembayaran" }]} />
    <main className="flex-1">
      <Suspense fallback={<PaymentLayout />}><PaymentCheckout /></Suspense>
    </main>
  </div>;
}
