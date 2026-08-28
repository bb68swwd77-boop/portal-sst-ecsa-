import rateLimit from "express-rate-limit";

// Limita fuerza bruta en login: 10 intentos / 15 min por IP, independiente del
// bloqueo de cuenta (failedLoginCount) que se aplica por usuario en el servicio de auth.
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Intente nuevamente en unos minutos." },
});

export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Intente nuevamente más tarde." },
});

// Límite general para toda la API — mitiga abuso/DoS básico a nivel de aplicación.
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
