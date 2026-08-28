import { Router } from "express";
import type { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { requirePermission } from "../../middleware/rbac";
import { asyncHandler, HttpError } from "../../middleware/errorHandler";
import { validateBody } from "../../middleware/validate";
import { evaluationSchema, questionSchema } from "../../validators/evaluations";
import { prisma } from "../../lib/prisma";
import { audit } from "../../lib/audit";

export const adminEvaluationsRouter = Router();
adminEvaluationsRouter.use(requireAuth, requirePermission("evaluations:manage"));

adminEvaluationsRouter.post(
  "/modules/:moduleId",
  validateBody(evaluationSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.evaluation.findUnique({ where: { moduleId: req.params.moduleId } });
    if (existing) throw new HttpError(409, "Este módulo ya tiene una evaluación. Edítela en vez de crear otra.");
    const evaluation = await prisma.evaluation.create({ data: { ...req.body, moduleId: req.params.moduleId } });
    await audit({ userId: req.currentUser!.id, action: "evaluation.create", resource: `Evaluation:${evaluation.id}`, result: "success", req });
    res.status(201).json({ evaluation });
  })
);

adminEvaluationsRouter.put(
  "/:id",
  validateBody(evaluationSchema.partial()),
  asyncHandler(async (req, res) => {
    const evaluation = await prisma.evaluation.update({ where: { id: req.params.id }, data: req.body });
    await audit({ userId: req.currentUser!.id, action: "evaluation.update", resource: `Evaluation:${evaluation.id}`, result: "success", req });
    res.json({ evaluation });
  })
);

adminEvaluationsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const evaluation = await prisma.evaluation.findUnique({
      where: { id: req.params.id },
      include: { questions: { include: { options: true }, orderBy: { order: "asc" } } },
    });
    if (!evaluation) throw new HttpError(404, "Evaluación no encontrada.");
    res.json({ evaluation });
  })
);

adminEvaluationsRouter.post(
  "/:id/questions",
  validateBody(questionSchema),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof questionSchema>;
    const question = await prisma.question.create({
      data: {
        evaluationId: req.params.id,
        type: data.type,
        text: data.text,
        order: data.order,
        points: data.points,
        options: { create: data.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect, order: o.order, matchKey: o.matchKey })) },
      },
      include: { options: true },
    });
    await audit({ userId: req.currentUser!.id, action: "question.create", resource: `Question:${question.id}`, result: "success", req });
    res.status(201).json({ question });
  })
);

adminEvaluationsRouter.put(
  "/questions/:questionId",
  validateBody(questionSchema),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof questionSchema>;
    const question = await prisma.$transaction(async (tx) => {
      await tx.answerOption.deleteMany({ where: { questionId: req.params.questionId } });
      return tx.question.update({
        where: { id: req.params.questionId },
        data: {
          type: data.type,
          text: data.text,
          order: data.order,
          points: data.points,
          options: { create: data.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect, order: o.order, matchKey: o.matchKey })) },
        },
        include: { options: true },
      });
    });
    await audit({ userId: req.currentUser!.id, action: "question.update", resource: `Question:${question.id}`, result: "success", req });
    res.json({ question });
  })
);

adminEvaluationsRouter.delete(
  "/questions/:questionId",
  asyncHandler(async (req, res) => {
    await prisma.question.delete({ where: { id: req.params.questionId } });
    await audit({ userId: req.currentUser!.id, action: "question.delete", resource: `Question:${req.params.questionId}`, result: "success", req });
    res.json({ ok: true });
  })
);
