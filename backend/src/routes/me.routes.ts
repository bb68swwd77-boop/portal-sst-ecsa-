import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { getDashboardForUser } from "../services/courses.service";
import { prisma } from "../lib/prisma";

export const meRouter = Router();

meRouter.use(requireAuth);

meRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const dashboard = await getDashboardForUser(req.currentUser!.id);
    res.json(dashboard);
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
        firstName: true,
        lastName: true,
        documentId: true,
        company: true,
        area: true,
        position: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
    res.json({ profile: user });
  })
);
