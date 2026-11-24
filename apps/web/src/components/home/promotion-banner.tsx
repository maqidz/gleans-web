import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@gleans/ui/button";
import { DialogDescription, DialogTitle } from "@gleans/ui/dialog";
import type { AdminState } from "@/features/admin/lib/model";

export type PromotionBannerContent = Pick<AdminState["promos"][number], "title" | "description" | "href" | "imageUrl" | "buttonLabel">;

export function PromotionBanner({ banner, onDismiss, navigation }: {
  banner: PromotionBannerContent;
  onDismiss: () => void;
  navigation?: ReactNode;
}) {
  return <div className="relative flex max-h-[inherit] min-w-0 flex-col overflow-hidden rounded-2xl border border-white/70 bg-popover text-popover-foreground shadow-md">
    <Button type="button" variant="ghost" size="icon-sm"
      className="absolute right-2 top-2 z-10 size-7 rounded-full bg-white text-slate-950 shadow-sm hover:bg-slate-100"
      aria-label="Tutup promosi" onClick={onDismiss}><X /></Button>
    <div className="min-h-0 overflow-y-auto overscroll-contain">
      {banner.imageUrl && <Image src={banner.imageUrl} alt="" width={768} height={432} unoptimized
        className="aspect-video h-auto w-full bg-surface object-contain" />}
      <div className="p-4">
        <DialogTitle className={`break-words text-base leading-snug font-semibold ${banner.imageUrl ? "" : "pr-7"}`}>{banner.title}</DialogTitle>
        <DialogDescription className={banner.description ? "mt-1.5 break-words whitespace-pre-line text-sm leading-relaxed text-muted-foreground" : "sr-only"}>
          {banner.description || "Promosi Gleans"}
        </DialogDescription>
        {navigation}
        {banner.href && <Button asChild size="pill-sm" className="mt-3 h-12 w-full whitespace-normal">
          <Link href={banner.href} onClick={onDismiss}>{banner.buttonLabel?.trim() || "Lihat promo"}</Link>
        </Button>}
      </div>
    </div>
  </div>;
}
