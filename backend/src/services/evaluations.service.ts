import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";
import { maybeIssueCertificate } from "./certificates.service";
import { audit } from "../lib/audit";
import type { Request } from "express";

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Respuestas guardadas como borrador mientras el capacitado responde.
export interface DraftAnswer {
  selectedOptionIds?: string[];
  shortAnswerText?: string;
}

// Tolerancia entre el fin del tiempo límite y la llegada del envío (red lenta,
// envío automático del navegador al llegar a cero).
const SUBMIT_GRACE_MS = 90 * 1000;

function parseDraft(raw: string | null | undefined): Record<string, DraftAnswer> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, DraftAnswer>) : {};
  } catch {
    return {};
  }
}

// Lecciones del módulo que el usuario aún no ha completado — la evaluación
// del módulo solo se habilita cuando este número llega a cero.
async function countPendingLessons(userId: string, moduleId: string) {
  const [total, completed] = await Promise.all([
    prisma.lesson.count({ where: { moduleId } }),
    prisma.lessonProgress.count({ where: { userId, completedAt: { not: null }, lesson: { moduleId } } }),
  ]);
  return Math.max(0, total - completed);
}

/**
 * Inicia (o reanuda) un intento de evaluación. Devuelve preguntas y opciones
 * SIN el campo isCorrect — el cliente nunca recibe las respuestas correctas.
 */
export async function startAttempt(userId: string, evaluationId: string) {
  const evaluation = await prisma.evaluation.findUnique({
    where: { id: evaluationId },
    include: { questions: { include: { options: true }, orderBy: { order: "asc" } }, module: { include: { course: true } } },
  });
  if (!evaluation) throw new HttpError(404, "Evaluación no encontrada.");

  const pendingLessons = await countPendingLessons(userId, evaluation.moduleId);
  if (pendingLessons > 0) {
    throw new HttpError(403, "Debe completar todas las lecciones del módulo antes de iniciar la evaluación.");
  }

  // Reanuda un intento en progreso si existe.
  let attempt = await prisma.evaluationAttempt.findFirst({
    where: { userId, evaluationId, status: "IN_PROGRESS" },
  });

  if (!attempt) {
    const submittedCount = await prisma.evaluationAttempt.count({
      where: { userId, evaluationId, status: "SUBMITTED" },
    });
    if (submittedCount >= evaluation.maxAttempts) {
      throw new HttpError(403, "Ha alcanzado el número máximo de intentos para esta evaluación.");
    }
    const alreadyPassed = await prisma.evaluationAttempt.findFirst({
      where: { userId, evaluationId, passed: true },
    });
    if (alreadyPassed) {
      throw new HttpError(400, "Ya aprobó esta evaluación.");
    }

    const questionOrder = evaluation.shuffleQuestions
      ? shuffle(evaluation.questions.map((q) => q.id))
      : evaluation.questions.map((q) => q.id);

    attempt = await prisma.evaluationAttempt.create({
      data: {
        evaluationId,
        userId,
        attemptNumber: submittedCount + 1,
        status: "IN_PROGRESS",
        questionOrder: JSON.stringify(questionOrder),
      },
    });
  }

  const orderIds: string[] = attempt.questionOrder ? JSON.parse(attempt.questionOrder) : evaluation.questions.map((q) => q.id);
  const questionsById = new Map(evaluation.questions.map((q) => [q.id, q]));

  const questions = orderIds
    .map((id) => questionsById.get(id))
    .filter((q): q is NonNullable<typeof q> => Boolean(q))
    .map((q) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      points: q.points,
      options: (evaluation.shuffleAnswers ? shuffle(q.options) : q.options).map((o) => ({
        id: o.id,
        text: o.text,
        // isCorrect deliberadamente omitido
      })),
    }));

  return {
    attemptId: attempt.id,
    attemptNumber: attempt.attemptNumber,
    startedAt: attempt.startedAt,
    timeLimitMin: evaluation.timeLimitMin,
    // Hora del servidor: el contador del navegador se corrige con ella para que
    // un reloj mal puesto no regale ni quite tiempo.
    serverNow: new Date().toISOString(),
    maxAttempts: evaluation.maxAttempts,
    title: evaluation.title,
    description: evaluation.description,
    passingScore: evaluation.passingScore,
    questions,
    // Respuestas ya guardadas de este intento (si se interrumpió y se reanuda).
    draftAnswers: parseDraft(attempt.draftAnswers),
  };
}

/**
 * Guarda el borrador de respuestas del intento en curso, para que no se pierdan
 * si se cae la conexión o se cierra la sesión por inactividad.
 */
