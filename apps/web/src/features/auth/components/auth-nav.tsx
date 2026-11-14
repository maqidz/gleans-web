"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, LayoutDashboard, LogOut, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { logout } from "@/features/auth/user-actions";
import { Button } from "@gleans/ui/button";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@gleans/ui/dropdown-menu";

type NavigationAccount = { name: string; email: string; dashboardHref: string; settingsHref: string };

export function useNavigationAccount() {
  const [account, setAccount] = useState<NavigationAccount | null>(null);
  const pathname = usePathname();
  useEffect(() => {
    let active = true;
    let pending: AbortController | undefined;

    async function refresh() {
      if (pending) return;
      const controller = new AbortController();
      pending = controller;
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const { account: currentAccount } = await response.json();
        if (active) setAccount(currentAccount);
      } catch {
        // Keep the current navigation usable if the session check fails.
      } finally {
        pending = undefined;
      }
    }

    // The links are already rendered, so this check can wait for page resources.
    if (document.readyState === "complete") void refresh();
    else window.addEventListener("load", refresh, { once: true });
    window.addEventListener("focus", refresh);
    const restore = (event: PageTransitionEvent) => { if (event.persisted) void refresh(); };
    window.addEventListener("pageshow", restore);

    return () => {
      active = false;
      pending?.abort();
      window.removeEventListener("load", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", restore);
    };
  }, [pathname]);

  return account;
}

export function AuthNav({ account, onNavigate }: { account: NavigationAccount | null; onNavigate?: () => void }) {
  if (!account) return <div className="flex items-center gap-3"><Button asChild size="pill-sm" variant="outline" className="w-[100px]"><Link href="/masuk" onClick={onNavigate}>Masuk</Link></Button><Button asChild size="pill-sm" className="w-[100px]"><Link href="/daftar" onClick={onNavigate}>Daftar</Link></Button></div>;
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" aria-label={`Menu akun ${account.name}`} className="h-11 min-w-0 gap-2 rounded-full border border-border bg-white px-3">
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent font-medium text-primary">{account.name[0]?.toUpperCase()}</span>
        <span title={account.name} className="max-w-40 truncate sm:max-w-48">{account.name}</span>
        <ChevronDown className="size-4 shrink-0" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-2xl p-2">
      <DropdownMenuLabel className="px-3 py-2"><p className="break-words text-sm font-medium">{account.name}</p><p className="mt-1 break-words text-xs font-normal text-muted-foreground">{account.email}</p></DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild className="rounded-xl px-3 py-2.5"><Link href={account.dashboardHref} onClick={onNavigate}><LayoutDashboard />Dashboard</Link></DropdownMenuItem>
      <DropdownMenuItem asChild className="rounded-xl px-3 py-2.5"><Link href={account.settingsHref} onClick={onNavigate}><Settings />Pengaturan akun</Link></DropdownMenuItem>
      <DropdownMenuSeparator />
      <form action={logout}><DropdownMenuItem asChild onSelect={event => event.preventDefault()} className="rounded-xl px-3 py-2.5"><button type="submit" className="w-full"><LogOut />Keluar</button></DropdownMenuItem></form>
    </DropdownMenuContent>
  </DropdownMenu>;
}
