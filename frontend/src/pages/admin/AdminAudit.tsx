import { useEffect, useState } from "react";
import { api } from "../../api/client";

interface AuditLog {
  id: string;
  action: string;
  resource: string | null;
  result: string;
  ip: string | null;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string } | null;
}

export function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const pageSize = 50;

  async function load() {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (actionFilter) params.set("action", actionFilter);
    const res = await api.get<{ logs: AuditLog[]; total: number }>(`/admin/audit?${params.toString()}`);
    setLogs(res.logs);
    setTotal(res.total);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div>
      <h2 className="page-title">Auditoría</h2>
      <p className="page-subtitle">Trazabilidad de eventos sensibles del sistema.</p>

      <div className="flex gap-8">
        <input
          placeholder="Filtrar por acción (ej: auth.login)"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        />
        <button
          className="btn btn-secondary"
          onClick={() => {
            setPage(1);
            load();
          }}
        >
          Filtrar
        </button>
      </div>

      <div className="table-wrap mt-16">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Acción</th>
              <th>Recurso</th>
              <th>Resultado</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{new Date(l.createdAt).toLocaleString("es-EC")}</td>
                <td>{l.user ? `${l.user.firstName} ${l.user.lastName}` : "—"}</td>
                <td>{l.action}</td>
                <td>{l.resource ?? "—"}</td>
                <td>
                  <span className={`badge badge-status-${l.result === "success" ? "completed" : "overdue"}`}>{l.result}</span>
                </td>
                <td>{l.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex-between mt-16">
        <span className="text-muted" style={{ fontSize: 12 }}>
          {total} eventos · página {page} de {Math.max(1, Math.ceil(total / pageSize))}
        </span>
        <div className="flex gap-8">
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </button>
          <button className="btn btn-secondary btn-sm" disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage((p) => p + 1)}>
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