export async function saveDraft(userId: string, attemptId: string, draft: Record<string, DraftAnswer>) {
  const attempt = await prisma.evaluationAttempt.findUnique({
    where: { id: attemptId },
    select: { userId: true, status: true },
  });
  if (!attempt || attempt.userId !== userId) {
    throw new HttpError(404, "Intento de evaluación no encontrado.");
  }
  if (attempt.status !== "IN_PROGRESS") {
    throw new HttpError(400, "Este intento ya fue enviado.");
  }
  await prisma.evaluationAttempt.update({
    where: { id: attemptId },
    data: { draftAnswers: JSON.stringify(draft) },
  });
}

interface SubmitAnswer {
  questionId: string;
  selectedOptionIds?: string[];
  shortAnswerText?: string;
}

export async function submitAttempt(userId: string, attemptId: string, answers: SubmitAnswer[], req?: Request) {
  const attempt = await prisma.evaluationAttempt.findUnique({
    where: { id: attemptId },
    include: {
      evaluation: {
        include: {
          questions: { include: { options: true } },
          module: { include: { course: true } },
        },
      },
    },
  });

  if (!attempt || attempt.userId !== userId) {
    throw new HttpError(404, "Intento de evaluación no encontrado.");
  }
  if (attempt.status !== "IN_PROGRESS") {
    throw new HttpError(400, "Este intento ya fue enviado.");
  }

  // Tiempo límite: si el envío llega pasado el plazo (más la tolerancia), solo
  // cuentan las respuestas que ya estaban guardadas en el borrador — no se gana
  // tiempo extra enviando respuestas nuevas fuera de plazo.
  const timeLimitMin = attempt.evaluation.timeLimitMin;
  if (timeLimitMin && Date.now() - attempt.startedAt.getTime() > timeLimitMin * 60 * 1000 + SUBMIT_GRACE_MS) {
    answers = Object.entries(parseDraft(attempt.draftAnswers)).map(([questionId, a]) => ({
      questionId,
      selectedOptionIds: a.selectedOptionIds,
      shortAnswerText: a.shortAnswerText,
    }));
  }

  const questionsById = new Map(attempt.evaluation.questions.map((q) => [q.id, q]));
  let totalPoints = 0;
  let earnedPoints = 0;
  const answerRows = [];

  for (const question of attempt.evaluation.questions) {
    totalPoints += question.points;
    const given = answers.find((a) => a.questionId === question.id);
    const correctOptionIds = new Set(question.options.filter((o) => o.isCorrect).map((o) => o.id));
    let isCorrect = false;

    if (question.type === "SHORT_ANSWER") {
      // Respuesta corta: comparación case-insensitive contra opciones marcadas correctas (usadas como respuestas válidas).
      const validAnswers = question.options.filter((o) => o.isCorrect).map((o) => o.text.trim().toLowerCase());
      isCorrect = Boolean(given?.shortAnswerText) && validAnswers.includes(given!.shortAnswerText!.trim().toLowerCase());
    } else {
      const selected = new Set(given?.selectedOptionIds ?? []);
      isCorrect =
        selected.size === correctOptionIds.size && [...selected].every((id) => correctOptionIds.has(id));
    }

    if (isCorrect) earnedPoints += question.points;

    answerRows.push({
      attemptId: attempt.id,
      questionId: question.id,
      selectedOptionIds: given?.selectedOptionIds ? JSON.stringify(given.selectedOptionIds) : null,
      shortAnswerText: given?.shortAnswerText ?? null,
      isCorrect,
    });
  }

  const score = totalPoints === 0 ? 0 : Math.round((earnedPoints / totalPoints) * 100);
  const passed = score >= attempt.evaluation.passingScore;

  await prisma.$transaction([
    prisma.attemptAnswer.createMany({ data: answerRows }),
    prisma.evaluationAttempt.update({
      where: { id: attempt.id },
      data: { status: "SUBMITTED", submittedAt: new Date(), score, passed, draftAnswers: null },
    }),
  ]);

  await audit({
    userId,
    action: "evaluation.submit",
    resource: `Evaluation:${attempt.evaluationId}`,
    result: "success",
    req,
    metadata: { score, passed, attemptNumber: attempt.attemptNumber },
  });

  let certificate = null;
  if (passed) {
    certificate = await maybeIssueCertificate(userId, attempt.evaluation.module.courseId, req);
  }

  return {
    score,
    passed,
    showCorrectAnswers: attempt.evaluation.showCorrectAnswers,
    correctAnswers: attempt.evaluation.showCorrectAnswers
      ? Object.fromEntries(
          attempt.evaluation.questions.map((q) => [q.id, q.options.filter((o) => o.isCorrect).map((o) => o.id)])
        )
      : undefined,
    certificateIssued: Boolean(certificate),
    certificateCode: certificate?.code,
  };
}

