import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { asyncHandler, HttpError } from "../middleware/errorHandler";
import { validateBody } from "../middleware/validate";
import { saveDraftSchema, submitAttemptSchema } from "../validators/evaluations";
import { saveDraft, startAttempt, submitAttempt } from "../services/evaluations.service";
import { assertCourseAccess, assertModuleAccess } from "../services/courses.service";
import { prisma } from "../lib/prisma";

export const evaluationsRouter = Router();

evaluationsRouter.use(requireAuth, requirePermission("evaluations:take"));

evaluationsRouter.post(
  "/:id/start",
  asyncHandler(async (req, res) => {
    const evaluation = await prisma.evaluation.findUnique({
      where: { id: req.params.id },
      include: { module: true },
    });
    if (!evaluation) throw new HttpError(404, "Evaluación no encontrada.");
    await assertCourseAccess(req.currentUser!, evaluation.module.courseId);
    await assertModuleAccess(req.currentUser!, evaluation.module.courseId, evaluation.module.id);

    const attempt = await startAttempt(req.currentUser!.id, req.params.id);
    res.json({ attempt });
  })
);

evaluationsRouter.post(
  "/attempts/:attemptId/submit",
  validateBody(submitAttemptSchema),
  asyncHandler(async (req, res) => {
    const result = await submitAttempt(req.currentUser!.id, req.params.attemptId, req.body.answers, req);
    res.json({ result });
  })
);

// Guarda el borrador de respuestas del intento en curso (autoguardado del
// navegador): si se cae la conexión o se cierra la sesión por inactividad, el
// capacitado retoma donde iba.
evaluationsRouter.put(
  "/attempts/:attemptId/draft",
  validateBody(saveDraftSchema),
  asyncHandler(async (req, res) => {
    await saveDraft(req.currentUser!.id, req.params.attemptId, req.body.answers);
    res.json({ ok: true });
  })
);
