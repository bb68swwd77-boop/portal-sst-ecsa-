import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useLanguage } from "../../context/LanguageContext";

interface DashboardData {
  totalUsers: number;
  activeUsers: number;
  activeCourses: number;
  totalAttempts: number;
  approvalRate: number;
  certificatesIssued: number;
  courseBreakdown: { courseId: string; title: string; certificatesIssued: number; attempts: number; approvalRate: number }[];
}

export function AdminDashboardPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get<DashboardData>("/admin/dashboard").then(setData);
  }, []);

  if (!data) return <div className="empty-state">{t("Cargando…")}</div>;

  return (
    <div>
      <h2 className="page-title">{t("Panel administrativo")}</h2>
      <p className="page-subtitle">{t("Indicadores generales de capacitación SST.")}</p>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="value">{data.totalUsers}</div>
          <div className="label">{t("Usuarios registrados")}</div>
        </div>
        <div className="stat-card">
          <div className="value">{data.activeUsers}</div>
          <div className="label">{t("Usuarios activos")}</div>
        </div>
        <div className="stat-card">
          <div className="value">{data.activeCourses}</div>
          <div className="label">{t("Capacitaciones activas")}</div>
        </div>
        <div className="stat-card">
          <div className="value">{data.totalAttempts}</div>
          <div className="label">{t("Evaluaciones realizadas")}</div>
        </div>
        <div className="stat-card">
          <div className="value">{data.approvalRate}%</div>
          <div className="label">{t("Tasa de aprobación")}</div>
        </div>
        <div className="stat-card">
          <div className="value">{data.certificatesIssued}</div>
          <div className="label">{t("Certificados emitidos")}</div>
        </div>
      </div>

      <h3>{t("Aprobación por capacitación")}</h3>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("Capacitación")}</th>
              <th>{t("Intentos")}</th>
              <th>{t("% Aprobación")}</th>
              <th>{t("Certificados emitidos")}</th>
            </tr>
          </thead>
          <tbody>
            {data.courseBreakdown.map((c) => (
              <tr key={c.courseId}>
                <td>{c.title}</td>
                <td>{c.attempts}</td>
                <td>{c.approvalRate}%</td>
                <td>{c.certificatesIssued}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
