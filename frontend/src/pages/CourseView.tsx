import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, apiUrl, ApiError } from "../api/client";
import { useToast } from "../context/ToastContext";
import { useLanguage } from "../context/LanguageContext";
import { extractYouTubeId, YouTubePlayer } from "../components/YouTubePlayer";
import type { CourseDetail } from "../types";

export function CourseViewPage() {
  const { courseId } = useParams();
  const { notify } = useToast();
  const { t } = useLanguage();
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
      setError(err instanceof ApiError ? t(err.message) : t("No fue posible cargar la capacitación."));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function completeLesson(lessonId: string) {
    if (!courseId) return;
    await api.post(`/courses/${courseId}/lessons/${lessonId}/complete`);
    notify(t("Lección marcada como completada."), "success");
    await load();
  }

  // Heartbeat de video (cada ~10s y al terminar) — actualiza el estado local
  // sin recargar todo el curso, para no interrumpir la reproducción. El
  // servidor decide cuándo queda "completado" (nunca el cliente).
  async function handleVideoProgress(lessonId: string, percent: number) {
    if (!courseId) return;
    try {
      const res = await api.post<{ percentWatched: number; completed: boolean }>(
        `/courses/${courseId}/lessons/${lessonId}/video-progress`,
        { percentWatched: percent }
      );
      setCourse((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          modules: prev.modules.map((m) => ({
            ...m,
            lessons: m.lessons.map((l) =>
              l.id === lessonId ? { ...l, percentWatched: res.percentWatched, completed: res.completed } : l
            ),
          })),
        };
      });
    } catch {
      // Un heartbeat fallido no debe interrumpir la reproducción del video.
    }
  }

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!course) return <div className="empty-state">{t("Cargando…")}</div>;

  const activeLesson = course.modules.flatMap((m) => m.lessons).find((l) => l.id === activeLessonId);

  return (
    <div>
      <div className="breadcrumbs">
        <Link to="/portal">{t("Mi capacitación")}</Link> / {course.title}
      </div>
      <h2 className="page-title">{course.title}</h2>
      <p className="page-subtitle">{course.description}</p>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }} className="course-layout">
        <div className="card" style={{ alignSelf: "start" }}>
          {course.modules.map((m) => (
            <div key={m.id} className="mt-16">
              <div className="text-secondary" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {t("Módulo")} {m.order} · {m.title}
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
                    {l.completed ? <span style={{ color: "var(--color-success)" }}>✓ {t("Completado")}</span> : t("Pendiente")}
                  </div>
                </button>
              ))}
              {m.evaluation && (
                <div className="card mt-8" style={{ padding: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.evaluation.title}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>
                    {t("Intentos:")} {m.evaluation.attemptsUsed}/{m.evaluation.maxAttempts}
                    {m.evaluation.lastScore !== null && ` · ${t("Último puntaje:")} ${m.evaluation.lastScore}%`}
                  </div>
                  {m.evaluation.lastPassed ? (
                    <span className="badge badge-status-completed mt-8">{t("Aprobado")}</span>
                  ) : m.evaluation.canAttempt ? (
                    <Link to={`/curso/${course.id}/evaluacion/${m.evaluation.id}`} className="btn btn-primary btn-sm mt-8">
                      {t("Iniciar evaluación")}
                    </Link>
                  ) : (
                    <span className="badge badge-status-overdue mt-8">{t("Sin intentos disponibles")}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="card">
          {!activeLesson && <div className="empty-state">{t("Seleccione una lección para comenzar.")}</div>}
          {activeLesson && (
            <>
              <span className="badge badge-copper">{activeLesson.contentType}</span>
              <h3 className="mt-8">{activeLesson.title}</h3>

              {(activeLesson.normReference || activeLesson.normCode) && (
                <div className="norma">
                  <strong>{t("Base normativa:")}</strong> {activeLesson.normReference}
                  {activeLesson.normCode && ` (${activeLesson.normCode}`}
                  {activeLesson.normArticle && `, ${activeLesson.normArticle}`}
                  {activeLesson.normCode && ")"}
                  {activeLesson.normReviewedAt && (
                    <div className="text-muted mt-8" style={{ fontSize: 11 }}>
                      {t("Última revisión normativa:")} {new Date(activeLesson.normReviewedAt).toLocaleDateString("es-EC")}
                      {activeLesson.normSource && ` · ${t("Fuente:")} ${activeLesson.normSource}`}
                    </div>
                  )}
                </div>
              )}

              {activeLesson.bodyHtml && (
                <section className="content" dangerouslySetInnerHTML={{ __html: activeLesson.bodyHtml }} />
              )}

              {activeLesson.file && (
                <p>
                  <a href={apiUrl(`/files/${activeLesson.file.id}`)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                    📄 {t("Descargar")} {activeLesson.file.filename} ({Math.round(activeLesson.file.sizeBytes / 1024)} KB)
                  </a>
                </p>
              )}

              {activeLesson.files.length > 0 && (
                <div className="flex gap-8" style={{ flexWrap: "wrap" }}>
                  {activeLesson.files.map((f) => (
                    <a
                      key={f.id}
                      href={apiUrl(`/files/${f.id}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                    >
                      📄 {t("Descargar")} {f.filename} ({Math.round(f.sizeBytes / 1024)} KB)
                    </a>
                  ))}
                </div>
              )}

              {activeLesson.contentType === "VIDEO" && activeLesson.externalUrl && extractYouTubeId(activeLesson.externalUrl) ? (
                <YouTubePlayer
                  key={activeLesson.id}
                  videoId={extractYouTubeId(activeLesson.externalUrl)!}
                  onProgress={(percent) => handleVideoProgress(activeLesson.id, percent)}
                />
              ) : (
                activeLesson.externalUrl && (
                  <p>
                    <a href={activeLesson.externalUrl} target="_blank" rel="noopener noreferrer">
                      {t("Abrir recurso externo")} ↗
                    </a>
                  </p>
                )
              )}

              <div className="mt-24">
                {activeLesson.completed ? (
                  <span className="badge badge-status-completed">✓ {t("Lección completada")}</span>
                ) : activeLesson.contentType === "VIDEO" ? (
                  <p className="text-muted" style={{ fontSize: 12 }}>
                    {activeLesson.percentWatched ? `${activeLesson.percentWatched}% ${t("visto")} · ` : ""}
                    {t("Se marca como completada automáticamente al terminar de ver el video.")}
                  </p>
                ) : (
                  <button className="btn btn-primary" onClick={() => completeLesson(activeLesson.id)}>
                    {t("Marcar como completada")}
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
