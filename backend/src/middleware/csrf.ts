import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Protección CSRF por patrón "doble envío" (double-submit cookie):
 * 1. issueCsrfCookie coloca un token legible por JS (no HttpOnly) en una cookie.
 * 2. El frontend debe reenviarlo en el header X-CSRF-Token en cada mutación.
 * 3. verifyCsrf compara cookie vs header — un sitio externo no puede leer la
 *    cookie (mismo origen) para reproducir el header, aunque el navegador
 *    adjunte la cookie de sesión automáticamente.
 * Se complementa con SameSite=Lax en la cookie de sesión y validación de Origin.
 */
export function issueCsrfCookie(req: Request, res: Response, next: NextFunction) {
  if (!req.cookies?.[CSRF_COOKIE]) {
    const token = crypto.randomBytes(32).toString("hex");
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: env.COOKIE_SECURE,
      // Ver comentario en lib/session.ts: frontend y backend son orígenes
      // distintos en producción, por lo que se requiere SameSite=None+Secure
      // para que la cookie viaje en fetch cross-site.
      sameSite: env.COOKIE_SECURE ? "none" : "lax",
      path: "/",
    });
  }
  next();
}

export function verifyCsrf(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: "Solicitud no válida (CSRF). Recargue la página e intente de nuevo." });
  }
  next();
}
