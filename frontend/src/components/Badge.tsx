import type { ReactNode } from "react";
import { useLanguage } from "../context/LanguageContext";

const LABELS: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  completed: "Completado",
  overdue: "Vencido",
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  return <span className={`badge badge-status-${status}`}>{t(LABELS[status] ?? status)}</span>;
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge badge-copper">{children}</span>;
}
