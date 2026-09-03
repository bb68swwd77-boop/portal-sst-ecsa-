import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { asyncHandler } from "../middleware/errorHandler";
import { validateBody } from "../middleware/validate";
import { assertCourseAccess, getCourseDetailForUser, markLessonComplete, recordVideoProgress } from "../services/courses.service";
import { audit } from "../lib/audit";

export const coursesRouter = Router();

coursesRouter.use(requireAuth, requirePermission("courses:view_assigned"));

coursesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    await assertCourseAccess(req.currentUser!, req.params.id);
    const course = await getCourseDetailForUser(req.currentUser!.id, req.params.id);
    res.json({ course });
  })
);

coursesRouter.post(
  "/:id/lessons/:lessonId/complete",
  asyncHandler(async (req, res) => {
    await assertCourseAccess(req.currentUser!, req.params.id);
    await markLessonComplete(req.currentUser!.id, req.params.lessonId);
    await audit({
      userId: req.currentUser!.id,
      action: "lesson.completed",
      resource: `Lesson:${req.params.lessonId}`,
      result: "success",
      req,
    });
    res.json({ ok: true });
  })
);

const videoProgressSchema = z.object({ percentWatched: z.number().min(0).max(100) });

// Heartbeat de reproducción de video (llamado cada ~10s y al detectar el
// evento ENDED del reproductor de YouTube). El usuario viene siempre de la
// sesión autenticada — nunca se acepta un userId del cliente — y la lección
// debe pertenecer a un curso al que el usuario tenga acceso (assertCourseAccess).
coursesRouter.post(
  "/:id/lessons/:lessonId/video-progress",
  validateBody(videoProgressSchema),
  asyncHandler(async (req, res) => {
    await assertCourseAccess(req.currentUser!, req.params.id);
    const result = await recordVideoProgress(req.currentUser!.id, req.params.lessonId, req.body.percentWatched);
    if (result.completed) {
      await audit({
        userId: req.currentUser!.id,
        action: "lesson.completed",
        resource: `Lesson:${req.params.lessonId}`,
        result: "success",
        req,
        metadata: { via: "video-progress", percentWatched: result.percentWatched },
      });
    }
    res.json(result);
  })
);
