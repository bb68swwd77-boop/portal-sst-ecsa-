import { Router } from "express";
import { prisma } from "../lib/prisma";
import { audit } from "../lib/audit";
import { asyncHandler, HttpError } from "../middleware/errorHandler";
import { loginRateLimiter, passwordResetRateLimiter } from "../middleware/rateLimit";
import { validateBody } from "../middleware/validate";
import {
  changePasswordSchema,
  loginSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from "../validators/auth";
import { authenticate, changeOwnPassword, createPasswordResetToken, resetPasswordWithToken } from "../services/auth.service";
import { requireAuth } from "../middleware/auth";
import { createSession, destroySession } from "../lib/session";
import { csrfTokenHandler } from "../middleware/csrf";

export const authRouter = Router();

// Público: entrega el token CSRF vigente como JSON (protegido por CORS),
// porque el frontend vive en otro origen y no puede leer la cookie via JS.
// El frontend lo llama una vez al cargar y lo guarda en memoria.
authRouter.get("/csrf", csrfTokenHandler);

authRouter.post(
  "/login",
  loginRateLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = await authenticate(email, password);
      await createSession(res, user.id, req);
      await audit({ userId: user.id, action: "auth.login", result: "success", req });
      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          mustChangePassword: user.mustChangePassword,
        },
      });
    } catch (err) {
      await audit({ action: "auth.login", result: "failure", req, metadata: { email } });
      throw err;
    }
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const userId = req.currentUser?.id;
    await destroySession(req, res);
    await audit({ userId, action: "auth.logout", result: "success", req });
    res.json({ ok: true });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.currentUser });
  })
);

authRouter.post(
  "/password/forgot",
  passwordResetRateLimiter,
  validateBody(requestPasswordResetSchema),
  asyncHandler(async (req, res) => {
    const result = await createPasswordResetToken(req.body.email);
    await audit({ action: "auth.password_reset_requested", result: "success", req, metadata: { email: req.body.email } });
    // TODO(integración de correo): enviar `result.token` por email al usuario.
    // Nunca se devuelve el token en la respuesta HTTP en producción; en DEMO se
    // expone para poder probar el flujo sin servicio de correo configurado.
    res.json({
      ok: true,
      message: "Si el correo existe, se enviaron instrucciones de recuperación.",
      demoToken: process.env.DEMO_MODE === "true" ? result?.token : undefined,
    });
  })
);

authRouter.post(
  "/password/reset",
  passwordResetRateLimiter,
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    await resetPasswordWithToken(req.body.token, req.body.newPassword);
    await audit({ action: "auth.password_reset_completed", result: "success", req });
    res.json({ ok: true });
  })
);

authRouter.post(
  "/password/change",
  requireAuth,
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    await changeOwnPassword(req.currentUser!.id, req.body.currentPassword, req.body.newPassword);
    await audit({ userId: req.currentUser!.id, action: "auth.password_changed", result: "success", req });
    res.json({ ok: true });
  })
);

// Permite al usuario ver/cerrar sus sesiones activas (control de sesiones).
authRouter.get(
  "/sessions",
  requireAuth,
  asyncHandler(async (req, res) => {
    const sessions = await prisma.session.findMany({
      where: { userId: req.currentUser!.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        userAgent: s.userAgent,
        ip: s.ip,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        current: s.id === req.sessionId,
      })),
    });
  })
);

authRouter.post(
  "/sessions/:id/revoke",
  requireAuth,
  asyncHandler(async (req, res) => {
    const session = await prisma.session.findUnique({ where: { id: req.params.id } });
    if (!session || session.userId !== req.currentUser!.id) {
      throw new HttpError(404, "Sesión no encontrada.");
    }
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    res.json({ ok: true });
  })
);
