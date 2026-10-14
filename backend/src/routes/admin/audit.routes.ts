import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { requirePermission } from "../../middleware/rbac";
import { asyncHandler } from "../../middleware/errorHandler";
import { validateQuery } from "../../middleware/validate";
import { prisma } from "../../lib/prisma";
import { CURRENT_POLICY_VERSION } from "../../config/policies";

export const adminAuditRouter = Router();
adminAuditRouter.use(requireAuth, requirePermission("audit:view"));

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  action: z.string().trim().max(100).optional(),
  userId: z.string().cuid().optional(),
});

adminAuditRouter.get(
  "/",
  validateQuery(querySchema),
  asyncHandler(async (req, res) => {
    const { page, pageSize, action, userId } = req.query as unknown as z.infer<typeof querySchema>;
    const where = {
      action: action ? { contains: action } : undefined,
      userId: userId || undefined,
    };
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ total, page, pageSize, logs });
  })
);

const acceptancesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().max(100).optional(),
});

// Registro de aceptación de políticas (datos personales y cookies): quién
// aceptó, qué versión, cuándo y desde qué IP, más cuántos usuarios activos
// todavía no han aceptado la versión vigente.
adminAuditRouter.get(
  "/policy-acceptances",
  validateQuery(acceptancesQuerySchema),
  asyncHandler(async (req, res) => {
    const { page, pageSize, search } = req.query as unknown as z.infer<typeof acceptancesQuerySchema>;
    const where = search
      ? {
          user: {
            OR: [
              { code: { contains: search, mode: "insensitive" as const } },
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
            ],
          },
        }
      : {};

    const [total, acceptances, pendingUsers, acceptedCurrent] = await Promise.all([
      prisma.policyAcceptance.count({ where }),
      prisma.policyAcceptance.findMany({
        where,
        include: { user: { select: { firstName: true, lastName: true, code: true, company: true } } },
        orderBy: { acceptedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({
        where: { isActive: true, policyAcceptances: { none: { version: CURRENT_POLICY_VERSION } } },
      }),
      prisma.policyAcceptance.count({ where: { version: CURRENT_POLICY_VERSION } }),
    ]);

    res.json({
      currentVersion: CURRENT_POLICY_VERSION,
      total,
      page,
      pageSize,
      acceptedCurrent,
      pendingUsers,
      acceptances: acceptances.map((a) => ({
        id: a.id,
        version: a.version,
        acceptedAt: a.acceptedAt,
        ip: a.ip,
        user: a.user,
      })),
    });
  })
);
