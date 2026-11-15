import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, X } from "lucide-react";
import type { ReactNode } from "react";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "确认",
  danger = false,
  busy = false,
  confirmDisabled = false,
  onConfirm,
  children
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="confirm-dialog">
          <div className="confirm-icon">
            <AlertTriangle size={20} aria-hidden="true" />
          </div>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
          {children}
          <div className="dialog-actions">
            <Dialog.Close className="button secondary">取消</Dialog.Close>
            <button
              className={`button ${danger ? "danger" : "primary"}`}
              disabled={busy || confirmDisabled}
              onClick={onConfirm}
              type="button"
            >
              {busy ? "处理中…" : confirmLabel}
            </button>
          </div>
          <Dialog.Close className="dialog-close" aria-label="关闭">
            <X size={16} aria-hidden="true" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
