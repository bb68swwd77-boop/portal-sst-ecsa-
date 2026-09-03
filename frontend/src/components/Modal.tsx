import type { ReactNode } from "react";
import { useLanguage } from "../context/LanguageContext";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex-between mt-8" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn-link" onClick={onClose} aria-label={t("Cerrar")}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
