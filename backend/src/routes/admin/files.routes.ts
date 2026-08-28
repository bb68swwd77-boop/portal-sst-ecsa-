import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../middleware/auth";
import { requirePermission } from "../../middleware/rbac";
import { asyncHandler, HttpError } from "../../middleware/errorHandler";
import { uploadPdf } from "../../middleware/upload";
import { prisma } from "../../lib/prisma";
import { audit } from "../../lib/audit";

export const adminFilesRouter = Router();
adminFilesRouter.use(requireAuth, requirePermission("courses:edit"));

adminFilesRouter.post(
  "/upload",
  asyncHandler(async (req, res) => {
    await new Promise<void>((resolve, reject) => {
      uploadPdf(req, res, (err) => (err ? reject(err) : resolve()));
    }).catch((err) => {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        throw new HttpError(400, "El archivo supera el tamaño máximo permitido (10 MB).");
      }
      // El único error no-multer que produce fileFilter es el mensaje ya en
      // español "Solo se permiten archivos PDF." — se reenvía tal cual.
      throw new HttpError(400, err instanceof Error ? err.message : "No fue posible procesar el archivo.");
    });

    if (!req.file) {
      throw new HttpError(400, "Debe adjuntar un archivo PDF.");
    }

    const file = await prisma.fileAsset.create({
      data: {
        filename: req.file.originalname.slice(0, 200),
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        data: req.file.buffer,
        uploadedById: req.currentUser!.id,
      },
    });

    await audit({
      userId: req.currentUser!.id,
      action: "file.upload",
      resource: `FileAsset:${file.id}`,
      result: "success",
      req,
      metadata: { filename: file.filename, sizeBytes: file.sizeBytes },
    });

    res.status(201).json({ file: { id: file.id, filename: file.filename, mimeType: file.mimeType, sizeBytes: file.sizeBytes } });
  })
);
