import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

// Valida body/query contra un esquema Zod y reemplaza req.body con los datos
// ya parseados/coercionados. Los errores caen en errorHandler (ZodError -> 400).
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = schema.parse(req.body);
    next();
  };
}

export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.query = schema.parse(req.query);
    next();
  };
}
