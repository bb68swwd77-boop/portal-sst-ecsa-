import { useEffect, useState, type FormEvent } from "react";
import { api, downloadFile } from "../../api/client";
import { StatusBadge } from "../../components/Badge";

interface ReportRow {
  userId: string;
  userName: string;
  email: string;
  company: string | null;
  courseTitle: string;
  status: string;
  percent: number;
  bestScore: number | null;
  certificateCode: string | null;
}

export function AdminReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    const params = new URLSearchParams();
    if (company) params.set("company", company);
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    const res = await api.get<{ rows: ReportRow[] }>(`/admin/reports/training?${params.toString()}`);
    setRows(res.rows);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await load();
  }

  async function handleExport() {
    const params = new URLSearchParams({ format: "csv" });
    if (company) params.set("company", company);
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    await downloadFile(`/admin/reports/training?${params.toString()}`, "reporte-capacitacion-sst.csv");
  }

  return (
    <div>
      <div className="flex-between">
        <div>
          <h2 className="page-title">Reportes</h2>
          <p className="page-subtitle">Estado de capacitación por usuario y curso.</p>
        </div>
        <button className="btn btn-secondary" onClick={handleExport}>
          Exportar CSV
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-8 mt-16" style={{ flexWrap: "wrap" }}>
        <input placeholder="Buscar usuario" value={search} onChange={(e) => setSearch(e.target.value)} />
        <input placeholder="Empresa" value={company} onChange={(e) => setCompany(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="in_progress">En progreso</option>
          <option value="completed">Completado</option>
          <option value="overdue">Vencido</option>
        </select>
        <button className="btn btn-secondary" type="submit">
          Filtrar
        </button>
      </form>

      <div className="table-wrap mt-16">
        <table className="data-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Empresa</th>
              <th>Capacitación</th>
              <th>Estado</th>
              <th>Progreso</th>
              <th>Mejor puntaje</th>
              <th>Certificado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.userId}-${r.courseTitle}-${i}`}>
                <td>
                  {r.userName}
                  <br />
                  <span className="text-muted" style={{ fontSize: 11 }}>
                    {r.email}
                  </span>
                </td>
                <td>{r.company ?? "—"}</td>
                <td>{r.courseTitle}</td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td>{r.percent}%</td>
                <td>{r.bestScore ?? "—"}</td>
                <td>{r.certificateCode ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
