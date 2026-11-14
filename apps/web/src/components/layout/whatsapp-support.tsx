"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { X } from "lucide-react";
import { CONTACT } from "@/config/site";

export function WhatsAppSupport() {
  const [showPrompt, setShowPrompt] = useState(true);
  const linkRef = useRef<HTMLAnchorElement>(null);

  return (
    <div className="relative">
      <a
        ref={linkRef}
        href={CONTACT.whatsapp}
        target="_blank"
        rel="noreferrer"
        aria-label={showPrompt
          ? "Ada pertanyaan? Hubungi aku di sini yuk! Chat via WhatsApp dengan Gleans"
          : "Chat via WhatsApp dengan Gleans"}
        className="pointer-events-auto flex items-end gap-3 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        {showPrompt && (
          <span className="mb-6 rounded-[8px] bg-primary px-3 py-2 text-xs leading-tight font-semibold text-primary-foreground shadow-sm md:mb-8 md:px-4 md:py-3">
            <span className="block">Ada pertanyaan?</span>
            <span className="block">Hubungi aku di sini yuk!</span>
          </span>
        )}
        <span className="relative size-14 md:size-[72px]">
          <Image
            src="/images/support-mascot.webp"
            alt=""
            width={160}
            height={160}
            unoptimized
            className="pointer-events-none absolute bottom-0 left-1/2 h-auto w-16 max-w-none -translate-x-1/2 md:w-20"
          />
        </span>
      </a>
      {showPrompt && (
        <button
          type="button"
          aria-label="Sembunyikan pesan bantuan"
          onClick={() => {
            setShowPrompt(false);
            linkRef.current?.focus();
          }}
          className="pointer-events-auto absolute -top-3 -left-3 grid size-7 place-items-center rounded-full bg-[#ffc530] text-[#8d6c24] shadow-sm ring-1 ring-navy/25 transition-colors hover:bg-[#ffda6b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <X aria-hidden="true" className="size-4" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
