import { Router } from "express";
import { prisma } from "../lib/prisma";
import { audit } from "../lib/audit";
import { asyncHandler, HttpError } from "../middleware/errorHandler";
import { loginRateLimiter, passwordResetRateLimiter } from "../middleware/rateLimit";
import { validateBody } from "../middleware/validate";
import {
  acceptPolicySchema,
  changePasswordSchema,
  loginSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from "../validators/auth";
import {
  authenticate,
  changeOwnPassword,
  createPasswordResetToken,
  markResetRequestedByCode,
  resetPasswordWithToken,
} from "../services/auth.service";
import { requireAuth } from "../middleware/auth";
import { createSession, destroySession } from "../lib/session";
import { csrfTokenHandler } from "../middleware/csrf";
import { CURRENT_POLICY_VERSION } from "../config/policies";

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
    const { code, password } = req.body;
    try {
      const user = await authenticate(code, password);
      await createSession(res, user.id, req);
      await audit({ userId: user.id, action: "auth.login", result: "success", req });
      res.json({
        user: {
          id: user.id,
          email: user.email,
          code: user.code,
          firstName: user.firstName,
          lastName: user.lastName,
          mustChangePassword: user.mustChangePassword,
        },
      });
    } catch (err) {
      await audit({ action: "auth.login", result: "failure", req, metadata: { code } });
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
    // Set no serializa a JSON como array (res.json({...Set}) produce "{}"),
    // así que se convierte explícitamente antes de responder.
    res.json({
      user: { ...req.currentUser, permissions: [...req.currentUser!.permissions], policyVersion: CURRENT_POLICY_VERSION },
    });
  })
);

// Aceptación de las políticas de protección de datos y de cookies. Idempotente:
// una fila por usuario y versión (índice único), así que repetir la llamada no
// duplica el registro ni la entrada de auditoría.
authRouter.post(
  "/policies/accept",
  requireAuth,
  validateBody(acceptPolicySchema),
  asyncHandler(async (req, res) => {
    const userId = req.currentUser!.id;
    const created = await prisma.policyAcceptance.createMany({
      data: [
        {
          userId,
          version: CURRENT_POLICY_VERSION,
          ip: req.ip,
          userAgent: req.headers["user-agent"]?.toString().slice(0, 255),
        },
      ],
      skipDuplicates: true,
    });
    if (created.count > 0) {
      await audit({
        userId,
        action: "policy.accepted",
        resource: `Policy:${CURRENT_POLICY_VERSION}`,
        result: "success",
        req,
        metadata: { version: CURRENT_POLICY_VERSION },
      });
    }
    res.json({ ok: true, version: CURRENT_POLICY_VERSION });
  })
);

authRouter.post(
  "/password/forgot",
  passwordResetRateLimiter,
  validateBody(requestPasswordResetSchema),
  asyncHandler(async (req, res) => {
    const identifier = req.body.identifier as string;
    let demoToken: string | undefined;

    if (identifier.includes("@")) {
      // Por correo (reservado para cuando haya envío de correo): genera el token.
      const result = await createPasswordResetToken(identifier.toLowerCase());
      // TODO(integración de correo): enviar `result.token` por email al usuario.
      // Nunca se devuelve el token en la respuesta HTTP salvo en DEMO y solo para
      // cuentas de demostración (isDemo): así se prueba el flujo sin correo, pero
      // nadie puede tomar una cuenta real conociendo solo su correo.
      if (process.env.DEMO_MODE === "true" && result?.user.isDemo) demoToken = result.token;
      await audit({ action: "auth.password_reset_requested", result: "success", req, metadata: { email: identifier } });
    } else {
      // Por código de trabajador (lo habitual: no tienen correo real). Queda
      // registrada la solicitud para que el administrador le entregue una clave
      // temporal desde Usuarios.
      await markResetRequestedByCode(identifier);
      await audit({ action: "auth.password_reset_requested", result: "success", req, metadata: { code: identifier } });
    }

    // Misma respuesta exista o no la cuenta (previene enumeración de usuarios).
    res.json({
      ok: true,
      message: "Solicitud registrada. El administrador del portal le entregará una clave temporal para que vuelva a ingresar.",
      demoToken,
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
    await changeOwnPassword(req.currentUser!.id, req.body.currentPassword, req.body.newPassword, req.sessionId);
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
