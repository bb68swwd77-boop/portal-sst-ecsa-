import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";

interface HistoryResponse {
  summary: {
    connectionSeconds: number;
    completedLessons: number;
    attempts: number;
    passedEvaluations: number;
  };
  attempts: {
    id: string;
    courseTitle: string;
    moduleTitle: string;
    moduleOrder: number;
    attemptNumber: number;
    score: number | null;
    passed: boolean | null;
    submittedAt: string | null;
  }[];
  lessons: {
    id: string;
    title: string;
    courseTitle: string;
    moduleTitle: string;
    moduleOrder: number;
    completedAt: string | null;
  }[];
}

function formatConnectionTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

// "Mi historial": lo que el trabajador ha hecho en el portal — evaluaciones
// rendidas con su puntaje, lecciones completadas y tiempo conectado.
export function HistoryPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .get<HistoryResponse>("/me/history")
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <div className="alert alert-danger" role="alert">{t("No fue posible cargar su historial.")}</div>;
  if (!data) return <div className="empty-state">{t("Cargando…")}</div>;

  return (
    <div>
      <div className="page-hero">
        <h2 className="page-title">{t("Mi historial")}</h2>
        <p className="page-subtitle">{t("Sus evaluaciones, lecciones completadas y tiempo en el portal.")}</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="value">{data.summary.completedLessons}</div>
          <div className="label">{t("Lecciones completadas")}</div>
        </div>
        <div className="stat-card">
          <div className="value">{data.summary.passedEvaluations}</div>
          <div className="label">{t("Evaluaciones aprobadas")}</div>
        </div>
        <div className="stat-card">
          <div className="value">{data.summary.attempts}</div>
          <div className="label">{t("Intentos realizados")}</div>
        </div>
        <div className="stat-card">
          <div className="value">{formatConnectionTime(data.summary.connectionSeconds)}</div>
          <div className="label">{t("Tiempo en el portal")}</div>
        </div>
      </div>

      <h3 className="mt-24">{t("Evaluaciones")}</h3>
      {data.attempts.length === 0 ? (
        <div className="empty-state card">{t("Aún no ha rendido evaluaciones.")}</div>
      ) : (
        <div className="table-wrap mt-8">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("Fecha")}</th>
                <th>{t("Módulo")}</th>
                <th>{t("Intento")}</th>
                <th>{t("Puntaje")}</th>
                <th>{t("Resultado")}</th>
              </tr>
            </thead>
            <tbody>
              {data.attempts.map((a) => (
                <tr key={a.id}>
                  <td>{formatDateTime(a.submittedAt)}</td>
                  <td>
                    {t("Módulo")} {a.moduleOrder} · {a.moduleTitle}
                    <div className="text-muted">{a.courseTitle}</div>
                  </td>
                  <td>{a.attemptNumber}</td>
                  <td>{a.score !== null ? `${a.score}%` : "—"}</td>
                  <td>
                    <span className={`badge badge-status-${a.passed ? "completed" : "overdue"}`}>
                      {a.passed ? t("Aprobado") : t("No aprobado")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="mt-24">{t("Lecciones completadas")}</h3>
      {data.lessons.length === 0 ? (
        <div className="empty-state card">{t("Aún no ha completado lecciones.")}</div>
      ) : (
        <div className="table-wrap mt-8">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("Fecha")}</th>
                <th>{t("Lección")}</th>
                <th>{t("Módulo")}</th>
              </tr>
            </thead>
            <tbody>
              {data.lessons.map((l) => (
                <tr key={l.id}>
                  <td>{formatDateTime(l.completedAt)}</td>
                  <td>{l.title}</td>
                  <td>
                    {t("Módulo")} {l.moduleOrder} · {l.moduleTitle}
                    <div className="text-muted">{l.courseTitle}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
