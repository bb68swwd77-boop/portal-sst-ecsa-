import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";

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
