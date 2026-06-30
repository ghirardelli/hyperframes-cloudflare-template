import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "warning" | "info";

interface ToastInput {
  tone?: ToastTone;
  title?: string;
  message: string;
  durationMs?: number;
}

interface ToastOptions {
  title?: string;
  durationMs?: number;
}

interface ToastRecord {
  id: string;
  tone: ToastTone;
  title?: string;
  message: string;
  exiting: boolean;
}

interface ToastApi {
  show: (toast: ToastInput | string) => string;
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const DEFAULT_DURATION_MS = 3200;
const EXIT_DURATION_MS = 220;
const MAX_VISIBLE_TOASTS = 5;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextIdRef = useRef(0);
  const autoTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const exitTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const removeToast = useCallback((id: string) => {
    const autoTimer = autoTimersRef.current.get(id);
    if (autoTimer) clearTimeout(autoTimer);
    autoTimersRef.current.delete(id);

    const exitTimer = exitTimersRef.current.get(id);
    if (exitTimer) clearTimeout(exitTimer);
    exitTimersRef.current.delete(id);

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      const autoTimer = autoTimersRef.current.get(id);
      if (autoTimer) clearTimeout(autoTimer);
      autoTimersRef.current.delete(id);

      setToasts((current) =>
        current.map((toast) => (toast.id === id ? { ...toast, exiting: true } : toast)),
      );

      if (!exitTimersRef.current.has(id)) {
        exitTimersRef.current.set(
          id,
          setTimeout(() => removeToast(id), EXIT_DURATION_MS),
        );
      }
    },
    [removeToast],
  );

  const show = useCallback(
    (input: ToastInput | string) => {
      const toastInput = typeof input === "string" ? { message: input } : input;
      const id = `toast-${Date.now()}-${nextIdRef.current++}`;
      const tone = toastInput.tone ?? "info";
      const durationMs = toastInput.durationMs ?? DEFAULT_DURATION_MS;

      setToasts((current) =>
        [
          ...current,
          {
            id,
            tone,
            title: toastInput.title,
            message: toastInput.message,
            exiting: false,
          },
        ].slice(-MAX_VISIBLE_TOASTS),
      );

      if (durationMs > 0) {
        autoTimersRef.current.set(id, setTimeout(() => dismiss(id), durationMs));
      }

      return id;
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message, options) => show({ tone: "success", message, ...options }),
      error: (message, options) => show({ tone: "error", message, ...options }),
      warning: (message, options) => show({ tone: "warning", message, ...options }),
      info: (message, options) => show({ tone: "info", message, ...options }),
      dismiss,
    }),
    [dismiss, show],
  );

  useEffect(() => {
    return () => {
      for (const timer of autoTimersRef.current.values()) clearTimeout(timer);
      for (const timer of exitTimersRef.current.values()) clearTimeout(timer);
    };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastRecord[];
  onDismiss: (id: string) => void;
}) {
  if (!toasts.length) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex w-[min(calc(100vw-2rem),24rem)] flex-col gap-2 sm:bottom-6 sm:right-6"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastRecord;
  onDismiss: (id: string) => void;
}) {
  const Icon = toastIconByTone[toast.tone];
  const title = toast.title ?? toastTitleByTone[toast.tone];

  return (
    <article
      aria-live={toast.tone === "error" ? "assertive" : "polite"}
      className={cn(
        "toast-enter pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-xl shadow-black/15",
        "min-h-16 text-sm leading-5",
        toastToneClassName[toast.tone],
        toast.exiting && "toast-exit",
      )}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 break-words opacity-90">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full opacity-80 transition hover:bg-white/15 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <X className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Close notification</span>
      </button>
    </article>
  );
}

const toastIconByTone = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} satisfies Record<ToastTone, typeof CheckCircle2>;

const toastTitleByTone = {
  success: "Confirmed",
  error: "Error",
  warning: "Warning",
  info: "Notice",
} satisfies Record<ToastTone, string>;

const toastToneClassName = {
  success: "border-emerald-500 bg-emerald-600 text-white",
  error: "border-red-500 bg-red-600 text-white",
  warning: "border-amber-300 bg-amber-300 text-amber-950 shadow-amber-950/10",
  info: "border-sky-500 bg-sky-600 text-white",
} satisfies Record<ToastTone, string>;
