import { X } from "lucide-react"

interface Props {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "default"
  isPending?: boolean
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "אישור",
  cancelLabel = "ביטול",
  variant = "default",
  isPending = false
}: Props) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-shell max-w-sm mx-4">
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <p className="text-sm text-[var(--color-text-secondary)]">{message}</p>
        </div>

        <div className="modal-footer">
          <button
            onClick={onConfirm}
            disabled={isPending}
            className={`btn ${variant === "danger" ? "btn--danger" : "btn--primary"}`}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onClose}
            className="btn btn--secondary"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
