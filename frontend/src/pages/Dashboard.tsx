import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { StatusBadge } from "../components/Badge";
import { ProgressBar } from "../components/ProgressBar";
import type { DashboardCourse, DashboardStats } from "../types";

export function DashboardPage() {
  const [items, setItems] = useState<DashboardCourse[] | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.get<{ items: DashboardCourse[]; stats: DashboardStats }>("/me/dashboard").then((res) => {
      setItems(res.items);
      setStats(res.stats);
    });
  }, []);

  return (
    <div>
      <span className="badge badge-copper">Mi capacitación</span>
      <h2 className="page-title">Capacitaciones asignadas</h2>
      <p className="page-subtitle">Continúa donde quedaste o revisa tu progreso general.</p>

      {stats && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="value">{stats.overallPercent}%</div>
            <div className="label">Avance general</div>
          </div>
          <div className="stat-card">
            <div className="value">{stats.completed}</div>
            <div className="label">Completadas</div>
          </div>
          <div className="stat-card">
            <div className="value">{stats.inProgress}</div>
            <div className="label">En progreso</div>
          </div>
          <div className="stat-card">
            <div className="value">{stats.overdue}</div>
            <div className="label">Vencidas</div>
          </div>
          <div className="stat-card">
            <div className="value">{stats.certificates}</div>
            <div className="label">Certificados</div>
          </div>
        </div>
      )}

      {items && items.length === 0 && (
        <div className="empty-state card">
          <h3>No tiene capacitaciones asignadas</h3>
          <p>Cuando se le asigne una capacitación aparecerá aquí.</p>
        </div>
      )}

      <div className="card-grid">
        {items?.map((course) => (
          <div key={course.id} className="card course-card">
            <div className="flex-between">
              <StatusBadge status={course.status} />
              <span className="text-muted" style={{ fontSize: 12 }}>
                {course.moduleCount} módulo{course.moduleCount !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="course-title">{course.title}</div>
            <div className="course-desc">{course.description}</div>
            <div className="course-meta">
              <span>⏱ {course.durationMin} min</span>
              {course.dueAt && <span>Vence: {new Date(course.dueAt).toLocaleDateString("es-EC")}</span>}
            </div>
            <ProgressBar percent={course.percent} label={`${course.percent}% completado`} />
            <Link to={`/curso/${course.id}`} className="btn btn-primary mt-8">
              {course.status === "completed" ? "Revisar curso" : course.percent > 0 ? "Continuar" : "Comenzar"}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
