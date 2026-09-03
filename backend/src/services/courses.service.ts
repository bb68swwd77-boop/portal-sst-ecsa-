import { prisma } from "../lib/prisma";
import type { AuthenticatedUser } from "../middleware/auth";
import { HttpError } from "../middleware/errorHandler";

interface UserForAssignment {
  id: string;
  company: string | null;
  area: string | null;
  position: string | null;
}

export async function getAssignedCourseIdsForUser(user: UserForAssignment): Promise<Set<string>> {
  const assignments = await prisma.courseAssignment.findMany({
    where: {
      OR: [
        { targetType: "ALL" },
        { targetType: "USER", userId: user.id },
        user.company ? { targetType: "COMPANY", targetValue: user.company } : undefined,
        user.area ? { targetType: "AREA", targetValue: user.area } : undefined,
        user.position ? { targetType: "POSITION", targetValue: user.position } : undefined,
      ].filter(Boolean) as any,
    },
    select: { courseId: true },
  });
  return new Set(assignments.map((a) => a.courseId));
}

export async function assertCourseAccess(currentUser: AuthenticatedUser, courseId: string) {
  if (currentUser.permissions.has("courses:view")) return; // admin ve todo
  const fullUser = await prisma.user.findUnique({ where: { id: currentUser.id } });
  if (!fullUser) throw new HttpError(404, "Usuario no encontrado.");
  const assigned = await getAssignedCourseIdsForUser(fullUser);
  if (!assigned.has(courseId)) {
    throw new HttpError(403, "No tiene acceso a esta capacitación.");
  }
}

export async function getDashboardForUser(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const assignedIds = await getAssignedCourseIdsForUser(user);

  const courses = await prisma.course.findMany({
    where: { id: { in: [...assignedIds] }, status: "PUBLISHED" },
    include: {
      modules: { include: { lessons: true, evaluation: true }, orderBy: { order: "asc" } },
    },
  });

  const assignments = await prisma.courseAssignment.findMany({
    where: { courseId: { in: [...assignedIds] }, OR: [{ userId: user.id }, { userId: null }] },
  });

  const progressRows = await prisma.lessonProgress.findMany({
    where: { userId, lesson: { module: { courseId: { in: [...assignedIds] } } } },
  });
  const completedLessonIds = new Set(progressRows.filter((p) => p.completedAt).map((p) => p.lessonId));

  const attempts = await prisma.evaluationAttempt.findMany({
    where: { userId, evaluation: { module: { courseId: { in: [...assignedIds] } } }, status: "SUBMITTED" },
    orderBy: { submittedAt: "desc" },
  });

  const certificates = await prisma.certificate.findMany({ where: { userId } });
  const certByCourse = new Map(certificates.map((c) => [c.courseId, c]));

  const items = courses.map((course) => {
    const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
    const completedLessons = course.modules.reduce(
      (acc, m) => acc + m.lessons.filter((l) => completedLessonIds.has(l.id)).length,
      0
    );
    const evaluationIds = course.modules.filter((m) => m.evaluation).map((m) => m.evaluation!.id);
    const passedEvaluations = evaluationIds.filter((evalId) =>
      attempts.some((a) => a.evaluationId === evalId && a.passed)
    );

    const totalUnits = totalLessons + evaluationIds.length;
    const completedUnits = completedLessons + passedEvaluations.length;
    const percent = totalUnits === 0 ? 0 : Math.round((completedUnits / totalUnits) * 100);
    const certificate = certByCourse.get(course.id);

    const assignment = assignments.find((a) => a.courseId === course.id);

    let status: "pending" | "in_progress" | "completed" | "overdue" = "pending";
    if (certificate) status = "completed";
    else if (completedUnits > 0) status = "in_progress";
    if (assignment?.dueAt && assignment.dueAt < new Date() && status !== "completed") status = "overdue";

    return {
      id: course.id,
      code: course.code,
      title: course.title,
      description: course.description,
      imageUrl: course.imageUrl,
      durationMin: course.durationMin,
      moduleCount: course.modules.length,
      percent,
      status,
      dueAt: assignment?.dueAt ?? null,
      certificateCode: certificate?.code ?? null,
    };
  });

  const stats = {
    totalAssigned: items.length,
    completed: items.filter((i) => i.status === "completed").length,
    inProgress: items.filter((i) => i.status === "in_progress").length,
    pending: items.filter((i) => i.status === "pending").length,
    overdue: items.filter((i) => i.status === "overdue").length,
    certificates: certificates.length,
    overallPercent:
      items.length === 0 ? 0 : Math.round(items.reduce((acc, i) => acc + i.percent, 0) / items.length),
  };

  return { items, stats };
}

