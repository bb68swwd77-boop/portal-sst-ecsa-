import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { requirePermission } from "../../middleware/rbac";
import { asyncHandler } from "../../middleware/errorHandler";
import { validateQuery } from "../../middleware/validate";
import { prisma } from "../../lib/prisma";

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
