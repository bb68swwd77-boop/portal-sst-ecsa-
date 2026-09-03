import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { AttemptSession } from "../types";

interface AnswerState {
  selectedOptionIds?: string[];
  shortAnswerText?: string;
}

interface SubmitResult {
  score: number;
  passed: boolean;
  certificateIssued: boolean;
  certificateCode?: string;
}

export function EvaluationRunnerPage() {
  const { courseId, evaluationId } = useParams();
  const [session, setSession] = useState<AttemptSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!evaluationId) return;
    api
      .post<{ attempt: AttemptSession }>(`/evaluations/${evaluationId}/start`)
      .then((res) => setSession(res.attempt))
      .catch((err) => setError(err instanceof ApiError ? err.message : "No fue posible iniciar la evaluación."));
  }, [evaluationId]);

  function selectSingle(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: { selectedOptionIds: [optionId] } }));
  }

  function toggleMultiple(questionId: string, optionId: string) {
    setAnswers((prev) => {
      const current = new Set(prev[questionId]?.selectedOptionIds ?? []);
      current.has(optionId) ? current.delete(optionId) : current.add(optionId);
      return { ...prev, [questionId]: { selectedOptionIds: [...current] } };
    });
  }

  function setShortAnswer(questionId: string, text: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: { shortAnswerText: text } }));
  }

  async function handleSubmit() {
    if (!session) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        answers: session.questions.map((q) => ({ questionId: q.id, ...answers[q.id] })),
      };
      const res = await api.post<{ result: SubmitResult }>(`/evaluations/attempts/${session.attemptId}/submit`, payload);
      setResult(res.result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No fue posible enviar la evaluación.");
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !session) return <div className="alert alert-danger">{error}</div>;
  if (!session && !result) return <div className="empty-state">Cargando evaluación…</div>;

  if (result) {
    return (
      <div className="card" style={{ maxWidth: 520, margin: "0 auto" }}>
        <span className={`badge badge-status-${result.passed ? "completed" : "overdue"}`}>
          {result.passed ? "APROBADO" : "NO APROBADO"}
        </span>
        <h2 className="mt-8">Puntaje: {result.score}%</h2>
        {result.certificateIssued && (
          <div className="alert alert-success mt-16">
            ¡Felicidades! Completó todos los requisitos y se emitió su certificado ({result.certificateCode}).
          </div>
        )}
        {!result.passed && <p className="text-secondary">Puede reintentar si le quedan intentos disponibles.</p>}
        <Link to={`/curso/${courseId}`} className="btn btn-primary mt-16">
          Volver a la capacitación
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="breadcrumbs">
        <Link to={`/curso/${courseId}`}>{session!.title}</Link> / Evaluación
      </div>
      <h2 className="page-title">{session!.title}</h2>
      {session!.description && <p className="page-subtitle">{session!.description}</p>}
      <p className="text-muted" style={{ fontSize: 12 }}>
        Nota mínima de aprobación: {session!.passingScore}%
        {session!.timeLimitMin && ` · Tiempo límite: ${session!.timeLimitMin} min`}
      </p>

      {error && <div className="alert alert-danger">{error}</div>}

      {session!.questions.map((q, idx) => (
        <div className="quiz card mt-16" key={q.id}>
          <h3>
            {idx + 1}. {q.text}
          </h3>
          {q.type === "SHORT_ANSWER" ? (
            <div className="field">
              <input
                value={answers[q.id]?.shortAnswerText ?? ""}
                onChange={(e) => setShortAnswer(q.id, e.target.value)}
                placeholder="Escriba su respuesta"
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
      ))}

      <button className="btn btn-primary mt-24" onClick={handleSubmit} disabled={submitting}>
        {submitting ? "Enviando…" : "Enviar respuestas"}
      </button>
    </div>
  );
}
