import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";
import { generateCertificateCode } from "../lib/hash";
import { audit } from "../lib/audit";
import type { Request } from "express";

// Un módulo está aprobado para un usuario cuando TODAS sus lecciones están
// completas y su evaluación está aprobada. Un módulo sin evaluación nunca se
// certifica (no hay nota con la que certificar). La nota del certificado es la
// mejor nota aprobatoria.
export async function getModuleCompletion(userId: string, moduleId: string) {
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    include: { lessons: { select: { id: true } }, evaluation: { select: { id: true } } },
  });
  if (!mod || !mod.evaluation) return { complete: false as const };

  const [doneLessons, bestPassed] = await Promise.all([
    prisma.lessonProgress.count({
      where: { userId, lessonId: { in: mod.lessons.map((l) => l.id) }, completedAt: { not: null } },
    }),
    prisma.evaluationAttempt.findFirst({
      where: { userId, evaluationId: mod.evaluation.id, passed: true },
      orderBy: { score: "desc" },
    }),
  ]);

  const complete = doneLessons === mod.lessons.length && Boolean(bestPassed);
  if (!complete || !bestPassed) return { complete: false as const };
  return { complete: true as const, score: bestPassed.score ?? 0, module: mod };
}

// Emite el certificado del módulo si está aprobado (ver getModuleCompletion).
// Se invoca tras aprobar la evaluación del módulo. Es idempotente: si ya existe
// el certificado del módulo para el usuario, lo devuelve sin crear otro.
export async function maybeIssueModuleCertificate(userId: string, moduleId: string, req?: Request) {
  const existing = await prisma.certificate.findFirst({ where: { userId, moduleId } });
  if (existing) return existing;

  const completion = await getModuleCompletion(userId, moduleId);
  if (!completion.complete) return null;

  let certificate;
  try {
    certificate = await prisma.certificate.create({
      data: {
        code: generateCertificateCode(),
        userId,
        courseId: completion.module.courseId,
        moduleId,
        moduleTitle: completion.module.title,
        score: completion.score,
        durationMin: 0,
      },
    });
  } catch (err) {
    // Dos envíos simultáneos pueden competir por el mismo (usuario, módulo): gana uno.
    const raced = await prisma.certificate.findFirst({ where: { userId, moduleId } });
    if (raced) return raced;
    throw err;
  }

  await audit({
    userId,
    action: "certificate.issued",
    resource: `Certificate:${certificate.id}`,
    result: "success",
    req,
    metadata: { courseId: completion.module.courseId, moduleId, score: completion.score },
  });

  return certificate;
}

export async function getMyCertificates(userId: string) {
  return prisma.certificate.findMany({
    where: { userId, revokedAt: null },
    include: { course: { select: { title: true, code: true, imageUrl: true } } },
    orderBy: { issuedAt: "desc" },
  });
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
      course: { select: { title: true, code: true } },
      user: { select: { firstName: true, lastName: true, documentId: true, company: true } },
    },
  });
  if (!cert || cert.revokedAt) return null;
  return cert;
}
