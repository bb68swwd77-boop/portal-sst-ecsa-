import argon2 from "argon2";
import crypto from "node:crypto";

// Argon2id: recomendado por OWASP sobre bcrypt para nuevos sistemas (resistente a GPU/ASIC).
const HASH_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456, // ~19 MB, guía OWASP
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, HASH_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

// Tokens opacos (reset de contraseña, verificación) — se guarda solo el hash SHA-256 en BD.
export function generateOpaqueToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Código público de certificado: no debe ser adivinable secuencialmente.
export function generateCertificateCode(): string {
  const random = crypto.randomBytes(6).toString("hex").toUpperCase();
  return `ECSA-SST-${random}`;
}
