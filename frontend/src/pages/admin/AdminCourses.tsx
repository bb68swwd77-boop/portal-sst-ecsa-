import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { Modal } from "../../components/Modal";

interface AdminCourse {
  id: string;
  code: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  durationMin: number;
  _count: { modules: number; assignments: number; certificates: number };
}

const emptyForm = {
  code: "",
  title: "",
  description: "",
  category: "",
  durationMin: 60,
  passingScore: 80,
  maxAttempts: 3,
};

export function AdminCoursesPage() {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await api.get<{ courses: AdminCourse[] }>("/admin/courses");
    setCourses(res.courses);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/admin/courses", form);
      setShowCreate(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No fue posible crear la capacitación.");
    }
  }

  const statusLabel: Record<string, string> = { DRAFT: "Borrador", PUBLISHED: "Publicado", ARCHIVED: "Archivado" };

  return (
    <div>
      <div className="flex-between">
        <div>
          <h2 className="page-title">Capacitaciones</h2>
          <p className="page-subtitle">Gestión de cursos, módulos y evaluaciones SST.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Nueva capacitación
        </button>
      </div>

      <div className="table-wrap mt-16">
        <table className="data-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Título</th>
              <th>Estado</th>
              <th>Duración</th>
              <th>Módulos</th>
              <th>Certificados emitidos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id}>
                <td>{c.code}</td>
                <td>{c.title}</td>
                <td>
                  <span className={`badge badge-status-${c.status === "PUBLISHED" ? "completed" : c.status === "DRAFT" ? "pending" : "overdue"}`}>
                    {statusLabel[c.status]}
                  </span>
                </td>
                <td>{c.durationMin} min</td>
                <td>{c._count.modules}</td>
                <td>{c._count.certificates}</td>
                <td>
                  <Link to={`/admin/capacitaciones/${c.id}`} className="btn-link">
                    Administrar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="Nueva capacitación" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} noValidate>
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="form-row">
              <div className="field">
                <label>Código</label>
                <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SST-XXX-01" />
              </div>
              <div className="field">
                <label>Categoría</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Título</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="field">
              <label>Descripción</label>
              <textarea required rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="field">
                <label>Duración (min)</label>
                <input type="number" min={0} value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })} />
              </div>
              <div className="field">
                <label>Nota mínima (%)</label>
                <input type="number" min={1} max={100} value={form.passingScore} onChange={(e) => setForm({ ...form, passingScore: Number(e.target.value) })} />
              </div>
            </div>
            <div className="field">
              <label>Intentos máximos</label>
              <input type="number" min={1} value={form.maxAttempts} onChange={(e) => setForm({ ...form, maxAttempts: Number(e.target.value) })} />
            </div>
            <button className="btn btn-primary" type="submit">
              Crear capacitación (borrador)
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
