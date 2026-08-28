import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import { env } from "./config/env";
import { loadSession } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";
import { apiRateLimiter } from "./middleware/rateLimit";
import { issueCsrfCookie, verifyCsrf } from "./middleware/csrf";
import { authRouter } from "./routes/auth.routes";
import { coursesRouter } from "./routes/courses.routes";
import { evaluationsRouter } from "./routes/evaluations.routes";
import { certificatesRouter } from "./routes/certificates.routes";
import { meRouter } from "./routes/me.routes";
import { adminUsersRouter } from "./routes/admin/users.routes";
import { adminCoursesRouter } from "./routes/admin/courses.routes";
import { adminEvaluationsRouter } from "./routes/admin/evaluations.routes";
import { adminReportsRouter } from "./routes/admin/reports.routes";
import { adminAuditRouter } from "./routes/admin/audit.routes";
import { adminDashboardRouter } from "./routes/admin/dashboard.routes";

export function createApp() {
  const app = express();

  // Detrás de un proxy/load balancer (Render) para que req.ip / rate limiting sean correctos.
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      // "same-site" bloquearía al frontend: en Render cada subdominio
      // *.onrender.com se trata como un sitio distinto (está en la Public
      // Suffix List). El control de acceso real lo da CORS (origin
      // explícito + credentials) más abajo, no este header.
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );

  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser(env.SESSION_SECRET));
  app.use(apiRateLimiter);
  app.use(issueCsrfCookie);
  app.use(loadSession);

  app.get("/api/health", (_req, res) => res.json({ ok: true, service: "ecsa-sst-backend" }));

  // CSRF: se valida a partir de aquí para todo endpoint mutante de la API.
  app.use("/api", verifyCsrf);

  app.use("/api/auth", authRouter);
  app.use("/api/courses", coursesRouter);
  app.use("/api/evaluations", evaluationsRouter);
  app.use("/api/certificates", certificatesRouter);
  app.use("/api/me", meRouter);
  app.use("/api/admin/dashboard", adminDashboardRouter);
  app.use("/api/admin/users", adminUsersRouter);
  app.use("/api/admin/courses", adminCoursesRouter);
  app.use("/api/admin/evaluations", adminEvaluationsRouter);
  app.use("/api/admin/reports", adminReportsRouter);
  app.use("/api/admin/audit", adminAuditRouter);

  app.use((req, res) => {
    res.status(404).json({ error: "Recurso no encontrado." });
  });

  app.use(errorHandler);

  return app;
}
