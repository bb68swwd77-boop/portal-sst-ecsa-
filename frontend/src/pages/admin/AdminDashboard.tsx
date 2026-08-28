import { useEffect, useState } from "react";
import { api } from "../../api/client";

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
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get<DashboardData>("/admin/dashboard").then(setData);
  }, []);

  if (!data) return <div className="empty-state">Cargando…</div>;

  return (
    <div>
      <h2 className="page-title">Panel administrativo</h2>
      <p className="page-subtitle">Indicadores generales de capacitación SST.</p>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="value">{data.totalUsers}</div>
          <div className="label">Usuarios registrados</div>
        </div>
        <div className="stat-card">
          <div className="value">{data.activeUsers}</div>
          <div className="label">Usuarios activos</div>
        </div>
        <div className="stat-card">
          <div className="value">{data.activeCourses}</div>
          <div className="label">Capacitaciones activas</div>
        </div>
        <div className="stat-card">
          <div className="value">{data.totalAttempts}</div>
          <div className="label">Evaluaciones realizadas</div>
        </div>
        <div className="stat-card">
          <div className="value">{data.approvalRate}%</div>
          <div className="label">Tasa de aprobación</div>
        </div>
        <div className="stat-card">
          <div className="value">{data.certificatesIssued}</div>
          <div className="label">Certificados emitidos</div>
        </div>
      </div>

      <h3>Aprobación por capacitación</h3>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Capacitación</th>
              <th>Intentos</th>
              <th>% Aprobación</th>
              <th>Certificados emitidos</th>
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
