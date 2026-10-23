import rateLimit from "express-rate-limit";

// Segunda barrera contra fuerza bruta, por IP, independiente del bloqueo de
// cuenta (3 fallos) del servicio de auth. Solo cuenta los intentos fallidos:
// los trabajadores de un mismo campamento comparten IP pública y los ingresos
// correctos de una cuadrilla no deben agotar el cupo. Frena a quien prueba
// muchas cuentas distintas desde una misma IP (adivinar contraseñas comunes).
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Intente nuevamente en unos minutos." },
});

export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  // Los trabajadores comparten la misma IP pública (red del campamento/oficina):
  // un límite muy bajo bloquearía a todos por las solicitudes de unos pocos.
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Intente nuevamente más tarde." },
});

// Límite general para toda la API — mitiga abuso/DoS básico a nivel de aplicación.
// Se cuenta por IP y los trabajadores comparten la misma IP pública: con el
// heartbeat de conexión y el autoguardado de evaluaciones, 120/min se quedaba corto.
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 400,
  standardHeaders: true,
  legacyHeaders: false,
});
