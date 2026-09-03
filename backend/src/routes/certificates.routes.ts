import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { asyncHandler } from "../middleware/errorHandler";
import { z } from "zod";
import { validateQuery } from "../middleware/validate";
import { getCertificateForUser, getMyCertificates, verifyCertificateByCode } from "../services/certificates.service";
import { audit } from "../lib/audit";

export const certificatesRouter = Router();

certificatesRouter.get(
  "/mine",
  requireAuth,
  requirePermission("certificates:view"),
  asyncHandler(async (req, res) => {
    const certificates = await getMyCertificates(req.currentUser!.id);
    res.json({ certificates });
  })
);

certificatesRouter.get(
  "/mine/:id",
  requireAuth,
  requirePermission("certificates:view"),
  asyncHandler(async (req, res) => {
    const cert = await getCertificateForUser(req.currentUser!.id, req.params.id);
    res.json({ certificate: cert });
  })
);

// Endpoint público (sin autenticación): verificación de certificados por código.
const verifySchema = z.object({ code: z.string().trim().min(4).max(60) });
certificatesRouter.get(
  "/verify",
  validateQuery(verifySchema),
  asyncHandler(async (req, res) => {
    const { code } = req.query as unknown as { code: string };
    const cert = await verifyCertificateByCode(code);
    await audit({ action: "certificate.verify", result: cert ? "success" : "failure", req, metadata: { code } });
    if (!cert) {
      return res.status(404).json({ valid: false, message: "Certificado no encontrado o revocado." });
    }
    res.json({
      valid: true,
      certificate: {
        code: cert.code,
        courseTitle: cert.course.title,
        courseCode: cert.course.code,
        durationMin: cert.course.durationMin,
        score: cert.score,
        issuedAt: cert.issuedAt,
        holderName: `${cert.user.firstName} ${cert.user.lastName}`,
        holderDocument: cert.user.documentId,
        holderCompany: cert.user.company,
      },
    });
  })
);
