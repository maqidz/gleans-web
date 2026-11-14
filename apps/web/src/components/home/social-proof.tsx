import Image from "next/image";

const LOGOS = [
  { src: "/images/logo-unnes.webp", alt: "Universitas Negeri Semarang", width: 288, height: 88, className: "h-9 w-[148px] md:h-11 md:w-[190px]" },
  { src: "/images/logo-amikom.webp", alt: "Universitas Amikom Yogyakarta", width: 204, height: 74, className: "h-9 w-[148px] md:h-11 md:w-[190px]" },
  { src: "/images/logo-dinamika.webp", alt: "Universitas Dinamika", width: 318, height: 89, className: "h-9 w-[148px] md:h-11 md:w-[190px]" },
  { src: "/images/logo-pertamina.webp", alt: "Universitas Pertamina", width: 256, height: 72, className: "h-24 w-[124px] md:h-[120px] md:w-[168px]" },
  { src: "/images/logo-cakrawala.webp", alt: "Cakrawala University", width: 242, height: 66, className: "h-9 w-[148px] md:h-11 md:w-[190px]" },
  { src: "/images/logo-telkom.webp", alt: "Telkom University", width: 200, height: 66, className: "h-24 w-[72px] md:h-[132px] md:w-[100px]" },
  { src: "/images/logo-undip.webp", alt: "Universitas Diponegoro", width: 258, height: 96, className: "h-12 w-[128px] md:h-14 md:w-[150px]" },
  { src: "/images/logo-esa-unggul.webp", alt: "Universitas Esa Unggul", width: 288, height: 75, className: "h-24 w-[108px] md:h-[120px] md:w-[144px]" },
  { src: "/images/logo-uny.webp", alt: "Universitas Negeri Yogyakarta", width: 380, height: 86, className: "h-9 w-[148px] md:h-11 md:w-[190px]" },
] as const;

export function SocialProof() {
  const logos = [...LOGOS, ...LOGOS];

  return (
    <section className="flex flex-col gap-5">
      <p className="container-page text-center text-sm md:text-base">
        Gleans telah dipercaya oleh 50.000+ mahasiswa di seluruh Indonesia.
      </p>
      <div className="overflow-hidden bg-white pt-0 pb-6 motion-reduce:overflow-x-auto md:pb-8">
        <ul className="flex w-max items-center gap-12 animate-marquee hover:[animation-play-state:paused] motion-reduce:animate-none">
          {logos.map((logo, i) => (
            <li
              key={`${logo.src}-${i}`}
              aria-hidden={i >= LOGOS.length}
              className={`flex shrink-0 items-center justify-center ${logo.className}`}
            >
              <Image
                src={logo.src}
                alt={i >= LOGOS.length ? "" : logo.alt}
                width={logo.width}
                height={logo.height}
                className="h-full w-full object-contain"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
