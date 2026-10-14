import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { getDashboardForUser } from "../services/courses.service";
import { prisma } from "../lib/prisma";
import { recordHeartbeat } from "../lib/session";
import { CURRENT_POLICY_VERSION } from "../config/policies";

export const meRouter = Router();

meRouter.use(requireAuth);

meRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const dashboard = await getDashboardForUser(req.currentUser!);
    res.json(dashboard);
  })
);

meRouter.post(
  "/heartbeat",
  asyncHandler(async (req, res) => {
    if (req.sessionId) await recordHeartbeat(req.sessionId, req.currentUser!.id);
    res.json({ ok: true });
  })
);

// Constancia propia de aceptación de políticas (se muestra en "Mi perfil").
meRouter.get(
  "/consents",
  asyncHandler(async (req, res) => {
    const acceptances = await prisma.policyAcceptance.findMany({
      where: { userId: req.currentUser!.id },
      orderBy: { acceptedAt: "desc" },
      select: { version: true, acceptedAt: true },
    });
    res.json({ currentVersion: CURRENT_POLICY_VERSION, acceptances });
  })
);

meRouter.get(
  "/profile",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.currentUser!.id },
      select: {
        id: true,
        email: true,
        code: true,
        firstName: true,
        lastName: true,
        documentId: true,
        company: true,
        area: true,
        position: true,
        category: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
    res.json({ profile: user });
  })
);
