import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import { ProgressBar } from "../components/ProgressBar";
import type { CourseDetail, ModuleDetail } from "../types";

type ModuleState = "done" | "progress" | "pending";

function moduleState(m: ModuleDetail): ModuleState {
  const doneCount = m.lessons.filter((l) => l.completed).length;
  const finished = m.lessons.length > 0 && doneCount === m.lessons.length && (!m.evaluation || m.evaluation.lastPassed);
  if (finished) return "done";
  if (doneCount > 0 || (m.evaluation && m.evaluation.attemptsUsed > 0)) return "progress";
  return "pending";
}

// Pantalla principal de una capacitación: un módulo por tarjeta. Al hacer clic se
// abre la página del módulo (/curso/:courseId/modulo/:moduleId) con sus lecciones.
export function CourseViewPage() {
  const { courseId } = useParams();
  const { t } = useLanguage();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    api
      .get<{ course: CourseDetail }>(`/courses/${courseId}`)
      .then((res) => setCourse(res.course))
      .catch((err) => setError(err instanceof ApiError ? t(err.message) : t("No fue posible cargar la capacitación.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  if (error) return <div className="alert alert-danger" role="alert">{error}</div>;
  if (!course) return <div className="empty-state">{t("Cargando…")}</div>;

  // Primer módulo con algo pendiente (lecciones o evaluación): "Continuar donde quedaste".
  const resumeModule = course.modules.find((m) => moduleState(m) !== "done");

  return (
    <div>
      <div className="breadcrumbs">
        <Link to="/portal">{t("Mi capacitación")}</Link> / {course.title}
      </div>
      <h2 className="page-title">{course.title}</h2>
      <p className="page-subtitle">{course.description}</p>
      <ProgressBar percent={course.percent} label={`${course.percent}% ${t("completado")}`} />

      {resumeModule && (
        <div className="mt-16">
          <Link to={`/curso/${course.id}/modulo/${resumeModule.id}`} className="btn btn-primary">
            {t("Continuar donde quedaste")} →
          </Link>
        </div>
      )}

      <div className="module-grid mt-16">
        {course.modules.map((m) => {
          const state = moduleState(m);
          const doneCount = m.lessons.filter((l) => l.completed).length;
          const percent = m.lessons.length ? Math.round((doneCount / m.lessons.length) * 100) : 0;
          return (
            <Link
              key={m.id}
              to={`/curso/${course.id}/modulo/${m.id}`}
              className={`module-tile ${state}`}
              aria-label={`${t("Módulo")} ${m.order}: ${m.title}`}
            >
              <span className="module-tile-top">
                <span className="module-number">{state === "done" ? "✓" : m.order}</span>
                <span className={`badge ${state === "done" ? "badge-status-completed" : state === "progress" ? "badge-status-in_progress" : "badge-status-pending"}`}>
                  {state === "done" ? t("Completado") : state === "progress" ? t("En curso") : t("Pendiente")}
                </span>
              </span>
              <span className="module-tile-title">{m.title}</span>
              <span className="module-tile-meta">
                {t("Módulo")} {m.order} · {doneCount}/{m.lessons.length} {t("Lecciones")}
              </span>
              <ProgressBar percent={percent} />
              <span className="module-tile-foot">
                {m.evaluation ? (
                  m.evaluation.lastPassed ? (
                    <span className="module-tile-eval ok">✓ {t("Evaluación aprobada")}</span>
                  ) : (
                    <span className="module-tile-eval">
                      {t("Evaluación")}: {m.evaluation.attemptsUsed}/{m.evaluation.maxAttempts} {t("Intentos").toLowerCase()}
                    </span>
                  )
                ) : (
                  <span />
                )}
                <span className="module-tile-open">{t("Abrir módulo")} →</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
