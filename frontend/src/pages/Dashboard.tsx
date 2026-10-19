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

  // Capacitación sugerida para continuar: primero las que ya empezó (la de fecha
  // límite más próxima), luego las que no ha iniciado; las completadas no cuentan.
  const nextCourse = [...(items ?? [])]
    .filter((c) => c.status !== "completed")
    .sort((a, b) => {
      const startedA = a.percent > 0 ? 0 : 1;
      const startedB = b.percent > 0 ? 0 : 1;
      if (startedA !== startedB) return startedA - startedB;
      const dueA = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      const dueB = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
      return dueA - dueB;
    })[0];

  let dueLabel = "";
  if (nextCourse?.dueAt) {
    const days = Math.ceil((new Date(nextCourse.dueAt).getTime() - Date.now()) / 86400000);
    dueLabel =
      days < 0
        ? `${t("Vencida hace")} ${-days} ${t(-days === 1 ? "día" : "días")}`
        : days === 0
          ? t("Vence hoy")
          : `${t("Vence en")} ${days} ${t(days === 1 ? "día" : "días")}`;
  }

  return (
    <div>
      <div className="page-hero">
        <span className="badge badge-copper">{t("Mi capacitación")}</span>
        <h2 className="page-title">{t("Capacitaciones asignadas")}</h2>
        <p className="page-subtitle">{t("Continúa donde quedaste o revisa tu progreso general.")}</p>
      </div>

      {nextCourse && (
        <div className="card continue-card">
          <div>
            <span className="badge badge-copper">{t("Continúa donde quedaste")}</span>
            <div className="course-title mt-8">{nextCourse.title}</div>
            <div className="text-muted" style={{ fontSize: 13 }}>
              {nextCourse.percent}% {t("completado")}
              {dueLabel && ` · ${dueLabel}`}
            </div>
            <ProgressBar percent={nextCourse.percent} />
          </div>
          <Link to={`/curso/${nextCourse.id}`} className="btn btn-primary">
            {nextCourse.percent > 0 ? t("Continuar") : t("Comenzar")} →
          </Link>
        </div>
      )}

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
            <div className="course-thumb" style={course.imageUrl ? { backgroundImage: `url(${course.imageUrl})` } : undefined}>
              {!course.imageUrl && <span className="course-thumb-fallback">🛡️</span>}
            </div>
            <div className="course-card-body">
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
          </div>
        ))}
      </div>
    </div>
  );
}
