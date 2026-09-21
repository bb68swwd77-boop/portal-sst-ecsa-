import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";
import { generateCertificateCode } from "../lib/hash";
import { audit } from "../lib/audit";
import { getAccessibleModuleIds } from "./courses.service";
import type { Request } from "express";

// Un curso está completo para un usuario cuando TODAS las lecciones y TODAS
// las evaluaciones de los módulos que tiene asignados (todos, o solo los
// módulos puntuales de sus asignaciones) están hechas/aprobadas. Un curso sin
// evaluaciones nunca se considera completo (no hay nota con la que certificar).
export async function getCourseCompletion(userId: string, courseId: string) {
  const [user, course] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.course.findUniqueOrThrow({
      where: { id: courseId },
      include: { modules: { include: { lessons: { select: { id: true } }, evaluation: { select: { id: true } } } } },
    }),
  ]);

  const accessible = await getAccessibleModuleIds(user, courseId);
  // Sin asignaciones propias (ej. un admin probando el curso) se exige todo.
  const modules =
    accessible === null || accessible.size === 0 ? course.modules : course.modules.filter((m) => accessible.has(m.id));

  const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
  const evaluationIds = modules.filter((m) => m.evaluation).map((m) => m.evaluation!.id);

  const [doneLessons, passedAttempts] = await Promise.all([
    prisma.lessonProgress.findMany({
      where: { userId, lessonId: { in: lessonIds }, completedAt: { not: null } },
      select: { lessonId: true },
    }),
    prisma.evaluationAttempt.findMany({
      where: { userId, evaluationId: { in: evaluationIds }, passed: true },
      orderBy: { score: "desc" },
    }),
  ]);

  const doneLessonIds = new Set(doneLessons.map((l) => l.lessonId));
  const bestByEvaluation = new Map<string, number>();
  for (const a of passedAttempts) {
    if (!bestByEvaluation.has(a.evaluationId)) bestByEvaluation.set(a.evaluationId, a.score ?? 0);
  }

  const complete =
    evaluationIds.length > 0 &&
    lessonIds.every((id) => doneLessonIds.has(id)) &&
    evaluationIds.every((id) => bestByEvaluation.has(id));
  const avgScore = bestByEvaluation.size
    ? Math.round([...bestByEvaluation.values()].reduce((a, b) => a + b, 0) / bestByEvaluation.size)
    : 0;

  return { complete, avgScore, durationMin: course.durationMin };
}

// Emite el certificado solo si el curso está completo (ver getCourseCompletion).
// Se invoca tras aprobar una evaluación y tras completar una lección, porque la
// última pieza pendiente puede ser cualquiera de las dos.
export async function maybeIssueCertificate(userId: string, courseId: string, req?: Request) {
  const existing = await prisma.certificate.findFirst({ where: { userId, courseId } });
  if (existing) return existing;

  const completion = await getCourseCompletion(userId, courseId);
  if (!completion.complete) return null;

  const certificate = await prisma.certificate.create({
    data: {
      code: generateCertificateCode(),
      userId,
      courseId,
      score: completion.avgScore,
      durationMin: completion.durationMin,
    },
  });

  await audit({
    userId,
    action: "certificate.issued",
    resource: `Certificate:${certificate.id}`,
    result: "success",
    req,
    metadata: { courseId, score: completion.avgScore },
  });

  return certificate;
}

export async function getMyCertificates(userId: string) {
  const certificates = await prisma.certificate.findMany({
    where: { userId, revokedAt: null },
    include: { course: { select: { title: true, code: true, imageUrl: true } } },
    orderBy: { issuedAt: "desc" },
  });
  // Certificados emitidos antes de exigir la totalidad de módulos no se
  // muestran hasta que el curso realmente esté completo.
  const completion = await Promise.all(certificates.map((c) => getCourseCompletion(userId, c.courseId)));
  return certificates.filter((_, i) => completion[i].complete);
}

export async function getCertificateForUser(userId: string, certificateId: string) {
  const cert = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: { course: true, user: true },
  });
  // IDOR: solo el dueño del certificado (o un admin, verificado en la ruta) puede consultarlo por id interno.
  if (!cert || cert.userId !== userId) {
    throw new HttpError(404, "Certificado no encontrado.");
  }
  return cert;
}

// Verificación pública: solo por código público, nunca por id interno secuencial.
export async function verifyCertificateByCode(code: string) {
  const cert = await prisma.certificate.findUnique({
    where: { code },
    include: {
      course: { select: { title: true, code: true, durationMin: true } },
      user: { select: { firstName: true, lastName: true, documentId: true, company: true } },
    },
  });
  if (!cert || cert.revokedAt) return null;
  return cert;
}
