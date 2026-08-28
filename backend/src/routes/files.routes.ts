import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler, HttpError } from "../middleware/errorHandler";
import { prisma } from "../lib/prisma";
import { assertCourseAccess } from "../services/courses.service";

export const filesRouter = Router();

filesRouter.use(requireAuth);

// Sirve el binario de un PDF de lección. Nunca por confianza en el id de la
// URL: valida que el usuario tenga acceso al curso que contiene la lección
// que referencia este archivo (o permiso admin), igual que certificados/cursos.
filesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const file = await prisma.fileAsset.findUnique({ where: { id: req.params.id } });
    if (!file || !file.data) {
      throw new HttpError(404, "Archivo no encontrado.");
    }

    if (!req.currentUser!.permissions.has("courses:view")) {
      const lesson = await prisma.lesson.findFirst({
        where: { fileId: file.id },
        include: { module: { select: { courseId: true } } },
      });
      if (!lesson) {
        throw new HttpError(404, "Archivo no encontrado.");
      }
      await assertCourseAccess(req.currentUser!, lesson.module.courseId);
    }

    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.filename)}"`);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(Buffer.from(file.data));
  })
);
