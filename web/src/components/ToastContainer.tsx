import React from "react";
import { Toast } from "../types";

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

const ICONS: Record<Toast["type"], React.ReactNode> = {
  success: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  pending: (
    <span className="spinner" style={{ borderColor: "rgba(194,65,12,.3)", borderTopColor: "var(--accent)" }} />
  ),
};

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast ${toast.type} ${toast.exiting ? "toast-exit" : ""}`}
          onClick={() => onDismiss(toast.id)}
          role="alert"
          aria-live="polite"
          title="Click to dismiss"
        >
          <span className="toast-icon">{ICONS[toast.type]}</span>
          <div className="toast-body">
            <div className="toast-title">{toast.title}</div>
            {toast.message && (
              <div className={`toast-message ${toast.message.startsWith("0x") ? "font-mono" : ""}`}>
                {toast.message}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
