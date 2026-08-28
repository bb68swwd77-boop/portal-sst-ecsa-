import type { NextFunction, Request, Response } from "express";

/**
 * Middleware de autorización basado en permisos (RBAC), no en comparaciones de rol
 * hardcodeadas (nunca `if (role === "admin")`). Cada endpoint declara el/los
 * permisos exactos que requiere; el rol solo determina qué permisos posee.
 */
export function requirePermission(...permissionKeys: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.currentUser) {
      return res.status(401).json({ error: "No autenticado. Inicie sesión para continuar." });
    }
    const hasAll = permissionKeys.every((key) => req.currentUser!.permissions.has(key));
    if (!hasAll) {
      return res.status(403).json({ error: "No tiene permisos para realizar esta acción." });
    }
    next();
  };
}
