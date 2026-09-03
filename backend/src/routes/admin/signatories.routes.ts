import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { requirePermission } from "../../middleware/rbac";
import { asyncHandler } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { prisma } from "../../lib/prisma";
import { audit } from "../../lib/audit";

export const adminSignatoriesRouter = Router();
adminSignatoriesRouter.use(requireAuth, requirePermission("signatories:manage"));

adminSignatoriesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const signatories = await prisma.signatory.findMany({ orderBy: { createdAt: "asc" } });
    res.json({ signatories });
  })
);

const signatorySchema = z.object({
  name: z.string().trim().min(2).max(150),
  position: z.string().trim().min(2).max(150),
  isActive: z.boolean().default(true),
});

adminSignatoriesRouter.post(
  "/",
  validateBody(signatorySchema),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof signatorySchema>;
    // Solo un firmante activo a la vez (es el que se usa por defecto al
    // emitir un certificado nuevo) — evita ambigüedad sobre quién firma.
    if (data.isActive) {
      await prisma.signatory.updateMany({ where: { isActive: true }, data: { isActive: false } });
    }
    const signatory = await prisma.signatory.create({ data });
    await audit({ userId: req.currentUser!.id, action: "signatory.create", resource: `Signatory:${signatory.id}`, result: "success", req });
    res.status(201).json({ signatory });
  })
);

adminSignatoriesRouter.put(
  "/:id",
  validateBody(signatorySchema.partial()),
  asyncHandler(async (req, res) => {
    const data = req.body as Partial<z.infer<typeof signatorySchema>>;
    if (data.isActive) {
      await prisma.signatory.updateMany({ where: { isActive: true, id: { not: req.params.id } }, data: { isActive: false } });
    }
    const signatory = await prisma.signatory.update({ where: { id: req.params.id }, data });
    await audit({ userId: req.currentUser!.id, action: "signatory.update", resource: `Signatory:${signatory.id}`, result: "success", req });
    res.json({ signatory });
  })
);
