import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useToast } from "../context/ToastContext";
import type { CourseDetail } from "../types";

export function CourseViewPage() {
  const { courseId } = useParams();
  const { notify } = useToast();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await api.get<{ course: CourseDetail }>(`/courses/${courseId}`);
      setCourse(res.course);
      const firstIncomplete = res.course.modules.flatMap((m) => m.lessons).find((l) => !l.completed);
      setActiveLessonId(firstIncomplete?.id ?? res.course.modules[0]?.lessons[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No fue posible cargar la capacitación.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function completeLesson(lessonId: string) {
    if (!courseId) return;
    await api.post(`/courses/${courseId}/lessons/${lessonId}/complete`);
    notify("Lección marcada como completada.", "success");
    await load();
  }

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!course) return <div className="empty-state">Cargando…</div>;

  const activeLesson = course.modules.flatMap((m) => m.lessons).find((l) => l.id === activeLessonId);

  return (
    <div>
      <div className="breadcrumbs">
        <Link to="/">Mi capacitación</Link> / {course.title}
      </div>
      <h2 className="page-title">{course.title}</h2>
      <p className="page-subtitle">{course.description}</p>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }} className="course-layout">
        <div className="card" style={{ alignSelf: "start" }}>
          {course.modules.map((m) => (
            <div key={m.id} className="mt-16">
              <div className="text-secondary" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Módulo {m.order} · {m.title}
              </div>
              {m.lessons.map((l) => (
                <button
                  key={l.id}
                  className="module-item"
                  onClick={() => setActiveLessonId(l.id)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: 10,
                    borderRadius: 8,
                    marginTop: 6,
                    background: activeLessonId === l.id ? "var(--color-bg-subtle)" : "transparent",
                    border: activeLessonId === l.id ? "1px solid var(--color-cyan)" : "1px solid transparent",
                    color: "inherit",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 13 }}>{l.title}</div>
                  <div style={{ fontSize: 11 }} className={l.completed ? "" : "text-muted"}>
                    {l.completed ? <span style={{ color: "var(--color-success)" }}>✓ Completado</span> : "Pendiente"}
                  </div>
                </button>
              ))}
              {m.evaluation && (
                <div className="card mt-8" style={{ padding: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.evaluation.title}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>
                    Intentos: {m.evaluation.attemptsUsed}/{m.evaluation.maxAttempts}
                    {m.evaluation.lastScore !== null && ` · Último puntaje: ${m.evaluation.lastScore}%`}
                  </div>
                  {m.evaluation.lastPassed ? (
                    <span className="badge badge-status-completed mt-8">Aprobado</span>
                  ) : m.evaluation.canAttempt ? (
                    <Link to={`/curso/${course.id}/evaluacion/${m.evaluation.id}`} className="btn btn-primary btn-sm mt-8">
                      Iniciar evaluación
                    </Link>
                  ) : (
                    <span className="badge badge-status-overdue mt-8">Sin intentos disponibles</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="card">
          {!activeLesson && <div className="empty-state">Seleccione una lección para comenzar.</div>}
          {activeLesson && (
            <>
              <span className="badge badge-copper">{activeLesson.contentType}</span>
              <h3 className="mt-8">{activeLesson.title}</h3>

              {(activeLesson.normReference || activeLesson.normCode) && (
                <div className="norma">
                  <strong>Base normativa:</strong> {activeLesson.normReference}
                  {activeLesson.normCode && ` (${activeLesson.normCode}`}
                  {activeLesson.normArticle && `, ${activeLesson.normArticle}`}
                  {activeLesson.normCode && ")"}
                  {activeLesson.normReviewedAt && (
                    <div className="text-muted mt-8" style={{ fontSize: 11 }}>
                      Última revisión normativa: {new Date(activeLesson.normReviewedAt).toLocaleDateString("es-EC")}
                      {activeLesson.normSource && ` · Fuente: ${activeLesson.normSource}`}
                    </div>
                  )}
                </div>
              )}

              {activeLesson.bodyHtml && (
                <section className="content" dangerouslySetInnerHTML={{ __html: activeLesson.bodyHtml }} />
              )}

              {activeLesson.contentType === "IMAGE" && activeLesson.externalUrl && (
                <img src={activeLesson.externalUrl} alt={activeLesson.title} className="lesson-reference-image" />
              )}

              {activeLesson.contentType !== "IMAGE" && activeLesson.externalUrl && (
                <p>
                  <a href={activeLesson.externalUrl} target="_blank" rel="noopener noreferrer">
                    Abrir recurso externo ↗
                  </a>
                </p>
              )}

              <div className="mt-24">
                {activeLesson.completed ? (
                  <span className="badge badge-status-completed">✓ Lección completada</span>
                ) : (
                  <button className="btn btn-primary" onClick={() => completeLesson(activeLesson.id)}>
                    Marcar como completada
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .course-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
