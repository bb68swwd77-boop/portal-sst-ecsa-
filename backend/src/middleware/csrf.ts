import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

export const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Protección CSRF por patrón "doble envío" (double-submit cookie), adaptado a
 * que frontend y backend viven en dominios distintos (subdominios separados
 * en Render):
 *
 * 1. issueCsrfCookie coloca un token no-HttpOnly en una cookie del backend
 *    (SameSite=None+Secure en producción, para que viaje en fetch cross-site).
 * 2. Como el JS del frontend NO puede leer esa cookie vía document.cookie
 *    (pertenece a otro origen), el valor también se expone en JSON a través
 *    de GET /api/auth/csrf — protegido por CORS (solo el origen configurado
 *    en CORS_ORIGIN puede leer esa respuesta). El frontend guarda ese valor
 *    en memoria y lo reenvía como header X-CSRF-Token en cada mutación.
 * 3. verifyCsrf compara cookie (que el navegador sí adjunta automáticamente)
 *    contra el header: un sitio externo no puede reproducir el header porque
 *    CORS le bloquea leer la respuesta de /api/auth/csrf.
 */
function ensureCsrfToken(req: Request, res: Response): string {
  const existing = req.cookies?.[CSRF_COOKIE];
  if (existing) return existing;

  const token = crypto.randomBytes(32).toString("hex");
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SECURE ? "none" : "lax",
    path: "/",
  });
  return token;
}

export function issueCsrfCookie(req: Request, res: Response, next: NextFunction) {
  ensureCsrfToken(req, res);
  next();
}

export function csrfTokenHandler(req: Request, res: Response) {
  res.json({ csrfToken: ensureCsrfToken(req, res) });
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
