import { PrismaClient } from "@prisma/client";

// Instancia única reutilizada entre requests (evita agotar el pool de conexiones).
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
