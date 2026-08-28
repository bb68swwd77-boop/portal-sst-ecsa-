import { Router } from "express";
import type { z } from "zod";
import crypto from "node:crypto";
import { requireAuth } from "../../middleware/auth";
import { requirePermission } from "../../middleware/rbac";
import { asyncHandler, HttpError } from "../../middleware/errorHandler";
import { validateBody, validateQuery } from "../../middleware/validate";
import { createUserSchema, paginationSchema, updateUserSchema } from "../../validators/users";
import { prisma } from "../../lib/prisma";
import { hashPassword } from "../../lib/hash";
import { audit } from "../../lib/audit";

export const adminUsersRouter = Router();
adminUsersRouter.use(requireAuth, requirePermission("users:view"));

adminUsersRouter.get(
  "/",
  validateQuery(paginationSchema),
  asyncHandler(async (req, res) => {
    const { page, pageSize, search } = req.query as unknown as { page: number; pageSize: number; search?: string };
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: "insensitive" as const } },
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { company: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        include: { role: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    res.json({
      total,
      page,
      pageSize,
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        documentId: u.documentId,
        company: u.company,
        area: u.area,
        position: u.position,
        role: u.role.key,
        isActive: u.isActive,
        isDemo: u.isDemo,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
      })),
    });
  })
);

adminUsersRouter.post(
  "/",
  requirePermission("users:create"),
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof createUserSchema>;
    const role = await prisma.role.findUniqueOrThrow({ where: { key: data.roleKey } });
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new HttpError(409, "Ya existe un usuario con ese correo.");

    // Contraseña temporal aleatoria: el usuario debe restablecerla en su primer acceso.
    const tempPassword = crypto.randomBytes(12).toString("base64url");
    const passwordHash = await hashPassword(tempPassword);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        documentId: data.documentId,
        company: data.company,
        area: data.area,
        position: data.position,
        roleId: role.id,
        passwordHash,
        mustChangePassword: true,
      },
    });

    await audit({ userId: req.currentUser!.id, action: "user.create", resource: `User:${user.id}`, result: "success", req });

    res.status(201).json({
      user: { id: user.id, email: user.email },
      // Se expone solo en respuesta directa al admin que lo crea (no queda en logs ni en BD en texto plano).
      temporaryPassword: tempPassword,
    });
  })
);

adminUsersRouter.put(
  "/:id",
  requirePermission("users:edit"),
  validateBody(updateUserSchema),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof updateUserSchema>;
    const updateData: Record<string, unknown> = { ...data };
    delete updateData.roleKey;

    if (data.roleKey) {
      const role = await prisma.role.findUniqueOrThrow({ where: { key: data.roleKey } });
      updateData.roleId = role.id;
    }

    const user = await prisma.user.update({ where: { id: req.params.id }, data: updateData });
    await audit({ userId: req.currentUser!.id, action: "user.update", resource: `User:${user.id}`, result: "success", req });
    res.json({ ok: true });
  })
);

adminUsersRouter.post(
  "/:id/toggle-active",
  requirePermission("users:edit"),
  asyncHandler(async (req, res) => {
    const target = await prisma.user.findUniqueOrThrow({ where: { id: req.params.id } });
    if (target.id === req.currentUser!.id) {
      throw new HttpError(400, "No puede desactivar su propia cuenta.");
    }
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { isActive: !target.isActive } });
    await prisma.session.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } });
    await audit({
      userId: req.currentUser!.id,
      action: user.isActive ? "user.activated" : "user.deactivated",
      resource: `User:${user.id}`,
      result: "success",
      req,
    });
    res.json({ ok: true, isActive: user.isActive });
  })
);

adminUsersRouter.post(
  "/:id/reset-password",
  requirePermission("users:edit"),
  asyncHandler(async (req, res) => {
    const tempPassword = crypto.randomBytes(12).toString("base64url");
    const passwordHash = await hashPassword(tempPassword);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash, mustChangePassword: true, failedLoginCount: 0, lockedUntil: null },
    });
    await prisma.session.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } });
    await audit({ userId: req.currentUser!.id, action: "user.password_reset_by_admin", resource: `User:${user.id}`, result: "success", req });
    res.json({ ok: true, temporaryPassword: tempPassword });
  })
);

adminUsersRouter.get(
  "/:id/history",
  requirePermission("reports:view"),
  asyncHandler(async (req, res) => {
    const [assignments, attempts, certificates] = await Promise.all([
      prisma.courseAssignment.findMany({ where: { userId: req.params.id }, include: { course: true } }),
      prisma.evaluationAttempt.findMany({
        where: { userId: req.params.id, status: "SUBMITTED" },
        include: { evaluation: { include: { module: { include: { course: true } } } } },
        orderBy: { submittedAt: "desc" },
      }),
      prisma.certificate.findMany({ where: { userId: req.params.id } }),
    ]);
    res.json({ assignments, attempts, certificates });
  })
);
