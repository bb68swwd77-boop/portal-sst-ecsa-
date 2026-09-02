import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logoEcsa from "../assets/logo-ecsa.png";

const USER_LINKS = [
  { to: "/", label: "Mi capacitación", end: true },
  { to: "/certificados", label: "Mis certificados" },
  { to: "/perfil", label: "Mi perfil" },
];

const ADMIN_LINKS = [
  { to: "/admin", label: "Panel administrativo", end: true },
  { to: "/admin/usuarios", label: "Usuarios" },
  { to: "/admin/capacitaciones", label: "Capacitaciones" },
  { to: "/admin/reportes", label: "Reportes" },
  { to: "/admin/auditoria", label: "Auditoría" },
];

const COLLAPSE_STORAGE_KEY = "ecsa-sidebar-collapsed";

export function Layout() {
  const { user, logout, hasPermission } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const navigate = useNavigate();

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // localStorage puede no estar disponible (modo privado); no es crítico.
    }
  }, [collapsed]);

  const isAdmin = hasPermission("courses:view");
  const links = isAdmin ? ADMIN_LINKS : USER_LINKS;

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <div className={`sidebar-scrim ${drawerOpen ? "open" : ""}`} onClick={() => setDrawerOpen(false)} />

      <button
        type="button"
        className={`sidebar-collapse-toggle ${collapsed ? "collapsed" : ""}`}
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? "Mostrar menú" : "Ocultar menú"}
        title={collapsed ? "Mostrar menú" : "Ocultar menú"}
      >
        {collapsed ? "›" : "‹"}
      </button>

      <aside className={`sidebar ${drawerOpen ? "open" : ""} ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-brand">
          <img src={logoEcsa} alt="ECSA" className="sidebar-logo" />
          <p>Capacitación SST — Contratistas</p>
        </div>
        <nav className="sidebar-nav">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
              onClick={() => setDrawerOpen(false)}
            >
              {l.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink to="/" className="sidebar-link" style={{ marginTop: 12 }} onClick={() => setDrawerOpen(false)}>
              ← Ir al portal del capacitado
            </NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            {user?.firstName} {user?.lastName}
            <br />
            <span className="text-muted">{user?.email}</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout} style={{ width: "100%" }}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className={`main-area ${collapsed ? "sidebar-collapsed" : ""}`}>
        <div className="topbar">
          <button className="btn btn-secondary btn-sm" onClick={() => setDrawerOpen((v) => !v)} aria-label="Abrir menú">
            ☰
          </button>
          <img src={logoEcsa} alt="ECSA" className="topbar-logo" />
          <strong>Capacitación SST</strong>
        </div>
        <div className="main-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
