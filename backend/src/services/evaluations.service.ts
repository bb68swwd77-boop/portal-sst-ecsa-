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
    title: evaluation.title,
    description: evaluation.description,
    passingScore: evaluation.passingScore,
    questions,
  };
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
      data: { status: "SUBMITTED", submittedAt: new Date(), score, passed },
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

