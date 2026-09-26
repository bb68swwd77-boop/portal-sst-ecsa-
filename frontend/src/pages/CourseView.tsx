import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, apiUrl, ApiError } from "../api/client";
import { useToast } from "../context/ToastContext";
import { useLanguage } from "../context/LanguageContext";
import { extractYouTubeId, YouTubePlayer } from "../components/YouTubePlayer";
import { ProgressBar } from "../components/ProgressBar";
import type { CourseDetail } from "../types";

export function CourseViewPage() {
  const { courseId } = useParams();
  const { notify } = useToast();
  const { t } = useLanguage();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Módulos desplegados en el acordeón — por defecto solo el que contiene la
  // lección activa, para no ocupar todo el espacio vertical del panel.
  const [expandedModuleIds, setExpandedModuleIds] = useState<Set<string>>(new Set());

  function toggleModule(moduleId: string) {
    setExpandedModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }

  async function load() {
    try {
      const res = await api.get<{ course: CourseDetail }>(`/courses/${courseId}`);
      setCourse(res.course);
      const firstIncomplete = res.course.modules.flatMap((m) => m.lessons).find((l) => !l.completed);
      const nextActiveLessonId = firstIncomplete?.id ?? res.course.modules[0]?.lessons[0]?.id ?? null;
      setActiveLessonId(nextActiveLessonId);
      const activeModule = res.course.modules.find((m) => m.lessons.some((l) => l.id === nextActiveLessonId));
      setExpandedModuleIds(activeModule ? new Set([activeModule.id]) : new Set());
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
      const wasCompleted = course?.modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId)?.completed ?? false;
      const res = await api.post<{ percentWatched: number; completed: boolean }>(
        `/courses/${courseId}/lessons/${lessonId}/video-progress`,
        { percentWatched: percent }
      );
      // Si esta llamada recién completó la lección, puede haber desbloqueado
      // el siguiente módulo — recargamos el curso completo para reflejar ese
      // cambio (el video ya terminó, así que no hay reproducción que cortar).
      if (res.completed && !wasCompleted) {
        await load();
        return;
      }
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
      <ProgressBar percent={course.percent} label={`${course.percent}% ${t("completado")}`} />

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24, marginTop: 16 }} className="course-layout">
        <div className="module-list">
          {course.modules.map((m) => {
            const expanded = expandedModuleIds.has(m.id);
            const doneCount = m.lessons.filter((l) => l.completed).length;
            const allDone = m.lessons.length > 0 && doneCount === m.lessons.length && (!m.evaluation || m.evaluation.lastPassed);
            return (
              <div key={m.id} className={`module-card ${expanded ? "expanded" : ""} ${allDone ? "done" : ""}`}>
                <button type="button" className="module-card-header" onClick={() => toggleModule(m.id)} aria-expanded={expanded}>
                  <span className="module-number">{allDone ? "✓" : m.order}</span>
                  <span className="module-card-text">
                    <span className="module-card-title">{m.title}</span>
                    <span className="module-card-meta">
                      {t("Módulo")} {m.order} · {doneCount}/{m.lessons.length} {t("Lecciones")}
                    </span>
                  </span>
                  <span className="module-chevron">{expanded ? "▲" : "▼"}</span>
                </button>
                {expanded && (
                  <div className="module-card-body">
                    {m.lessons.map((l) => (
                      <button
                        key={l.id}
                        className={`module-item ${activeLessonId === l.id ? "active" : ""}`}
                        onClick={() => setActiveLessonId(l.id)}
                      >
                        <span className={`lesson-dot ${l.completed ? "done" : ""}`}>{l.completed ? "✓" : ""}</span>
                        <span>
                          <span className="lesson-title">{l.title}</span>
                          <span className={`lesson-status ${l.completed ? "done" : ""}`}>{l.completed ? t("Completado") : t("Pendiente")}</span>
                        </span>
                      </button>
                    ))}
                    {m.evaluation && (
                      <div className="module-eval">
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
                )}
              </div>
            );
          })}
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

              {(activeLesson.file || activeLesson.files.length > 0) && (
                <div className="doc-section">
                  <div className="doc-section-title">{t("Documentos para descargar")}</div>
                  <div className="doc-grid">
                    {[...(activeLesson.file ? [activeLesson.file] : []), ...activeLesson.files].map((f) => (
                      <a key={f.id} href={apiUrl(`/files/${f.id}`)} target="_blank" rel="noopener noreferrer" className="doc-tile">
                        <span className="doc-icon" aria-hidden="true">
                          <svg viewBox="0 0 40 48" width="34" height="41">
                            <path d="M4 0h22l14 14v30a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4z" fill="#e5392b" />
                            <path d="M26 0l14 14H30a4 4 0 0 1-4-4z" fill="#a82015" />
                            <text x="20" y="38" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff" fontFamily="Arial, sans-serif">PDF</text>
                          </svg>
                        </span>
                        <span className="doc-info">
                          <span className="doc-name">{f.filename}</span>
                          <span className="doc-size">PDF · {Math.round(f.sizeBytes / 1024)} KB</span>
                        </span>
                        <span className="doc-download">⬇ {t("Descargar")}</span>
                      </a>
                    ))}
                  </div>
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
