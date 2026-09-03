import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { asyncHandler } from "../middleware/errorHandler";
import { z } from "zod";
import { validateQuery } from "../middleware/validate";
import { getCertificateForUser, getMyCertificates, verifyCertificateByCode } from "../services/certificates.service";
import { audit } from "../lib/audit";
import { renderCertificatePdf } from "../lib/certificatePdf";
import { env } from "../config/env";

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

certificatesRouter.get(
  "/mine/:id/pdf",
  requireAuth,
  requirePermission("certificates:view"),
  asyncHandler(async (req, res) => {
    const cert = await getCertificateForUser(req.currentUser!.id, req.params.id);
    const pdfBytes = await renderCertificatePdf({
      holderName: `${cert.user.firstName} ${cert.user.lastName}`,
      courseTitle: cert.course.title,
      issuedAt: cert.issuedAt,
      durationMin: cert.durationMin,
      modality: cert.modality,
      code: cert.code,
      // Firma institucional del firmante vigente AL EMITIR — nunca los
      // datos del participante (ver Signatory en el schema).
      signatoryName: cert.signatory?.name ?? "Responsable SSO",
      signatoryPosition: cert.signatory?.position ?? "Departamento de Seguridad y Salud Ocupacional",
      verifyUrl: `${env.CORS_ORIGIN}/verificar-certificado?code=${encodeURIComponent(cert.code)}`,
    });
    await audit({ userId: req.currentUser!.id, action: "certificate.download_pdf", resource: `Certificate:${cert.id}`, result: "success", req });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="certificado-${cert.code}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  })
);

// Endpoint público (sin autenticación): verificación de certificados por
// código. Solo lectura, expone el mínimo necesario (nombre, curso, fecha,
// resultado) — nunca identificación ni otros datos personales.
const verifySchema = z.object({ code: z.string().trim().min(4).max(60) });
certificatesRouter.get(
  "/verify",
  validateQuery(verifySchema),
  asyncHandler(async (req, res) => {
    const { code } = req.query as unknown as { code: string };
    const result = await verifyCertificateByCode(code);
    await audit({ action: "certificate.verify", result: result ? "success" : "failure", req, metadata: { code } });
    if (!result) {
      return res.status(404).json({ valid: false, message: "Código no encontrado — certificado no válido." });
    }
    const { cert, integrityValid } = result;
    res.json({
      valid: true,
      integrityValid,
      certificate: {
        code: cert.code,
        courseTitle: cert.course.title,
        courseCode: cert.course.code,
        durationMin: cert.durationMin,
        modality: cert.modality,
        score: cert.score,
        issuedAt: cert.issuedAt,
        holderName: `${cert.user.firstName} ${cert.user.lastName}`,
        holderCompany: cert.user.company,
        signedBy: cert.signatory ? { name: cert.signatory.name, position: cert.signatory.position } : null,
      },
    });
  })
);
