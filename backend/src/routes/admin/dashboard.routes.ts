import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requirePermission } from "../../middleware/rbac";
import { asyncHandler } from "../../middleware/errorHandler";
import { prisma } from "../../lib/prisma";

export const adminDashboardRouter = Router();
adminDashboardRouter.use(requireAuth, requirePermission("reports:view"));

adminDashboardRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const [totalUsers, activeUsers, activeCourses, totalAttempts, passedAttempts, certificates, courses] = await Promise.all([
      prisma.user.count({ where: { role: { key: "user" } } }),
      prisma.user.count({ where: { role: { key: "user" }, isActive: true } }),
      prisma.course.count({ where: { status: "PUBLISHED" } }),
      prisma.evaluationAttempt.count({ where: { status: "SUBMITTED" } }),
      prisma.evaluationAttempt.count({ where: { status: "SUBMITTED", passed: true } }),
      prisma.certificate.count(),
      prisma.course.findMany({
        where: { status: "PUBLISHED" },
        include: {
          _count: { select: { certificates: true } },
          modules: { include: { evaluation: { include: { attempts: { where: { status: "SUBMITTED" } } } } } },
        },
      }),
    ]);

    const approvalRate = totalAttempts === 0 ? 0 : Math.round((passedAttempts / totalAttempts) * 100);

    const courseBreakdown = courses.map((c) => {
      const attempts = c.modules.flatMap((m) => m.evaluation?.attempts ?? []);
      const passed = attempts.filter((a) => a.passed).length;
      return {
        courseId: c.id,
        title: c.title,
        certificatesIssued: c._count.certificates,
        attempts: attempts.length,
        approvalRate: attempts.length === 0 ? 0 : Math.round((passed / attempts.length) * 100),
      };
    });

    res.json({
      totalUsers,
      activeUsers,
      activeCourses,
      totalAttempts,
      approvalRate,
      certificatesIssued: certificates,
      courseBreakdown,
    });
  })
);
