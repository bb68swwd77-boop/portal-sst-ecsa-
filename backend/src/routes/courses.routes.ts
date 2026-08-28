import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { asyncHandler } from "../middleware/errorHandler";
import { assertCourseAccess, getCourseDetailForUser, markLessonComplete } from "../services/courses.service";
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
