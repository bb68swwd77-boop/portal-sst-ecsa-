import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { getValidSession, SESSION_COOKIE } from "../lib/session";

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleKey: string;
  permissions: Set<string>;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      currentUser?: AuthenticatedUser;
      sessionId?: string;
    }
  }
}

/**
 * Carga el usuario asociado a la cookie de sesión (si es válida) en req.currentUser.
 * No rechaza la request: rutas públicas y protegidas comparten este middleware.
 * Toda la validación (expiración, revocación) ocurre contra la tabla Session en BD,
 * nunca confiando únicamente en el contenido de la cookie.
 */
export async function loadSession(req: Request, res: Response, next: NextFunction) {
  const sessionId = req.signedCookies?.[SESSION_COOKIE];
  const session = await getValidSession(sessionId);
  if (!session) return next();

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });

  if (!user || !user.isActive) {
    return next();
  }

  req.sessionId = session.id;
  req.currentUser = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roleKey: user.role.key,
    permissions: new Set(user.role.permissions.map((rp) => rp.permission.key)),
  };
  next();
}

// Exige que exista un usuario autenticado en la sesión.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.currentUser) {
    return res.status(401).json({ error: "No autenticado. Inicie sesión para continuar." });
  }
  next();
}
