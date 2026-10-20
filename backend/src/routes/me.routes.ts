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

// Historial propio de capacitación: evaluaciones rendidas, lecciones completadas
// y tiempo en el portal ("Mi historial"). Solo datos del propio usuario.
meRouter.get(
  "/history",
  asyncHandler(async (req, res) => {
    const userId = req.currentUser!.id;
    const courseSelect = { select: { title: true, order: true, course: { select: { title: true } } } } as const;

    const [attempts, lessonRows, completedLessonCount, user] = await Promise.all([
      prisma.evaluationAttempt.findMany({
        where: { userId, status: "SUBMITTED" },
        orderBy: { submittedAt: "desc" },
        take: 200,
        include: { evaluation: { select: { title: true, module: courseSelect } } },
      }),
      prisma.lessonProgress.findMany({
        where: { userId, completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
        take: 200,
        include: { lesson: { select: { title: true, module: courseSelect } } },
      }),
      prisma.lessonProgress.count({ where: { userId, completedAt: { not: null } } }),
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { connectionSeconds: true } }),
    ]);

    res.json({
      summary: {
        connectionSeconds: user.connectionSeconds,
        completedLessons: completedLessonCount,
        attempts: attempts.length,
        passedEvaluations: new Set(attempts.filter((a) => a.passed).map((a) => a.evaluationId)).size,
      },
      attempts: attempts.map((a) => ({
        id: a.id,
        courseTitle: a.evaluation.module.course.title,
        moduleTitle: a.evaluation.module.title,
        moduleOrder: a.evaluation.module.order,
        attemptNumber: a.attemptNumber,
        score: a.score,
        passed: a.passed,
        submittedAt: a.submittedAt,
      })),
      lessons: lessonRows.map((p) => ({
        id: p.id,
        title: p.lesson.title,
        courseTitle: p.lesson.module.course.title,
        moduleTitle: p.lesson.module.title,
        moduleOrder: p.lesson.module.order,
        completedAt: p.completedAt,
      })),
    });
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
