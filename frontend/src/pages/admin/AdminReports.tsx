import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import { api, downloadFile } from "../../api/client";
import { StatusBadge } from "../../components/Badge";
import { useLanguage } from "../../context/LanguageContext";

interface ReportRow {
  userId: string;
  userName: string;
  email: string;
  company: string | null;
  area: string | null;
  courseTitle: string;
  status: string;
  percent: number;
  approvedModules: string[];
  bestScore: number | null;
  certificateCode: string | null;
  connectionSeconds: number;
}

interface UserGroup {
  userId: string;
  userName: string;
  email: string;
  company: string | null;
  area: string | null;
  rows: ReportRow[];
  completed: number;
  avgPercent: number;
  connectionSeconds: number;
  status: string;
}

function formatConnectionTime(seconds: number) {
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 1) return "—";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function overallStatus(rows: ReportRow[]) {
  if (rows.every((r) => r.status === "completed")) return "completed";
  if (rows.some((r) => r.status === "overdue")) return "overdue";
  if (rows.some((r) => r.status === "in_progress" || r.status === "completed" || r.percent > 0)) return "in_progress";
  return "pending";
}

function groupByUser(rows: ReportRow[]): UserGroup[] {
  const map = new Map<string, ReportRow[]>();
  for (const r of rows) {
    const list = map.get(r.userId);
    if (list) list.push(r);
    else map.set(r.userId, [r]);
  }
  return Array.from(map.entries()).map(([userId, list]) => ({
    userId,
    userName: list[0].userName,
    email: list[0].email,
    company: list[0].company,
    area: list[0].area,
    rows: list,
    completed: list.filter((r) => r.status === "completed").length,
    avgPercent: Math.round(list.reduce((sum, r) => sum + r.percent, 0) / list.length),
    connectionSeconds: list.reduce((sum, r) => sum + r.connectionSeconds, 0),
    status: overallStatus(list),
  }));
}

export function AdminReportsPage() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const groups = useMemo(() => groupByUser(rows), [rows]);
  const allExpanded = groups.length > 0 && expanded.size >= groups.length;

  function toggle(userId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function load() {
    const params = new URLSearchParams();
    if (company) params.set("company", company);
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    const res = await api.get<{ rows: ReportRow[] }>(`/admin/reports/training?${params.toString()}`);
    setRows(res.rows);
    // Al buscar un usuario, se abren sus datos directamente.
    setExpanded(search.trim() ? new Set(res.rows.map((r) => r.userId)) : new Set());
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
          <h2 className="page-title">{t("Reportes")}</h2>
          <p className="page-subtitle">{t("Estado de capacitación por usuario y curso.")}</p>
        </div>
        <button className="btn btn-secondary" onClick={handleExport}>
          {t("Exportar CSV")}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-8 mt-16" style={{ flexWrap: "wrap" }}>
        <input placeholder={t("Buscar usuario")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <input placeholder={t("Empresa")} value={company} onChange={(e) => setCompany(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t("Todos los estados")}</option>
          <option value="pending">{t("Pendiente")}</option>
          <option value="in_progress">{t("En progreso")}</option>
          <option value="completed">{t("Completado")}</option>
          <option value="overdue">{t("Vencido")}</option>
        </select>
        <button className="btn btn-secondary" type="submit">
          {t("Filtrar")}
        </button>
      </form>

      <div className="flex-between mt-16">
        <span className="text-muted" style={{ fontSize: 12 }}>
          {groups.length} {t("Usuarios")} · {rows.length} {t("Capacitaciones")}
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={groups.length === 0}
          onClick={() => setExpanded(allExpanded ? new Set() : new Set(groups.map((g) => g.userId)))}
        >
          {allExpanded ? t("Contraer todo") : t("Expandir todo")}
        </button>
      </div>

      <div className="table-wrap mt-16">
        <table className="data-table report-table">
          <thead>
            <tr>
              <th style={{ width: 36 }} />
              <th>{t("Usuario")}</th>
              <th>{t("Empresa")}</th>
              <th>{t("Área")}</th>
              <th>{t("Capacitaciones")}</th>
              <th>{t("Progreso promedio")}</th>
              <th>{t("Estado")}</th>
              <th>{t("Tiempo de conexión")}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const open = expanded.has(g.userId);
              return (
                <Fragment key={g.userId}>
                  <tr className={`report-user-row${open ? " is-open" : ""}`} onClick={() => toggle(g.userId)}>
                    <td>
                      <button
                        type="button"
                        className="report-toggle"
                        aria-expanded={open}
                        aria-label={t("Mostrar u ocultar detalle")}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(g.userId);
                        }}
                      >
                        {open ? "▼" : "▶"}
                      </button>
                    </td>
                    <td>
                      {g.userName}
                      <br />
                      <span className="text-muted" style={{ fontSize: 11 }}>
                        {g.email}
                      </span>
                    </td>
                    <td>{g.company ?? "—"}</td>
                    <td>{g.area ?? "—"}</td>
                    <td>
                      {g.completed}/{g.rows.length} {t("completados")}
                    </td>
                    <td>
                      <div className="report-progress">
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${g.avgPercent}%` }} />
                        </div>
                        <span>{g.avgPercent}%</span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={g.status} />
                    </td>
                    <td>{formatConnectionTime(g.connectionSeconds)}</td>
                  </tr>
                  {open && (
                    <tr className="report-detail-row">
                      <td />
                      <td colSpan={7}>
                        <table className="data-table report-subtable">
                          <thead>
                            <tr>
                              <th>{t("Capacitación")}</th>
                              <th>{t("Estado")}</th>
                              <th>{t("Progreso")}</th>
                              <th>{t("Módulos aprobados")}</th>
                              <th>{t("Mejor puntaje")}</th>
                              <th>{t("Tiempo de conexión")}</th>
                              <th>{t("Certificado")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.rows.map((r, i) => (
                              <tr key={`${r.courseTitle}-${i}`}>
                                <td style={{ whiteSpace: "normal", minWidth: 220 }}>{r.courseTitle}</td>
                                <td>
                                  <StatusBadge status={r.status} />
                                </td>
                                <td>{r.percent}%</td>
                                <td>
                                  {r.approvedModules.length === 0
                                    ? "—"
                                    : r.approvedModules.map((m) => (
                                        <div key={m} style={{ fontSize: 12 }}>
                                          {m}
                                        </div>
                                      ))}
                                </td>
                                <td>{r.bestScore ?? "—"}</td>
                                <td>{formatConnectionTime(r.connectionSeconds)}</td>
                                <td>{r.certificateCode ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {groups.length === 0 && (
              <tr>
                <td colSpan={8} className="text-muted" style={{ textAlign: "center", padding: 24 }}>
                  —
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
