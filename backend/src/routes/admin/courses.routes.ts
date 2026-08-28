import { Router } from "express";
import type { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { requirePermission } from "../../middleware/rbac";
import { asyncHandler, HttpError } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { assignmentSchema, courseSchema, lessonSchema, moduleSchema } from "../../validators/courses";
import { prisma } from "../../lib/prisma";
import { audit } from "../../lib/audit";
import { sanitizeRichText } from "../../lib/sanitize";

export const adminCoursesRouter = Router();
adminCoursesRouter.use(requireAuth, requirePermission("courses:view"));

adminCoursesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const courses = await prisma.course.findMany({
      include: { _count: { select: { modules: true, assignments: true, certificates: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ courses });
  })
);

adminCoursesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: {
            lessons: { orderBy: { order: "asc" } },
            evaluation: { include: { questions: { include: { options: true }, orderBy: { order: "asc" } } } },
          },
        },
        assignments: true,
      },
    });
    if (!course) throw new HttpError(404, "Capacitación no encontrada.");
    res.json({ course });
  })
);

adminCoursesRouter.post(
  "/",
  requirePermission("courses:create"),
  validateBody(courseSchema),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof courseSchema>;
    const existing = await prisma.course.findUnique({ where: { code: data.code } });
    if (existing) throw new HttpError(409, "Ya existe una capacitación con ese código.");
    const course = await prisma.course.create({ data: { ...data, imageUrl: data.imageUrl || undefined } });
    await audit({ userId: req.currentUser!.id, action: "course.create", resource: `Course:${course.id}`, result: "success", req });
    res.status(201).json({ course });
  })
);

adminCoursesRouter.put(
  "/:id",
  requirePermission("courses:edit"),
  validateBody(courseSchema.partial()),
  asyncHandler(async (req, res) => {
    const data = req.body as Partial<z.infer<typeof courseSchema>>;
    const course = await prisma.course.update({
      where: { id: req.params.id },
      data: { ...data, imageUrl: data.imageUrl || undefined },
    });
    await audit({
      userId: req.currentUser!.id,
      action: data.status ? "course.status_change" : "course.update",
      resource: `Course:${course.id}`,
      result: "success",
      req,
      metadata: { status: data.status },
    });
    res.json({ course });
  })
);

adminCoursesRouter.delete(
  "/:id",
  requirePermission("courses:delete"),
  asyncHandler(async (req, res) => {
    await prisma.course.delete({ where: { id: req.params.id } });
    await audit({ userId: req.currentUser!.id, action: "course.delete", resource: `Course:${req.params.id}`, result: "success", req });
    res.json({ ok: true });
  })
);

// --- Módulos ---------------------------------------------------------------

adminCoursesRouter.post(
  "/:id/modules",
  requirePermission("courses:edit"),
  validateBody(moduleSchema),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof moduleSchema>;
    const module = await prisma.module.create({ data: { ...data, courseId: req.params.id } });
    await audit({ userId: req.currentUser!.id, action: "module.create", resource: `Module:${module.id}`, result: "success", req });
    res.status(201).json({ module });
  })
);

adminCoursesRouter.put(
  "/modules/:moduleId",
  requirePermission("courses:edit"),
  validateBody(moduleSchema.partial()),
  asyncHandler(async (req, res) => {
    const module = await prisma.module.update({ where: { id: req.params.moduleId }, data: req.body });
    await audit({ userId: req.currentUser!.id, action: "module.update", resource: `Module:${module.id}`, result: "success", req });
    res.json({ module });
  })
);

adminCoursesRouter.delete(
  "/modules/:moduleId",
  requirePermission("courses:edit"),
  asyncHandler(async (req, res) => {
    await prisma.module.delete({ where: { id: req.params.moduleId } });
    await audit({ userId: req.currentUser!.id, action: "module.delete", resource: `Module:${req.params.moduleId}`, result: "success", req });
    res.json({ ok: true });
  })
);

// --- Lecciones ---------------------------------------------------------------

adminCoursesRouter.post(
  "/modules/:moduleId/lessons",
  requirePermission("courses:edit"),
  validateBody(lessonSchema),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof lessonSchema>;
    const lesson = await prisma.lesson.create({
      data: {
        ...data,
        bodyHtml: sanitizeRichText(data.bodyHtml),
        externalUrl: data.externalUrl || undefined,
        moduleId: req.params.moduleId,
      },
    });
    await audit({ userId: req.currentUser!.id, action: "lesson.create", resource: `Lesson:${lesson.id}`, result: "success", req });
    res.status(201).json({ lesson });
  })
);

adminCoursesRouter.put(
  "/lessons/:lessonId",
  requirePermission("courses:edit"),
  validateBody(lessonSchema.partial()),
  asyncHandler(async (req, res) => {
    const data = req.body as Partial<z.infer<typeof lessonSchema>>;
    const lesson = await prisma.lesson.update({
      where: { id: req.params.lessonId },
      data: {
        ...data,
        bodyHtml: data.bodyHtml !== undefined ? sanitizeRichText(data.bodyHtml) : undefined,
        externalUrl: data.externalUrl || undefined,
      },
    });
    await audit({ userId: req.currentUser!.id, action: "lesson.update", resource: `Lesson:${lesson.id}`, result: "success", req });
    res.json({ lesson });
  })
);

adminCoursesRouter.delete(
  "/lessons/:lessonId",
  requirePermission("courses:edit"),
  asyncHandler(async (req, res) => {
    await prisma.lesson.delete({ where: { id: req.params.lessonId } });
    await audit({ userId: req.currentUser!.id, action: "lesson.delete", resource: `Lesson:${req.params.lessonId}`, result: "success", req });
    res.json({ ok: true });
  })
);

// --- Asignaciones ------------------------------------------------------------

adminCoursesRouter.post(
  "/:id/assignments",
  requirePermission("courses:edit"),
  validateBody(assignmentSchema),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof assignmentSchema>;
    if (data.targetType === "USER" && !data.userId) {
      throw new HttpError(400, "Debe indicar el usuario a asignar.");
    }
    if (["COMPANY", "AREA", "POSITION"].includes(data.targetType) && !data.targetValue) {
      throw new HttpError(400, "Debe indicar el valor de segmentación (empresa/área/cargo).");
    }
    const assignment = await prisma.courseAssignment.create({
      data: { ...data, courseId: req.params.id, createdBy: req.currentUser!.id },
    });
    await audit({
      userId: req.currentUser!.id,
      action: "course.assign",
      resource: `Course:${req.params.id}`,
      result: "success",
      req,
      metadata: data,
    });
    res.status(201).json({ assignment });
  })
);

adminCoursesRouter.delete(
  "/assignments/:assignmentId",
  requirePermission("courses:edit"),
  asyncHandler(async (req, res) => {
    await prisma.courseAssignment.delete({ where: { id: req.params.assignmentId } });
    res.json({ ok: true });
  })
);
