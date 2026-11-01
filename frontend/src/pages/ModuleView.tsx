import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, apiUrl, ApiError } from "../api/client";
import { useToast } from "../context/ToastContext";
import { useLanguage } from "../context/LanguageContext";
import { extractYouTubeId, YouTubePlayer } from "../components/YouTubePlayer";
import { ProgressBar } from "../components/ProgressBar";
import type { CourseDetail } from "../types";

// Segundos que se pide dejar pasar tras abrir un documento antes de poder marcar
// la lección como completada (el servidor exige 10; aquí 15 para tener margen).
const DOCUMENT_REVIEW_SECONDS = 15;

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Página de un módulo: sus lecciones a la izquierda y el contenido de la lección
// elegida a la derecha. Se llega desde la tarjeta del módulo en /curso/:courseId.
export function ModuleViewPage() {
  const { courseId, moduleId } = useParams();
  const { notify } = useToast();
  const { t } = useLanguage();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Momento (ms) en que se hizo clic en cada documento durante esta visita: el
  // botón "Marcar como completada" espera unos segundos después de abrirlo.
  const [openedAt, setOpenedAt] = useState<Record<string, number>>({});
  const [, setClockTick] = useState(0);
  const lessonCardRef = useRef<HTMLDivElement>(null);

  // keepActive: recarga el progreso sin mover al usuario de la lección que está viendo.
  async function load(keepActive = false): Promise<CourseDetail | null> {
    try {
      const res = await api.get<{ course: CourseDetail }>(`/courses/${courseId}`);
      setCourse(res.course);
      const mod = res.course.modules.find((m) => m.id === moduleId);
      if (!mod) {
        setError(t("Módulo no encontrado."));
        return null;
      }
      if (keepActive && activeLessonId && mod.lessons.some((l) => l.id === activeLessonId)) return res.course;
      const firstIncomplete = mod.lessons.find((l) => !l.completed);
      setActiveLessonId(firstIncomplete?.id ?? mod.lessons[0]?.id ?? null);
      return res.course;
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("No fue posible cargar la capacitación."));
      return null;
    }
  }

  useEffect(() => {
    window.scrollTo(0, 0);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, moduleId]);

  // Mientras corre la espera mínima tras abrir un documento, refresca la pantalla
  // cada segundo (cuenta regresiva del botón) y se detiene al terminar.
  useEffect(() => {
    if (Object.keys(openedAt).length === 0) return;
    const interval = window.setInterval(() => setClockTick((x) => x + 1), 1000);
    const stop = window.setTimeout(() => window.clearInterval(interval), (DOCUMENT_REVIEW_SECONDS + 1) * 1000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(stop);
    };
  }, [openedAt]);

  async function completeLesson(lessonId: string) {
    if (!courseId) return;
    try {
      await api.post(`/courses/${courseId}/lessons/${lessonId}/complete`);
      notify(t("Lección marcada como completada."), "success");
      const fresh = await load(true);
      if (!fresh) return;
      // Avanza a la siguiente lección del módulo, salvo que esta haya sido la última
      // y la evaluación ya esté disponible: ahí se queda para mostrar el aviso con el
      // botón "Iniciar evaluación".
      const mod = fresh.modules.find((m) => m.id === moduleId);
      if (!mod) return;
      const idx = mod.lessons.findIndex((l) => l.id === lessonId);
      const ev = mod.evaluation;
      const evaluationNowReady = Boolean(ev && ev.canAttempt && !ev.lastPassed && ev.pendingLessons === 0);
      const next = idx >= 0 ? mod.lessons[idx + 1] : undefined;
      if (!evaluationNowReady && next) focusLesson(next.id);
    } catch (err) {
      notify(err instanceof ApiError ? t(err.message) : t("No fue posible completar la lección."), "danger");
    }
  }

  // Muestra una lección y, en pantallas angostas, lleva la vista al contenido: la
  // lista queda arriba y la lección debajo.
  function focusLesson(lessonId: string) {
    setActiveLessonId(lessonId);
    if (window.innerWidth <= 900) {
      window.setTimeout(() => lessonCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  }

  // El servidor registra la apertura del documento al servirlo; aquí se marca el
  // clic para la espera mínima y se refresca el progreso sin cambiar de lección.
  function handleDocumentOpened(fileId: string) {
    setOpenedAt((prev) => ({ ...prev, [fileId]: Date.now() }));
    window.setTimeout(() => void load(true), 2500);
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
      // Si esta llamada recién completó la lección, puede haber habilitado la
      // evaluación: se recarga el curso (el video ya terminó, no se corta nada) y se
      // deja al usuario en la lección para que vea el aviso.
      if (res.completed && !wasCompleted) {
        await load(true);
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

  if (error) {
    return (
      <div>
        <div className="alert alert-danger" role="alert">{error}</div>
        <Link to={`/curso/${courseId}`} className="btn btn-secondary">
          {t("Volver a los módulos")}
        </Link>
      </div>
    );
  }
  if (!course) return <div className="empty-state">{t("Cargando…")}</div>;

  const moduleIndex = course.modules.findIndex((m) => m.id === moduleId);
  const mod = course.modules[moduleIndex];
  if (!mod) return <div className="empty-state">{t("Módulo no encontrado.")}</div>;
  const nextModule = course.modules[moduleIndex + 1] ?? null;

  const lessons = mod.lessons;
  const doneCount = lessons.filter((l) => l.completed).length;
  const lessonsPercent = lessons.length ? Math.round((doneCount / lessons.length) * 100) : 0;
  const activeLesson = lessons.find((l) => l.id === activeLessonId);
  const activeIndex = lessons.findIndex((l) => l.id === activeLessonId);
  const prevLesson = activeIndex > 0 ? lessons[activeIndex - 1] : null;
  const nextLesson = activeIndex >= 0 && activeIndex < lessons.length - 1 ? lessons[activeIndex + 1] : null;
  const activeFiles = activeLesson ? [...(activeLesson.file ? [activeLesson.file] : []), ...activeLesson.files] : [];
  const lastOpenedAt = Math.max(0, ...activeFiles.map((f) => openedAt[f.id] ?? 0));
  const reviewSecondsLeft = lastOpenedAt
    ? Math.max(0, DOCUMENT_REVIEW_SECONDS - Math.floor((Date.now() - lastOpenedAt) / 1000))
    : 0;
  const documentsPending = activeLesson?.documentsPending ?? 0;
  // La evaluación del módulo ya se puede rendir (todas las lecciones completas).
  const evaluationReady = Boolean(
    mod.evaluation && mod.evaluation.canAttempt && !mod.evaluation.lastPassed && mod.evaluation.pendingLessons === 0
  );
  // Módulo terminado: todas las lecciones y, si la tiene, la evaluación aprobada.
  const moduleFinished = lessons.length > 0 && doneCount === lessons.length && (!mod.evaluation || mod.evaluation.lastPassed);

  return (
    <div>
      <div className="breadcrumbs">
        <Link to="/portal">{t("Mi capacitación")}</Link> / <Link to={`/curso/${course.id}`}>{course.title}</Link> /{" "}
        {t("Módulo")} {mod.order}
      </div>
      <h2 className="page-title">{mod.title}</h2>
      <ProgressBar percent={lessonsPercent} label={`${doneCount}/${lessons.length} ${t("Lecciones")}`} />

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24, marginTop: 16 }} className="course-layout">
        <div className="lesson-panel">
          <Link to={`/curso/${course.id}`} className="btn btn-secondary btn-sm lesson-panel-back">
            ← {t("Volver a los módulos")}
          </Link>
          <div className="lesson-panel-title">{t("Lecciones del módulo")}</div>
          {lessons.map((l) => (
            <button
              key={l.id}
              className={`module-item ${activeLessonId === l.id ? "active" : ""}`}
              aria-current={activeLessonId === l.id ? "true" : undefined}
              onClick={() => focusLesson(l.id)}
            >
              <span className={`lesson-dot ${l.completed ? "done" : ""}`}>{l.completed ? "✓" : ""}</span>
              <span>
                <span className="lesson-title">{l.title}</span>
                <span className={`lesson-status ${l.completed ? "done" : ""}`}>{l.completed ? t("Completado") : t("Pendiente")}</span>
              </span>
            </button>
          ))}
          {mod.evaluation && (
            <div className="module-eval">
              <div style={{ fontSize: 14, fontWeight: 600 }}>{mod.evaluation.title}</div>
              <div className="text-muted" style={{ fontSize: 13 }}>
                {t("Intentos:")} {mod.evaluation.attemptsUsed}/{mod.evaluation.maxAttempts}
                {mod.evaluation.lastScore !== null && ` · ${t("Último puntaje:")} ${mod.evaluation.lastScore}%`}
              </div>
              {mod.evaluation.lastPassed ? (
                <span className="badge badge-status-completed mt-8">{t("Aprobado")}</span>
              ) : mod.evaluation.canAttempt && mod.evaluation.pendingLessons > 0 ? (
                <>
                  <button type="button" className="btn btn-primary btn-sm mt-8" disabled>
                    🔒 {t("Iniciar evaluación")}
                  </button>
                  <div className="text-muted mt-8" style={{ fontSize: 13 }}>
                    {t("Complete todas las lecciones del módulo para habilitar la evaluación.")} ({mod.evaluation.pendingLessons}{" "}
                    {t("pendientes")})
                  </div>
                </>
              ) : mod.evaluation.canAttempt ? (
                <Link to={`/curso/${course.id}/evaluacion/${mod.evaluation.id}`} className="btn btn-primary btn-sm mt-8">
                  {t("Iniciar evaluación")}
                </Link>
              ) : (
                <span className="badge badge-status-overdue mt-8">{t("Sin intentos disponibles")}</span>
              )}
            </div>
          )}
        </div>

        <div className="card" ref={lessonCardRef}>
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
                    <div className="text-muted mt-8" style={{ fontSize: 13 }}>
                      {t("Última revisión normativa:")} {new Date(activeLesson.normReviewedAt).toLocaleDateString("es-EC")}
                      {activeLesson.normSource && ` · ${t("Fuente:")} ${activeLesson.normSource}`}
                    </div>
                  )}
                </div>
              )}

              {activeLesson.bodyHtml && (
                <section className="content" dangerouslySetInnerHTML={{ __html: activeLesson.bodyHtml }} />
              )}

              {(activeLesson.file || activeLesson.files.length > 0 || activeLesson.links.length > 0) && (
                <div className="doc-section">
                  <div className="doc-section-title">
                    {activeLesson.links.length === 0
                      ? t("Documentos para descargar")
                      : activeFiles.length === 0
                        ? t("Videos de la lección")
                        : t("Documentos y videos")}
                  </div>
                  <div className="doc-grid">
                    {activeFiles.map((f) => (
                      <a
                        key={f.id}
                        href={apiUrl(`/files/${f.id}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="doc-tile"
                        onClick={() => handleDocumentOpened(f.id)}
                      >
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
                    {activeLesson.links.map((lk) => {
                      const ytId = extractYouTubeId(lk.url);
                      return (
                        <a key={lk.id} href={lk.url} target="_blank" rel="noopener noreferrer" className="doc-tile video-tile">
                          <span className="video-thumb" aria-hidden="true">
                            {ytId && <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" loading="lazy" />}
                            <span className="video-play">▶</span>
                          </span>
                          <span className="doc-info">
                            <span className="doc-name">{lk.title}</span>
                            <span className="doc-size">{t("Video")} · {safeHost(lk.url)}</span>
                          </span>
                          <span className="doc-download video-open">▶ {t("Ver video")}</span>
                        </a>
                      );
                    })}
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
                  <p className="text-muted" style={{ fontSize: 13 }}>
                    {activeLesson.percentWatched ? `${activeLesson.percentWatched}% ${t("visto")} · ` : ""}
                    {t("Se marca como completada automáticamente al terminar de ver el video.")}
                  </p>
                ) : (
                  <>
                    <button
                      className="btn btn-primary"
                      onClick={() => completeLesson(activeLesson.id)}
                      disabled={documentsPending > 0 || reviewSecondsLeft > 0}
                    >
                      {documentsPending > 0 || reviewSecondsLeft > 0 ? "🔒 " : ""}
                      {t("Marcar como completada")}
                    </button>
                    {documentsPending > 0 && (
                      <p className="text-muted mt-8" style={{ fontSize: 14 }}>
                        {t("Abra y revise los documentos de la lección para poder completarla.")} ({documentsPending}{" "}
                        {t("pendientes")})
                      </p>
                    )}
                    {documentsPending === 0 && reviewSecondsLeft > 0 && (
                      <p className="text-muted mt-8" style={{ fontSize: 14 }}>
                        {t("Revise el documento: podrá marcar la lección como completada en")} {reviewSecondsLeft} {t("segundos")}.
                      </p>
                    )}
                  </>
                )}
              </div>

              {activeLesson.completed && evaluationReady && mod.evaluation && (
                <div className="alert alert-success mt-16">
                  <strong>{t("¡Terminó las lecciones de este módulo!")}</strong> {t("Ya puede rendir la evaluación.")}
                  <div className="mt-8">
                    <Link to={`/curso/${course.id}/evaluacion/${mod.evaluation.id}`} className="btn btn-primary btn-sm">
                      {t("Iniciar evaluación")}
                    </Link>
                  </div>
                </div>
              )}

              {moduleFinished && (
                <div className="alert alert-success mt-16">
                  <strong>{t("Módulo completado.")}</strong>
                  <div className="mt-8">
                    {nextModule ? (
                      <Link to={`/curso/${course.id}/modulo/${nextModule.id}`} className="btn btn-primary btn-sm">
                        {t("Ir al siguiente módulo")} →
                      </Link>
                    ) : (
                      <Link to={`/curso/${course.id}`} className="btn btn-primary btn-sm">
                        {t("Volver a los módulos")}
                      </Link>
                    )}
                  </div>
                </div>
              )}

              <div className="lesson-nav mt-24">
                <button type="button" className="btn btn-secondary btn-sm" disabled={!prevLesson} onClick={() => prevLesson && focusLesson(prevLesson.id)}>
                  ← {t("Anterior")}
                </button>
                <span className="text-muted" style={{ fontSize: 13 }}>
                  {t("Lección")} {activeIndex + 1}/{lessons.length}
                </span>
                <button type="button" className="btn btn-secondary btn-sm" disabled={!nextLesson} onClick={() => nextLesson && focusLesson(nextLesson.id)}>
                  {t("Siguiente")} →
                </button>
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
