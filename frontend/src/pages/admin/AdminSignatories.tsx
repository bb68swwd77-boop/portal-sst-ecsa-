import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../../api/client";
import { Modal } from "../../components/Modal";
import { useToast } from "../../context/ToastContext";

interface Signatory {
  id: string;
  name: string;
  position: string;
  isActive: boolean;
  createdAt: string;
}

const emptyForm = { name: "", position: "", isActive: true };

export function AdminSignatoriesPage() {
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const { notify } = useToast();

  async function load() {
    const res = await api.get<{ signatories: Signatory[] }>("/admin/signatories");
    setSignatories(res.signatories);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/admin/signatories", form);
      setShowCreate(false);
      setForm(emptyForm);
      notify("Firmante creado.", "success");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No fue posible crear el firmante.");
    }
  }

  async function activate(id: string) {
    await api.put(`/admin/signatories/${id}`, { isActive: true });
    notify("Firmante activo actualizado.", "success");
    await load();
  }

  return (
    <div>
      <div className="flex-between">
        <div>
          <h2 className="page-title">Firmantes</h2>
          <p className="page-subtitle">
            Firma institucional que aparece en los certificados — nunca los datos del participante. Solo puede haber un
            firmante activo a la vez.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Nuevo firmante
        </button>
      </div>

      <div className="table-wrap mt-16">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Cargo</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {signatories.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.position}</td>
                <td>
                  <span className={`badge badge-status-${s.isActive ? "completed" : "pending"}`}>
                    {s.isActive ? "Activo (en uso)" : "Inactivo"}
                  </span>
                </td>
                <td>
                  {!s.isActive && (
                    <button className="btn-link" onClick={() => activate(s.id)}>
                      Activar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {signatories.length === 0 && <div className="empty-state card mt-16">No hay firmantes registrados.</div>}

      {showCreate && (
        <Modal title="Nuevo firmante" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} noValidate>
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="field">
              <label>Nombre completo</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ing. María López" />
            </div>
            <div className="field">
              <label>Cargo</label>
              <input
                required
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                placeholder="Responsable SSO"
              />
            </div>
            <label className="field option-row">
              <input type="checkbox" className="option-toggle" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Usar como firmante activo (reemplaza al actual)
            </label>
            <button className="btn btn-primary" type="submit">
              Crear firmante
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
