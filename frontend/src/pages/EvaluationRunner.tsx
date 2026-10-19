import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import { Modal } from "../components/Modal";
import { ProgressBar } from "../components/ProgressBar";
import type { AttemptQuestion, AttemptSession } from "../types";

interface AnswerState {
  selectedOptionIds?: string[];
  shortAnswerText?: string;
}

interface SubmitResult {
  score: number;
  passed: boolean;
  certificateIssued: boolean;
  certificateCode?: string;
  showCorrectAnswers?: boolean;
  correctAnswers?: Record<string, string[]>;
}

type SaveState = "idle" | "saving" | "saved" | "error";

function isAnswered(q: AttemptQuestion, a: AnswerState | undefined) {
  if (q.type === "SHORT_ANSWER") return Boolean(a?.shortAnswerText?.trim());
  return (a?.selectedOptionIds?.length ?? 0) > 0;
}

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function EvaluationRunnerPage() {
  const { courseId, evaluationId } = useParams();
  const { t } = useLanguage();
  const [session, setSession] = useState<AttemptSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Refs: los temporizadores y los manejadores de eventos del navegador necesitan
  // ver siempre el valor más reciente sin volver a registrarse en cada cambio.
  const sessionRef = useRef<AttemptSession | null>(null);
  sessionRef.current = session;
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const lastSavedRef = useRef("{}");
  const submittedRef = useRef(false);
  const autoSubmittedRef = useRef(false);
  const clockSkewRef = useRef(0);

  // Inicia o reanuda el intento. También se usa para "Reintentar" tras un intento no aprobado.
  const loadAttempt = useCallback(async () => {
    if (!evaluationId) return;
    setSession(null);
    setResult(null);
    setError(null);
    setShowMissing(false);
    setConfirmOpen(false);
    setSaveState("idle");
    submittedRef.current = false;
    autoSubmittedRef.current = false;
    try {
      const res = await api.post<{ attempt: AttemptSession }>(`/evaluations/${evaluationId}/start`);
      const draft = res.attempt.draftAnswers ?? {};
      lastSavedRef.current = JSON.stringify(draft);
      clockSkewRef.current = new Date(res.attempt.serverNow).getTime() - Date.now();
      setAnswers(draft);
      setSession(res.attempt);
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("No fue posible iniciar la evaluación."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluationId]);

  useEffect(() => {
    void loadAttempt();
  }, [loadAttempt]);

  // Autoguardado del borrador en el servidor: si se cae la conexión, se refresca
  // la página o la sesión se cierra por inactividad, las respuestas no se pierden.
  const saveDraftNow = useCallback(async () => {
    const s = sessionRef.current;
    if (!s || submittedRef.current) return;
    const json = JSON.stringify(answersRef.current);
    if (json === lastSavedRef.current) return;
    setSaveState("saving");
    try {
      await api.put(`/evaluations/attempts/${s.attemptId}/draft`, { answers: answersRef.current });
      lastSavedRef.current = json;
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, []);

  useEffect(() => {
    if (!session || result) return;
    const timer = window.setTimeout(() => void saveDraftNow(), 3000);
    return () => window.clearTimeout(timer);
  }, [answers, session, result, saveDraftNow]);

  // Si el guardado falló (sin señal), reintenta cada 10 s hasta lograrlo.
  useEffect(() => {
    if (saveState !== "error" || result) return;
    const interval = window.setInterval(() => void saveDraftNow(), 10000);
    return () => window.clearInterval(interval);
  }, [saveState, result, saveDraftNow]);

  // Guarda al ocultar la pestaña y avisa antes de cerrar si queda algo sin guardar.
  useEffect(() => {
    if (!session || result) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void saveDraftNow();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(answersRef.current) !== lastSavedRef.current) {
        void saveDraftNow();
        e.preventDefault();
        e.returnValue = "";
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [session, result, saveDraftNow]);

  // Tiempo límite: cuenta regresiva (corregida con la hora del servidor) y envío
  // automático al llegar a cero. El servidor también lo hace cumplir.
  useEffect(() => {
    if (!session?.timeLimitMin || result) {
      setSecondsLeft(null);
      return;
    }
    const endAt = new Date(session.startedAt).getTime() + session.timeLimitMin * 60 * 1000;
    const tick = () => {
      const left = Math.max(0, Math.round((endAt - (Date.now() + clockSkewRef.current)) / 1000));
      setSecondsLeft(left);
      if (left === 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        void submit();
      }
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, result]);

  function selectSingle(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: { selectedOptionIds: [optionId] } }));
  }

  function toggleMultiple(questionId: string, optionId: string) {
    setAnswers((prev) => {
      const current = new Set(prev[questionId]?.selectedOptionIds ?? []);
      if (current.has(optionId)) current.delete(optionId);
      else current.add(optionId);
      return { ...prev, [questionId]: { selectedOptionIds: [...current] } };
    });
  }

  function setShortAnswer(questionId: string, text: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: { shortAnswerText: text } }));
  }

  async function submit() {
    const s = sessionRef.current;
    if (!s || submittedRef.current) return;
    setConfirmOpen(false);
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        answers: s.questions.map((q) => ({ questionId: q.id, ...answersRef.current[q.id] })),
      };
      const res = await api.post<{ result: SubmitResult }>(`/evaluations/attempts/${s.attemptId}/submit`, payload);
      submittedRef.current = true;
      setResult(res.result);
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("No fue posible enviar la evaluación."));
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmitClick() {
    if (!session) return;
    const missing = session.questions.filter((q) => !isAnswered(q, answers[q.id]));
    if (missing.length > 0) {
      setShowMissing(true);
      setConfirmOpen(true);
      return;
    }
    void submit();
  }

  function keepAnswering() {
    setConfirmOpen(false);
    const first = session?.questions.find((q) => !isAnswered(q, answers[q.id]));
    if (first) document.getElementById(`q-${first.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (error && !session) {
    return (
      <div>
        <div className="alert alert-danger">{error}</div>
        <Link to={`/curso/${courseId}`} className="btn btn-secondary">
          {t("Volver a la capacitación")}
        </Link>
      </div>
    );
  }
  if (!session) return <div className="empty-state">{t("Cargando evaluación…")}</div>;

  if (result) {
    const attemptsLeft = Math.max(0, session.maxAttempts - session.attemptNumber);
    const canRetry = !result.passed && attemptsLeft > 0;
    return (
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="card">
          <span className={`badge badge-status-${result.passed ? "completed" : "overdue"}`}>
            {result.passed ? t("APROBADO") : t("NO APROBADO")}
          </span>
          <h2 className="mt-8">
            {t("Puntaje:")} {result.score}%
          </h2>
          <p className="text-muted" style={{ fontSize: 13 }}>
            {t("Nota mínima de aprobación:")} {session.passingScore}%
          </p>
          {result.certificateIssued && (
            <div className="alert alert-success mt-16">
              {t("¡Felicidades! Completó todos los requisitos y se emitió su certificado")} ({result.certificateCode}).
            </div>
          )}
          {!result.passed && (
            <p className="text-secondary">
              {canRetry
                ? `${t("Intentos restantes:")} ${attemptsLeft}. ${t("Repase las lecciones del módulo e intente de nuevo.")}`
                : t("No le quedan intentos disponibles. Comuníquese con el administrador del portal.")}
            </p>
          )}
          <div className="flex gap-8 mt-16" style={{ flexWrap: "wrap" }}>
            {canRetry && (
              <button className="btn btn-primary" onClick={() => void loadAttempt()}>
                {t("Reintentar evaluación")}
              </button>
            )}
            <Link to={`/curso/${courseId}`} className={`btn ${canRetry ? "btn-secondary" : "btn-primary"}`}>
              {result.passed ? t("Continuar con la capacitación") : t("Volver a la capacitación")}
            </Link>
            {result.certificateIssued && (
              <Link to="/certificados" className="btn btn-secondary">
                {t("Ver mi certificado")}
              </Link>
            )}
          </div>
        </div>

        {result.showCorrectAnswers && result.correctAnswers && (
          <>
            <h3 className="mt-24">{t("Revisión de respuestas")}</h3>
            {session.questions.map((q, idx) => {
              const correctIds = new Set(result.correctAnswers![q.id] ?? []);
              const selected = new Set(answers[q.id]?.selectedOptionIds ?? []);
              const ok =
                q.type !== "SHORT_ANSWER" && selected.size === correctIds.size && [...selected].every((id) => correctIds.has(id));
              return (
                <div className="quiz card mt-16" key={q.id}>
                  <h3>
                    {idx + 1}. {q.text}
                  </h3>
                  {q.type === "SHORT_ANSWER" ? (
                    <p className="text-secondary">
                      {t("Su respuesta:")} {answers[q.id]?.shortAnswerText || "—"}
                    </p>
                  ) : (
                    <>
                      {q.options.map((opt) => {
                        const isCorrect = correctIds.has(opt.id);
                        const isSelected = selected.has(opt.id);
                        return (
                          <div
                            key={opt.id}
                            className={`quiz-option ${isCorrect ? "correct" : isSelected ? "incorrect" : ""}`}
                            style={{ cursor: "default" }}
                          >
                            {isCorrect ? "✓ " : isSelected ? "✗ " : ""}
                            {opt.text}
                          </div>
                        );
                      })}
                      <p className="text-muted" style={{ fontSize: 12 }}>
                        {ok ? t("Respuesta correcta") : t("Respuesta incorrecta")}
                      </p>
                    </>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  }

  const answeredCount = session.questions.filter((q) => isAnswered(q, answers[q.id])).length;
  const totalQuestions = session.questions.length;
  const missingCount = totalQuestions - answeredCount;
  const saveLabel =
    saveState === "saving"
      ? t("Guardando…")
      : saveState === "saved"
        ? `✓ ${t("Respuestas guardadas")}`
        : saveState === "error"
          ? t("Sin conexión: reintentando guardar…")
          : "";

  return (
    <div>
      <div className="breadcrumbs">
        <Link to={`/curso/${courseId}`}>{session.title}</Link> / {t("Evaluación")}
      </div>
      <h2 className="page-title">{session.title}</h2>
      {session.description && <p className="page-subtitle">{session.description}</p>}
      <p className="text-muted" style={{ fontSize: 12 }}>
        {t("Nota mínima de aprobación:")} {session.passingScore}%
        {session.timeLimitMin && ` · ${t("Tiempo límite:")} ${session.timeLimitMin} min`}
        {` · ${t("Intento")} ${session.attemptNumber}/${session.maxAttempts}`}
      </p>

      <div className="quiz-bar">
        <ProgressBar
          percent={totalQuestions === 0 ? 0 : Math.round((answeredCount / totalQuestions) * 100)}
          label={`${t("Respondidas")} ${answeredCount} ${t("de")} ${totalQuestions}`}
        />
        <div className="quiz-bar-meta">
          {secondsLeft !== null && (
            <strong className={secondsLeft <= 60 ? "quiz-timer-low" : undefined}>
              ⏱ {formatClock(secondsLeft)}
            </strong>
          )}
          <span className="text-muted">{saveLabel}</span>
        </div>
      </div>

      {error && <div className="alert alert-danger mt-16">{error}</div>}

      {session.questions.map((q, idx) => {
        const missing = showMissing && !isAnswered(q, answers[q.id]);
        return (
          <div className={`quiz card mt-16 ${missing ? "quiz-missing" : ""}`} key={q.id} id={`q-${q.id}`}>
            <h3>
              {idx + 1}. {q.text}
            </h3>
            {missing && <p className="quiz-missing-label">{t("Pregunta sin responder")}</p>}
            {q.type === "SHORT_ANSWER" ? (
              <div className="field">
                <input
                  value={answers[q.id]?.shortAnswerText ?? ""}
                  onChange={(e) => setShortAnswer(q.id, e.target.value)}
                  placeholder={t("Escriba su respuesta")}
                />
              </div>
            ) : (
              q.options.map((opt) => {
                const selected = answers[q.id]?.selectedOptionIds?.includes(opt.id);
                return (
                  <button
                    type="button"
                    key={opt.id}
                    className={`quiz-option ${selected ? "selected" : ""}`}
                    aria-pressed={Boolean(selected)}
                    onClick={() =>
                      q.type === "MULTIPLE_CHOICE" ? toggleMultiple(q.id, opt.id) : selectSingle(q.id, opt.id)
                    }
                  >
                    {opt.text}
                  </button>
                );
              })
            )}
          </div>
        );
      })}

      <button className="btn btn-primary mt-24" onClick={handleSubmitClick} disabled={submitting}>
        {submitting ? t("Enviando…") : t("Enviar respuestas")}
      </button>

      {confirmOpen && (
        <Modal title={t("Hay preguntas sin responder")} onClose={keepAnswering}>
          <p>
            {t("Le faltan")} <strong>{missingCount}</strong> {t("preguntas por responder. Las preguntas sin responder cuentan como incorrectas.")}
          </p>
          <div className="flex gap-8" style={{ flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={keepAnswering}>
              {t("Seguir respondiendo")}
            </button>
            <button className="btn btn-secondary" onClick={() => void submit()}>
              {t("Enviar de todos modos")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
