import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  documentId: z.string().trim().max(50).optional(),
  company: z.string().trim().max(150).optional(),
  area: z.string().trim().max(150).optional(),
  position: z.string().trim().max(150).optional(),
  roleKey: z.enum(["admin", "user"]).default("user"),
});

export const updateUserSchema = createUserSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
});
