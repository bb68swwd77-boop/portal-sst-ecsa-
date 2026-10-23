import { prisma } from "../lib/prisma";
import { generateOpaqueToken, hashPassword, hashToken, verifyPassword } from "../lib/hash";
import { HttpError } from "../middleware/errorHandler";

const MAX_FAILED_ATTEMPTS = 3;
const LOCK_MINUTES = 15;
// Ventana en la que se acumulan los fallos: pasado este tiempo sin fallar, se perdonan.
const FAILURE_WINDOW_MINUTES = 15;
const LOCKED_ERROR =
  "Cuenta bloqueada por 3 intentos fallidos. Intente de nuevo en 15 minutos o pida al administrador que la desbloquee.";
const RESET_TOKEN_TTL_MIN = 30;

// Mensaje idéntico para "usuario no existe" y "contraseña incorrecta": no revelar
// si un código está registrado (previene enumeración de usuarios).
const GENERIC_LOGIN_ERROR = "Código o contraseña incorrectos.";

export async function authenticate(code: string, password: string) {
  const user = await prisma.user.findUnique({ where: { code } });

  if (!user || !user.isActive) {
    // Ejecutar un hash "señuelo" para que el tiempo de respuesta no delate si el usuario existe.
    await verifyPassword("$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", password);
    throw new HttpError(401, GENERIC_LOGIN_ERROR);
  }

  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    throw new HttpError(423, LOCKED_ERROR);
  }

  // Los fallos viejos no se acumulan para siempre: si el bloqueo ya venció o el
  // último fallo fue hace más de la ventana, el contador vuelve a cero. Es un
  // updateMany condicional para que varias peticiones simultáneas lo hagan una sola vez.
  const windowStart = new Date(now.getTime() - FAILURE_WINDOW_MINUTES * 60 * 1000);
  await prisma.user.updateMany({
    where: {
      id: user.id,
      failedLoginCount: { gt: 0 },
      OR: [{ lockedUntil: { lte: now } }, { lastFailedLoginAt: { lt: windowStart } }, { lastFailedLoginAt: null }],
    },
    data: { failedLoginCount: 0, lockedUntil: null },
  });

  // Se reserva el intento ANTES de verificar la contraseña, con un incremento
  // atómico. Así, una ráfaga de peticiones paralelas no puede probar más de
  // MAX_FAILED_ATTEMPTS claves: solo las primeras llegan a verificarse.
  const reserved = await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: { increment: 1 }, lastFailedLoginAt: now },
    select: { failedLoginCount: true },
  });

  if (reserved.failedLoginCount > MAX_FAILED_ATTEMPTS) {
    throw new HttpError(423, LOCKED_ERROR);
  }

  const valid = await verifyPassword(user.passwordHash, password);

  if (!valid) {
    if (reserved.failedLoginCount >= MAX_FAILED_ATTEMPTS) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) },
      });
      throw new HttpError(423, LOCKED_ERROR);
    }
    throw new HttpError(401, GENERIC_LOGIN_ERROR);
  }

  await prisma.user.update({
    where: { id: user.id },
    // Si la recordó e ingresó, ya no necesita que el administrador la restablezca.
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
      lastFailedLoginAt: null,
      lastLoginAt: new Date(),
      resetRequestedAt: null,
    },
  });

  return user;
}

// Solicitud de restablecimiento hecha por el propio trabajador desde la pantalla
// "¿Olvidó su contraseña?": solo deja constancia para que el administrador la
// vea en Usuarios y entregue una clave temporal. No revela si el código existe.
export async function markResetRequestedByCode(code: string) {
  const user = await prisma.user.findUnique({ where: { code } });
  if (!user || !user.isActive) return;
  await prisma.user.update({ where: { id: user.id }, data: { resetRequestedAt: new Date() } });
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
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null, mustChangePassword: false, resetRequestedAt: null },
    }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    // Una contraseña restablecida invalida cualquier sesión abierta con la anterior.
    prisma.session.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

export async function changeOwnPassword(userId: string, currentPassword: string, newPassword: string, keepSessionId?: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const valid = await verifyPassword(user.passwordHash, currentPassword);
  if (!valid) {
    throw new HttpError(400, "La contraseña actual no es correcta.");
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } }),
    // Cierra las demás sesiones del usuario (otros equipos/navegadores) y deja
    // abierta solo la actual, desde donde se hizo el cambio.
    prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) },
      data: { revokedAt: new Date() },
    }),
  ]);
}
