"use client";

import { useEffect, useState } from "react";
import { ArrowUpToLine } from "lucide-react";

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function updateVisibility() {
      setVisible(window.scrollY >= 400);
    }

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  if (!visible) return null;

  function scrollToTop() {
    document.getElementById("main-content")?.focus({ preventScroll: true });
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "instant" : "smooth" });
  }

  return (
    <button
      type="button"
      aria-label="Kembali ke atas"
      onClick={scrollToTop}
      className="pointer-events-auto mr-1 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary md:mr-3"
    >
      <ArrowUpToLine aria-hidden="true" className="size-6 text-white!" />
    </button>
  );
}
