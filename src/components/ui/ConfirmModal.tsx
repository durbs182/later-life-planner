'use client';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ title, message, confirmLabel = 'Confirm', onConfirm, onCancel }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6 flex flex-col gap-4">
        <h2 id="confirm-modal-title" className="text-base font-black text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            autoFocus
            className="btn-ghost text-slate-500"
            onKeyDown={(e) => e.key === 'Escape' && onCancel()}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="btn-ghost text-rose-600 font-bold hover:bg-rose-50"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
