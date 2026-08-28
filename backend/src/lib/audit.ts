import type { Request } from "express";
import { prisma } from "./prisma";

interface AuditParams {
  userId?: string | null;
  action: string;
  resource?: string;
  result: "success" | "failure";
  req?: Request;
  metadata?: Record<string, unknown>;
}

// Registro de auditoría "best effort": nunca debe tumbar el request si falla.
export async function audit({ userId, action, resource, result, req, metadata }: AuditParams) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        resource,
        result,
        ip: req?.ip,
        userAgent: req?.headers["user-agent"]?.toString().slice(0, 255),
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      },
    });
  } catch (err) {
    console.error("No fue posible registrar auditoría", action, err);
  }
}
