"use client";

import { Minus, Plus } from "lucide-react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { SectionHeading } from "@/components/layout/section-heading";

const FAQS = [
  {
    q: "Bagaimana cara menggunakan Gleans Shield?",
    a: "Masukkan nomor WhatsApp, unggah dokumen, lalu periksa ringkasan dan selesaikan pembayaran. Setelah pemeriksaan selesai, kamu mendapat notifikasi WhatsApp dan bisa mengunduh laporan PDF melalui halaman Cek Pesanan. Kamu juga bisa memesan tanpa membuat akun.",
  },
  {
    q: "Berapa lama proses pemeriksaan dokumen?",
    a: "Dokumen diproses setelah pembayaran berhasil. Waktu pemeriksaan bergantung pada ukuran dokumen dan antrean yang sedang berjalan. Pantau perkembangannya di Cek Pesanan; kami mengirim notifikasi WhatsApp saat hasil siap diunduh.",
  },
  {
    q: "Format dan ukuran file apa yang didukung?",
    a: "Kamu bisa mengunggah PDF, DOC, DOCX, atau TXT dengan ukuran maksimal 25 MB dan hingga 25.000 kata per dokumen. Pastikan dokumen berisi teks yang bisa dibaca, bukan hanya gambar atau hasil pindai tanpa lapisan teks.",
  },
  {
    q: "Teknologi apa yang digunakan untuk memeriksa tulisan?",
    a: "Gleans menggunakan GPTZero untuk pemeriksaan AI pada tulisanmu. Hasilnya tersedia dalam laporan PDF yang bisa kamu gunakan sebagai bahan evaluasi dan revisi. Untuk kebutuhan pengumpulan tugas atau sidang, ikuti ketentuan pemeriksaan yang berlaku di kampusmu.",
  },
  {
    q: "Berapa biaya pemeriksaan di Gleans?",
    a: "Kamu membayar per dokumen, tanpa perlu berlangganan. Harga dan total pembayaran ditampilkan sebelum kamu melanjutkan ke pembayaran. Jika sering memeriksa tulisan, tersedia pilihan paket berisi beberapa kuota pengecekan di menu Paket Harga.",
  },
  {
    q: "Bagaimana dengan privasi dokumen saya?",
    a: "Dokumen diunggah untuk diproses, dan akses ke dokumen serta laporan dibatasi sesuai kepemilikan pesanan. Dokumen dan laporan tersedia hingga 24 jam setelah pemeriksaan selesai, lalu dihapus otomatis dari penyimpanan Gleans. Unduh hasilmu sebelum masa tersebut berakhir.",
  },
  {
    q: "Metode pembayaran apa saja yang tersedia?",
    a: "Kamu bisa membayar melalui QRIS. Jika sudah masuk ke akun, kamu juga bisa menggunakan Saldo Gleans atau Kuota Shield yang tersedia. Pembayaran QRIS diverifikasi oleh sistem tanpa perlu mengunggah bukti transfer.",
  },
  {
    q: "Di mana saya bisa melihat dan mengunduh hasil pemeriksaan?",
    a: "Buka menu Cek Pesanan dan cari pesananmu menggunakan invoice atau nomor WhatsApp. Gunakan browser saat memesan atau masuk ke akun pemilik pesanan untuk mengakses hasil. Laporan PDF bisa diunduh selama 24 jam setelah pemeriksaan selesai.",
  },
  {
    q: "Apa yang harus dilakukan jika pesanan mengalami kendala?",
    a: "Pastikan file tidak kosong, format dan ukurannya sesuai, serta teksnya dapat dibaca. Jika pembayaran sudah berhasil tetapi pemeriksaan mengalami kendala, simpan nomor invoice dan hubungi admin melalui WhatsApp agar pesananmu dapat diperiksa lebih lanjut.",
  },
];

export function Faq() {
  return (
    <section className="section-y">
      <div className="container-page flex flex-col gap-10 md:gap-14 lg:gap-[60px]">
        <SectionHeading
          title="Pertanyaan yang sering diajukan"
          description="Seputar pemeriksaan dokumen, pembayaran, dan hasil Gleans Shield."
        />
        <AccordionPrimitive.Root type="multiple" defaultValue={["0"]} className="w-full rounded-[24px] border bg-white px-5 md:px-8 lg:px-10">
          {FAQS.map((faq, index) => (
            <AccordionPrimitive.Item key={faq.q} value={String(index)} className="border-b last:border-b-0">
              <AccordionPrimitive.Header>
                <AccordionPrimitive.Trigger className="group flex w-full items-start justify-between gap-5 rounded-lg py-6 text-left outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 md:py-7">
                  <span className="text-base leading-relaxed font-medium sm:text-lg lg:text-xl">{faq.q}</span>
                  <span aria-hidden="true" className="mt-0.5 flex size-6 shrink-0 items-center justify-center text-primary sm:mt-1">
                    <Plus className="size-5 group-data-[state=open]:hidden" />
                    <Minus className="hidden size-5 group-data-[state=open]:block" />
                  </span>
                </AccordionPrimitive.Trigger>
              </AccordionPrimitive.Header>
              <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down motion-reduce:animate-none">
                <p className="pb-6 text-sm leading-relaxed text-muted-foreground sm:text-base md:pb-7 lg:pr-12 lg:text-lg">{faq.a}</p>
              </AccordionPrimitive.Content>
            </AccordionPrimitive.Item>
          ))}
        </AccordionPrimitive.Root>
      </div>
    </section>
  );
}
