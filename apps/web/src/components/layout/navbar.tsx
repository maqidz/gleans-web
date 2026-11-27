"use client";

import Image from "next/image";
import Link from "next/link";
import { AuthNav, useNavigationAccount } from "@/features/auth/components/auth-nav";
import { useState } from "react";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@gleans/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@gleans/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@gleans/ui/dropdown-menu";
import { NAV_LINKS, PRODUCTS } from "@/config/site";
import { cn } from "@/lib/utils";

function SoonBadge() {
  return (
    <span className="bg-primary/10 text-primary rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold tracking-wide">
      SOON
    </span>
  );
}

function ProductDetails({ product }: { product: (typeof PRODUCTS)[number] }) {
  return <>
    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border bg-surface">
      <Image src={product.icon} alt="" width={26} height={26} className="size-6" />
    </span>
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="flex flex-wrap items-center gap-2 text-base font-medium text-foreground">{product.name}{product.soon && <SoonBadge />}</span>
      <span className="text-sm leading-relaxed text-muted-foreground">{product.description}</span>
    </span>
  </>;
}

export function Navbar() {
  const account = useNavigationAccount();
  const [open, setOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [soonName, setSoonName] = useState<string | null>(null);
  const [soonOpen, setSoonOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex h-16 items-center justify-between px-5 md:px-8 lg:h-[68px] lg:px-10">
        <Link href="/" aria-label="Gleans - Beranda" className="shrink-0">
          <Logo className="h-7 lg:h-[34px]" />
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          <DropdownMenu>
            <DropdownMenuTrigger className="group inline-flex items-center gap-2 text-base outline-none">
              Produk
              <ChevronDown className="size-5 transition-transform group-data-[state=open]:rotate-180" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={18} collisionPadding={20} className="grid w-[780px] max-w-[calc(100vw-40px)] grid-cols-[1.15fr_1fr] overflow-hidden rounded-[24px] border bg-white p-0 shadow-xl ring-0">
              <div className="p-6">
                <p className="mb-3 px-3 text-[11px] font-medium tracking-[0.16em] text-muted-foreground">LAYANAN GLEANS</p>
                <div className="space-y-1">
                  {PRODUCTS.map((product) => product.soon ? (
                    <DropdownMenuItem key={product.href} className="cursor-pointer items-center gap-4 rounded-2xl p-3 focus:bg-surface" onSelect={() => { setSoonName(product.name); setSoonOpen(true); }}>
                      <ProductDetails product={product} />
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem key={product.href} asChild className="cursor-pointer rounded-2xl p-3 focus:bg-surface">
                      <Link href={product.href} className="flex items-center gap-4"><ProductDetails product={product} /></Link>
                    </DropdownMenuItem>
                  ))}
                </div>
              </div>
              <aside aria-label="Sorotan produk" className="border-l bg-accent/40 p-6">
                <p className="mb-5 text-[11px] font-medium tracking-[0.16em] text-muted-foreground">SOROTAN</p>
                <DropdownMenuItem asChild className="block cursor-pointer overflow-hidden rounded-[20px] border bg-white p-0 focus:bg-white focus:ring-2 focus:ring-primary/30">
                  <Link href="/deteksi-ai" className="group/sorotan">
                    <div className="flex h-40 items-center justify-center overflow-hidden bg-accent">
                      <Image src="/images/gleans-illustration-480.webp" alt="" width={480} height={360} className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover/sorotan:scale-105 motion-reduce:transform-none" />
                    </div>
                    <div className="p-5">
                      <p className="text-[11px] font-medium tracking-wide text-primary">GLEANS SHIELD</p>
                      <h2 className="mt-2 text-xl font-semibold leading-snug tracking-tight">Kumpulkan tulisan dengan lebih tenang.</h2>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Periksa AI dan plagiarisme pada dokumenmu, lalu unduh laporan hasil pemeriksaannya.</p>
                      <span className="mt-5 flex min-h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-white!">Mulai cek dokumen<ArrowRight aria-hidden="true" className="size-4 text-white!" /></span>
                    </div>
                  </Link>
                </DropdownMenuItem>
              </aside>
            </DropdownMenuContent>
          </DropdownMenu>
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-base transition-colors hover:text-primary">
              {l.label}
            </Link>
          ))}
          <AuthNav account={account} />
        </nav>

        <div className="flex items-center gap-1 lg:hidden">

        <Button
          variant="ghost"
          size="icon-lg"
          className="lg:hidden"
          aria-label={open ? "Tutup menu" : "Buka menu"}
          aria-expanded={open}
          onClick={() => {
            setOpen((value) => !value);
            setProductsOpen(false);
          }}
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </Button>
        </div>
      </div>

      {open && (
        <div className="absolute inset-x-0 top-full max-h-[calc(100dvh-64px)] overflow-y-auto border-t bg-white lg:hidden">
          <nav className="flex flex-col">
            <button
              type="button"
              onClick={() => setProductsOpen((v) => !v)}
              aria-expanded={productsOpen}
              className="flex items-center justify-between border-b px-5 py-5 text-left text-base text-muted-foreground"
            >
              Produk
              <ChevronDown className={cn("size-5 transition-transform", productsOpen && "rotate-180")} />
            </button>
            {productsOpen && (
              <div className="flex flex-col border-b">
                {PRODUCTS.map((p) =>
                  p.soon ? (
                    <button
                      key={p.href}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        setSoonName(p.name);
                        setSoonOpen(true);
                      }}
                      className="flex items-center gap-3 px-5 py-4 text-left hover:bg-surface"
                    >
                      <ProductDetails product={p} />
                    </button>
                  ) : (
                    <Link
                      key={p.href}
                      href={p.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-5 py-4 hover:bg-surface"
                    >
                      <ProductDetails product={p} />
                    </Link>
                  ),
                )}
              </div>
            )}
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="border-b px-5 py-5 text-base text-muted-foreground"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 flex gap-3 px-5 pb-6">
            <AuthNav account={account} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <Dialog open={soonOpen} onOpenChange={setSoonOpen}>
        <DialogContent className="rounded-[24px] p-6 sm:max-w-[400px]">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-xl font-semibold">{soonName} masih dalam pengembangan</DialogTitle>
            <DialogDescription className="text-base">
              Produk ini sedang kami kerjakan dan akan segera tersedia.
            </DialogDescription>
          </DialogHeader>
          <Button className="w-full font-normal" onClick={() => setSoonOpen(false)}>
            Mengerti
          </Button>
        </DialogContent>
      </Dialog>
    </header>
  );
}
