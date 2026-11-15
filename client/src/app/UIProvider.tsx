import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";

type SaveMode = "idle" | "saving" | "saved" | "error";

interface Toast {
  id: number;
  message: string;
  tone: "success" | "error";
}

interface UIContextValue {
  saveMode: SaveMode;
  saveLabel: string;
  setSaving: (message?: string) => void;
  setSaved: (message?: string) => void;
  setSaveError: (message?: string) => void;
  notify: (message: string, tone?: "success" | "error") => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [saveMode, setSaveMode] = useState<SaveMode>("saved");
  const [saveLabel, setSaveLabel] = useState("所有更改已保存");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextToastId = useRef(1);

  const notify = useCallback((message: string, tone: "success" | "error" = "success") => {
    const id = nextToastId.current++;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2600);
  }, []);

  const setSaving = useCallback((message = "正在保存…") => {
    setSaveMode("saving");
    setSaveLabel(message);
  }, []);

  const setSaved = useCallback((message = "所有更改已保存") => {
    setSaveMode("saved");
    setSaveLabel(message);
  }, []);

  const setSaveError = useCallback((message = "保存失败，请重试") => {
    setSaveMode("error");
    setSaveLabel(message);
  }, []);

  const value = useMemo<UIContextValue>(
    () => ({
      saveMode,
      saveLabel,
      setSaving,
      setSaved,
      setSaveError,
      notify
    }),
    [notify, saveLabel, saveMode, setSaveError, setSaved, setSaving]
  );

  return (
    <UIContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div className={`toast ${toast.tone}`} role="status" key={toast.id}>
            {toast.tone === "success" ? (
              <CheckCircle2 size={16} aria-hidden="true" />
            ) : (
              <AlertCircle size={16} aria-hidden="true" />
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </UIContext.Provider>
  );
}

export function useUI(): UIContextValue {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI must be used inside UIProvider");
  return context;
}

export function SaveState() {
  const { saveMode, saveLabel } = useUI();
  return (
    <span className={`save-state ${saveMode}`} aria-live="polite">
      {saveMode === "saving" ? (
        <LoaderCircle className="spin" size={12} aria-hidden="true" />
      ) : (
        <span className="save-dot" aria-hidden="true" />
      )}
      {saveLabel}
    </span>
  );
}
