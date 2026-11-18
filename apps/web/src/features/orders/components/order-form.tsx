"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldPriceChanged, startCheckoutTransition } from "@/features/payments/checkout-transition";
import { useBillingTotals } from "@/features/payments/billing/client";
import { finishPaymentUpload, preparePaymentUpload, uploadPaymentFile } from "@/features/payments/upload-file";
import { useDropzone } from "react-dropzone";
import { FileText, FileUp, Layers, Loader2, Phone, QrCode, TicketPercent, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@gleans/ui/button";
import { Input } from "@gleans/ui/input";
import { formatBytes, formatNumber, formatRupiah } from "@/lib/format";
import {
  ACCEPTED_FILES,
  LIMIT_LABEL,
  MAX_FILE_BYTES,
  type AppliedPromo,
  extractWordCount,
  validateFile,
  validateWords,
  whatsappSchema,
} from "@/features/orders/lib/order";
import { cn } from "@/lib/utils";

type UploadPreparation = ReturnType<typeof preparePaymentUpload>;
type Document = { file: File; words: number; requestId: string; preparation: UploadPreparation; preparedAt: number };

const PAYMENT_METHODS = [
  { id: "qris", label: "QRIS", icon: QrCode },
  { id: "balance", label: "Saldo Gleans", icon: Wallet },
  { id: "quota", label: "Kuota Shield", icon: Layers },
] as const;

export function OrderForm({ price: initialPrice }: { price: number }) {
  const router = useRouter();
  const [whatsapp, setWhatsapp] = useState("");
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<AppliedPromo | null>(null);
  const [price, setPrice] = useState(initialPrice);
  const [promoBusy, setPromoBusy] = useState(false);
  const [document, setDocument] = useState<Document | null>(null);
  const [reading, setReading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]["id"]>("qris");
  const { totals, error: billingError, authRequired } = useBillingTotals(paymentMethod !== "qris");
  const preparingUpload = useRef<UploadPreparation | null>(null);

  const subtotal = document ? price : 0;
  const discount = document ? (promo?.discount ?? 0) : 0;
  const total = subtotal - discount;
  const paymentAllowed = paymentMethod === "qris" || (totals && (
    paymentMethod === "balance" ? totals.balance >= total : totals.quota > 0
  ));
  const paymentHelp = billingError || (!totals ? "Memeriksa saldo dan kuota…" : paymentMethod === "quota"
    ? `Kuota tersedia: ${totals.quota} pemeriksaan.`
    : `Saldo tersedia: ${formatRupiah(totals.balance)}.`);

  async function acceptFile(file: File) {
    const fileError = validateFile(file);
    if (fileError) {
      toast.error(fileError);
      return;
    }
    setReading(true);
    try {
      const words = await extractWordCount(file);
      const wordError = validateWords(words);
      if (wordError) {
        toast.error(wordError);
        setDocument(null);
        return;
      }
      const requestId = crypto.randomUUID();
      router.prefetch(`/pembayaran?checkout=${requestId}`);
      // Serialize ticket requests so a first-time guest cookie is in place if a file is replaced.
      const preparation = Promise.resolve(preparingUpload.current).catch(() => null).then(() => preparePaymentUpload(file));
      preparingUpload.current = preparation;
      void preparation.catch(() => {});
      setDocument({ file, words, requestId, preparation, preparedAt: Date.now() });
      toast.success(`${file.name} siap diproses.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      toast.error(
        detail && detail.length < 180
          ? detail
          : "Gagal membaca dokumen. Coba unggah ulang atau pakai format lain.",
      );
    } finally {
      setReading(false);
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPTED_FILES,
    maxFiles: 1,
    maxSize: MAX_FILE_BYTES,
    multiple: false,
    disabled: reading,
    onDrop: (accepted) => accepted[0] && acceptFile(accepted[0]),
    onDropRejected: () => toast.error("File ditolak. Pastikan format PDF, DOC, DOCX, atau TXT di bawah 25MB."),
  });

  async function applyPromo() {
    const code = promoInput.trim();
    if (!code) {
      toast.error("Masukkan kode promo terlebih dahulu.");
      return;
    }
    setPromoBusy(true);
    try {
      const response = await fetch("/api/promotions/quote", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPrice(data.price);
      setPromo(data.promo);
      toast.success(`Kode ${data.promo.code} dipakai. ${data.promo.label}.`);
    } catch (error) {
      setPromo(null);
      toast.error(error instanceof Error ? error.message : "Kode promo belum dapat diperiksa.");
    } finally {
      setPromoBusy(false);
    }
  }

  function handlePay() {
    if (paying || !paymentAllowed) return;
    const parsed = whatsappSchema.safeParse(whatsapp);
    if (!parsed.success) { setWhatsappError(parsed.error.issues[0].message); return; }
    setWhatsappError(null);
    if (!document) { toast.error("Unggah dokumen yang mau diperiksa."); return; }
    setPaying(true);
    const { file, words, requestId, preparation, preparedAt } = document;
    let ticketId: string | undefined;
    let usePreparation = Date.now() - preparedAt < 10 * 60_000;
    startCheckoutTransition(requestId, { document_name: file.name, amount: total, method: paymentMethod }, async expectedAmount => {
      if (usePreparation) {
        usePreparation = false;
        const upload = await preparation.catch(() => null);
        if (upload) ticketId = await finishPaymentUpload(file, upload);
      }
      ticketId ??= await uploadPaymentFile(file);
      const response = await fetch("/api/payments/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, ticketId, words, whatsapp: parsed.data, method: paymentMethod, expectedAmount, ...(promo ? { promo: promo.code } : {}) }) });
      const body = await response.json();
      if (response.status === 409 && body.code === "SHIELD_PRICE_CHANGED") throw new ShieldPriceChanged(body.error, body.amount);
      if (!response.ok || !body.order) throw new Error(body.error || "Tidak dapat membuka pembayaran.");
      // The upload already established the guest cookie for this browser.
      return { ...body.order, access_code: body.access_code };
    });
    router.push(`/pembayaran?checkout=${requestId}`);
  }

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[1fr_380px]">
      <section className="flex min-w-0 flex-col gap-6 rounded-[24px] border bg-white p-4">
        <header className="flex min-w-0 items-center gap-4">
          <span className="bg-surface flex size-12 shrink-0 items-center justify-center rounded-[12px]">
            <FileText aria-hidden="true" className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-lg font-semibold">Upload Dokumen</h2>
            <p className="text-muted-foreground text-sm">{LIMIT_LABEL}</p>
          </div>
        </header>

        <Field label="No. WhatsApp" htmlFor="whatsapp" error={whatsappError}>
          <div className="relative">
            <Phone aria-hidden="true" className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="whatsapp"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={whatsapp}
              onChange={(e) => {
                setWhatsapp(e.target.value);
                setWhatsappError(null);
              }}
              aria-invalid={whatsappError ? true : undefined}
              placeholder="Masukkan No. WhatsApp"
              className="h-12 rounded-full pr-5 pl-13 md:text-base"
            />
          </div>
        </Field>

        <Field label="Kode Promo" htmlFor="promo">
          <div className="relative">
            <TicketPercent aria-hidden="true" className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="promo"
              value={promoInput}
              disabled={promoBusy || paying}
              onChange={(e) => {
                setPromoInput(e.target.value);
                setPromo(null);
              }}
              placeholder="Masukkan Kode Promo"
              className="h-12 rounded-full pr-32 pl-13 text-sm md:text-base"
            />
            <Button
              type="button"
              size="pill-sm"
              onClick={applyPromo}
              disabled={promoBusy || paying}
              className="absolute top-1/2 right-1 w-[104px] -translate-y-1/2 text-xs font-normal sm:text-sm"
            >
              {promoBusy ? "Memeriksa…" : "Gunakan"}
            </Button>
          </div>
        </Field>

        <Field label="Upload File">
          <div
            {...getRootProps()}
            className={cn(
              "bg-surface flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-4 rounded-[20px] border border-dashed border-border p-4 text-center transition-colors sm:min-h-[200px] lg:min-h-[240px]",
              isDragActive && "border-primary bg-accent",
              reading && "cursor-wait opacity-70",
            )}
          >
            <input {...getInputProps()} />
            <span className="flex size-12 items-center justify-center rounded-xl bg-white">
              {reading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <FileUp aria-hidden="true" className="size-5" />
              )}
            </span>
            <div className="flex w-full min-w-0 flex-col gap-1">
              <p className="truncate font-semibold">
                {reading ? "Membaca dokumen..." : document ? document.file.name : "Upload File"}
              </p>
              <p className="text-muted-foreground text-sm">
                {document && !reading
                  ? `${formatBytes(document.file.size)} • ${formatNumber(document.words)} Kata`
                  : "PDF, DOCS, DOC dan TXT"}
              </p>
            </div>
          </div>
        </Field>
      </section>

      <section className="flex min-w-0 flex-col gap-6 rounded-[24px] border bg-white p-4">
        <h2 className="text-xl font-semibold">Ringkasan Pesanan</h2>

        <div className="flex-1">
          {document ? (
            <div className="flex min-w-0 items-start gap-3">
              <span className="bg-surface flex size-12 shrink-0 items-center justify-center rounded-[12px]">
                <FileText aria-hidden="true" className="size-5" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="truncate font-semibold">{document.file.name}</p>
                <p className="text-muted-foreground text-sm break-words">
                  {formatBytes(document.file.size)} • {formatNumber(document.words)} Kata
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Hapus dokumen"
                onClick={() => setDocument(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Belum ada dokumen. Unggah file untuk melihat rinciannya.</p>
          )}
        </div>

        <fieldset disabled={paying}>
          <legend className="mb-2 text-sm font-semibold">Metode pembayaran</legend>
          <div className="grid gap-2">
            {PAYMENT_METHODS.filter(({ id }) => id !== "quota" || paymentMethod === "quota" || !!totals?.quota).map(({ id, label, icon: Icon }) => (
              <label
                key={id}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                  paymentMethod === id && "border-primary bg-accent",
                )}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
                <span className="flex-1">{label}</span>
                <input
                  type="radio"
                  name="shield-payment-method"
                  value={id}
                  checked={paymentMethod === id}
                  onChange={() => setPaymentMethod(id)}
                  aria-describedby={id !== "qris" && paymentMethod === id ? "shield-payment-method-info" : undefined}
                  className="size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
              </label>
            ))}
          </div>
          {paymentMethod !== "qris" && (
            <p id="shield-payment-method-info" className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {paymentHelp}
            </p>
          )}
        </fieldset>

        <div className="flex flex-col gap-3">
          <div className="text-muted-foreground flex items-center justify-between">
            <span>Subtotal</span>
            <span>{formatRupiah(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="text-primary flex items-center justify-between">
              <span>Promo {promo?.code}</span>
              <span>-{formatRupiah(discount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between font-semibold">
            <span>Total Pembayaran</span>
            <span>{document && paymentMethod === "quota" ? "1 kuota Shield" : formatRupiah(total)}</span>
          </div>
          {paymentMethod !== "qris" && authRequired ? (
            <Button asChild variant="outline" size="pill" className="w-full font-normal">
              <Link href="/masuk">Masuk untuk menggunakan saldo</Link>
            </Button>
          ) : paymentMethod === "balance" && totals && !paymentAllowed ? (
            <Button asChild variant="outline" size="pill" className="w-full font-normal">
              <Link href="/dashboard/paket-saldo" target="_blank" rel="noreferrer">Isi Saldo Gleans</Link>
            </Button>
          ) : (
            <Button
              type="button"
              size="pill"
              onClick={handlePay}
              disabled={!document || reading || paying || promoBusy || !paymentAllowed}
              className="w-full font-normal disabled:opacity-100"
            >
              {paymentMethod === "balance" ? "Bayar dengan Saldo" : paymentMethod === "quota" ? "Gunakan 1 Kuota" : "Bayar Sekarang"}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-xs font-medium uppercase">
          {label}
        </label>
      ) : (
        <p className="text-xs font-medium uppercase">{label}</p>
      )}
      {children}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
