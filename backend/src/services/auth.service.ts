import { prisma } from "../lib/prisma";
import { generateOpaqueToken, hashPassword, hashToken, verifyPassword } from "../lib/hash";
import { HttpError } from "../middleware/errorHandler";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const RESET_TOKEN_TTL_MIN = 30;

// Mensaje idéntico para "usuario no existe" y "contraseña incorrecta": no revelar
// si un correo está registrado (previene enumeración de usuarios).
const GENERIC_LOGIN_ERROR = "Correo o contraseña incorrectos.";

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    // Ejecutar un hash "señuelo" para que el tiempo de respuesta no delate si el usuario existe.
    await verifyPassword("$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", password);
    throw new HttpError(401, GENERIC_LOGIN_ERROR);
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new HttpError(423, "Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intente más tarde.");
  }

  const valid = await verifyPassword(user.passwordHash, password);

  if (!valid) {
    const failedLoginCount = user.failedLoginCount + 1;
    const lockedUntil =
      failedLoginCount >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount, lockedUntil },
    });
    throw new HttpError(401, GENERIC_LOGIN_ERROR);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  return user;
}

export async function createPasswordResetToken(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Respuesta idéntica exista o no el usuario (previene enumeración).
  if (!user || !user.isActive) return null;

  const { token, tokenHash } = generateOpaqueToken();
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60 * 1000),
    },
  });
  return { token, user };
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  const tokenHash = hashToken(token);
  const reset = await prisma.passwordReset.findUnique({ where: { tokenHash } });

  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    throw new HttpError(400, "El enlace de restablecimiento no es válido o ha expirado.");
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null, mustChangePassword: false },
    }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
  ]);
}

export async function changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const valid = await verifyPassword(user.passwordHash, currentPassword);
  if (!valid) {
    throw new HttpError(400, "La contraseña actual no es correcta.");
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } });
}
