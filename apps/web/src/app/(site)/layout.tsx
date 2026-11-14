import { BackToTop } from "@/components/layout/back-to-top";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { WhatsAppSupport } from "@/components/layout/whatsapp-support";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">{children}</main>
      <Footer />
      <div className="pointer-events-none fixed right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-30 flex flex-col items-end gap-5 sm:right-8 sm:bottom-[max(2rem,env(safe-area-inset-bottom))]">
        <BackToTop />
        <WhatsAppSupport />
      </div>
    </div>
  );
}
