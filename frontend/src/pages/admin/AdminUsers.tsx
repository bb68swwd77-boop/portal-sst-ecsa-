import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../../api/client";
import { Modal } from "../../components/Modal";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  documentId: string | null;
  company: string | null;
  area: string | null;
  position: string | null;
  role: "admin" | "user";
  isActive: boolean;
  isDemo: boolean;
  lastLoginAt: string | null;
}

const emptyForm = {
  email: "",
  firstName: "",
  lastName: "",
  documentId: "",
  company: "",
  area: "",
  position: "",
  roleKey: "user" as "admin" | "user",
};

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [editError, setEditError] = useState<string | null>(null);
  const { notify } = useToast();
  const { user: currentUser } = useAuth();
  const pageSize = 20;

  async function load() {
    const res = await api.get<{ users: AdminUser[]; total: number }>(
      `/admin/users?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(search)}`
    );
    setUsers(res.users);
    setTotal(res.total);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    await load();
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.post<{ temporaryPassword: string }>("/admin/users", form);
      setTempPassword(res.temporaryPassword);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No fue posible crear el usuario.");
    }
  }

  async function toggleActive(id: string) {
    await api.post(`/admin/users/${id}/toggle-active`);
    notify("Estado actualizado.", "success");
    await load();
  }

  async function resetPassword(id: string) {
    const res = await api.post<{ temporaryPassword: string }>(`/admin/users/${id}/reset-password`);
    notify(`Contraseña temporal generada: ${res.temporaryPassword}`, "info");
  }

  function openEdit(u: AdminUser) {
    setEditingUser(u);
    setEditError(null);
    setEditForm({
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      documentId: u.documentId ?? "",
      company: u.company ?? "",
      area: u.area ?? "",
      position: u.position ?? "",
      roleKey: u.role,
    });
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);
    try {
      await api.put(`/admin/users/${editingUser.id}`, editForm);
      notify("Usuario actualizado.", "success");
      setEditingUser(null);
      await load();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "No fue posible actualizar el usuario.");
    }
  }

  return (
    <div>
      <div className="flex-between">
        <div>
          <h2 className="page-title">Usuarios</h2>
          <p className="page-subtitle">Gestión de trabajadores, contratistas y administradores.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Nuevo usuario
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-8 mt-16" style={{ maxWidth: 400 }}>
        <input placeholder="Buscar por nombre, correo o empresa" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn btn-secondary" type="submit">
          Buscar
        </button>
      </form>

      <div className="table-wrap mt-16">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Empresa</th>
              <th>Área</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Último acceso</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.firstName} {u.lastName}
                </td>
                <td>{u.email}</td>
                <td>{u.company ?? "—"}</td>
                <td>{u.area ?? "—"}</td>
                <td>{u.role === "admin" ? "Administrador" : "Capacitado"}</td>
                <td>
                  <span className={`badge badge-status-${u.isActive ? "completed" : "overdue"}`}>
                    {u.isActive ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("es-EC") : "Nunca"}</td>
                <td className="flex gap-8">
                  <button className="btn-link" onClick={() => openEdit(u)}>
                    Editar
                  </button>
                  <button className="btn-link" onClick={() => toggleActive(u.id)}>
                    {u.isActive ? "Desactivar" : "Activar"}
                  </button>
                  <button className="btn-link" onClick={() => resetPassword(u.id)}>
                    Restablecer clave
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex-between mt-16">
        <span className="text-muted" style={{ fontSize: 12 }}>
          {total} usuarios · página {page} de {Math.max(1, Math.ceil(total / pageSize))}
        </span>
        <div className="flex gap-8">
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </button>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= Math.ceil(total / pageSize)}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </button>
        </div>
      </div>

      {showCreate && (
        <Modal
          title="Nuevo usuario"
          onClose={() => {
            setShowCreate(false);
            setTempPassword(null);
            setError(null);
          }}
        >
          {tempPassword ? (
            <div className="alert alert-success">
              Usuario creado. Contraseña temporal: <strong>{tempPassword}</strong>
              <br />
              Compártala de forma segura; el usuario deberá cambiarla en su primer acceso.
            </div>
          ) : (
            <form onSubmit={handleCreate} noValidate>
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="form-row">
                <div className="field">
                  <label>Nombres</label>
                  <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </div>
                <div className="field">
                  <label>Apellidos</label>
                  <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label>Correo electrónico</label>
                <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-row">
                <div className="field">
                  <label>Empresa</label>
                  <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                </div>
                <div className="field">
                  <label>Área</label>
                  <input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <label>Cargo</label>
                  <input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
                </div>
                <div className="field">
                  <label>Rol</label>
                  <select value={form.roleKey} onChange={(e) => setForm({ ...form, roleKey: e.target.value as "admin" | "user" })}>
                    <option value="user">Capacitado / Contratista</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>
              <button className="btn btn-primary" type="submit">
                Crear usuario
              </button>
            </form>
          )}
        </Modal>
      )}

      {editingUser && (
        <Modal title={`Editar usuario — ${editingUser.firstName} ${editingUser.lastName}`} onClose={() => setEditingUser(null)}>
          <form onSubmit={handleEdit} noValidate>
            {editError && <div className="alert alert-danger">{editError}</div>}
            <div className="form-row">
              <div className="field">
                <label>Nombres</label>
                <input required value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
              </div>
              <div className="field">
                <label>Apellidos</label>
                <input required value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Correo electrónico</label>
              <input type="email" required value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div className="field">
              <label>Identificación</label>
              <input value={editForm.documentId} onChange={(e) => setEditForm({ ...editForm, documentId: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="field">
                <label>Empresa</label>
                <input value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} />
              </div>
              <div className="field">
                <label>Área</label>
                <input value={editForm.area} onChange={(e) => setEditForm({ ...editForm, area: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>Cargo</label>
                <input value={editForm.position} onChange={(e) => setEditForm({ ...editForm, position: e.target.value })} />
              </div>
              <div className="field">
                <label>Rol</label>
                <select
                  value={editForm.roleKey}
                  disabled={editingUser.id === currentUser?.id}
                  onChange={(e) => setEditForm({ ...editForm, roleKey: e.target.value as "admin" | "user" })}
                >
                  <option value="user">Capacitado / Contratista</option>
                  <option value="admin">Administrador</option>
                </select>
                {editingUser.id === currentUser?.id && (
                  <div className="field-hint">No puede cambiar su propio rol.</div>
                )}
              </div>
            </div>
            <button className="btn btn-primary" type="submit">
              Guardar cambios
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
