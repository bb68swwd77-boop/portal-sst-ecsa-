import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido").max(255),
  password: z.string().min(1, "La contraseña es obligatoria").max(200),
});

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido").max(255),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z
    .string()
    .min(10, "La contraseña debe tener al menos 10 caracteres")
    .max(200)
    .regex(/[a-z]/, "Debe incluir una minúscula")
    .regex(/[A-Z]/, "Debe incluir una mayúscula")
    .regex(/[0-9]/, "Debe incluir un número"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: resetPasswordSchema.shape.newPassword,
});
