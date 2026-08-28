import type { Request, Response } from "express";
import { prisma } from "./prisma";
import { env } from "../config/env";

export const SESSION_COOKIE = "sid";

// Frontend y backend se despliegan como dos orígenes distintos (subdominios
// separados en Render), así que las peticiones fetch entre ellos son
// "cross-site" para el navegador. SameSite=Lax NO se envía en fetch
// cross-site (solo en navegaciones de nivel superior), así que en producción
// (COOKIE_SECURE=true, HTTPS) se usa SameSite=None+Secure. En desarrollo
// local, el proxy de Vite hace que todo sea same-origin, por lo que Lax basta.
function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: (env.COOKIE_SECURE ? "none" : "lax") as "none" | "lax",
    path: "/",
    maxAge: maxAgeMs,
    signed: true,
  };
}

/**
 * Crea una sesión persistida en BD (tabla Session) y coloca la cookie httpOnly
 * firmada con el id de sesión. La sesión es la fuente de verdad en el servidor:
 * revocarla en BD invalida inmediatamente al cliente, sin depender de JWT.
 */
export async function createSession(res: Response, userId: string, req: Request) {
  const ttlMs = env.SESSION_TTL_HOURS * 60 * 60 * 1000;
  const session = await prisma.session.create({
    data: {
      userId,
      userAgent: req.headers["user-agent"]?.toString().slice(0, 255),
      ip: req.ip,
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
  res.cookie(SESSION_COOKIE, session.id, cookieOptions(ttlMs));
  return session;
}

export async function destroySession(req: Request, res: Response) {
  const sessionId = req.signedCookies?.[SESSION_COOKIE];
  if (sessionId) {
    await prisma.session.updateMany({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export async function getValidSession(sessionId: string | undefined) {
  if (!sessionId) return null;
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  return session;
}
