"use client";

import { useEffect, useRef, useState } from "react";
import { PromotionBanner, type PromotionBannerContent } from "./promotion-banner";

export type PromotionSlide = PromotionBannerContent & { id: string };

export function PromotionCarousel({ banners, onDismiss }: { banners: PromotionSlide[]; onDismiss: () => void }) {
  const [index, setIndex] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const current = Math.min(index, banners.length - 1);
  const banner = banners[current];

  useEffect(() => {
    if (banners.length < 2) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = window.setInterval(() => {
      if (document.hidden || preference.matches || container.current?.matches(":hover, :focus-within")) return;
      setIndex(position => (position + 1) % banners.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [banners.length, current]);

  if (!banner) return null;

  const navigation = banners.length > 1 && <div className="-ml-2 mt-1 flex flex-wrap items-center" role="group" aria-label="Navigasi banner">
    {banners.map((slide, position) => <button
      key={slide.id}
      type="button"
      aria-label={`Tampilkan banner ${position + 1} dari ${banners.length}`}
      aria-current={position === current ? "true" : undefined}
      className="group grid size-6 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-ring"
      onClick={() => setIndex(position)}
    >
      <span aria-hidden="true" className="size-2 rounded-full bg-muted-foreground/40 group-hover:bg-primary/70 group-aria-[current=true]:bg-primary" />
    </button>)}
  </div>;

  return <div ref={container} className="max-h-[inherit] min-w-0">
    <PromotionBanner banner={banner} onDismiss={onDismiss} navigation={navigation} />
  </div>;
}
