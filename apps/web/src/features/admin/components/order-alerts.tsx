"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenuCheckboxItem } from "@gleans/ui/dropdown-menu";
import { Button } from "@gleans/ui/button";
import { createOrderWatcher, ORDER_ARRIVED_EVENT, type OrderMarker } from "../lib/order-alerts";

function createNotificationSound() {
  const context = new AudioContext();
  let output: GainNode | null = null;
  let sources: AudioScheduledSourceNode[] = [];
  let generation = 0;

  function stop() {
    generation += 1;
    output?.disconnect();
    output = null;
    for (const source of sources) source.stop();
    sources = [];
  }

  return {
    stop,
    async play() {
      stop();
      const current = generation;
      await context.resume();
      if (current !== generation) return false;

      const master = context.createGain();
      master.gain.value = 1;
      master.connect(context.destination);
      output = master;
      const start = context.currentTime;

      // Restore the original "de-ring": a short pickup and a brighter, fading bell.
      const notes = [
        { frequency: 783.99, offset: 0, duration: 0.2, volume: 0.13 },
        { frequency: 1046.5, offset: 0.14, duration: 0.95, volume: 0.16 },
      ];
      notes.forEach(note => {
        [1, 2, 2.997].forEach((partial, index) => {
          const at = start + note.offset;
          const duration = note.duration / (1 + index * 0.65);
          const oscillator = context.createOscillator();
          const envelope = context.createGain();
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(note.frequency * partial, at);
          envelope.gain.setValueAtTime(0, at);
          envelope.gain.linearRampToValueAtTime(note.volume / (1 + index * 4), at + 0.006);
          envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
          oscillator.connect(envelope);
          envelope.connect(master);
          sources.push(oscillator);
          oscillator.onended = () => {
            oscillator.disconnect();
            envelope.disconnect();
            sources = sources.filter(source => source !== oscillator);
            if (!sources.length) {
              master.disconnect();
              if (output === master) output = null;
            }
          };
          oscillator.start(at);
          oscillator.stop(at + duration + 0.02);
        });
      });
      return true;
    },
    dispose() {
      stop();
      void context.close();
    },
  };
}

const NotificationContext = createContext<{
  enabled: boolean;
  busy: boolean;
  error: string;
  toggle: () => void;
} | null>(null);

function showOrderNotification(id: string, openOrders: () => void) {
  const toastId = toast.info("Pesanan QRIS baru masuk", {
    description: id,
    duration: 8_000,
    action: <Button variant="outline" size="pill-sm" className="rounded-full border-border bg-background px-3 text-foreground shadow-none" onClick={() => { toast.dismiss(toastId); openOrders(); }}>Lihat pesanan</Button>,
  });
}

export function AdminOrderAlertsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const audio = useRef<ReturnType<typeof createNotificationSound> | null>(null);
  const enabled = useRef(false);
  const [sound, setSound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [connectionError, setConnectionError] = useState("");

  useEffect(() => {
    const observe = createOrderWatcher();
    const controller = new AbortController();
    let stopped = false;
    let pending = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (stopped || pending) return;
      clearTimeout(timer);
      pending = true;
      let retry = 15_000;
      try {
        const response = await fetch("/api/admin/shield-orders?watch=1", {
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
        });
        if (response.status === 401 || response.status === 403) {
          stopped = true;
          setConnectionError("Sesi admin berakhir. Masuk kembali untuk menerima notifikasi.");
          return;
        }
        if (!response.ok) throw new Error("POLL_FAILED");
        const { latest } = await response.json() as { latest: OrderMarker | null };
        setConnectionError("");
        if (observe(latest)) {
          window.dispatchEvent(new Event(ORDER_ARRIVED_EVENT));
          if (enabled.current) showOrderNotification(latest!.id, () => router.push("/admin/pesanan"));
          if (enabled.current && audio.current) {
            void audio.current.play().catch(() => {
              enabled.current = false;
              setSound(false);
              setMessage("Aktifkan kembali notifikasi untuk mengizinkan suara.");
            });
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          setConnectionError("Koneksi notifikasi terputus. Mencoba kembali otomatis…");
          retry = 30_000;
        }
      } finally {
        pending = false;
        if (!stopped) timer = setTimeout(() => void poll(), retry);
      }
    }
    const onVisible = () => { if (document.visibilityState === "visible") void poll(); };
    void poll();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [router]);

  useEffect(() => {
    return () => {
      enabled.current = false;
      audio.current?.dispose();
      audio.current = null;
    };
  }, []);

  async function play() {
    setBusy(true);
    setMessage("");
    try {
      audio.current ??= createNotificationSound();
      if (!await audio.current.play()) return;
      enabled.current = true;
      setSound(true);
    } catch {
      enabled.current = false;
      setSound(false);
      setMessage("Suara belum dapat diputar. Periksa izin suara pada browser lalu coba lagi.");
    } finally { setBusy(false); }
  }

  return <NotificationContext.Provider value={{
    enabled: sound,
    busy,
    error: message || connectionError,
    toggle: () => {
      if (sound) { enabled.current = false; audio.current?.stop(); setSound(false); setMessage(""); }
      else void play();
    },
  }}>{children}</NotificationContext.Provider>;
}

export function AdminOrderNotificationToggle() {
  const notifications = useContext(NotificationContext);
  if (!notifications) throw new Error("Admin notification provider missing");
  return <>
    <DropdownMenuCheckboxItem
      checked={notifications.enabled}
      disabled={notifications.busy}
      onSelect={event => event.preventDefault()}
      onCheckedChange={() => notifications.toggle()}
      aria-label="Notifikasi pesanan"
      className="min-h-11 cursor-pointer gap-3 rounded-xl px-3 [&>[data-slot=dropdown-menu-checkbox-item-indicator]]:hidden"
    >
      <Bell className="size-4"/>
      <span>Notifikasi</span>
      <span aria-hidden="true" className={`ml-auto inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors motion-reduce:transition-none ${notifications.enabled ? "bg-primary" : "bg-muted-foreground/25"}`}>
        <span className={`size-5 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none ${notifications.enabled ? "translate-x-5" : "translate-x-0"}`}/>
      </span>
    </DropdownMenuCheckboxItem>
    {notifications.error && <p role="status" className="px-3 py-2 text-xs leading-relaxed text-muted-foreground">{notifications.error}</p>}
  </>;
}
