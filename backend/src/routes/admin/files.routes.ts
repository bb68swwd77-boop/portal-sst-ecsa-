import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { requireAuth } from "../../middleware/auth";
import { requirePermission } from "../../middleware/rbac";
import { asyncHandler, HttpError } from "../../middleware/errorHandler";
import { uploadPdf, uploadImage } from "../../middleware/upload";
import { prisma } from "../../lib/prisma";
import { audit } from "../../lib/audit";

export const adminFilesRouter = Router();
adminFilesRouter.use(requireAuth, requirePermission("courses:edit"));

// Ejecuta el middleware multer dado, sube el archivo a FileAsset y responde
// — compartido entre /upload (PDF de lecciones) y /upload-image (miniatura
// de capacitación), que solo difieren en el multer y el mensaje de tamaño.
async function handleUpload(
  req: Request,
  res: Response,
  middleware: typeof uploadPdf,
  maxSizeLabel: string,
  requiredFileMessage: string
) {
  await new Promise<void>((resolve, reject) => {
    middleware(req, res, (err) => (err ? reject(err) : resolve()));
  }).catch((err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      throw new HttpError(400, `El archivo supera el tamaño máximo permitido (${maxSizeLabel}).`);
    }
    // El único error no-multer que produce fileFilter es el mensaje ya en
    // español fijado en el fileFilter — se reenvía tal cual.
    throw new HttpError(400, err instanceof Error ? err.message : "No fue posible procesar el archivo.");
  });

  if (!req.file) {
    throw new HttpError(400, requiredFileMessage);
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
}

adminFilesRouter.post(
  "/upload",
  asyncHandler(async (req, res) => {
    await handleUpload(req, res, uploadPdf, "20 MB", "Debe adjuntar un archivo PDF.");
  })
);

adminFilesRouter.post(
  "/upload-image",
  asyncHandler(async (req, res) => {
    await handleUpload(req, res, uploadImage, "5 MB", "Debe adjuntar una imagen.");
  })
);
