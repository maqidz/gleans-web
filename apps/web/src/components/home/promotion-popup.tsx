"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@gleans/ui/dialog";
import { PromotionCarousel, type PromotionSlide } from "./promotion-carousel";

const seenKey = (id: string) => `gleans:seen-promotion:${id}`;

function hasSeen(id: string) {
  try { return sessionStorage.getItem(seenKey(id)) === "1"; }
  catch { return false; }
}

export function PromotionPopup({ banners }: { banners: PromotionSlide[] }) {
  const [visible, setVisible] = useState<PromotionSlide[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(banners.filter(item => !hasSeen(item.id)));
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [banners]);

  function dismiss() {
    try {
      for (const item of visible) sessionStorage.setItem(seenKey(item.id), "1");
    } catch { /* Storage may be unavailable in the browser. */ }
    setVisible([]);
  }

  return <Dialog open={visible.length > 0} onOpenChange={open => { if (!open) dismiss(); }}>
    <DialogContent showCloseButton={false} overlayClassName="bg-slate-700/50 backdrop-blur-[1px]"
      onOpenAutoFocus={event => {
        if (event.currentTarget instanceof HTMLElement) {
          event.preventDefault();
          event.currentTarget.focus();
        }
      }}
      className="block max-h-[90dvh] rounded-2xl p-0 ring-0 sm:max-w-sm">
      {visible.length > 0 && <PromotionCarousel banners={visible} onDismiss={dismiss} />}
    </DialogContent>
  </Dialog>;
}
