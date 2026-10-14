import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { getValidSession, SESSION_COOKIE } from "../lib/session";
import { CURRENT_POLICY_VERSION } from "../config/policies";

export interface AuthenticatedUser {
  id: string;
  email: string;
  code: string | null;
  firstName: string;
  lastName: string;
  category: string | null;
  roleKey: string;
  permissions: Set<string>;
  mustChangePassword: boolean;
  // ¿Ya aceptó la versión vigente de las políticas de datos y cookies?
  policyAccepted: boolean;
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
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      policyAcceptances: { where: { version: CURRENT_POLICY_VERSION }, select: { id: true }, take: 1 },
    },
  });

  if (!user || !user.isActive) {
    return next();
  }

  req.sessionId = session.id;
  req.currentUser = {
    id: user.id,
    email: user.email,
    code: user.code,
    firstName: user.firstName,
    lastName: user.lastName,
    category: user.category,
    roleKey: user.role.key,
    permissions: new Set(user.role.permissions.map((rp) => rp.permission.key)),
    mustChangePassword: user.mustChangePassword,
    policyAccepted: user.policyAcceptances.length > 0,
  };
  next();
}

/**
 * Control de aceptación de políticas (datos personales y cookies): mientras el
 * usuario autenticado no haya aceptado la versión vigente, la API solo le deja
 * usar /api/auth/* (ver su sesión, aceptar, cambiar contraseña, cerrar sesión).
 * Así la aceptación no depende solo de la pantalla del frontend.
 * Las rutas públicas (sin sesión) no se ven afectadas.
 */
export function requirePolicyAcceptance(req: Request, res: Response, next: NextFunction) {
  const user = req.currentUser;
  if (!user || user.policyAccepted) return next();
  // req.path es relativo al punto de montaje ("/api").
  if (req.path.startsWith("/auth/")) return next();
  return res.status(403).json({
    error: "Debe aceptar la política de protección de datos y la política de cookies para continuar.",
    code: "POLICY_REQUIRED",
  });
}

// Exige que exista un usuario autenticado en la sesión.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.currentUser) {
    return res.status(401).json({ error: "No autenticado. Inicie sesión para continuar." });
  }
  next();
}
