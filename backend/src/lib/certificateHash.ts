import crypto from "node:crypto";

export interface CertificateHashInput {
  userId: string;
  courseId: string;
  issuedAt: Date;
  durationMin: number;
  modality: string;
  score: number;
}

// Hash determinístico sobre los campos que definen el certificado. Se
// calcula SIEMPRE en el servidor al emitir (nunca se acepta un hash enviado
// por el cliente) y se recalcula en /verify para detectar si alguno de estos
// campos fue alterado después de la emisión.
export function computeCertificateHash(input: CertificateHashInput): string {
  const canonical = [
    input.userId,
    input.courseId,
    input.issuedAt.toISOString(),
    String(input.durationMin),
    input.modality,
    String(input.score),
  ].join("|");
  return crypto.createHash("sha256").update(canonical).digest("hex");
}
