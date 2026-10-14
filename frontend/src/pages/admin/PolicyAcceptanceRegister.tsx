import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { useLanguage } from "../../context/LanguageContext";

interface Acceptance {
  id: string;
  version: string;
  acceptedAt: string;
  ip: string | null;
  user: { firstName: string; lastName: string; code: string | null; company: string | null };
}

interface RegisterResponse {
  currentVersion: string;
  total: number;
  acceptedCurrent: number;
  pendingUsers: number;
  acceptances: Acceptance[];
}

// Registro de aceptación de las políticas de datos personales y cookies:
// evidencia de quién aceptó, qué versión, cuándo y desde qué IP.
export function PolicyAcceptanceRegister() {
  const { t } = useLanguage();
  const [data, setData] = useState<RegisterResponse | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const pageSize = 50;

  async function load(targetPage = page) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(targetPage), pageSize: String(pageSize) });
      if (search.trim()) params.set("search", search.trim());
      setData(await api.get<RegisterResponse>(`/admin/audit/policy-acceptances?${params.toString()}`));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div>
      {data && (
        <div className="flex gap-8" style={{ flexWrap: "wrap" }}>
          <div className="card" style={{ minWidth: 200 }}>
            <div className="text-muted" style={{ fontSize: 12 }}>
              {t("Versión vigente")}
            </div>
            <strong>{data.currentVersion}</strong>
          </div>
          <div className="card" style={{ minWidth: 200 }}>
            <div className="text-muted" style={{ fontSize: 12 }}>
              {t("Usuarios que aceptaron la versión vigente")}
            </div>
            <strong>{data.acceptedCurrent}</strong>
          </div>
          <div className="card" style={{ minWidth: 200 }}>
            <div className="text-muted" style={{ fontSize: 12 }}>
              {t("Usuarios activos pendientes de aceptar")}
            </div>
            <strong>{data.pendingUsers}</strong>
          </div>
        </div>
      )}

      <div className="flex gap-8 mt-16">
        <input
          placeholder={t("Buscar por código o nombre")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setPage(1);
              void load(1);
            }
          }}
        />
        <button
          className="btn btn-secondary"
          onClick={() => {
            setPage(1);
            void load(1);
          }}
        >
          {t("Filtrar")}
        </button>
      </div>

      <div className="table-wrap mt-16">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("Fecha de aceptación")}</th>
              <th>{t("Código")}</th>
              <th>{t("Usuario")}</th>
              <th>{t("Empresa")}</th>
              <th>{t("Versión")}</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {(data?.acceptances ?? []).map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.acceptedAt).toLocaleString("es-EC")}</td>
                <td>{a.user.code ?? "—"}</td>
                <td>
                  {a.user.firstName} {a.user.lastName}
                </td>
                <td>{a.user.company ?? "—"}</td>
                <td>{a.version}</td>
                <td>{a.ip ?? "—"}</td>
              </tr>
            ))}
            {!loading && data && data.acceptances.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted">
                  {t("Aún no hay aceptaciones registradas.")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex-between mt-16">
        <span className="text-muted" style={{ fontSize: 12 }}>
          {data?.total ?? 0} {t("registros")} · {t("página")} {page} {t("de")} {totalPages}
        </span>
        <div className="flex gap-8">
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t("Anterior")}
          </button>
          <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            {t("Siguiente")}
          </button>
        </div>
      </div>
    </div>
  );
}
