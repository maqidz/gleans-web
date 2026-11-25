import Link from "next/link";
import { CircleCheck, Files, FileText, Layers } from "lucide-react";
import { SectionHeading } from "@/components/layout/section-heading";
import { Button } from "@gleans/ui/button";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";

import { PLANS, planBenefits } from "@/lib/plans";
import { displayShieldPricing } from "@/features/orders/lib/shield-pricing";

const PLAN_ICONS = {
  starter: FileText,
  standart: Files,
  premium: Layers,
};

export async function Pricing() {
  const { price: shieldPrice, packages } = await displayShieldPricing();
  return (
    <section id="harga" className="section-y scroll-mt-16">
      <div className="container-page flex flex-col gap-10 md:gap-14 lg:gap-20">
        <SectionHeading
          title="Pilih paket sesuai kebutuhanmu"
          description={`Cek satu dokumen seharga ${formatRupiah(shieldPrice)}, atau pilih paket untuk beberapa pemeriksaan.`}
        />
        <div className="flex flex-col gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((plan, i) => {
            const PlanIcon = PLAN_ICONS[plan.id];
            const individualTotal = plan.checks * shieldPrice;
            const packagePrice = packages[plan.id];

            return (
              <article
                key={plan.id}
                className={cn(
                  "flex w-full flex-col justify-between gap-10 rounded-[24px] border bg-white p-4 md:w-auto lg:min-h-[475px] lg:gap-[59px]",
                  i === 2 && "md:col-span-2 lg:col-span-1",
                )}
              >
                <div className="flex flex-col gap-8">
                  <div className="flex items-center justify-between gap-8">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-[16px] bg-primary text-white">
                      <PlanIcon aria-hidden="true" className="size-6" />
                    </span>
                    <div className="flex flex-col items-end gap-1 text-right">
                      <p className="text-2xl font-semibold">{formatRupiah(packagePrice)}</p>
                      {individualTotal > packagePrice && <p className="text-muted-foreground">
                        <span className="sr-only">Harga jika dibeli satuan: </span>
                        <s>{formatRupiah(individualTotal)}</s>
                      </p>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                      <h3 className="text-[22px] font-semibold">{plan.name}</h3>
                      <p>{plan.blurb}</p>
                    </div>
                    <ul className="flex flex-col gap-3">
                      {planBenefits(plan).map(
                        (f) => (
                          <li key={f} className="flex items-center gap-2">
                            <CircleCheck className="size-6 shrink-0 fill-primary text-white" />
                            {f}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                </div>
                <Button asChild size="pill" className="w-full font-normal">
                  <Link href={`/daftar?paket=${plan.id}`} aria-label={`Bayar Sekarang untuk paket ${plan.name}`}>
                    Bayar Sekarang
                  </Link>
                </Button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