export async function getCourseDetailForUser(userId: string, courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          lessons: {
            orderBy: { order: "asc" },
            include: { file: { select: { id: true, filename: true, mimeType: true, sizeBytes: true } } },
          },
          evaluation: { select: { id: true, title: true, description: true, passingScore: true, timeLimitMin: true, maxAttempts: true } },
        },
      },
    },
  });
  if (!course) throw new HttpError(404, "Capacitación no encontrada.");

  const progressRows = await prisma.lessonProgress.findMany({
    where: { userId, lesson: { module: { courseId } } },
  });
  const completedLessonIds = new Set(progressRows.filter((p) => p.completedAt).map((p) => p.lessonId));
  const progressByLessonId = new Map(progressRows.map((p) => [p.lessonId, p]));

  const attempts = await prisma.evaluationAttempt.findMany({
    where: { userId, evaluation: { module: { courseId } } },
    orderBy: { attemptNumber: "desc" },
  });

  const modules = course.modules.map((m) => {
    const lessons = m.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      order: l.order,
      contentType: l.contentType,
      bodyHtml: l.bodyHtml,
      externalUrl: l.externalUrl,
      file: l.file ? { id: l.file.id, filename: l.file.filename, mimeType: l.file.mimeType, sizeBytes: l.file.sizeBytes } : null,
      normReference: l.normReference,
      normCode: l.normCode,
      normArticle: l.normArticle,
      normYear: l.normYear,
      normVersion: l.normVersion,
      normSource: l.normSource,
      normReviewedAt: l.normReviewedAt,
      completed: completedLessonIds.has(l.id),
      // Solo relevante para contentType VIDEO — null para el resto de tipos.
      percentWatched: progressByLessonId.get(l.id)?.percentWatched ?? null,
    }));
    const moduleAttempts = m.evaluation ? attempts.filter((a) => a.evaluationId === m.evaluation!.id) : [];
    const bestAttempt = moduleAttempts.find((a) => a.status === "SUBMITTED");
    const attemptsUsed = moduleAttempts.filter((a) => a.status === "SUBMITTED").length;

    return {
      id: m.id,
      title: m.title,
      order: m.order,
      lessons,
      evaluation: m.evaluation
        ? {
            ...m.evaluation,
            attemptsUsed,
            lastScore: bestAttempt?.score ?? null,
            lastPassed: bestAttempt?.passed ?? null,
            canAttempt: attemptsUsed < m.evaluation.maxAttempts && !bestAttempt?.passed,
          }
        : null,
    };
  });

  return {
    id: course.id,
    code: course.code,
    title: course.title,
    description: course.description,
    objective: course.objective,
    durationMin: course.durationMin,
    passingScore: course.passingScore,
    modules,
  };
}

export async function markLessonComplete(userId: string, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) throw new HttpError(404, "Lección no encontrada.");

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { completedAt: new Date() },
    create: { userId, lessonId, completedAt: new Date() },
  });
}

// Umbral para considerar un video "visto" — tolera que no se reproduzcan
// los últimos segundos exactos (ej. créditos finales).
const VIDEO_COMPLETION_THRESHOLD = 95;

/**
 * Registra avance de reproducción de un video (heartbeat periódico del
 * reproductor de YouTube, o el evento ENDED). Reutiliza LessonProgress —
 * la misma tabla que usan PDF/texto — en vez de una tabla aparte.
 *
 * Nunca confía en el porcentaje del cliente para "completar" sin más: se
 * clampa a 0-100 y se guarda como el máximo histórico visto (monótono, no
 * retrocede si el usuario rebobina), como control básico anti-manipulación.
 * El único lugar donde completedAt se escribe para un video es aquí —
 * nunca hay un endpoint que acepte completed=true directo desde el cliente.
 */
export async function recordVideoProgress(userId: string, lessonId: string, rawPercent: number) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) throw new HttpError(404, "Lección no encontrada.");
  if (lesson.contentType !== "VIDEO") {
    throw new HttpError(400, "Esta lección no es de tipo video.");
  }

  const clamped = Math.max(0, Math.min(100, Math.round(rawPercent)));
  const existing = await prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId, lessonId } } });

  const bestPercent = Math.max(existing?.percentWatched ?? 0, clamped);
  const shouldComplete = bestPercent >= VIDEO_COMPLETION_THRESHOLD;
  const completedAt = existing?.completedAt ?? (shouldComplete ? new Date() : null);

  const progress = await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { percentWatched: bestPercent, completedAt },
    create: { userId, lessonId, startedAt: new Date(), percentWatched: bestPercent, completedAt },
  });

  return { percentWatched: progress.percentWatched, completed: Boolean(progress.completedAt) };
}
