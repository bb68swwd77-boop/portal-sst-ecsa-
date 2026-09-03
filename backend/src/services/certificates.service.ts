import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";
import { computeCertificateHash } from "../lib/certificateHash";

export async function getMyCertificates(userId: string) {
  const certificates = await prisma.certificate.findMany({
    where: { userId, revokedAt: null },
    include: { course: { select: { title: true, code: true } } },
    orderBy: { issuedAt: "desc" },
  });
  return certificates;
}

export async function getCertificateForUser(userId: string, certificateId: string) {
  const cert = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: { course: true, user: true, signatory: true },
  });
  // IDOR: solo el dueño del certificado (o un admin, verificado en la ruta) puede consultarlo por id interno.
  if (!cert || cert.userId !== userId) {
    throw new HttpError(404, "Certificado no encontrado.");
  }
  return cert;
}

// Verificación pública: solo por código público, nunca por id interno secuencial.
// Expone el mínimo necesario para validar el certificado (nombre, curso,
// fecha, resultado) — nunca identificación ni otros datos personales.
export async function verifyCertificateByCode(code: string) {
  const cert = await prisma.certificate.findUnique({
    where: { code },
    include: {
      course: { select: { title: true, code: true, durationMin: true } },
      user: { select: { firstName: true, lastName: true, company: true } },
      signatory: { select: { name: true, position: true } },
    },
  });
  if (!cert || cert.revokedAt) return null;

  // Certificados emitidos antes de introducir contentHash no tienen nada
  // que recalcular — se reporta "desconocido" (null), nunca un falso
  // positivo de alteración.
  let integrityValid: boolean | null = null;
  if (cert.contentHash) {
    const recomputedHash = computeCertificateHash({
      userId: cert.userId,
      courseId: cert.courseId,
      issuedAt: cert.issuedAt,
      durationMin: cert.durationMin,
      modality: cert.modality,
      score: cert.score,
    });
    integrityValid = recomputedHash === cert.contentHash;
  }

  return { cert, integrityValid };
}
