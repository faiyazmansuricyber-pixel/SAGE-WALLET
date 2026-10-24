import React from "react";
import { Toast } from "../types";

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast ${toast.type} ${toast.exiting ? "toast-exit" : ""}`}
          onClick={() => onDismiss(toast.id)}
          role="alert"
        >
          <span className="toast-icon">
            {toast.type === "success" && "✓"}
            {toast.type === "error" && "✕"}
            {toast.type === "pending" && "⏳"}
          </span>
          <div className="toast-body">
            <div className="toast-title">{toast.title}</div>
            {toast.message && (
              <div className={`toast-message ${toast.message.startsWith("0x") ? "mono" : ""}`}>
                {toast.message}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
