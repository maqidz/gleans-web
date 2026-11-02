import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/features/auth/server";
import { accountLandingPage } from "@/features/auth/session";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = {
  title: "Masuk Sekarang",
  description: "Masuk ke akun Gleans untuk melihat riwayat pesanan dan hasil pemeriksaan dokumenmu.",
};

export default async function MasukPage() {
  const user = await currentUser();
  if (user) redirect(accountLandingPage(user));
  return <LoginForm />;
}
