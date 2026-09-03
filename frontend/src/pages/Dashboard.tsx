import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { StatusBadge } from "../components/Badge";
import { ProgressBar } from "../components/ProgressBar";
import { useLanguage } from "../context/LanguageContext";
import type { DashboardCourse, DashboardStats } from "../types";

export function DashboardPage() {
  const { t } = useLanguage();
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
      <span className="badge badge-copper">{t("Mi capacitación")}</span>
      <h2 className="page-title">{t("Capacitaciones asignadas")}</h2>
      <p className="page-subtitle">{t("Continúa donde quedaste o revisa tu progreso general.")}</p>

      {stats && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="value">{stats.overallPercent}%</div>
            <div className="label">{t("Avance general")}</div>
          </div>
          <div className="stat-card">
            <div className="value">{stats.completed}</div>
            <div className="label">{t("Completadas")}</div>
          </div>
          <div className="stat-card">
            <div className="value">{stats.inProgress}</div>
            <div className="label">{t("En progreso")}</div>
          </div>
          <div className="stat-card">
            <div className="value">{stats.overdue}</div>
            <div className="label">{t("Vencidas")}</div>
          </div>
          <div className="stat-card">
            <div className="value">{stats.certificates}</div>
            <div className="label">{t("Certificados")}</div>
          </div>
        </div>
      )}

      {items && items.length === 0 && (
        <div className="empty-state card">
          <h3>{t("No tiene capacitaciones asignadas")}</h3>
          <p>{t("Cuando se le asigne una capacitación aparecerá aquí.")}</p>
        </div>
      )}

      <div className="card-grid">
        {items?.map((course) => (
          <div key={course.id} className="card course-card">
            <div className="flex-between">
              <StatusBadge status={course.status} />
              <span className="text-muted" style={{ fontSize: 12 }}>
                {course.moduleCount} {t(course.moduleCount !== 1 ? "módulos" : "módulo")}
              </span>
            </div>
            <div className="course-title">{course.title}</div>
            <div className="course-desc">{course.description}</div>
            <div className="course-meta">
              <span>⏱ {course.durationMin} min</span>
              {course.dueAt && (
                <span>
                  {t("Vence:")} {new Date(course.dueAt).toLocaleDateString("es-EC")}
                </span>
              )}
            </div>
            <ProgressBar percent={course.percent} label={`${course.percent}% ${t("completado")}`} />
            <Link to={`/curso/${course.id}`} className="btn btn-primary mt-8">
              {course.status === "completed" ? t("Revisar curso") : course.percent > 0 ? t("Continuar") : t("Comenzar")}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
