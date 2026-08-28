# Portal de Capacitación SST — ECSA Contratistas

Aplicación web completa (no una maqueta HTML) para gestionar capacitación en
Seguridad y Salud en el Trabajo de contratistas: cursos con módulos y
lecciones, evaluaciones calificadas en servidor, certificados verificables,
panel administrativo, reportes y auditoría.

## Estructura del proyecto

```
/backend    API REST (Node.js + Express + TypeScript + Prisma + PostgreSQL)
/frontend   Aplicación web (React + TypeScript + Vite)
/docs       Arquitectura y guía de despliegue
render.yaml Blueprint de despliegue en Render (backend + frontend + BD, sin instalar nada localmente)
```

Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para el diseño completo
(modelo de datos, RBAC, API, decisiones de seguridad) y
[docs/DEPLOY.md](docs/DEPLOY.md) para desplegar el portal en la nube paso a
paso sin instalar Node.js ni PostgreSQL en tu equipo.

## Requisitos

- Node.js 20+ y PostgreSQL 14+ **solo si vas a ejecutar el proyecto
  localmente**. Si prefieres no instalar nada, sigue `docs/DEPLOY.md` para
  desplegar directamente en Render usando su propia infraestructura.

## Ejecución local (opcional)

```bash
# Backend
cd backend
cp .env.example .env   # completar DATABASE_URL y SESSION_SECRET
npm install
npm run prisma:push    # crea el esquema en la base de datos
npm run seed            # datos DEMO (usuarios, 3 cursos, evaluaciones)
npm run dev              # http://localhost:4000

# Frontend (otra terminal)
cd frontend
npm install
npm run dev              # http://localhost:5173
```

## Credenciales DEMO

Generadas por `npm run seed`, **solo para entornos de desarrollo**:

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@example.com | Demo#2026Sst |
| Capacitado | usuario1@example.com | Demo#2026Sst |
| Capacitado | usuario2@example.com | Demo#2026Sst |

Cambia estas contraseñas o elimina los usuarios DEMO (`isDemo: true`) antes de
usar el sistema con datos reales.

## Seguridad — resumen

- Contraseñas con Argon2id (nunca texto plano, nunca en el frontend).
- Sesiones server-side revocables (no JWT autocontenido) con cookies
  `httpOnly` + `Secure` + `SameSite=Lax`.
- RBAC real: cada endpoint valida permisos (`courses:create`,
  `evaluations:take`, etc.), nunca `if (role === "admin")`.
- Las respuestas correctas de evaluación **nunca** se envían al navegador
  antes de calificar; la calificación ocurre en el backend.
- Protección CSRF (doble cookie), rate limiting, CSP, Helmet, sanitización de
  HTML enriquecido (DOMPurify), validación Zod en cada endpoint.
- IDOR: todo acceso a curso/certificado/intento verifica ownership o permiso
  en el servidor, no solo en la URL.
- Auditoría de eventos sensibles (`AuditLog`) consultable desde el panel
  admin.

Ver la sección de seguridad de [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
para el detalle completo y el mapeo contra OWASP Top 10.

## Estado del MVP

Incluido: autenticación completa, dashboard de usuario, cursos → módulos →
lecciones → evaluación → calificación → certificado, panel admin (usuarios,
cursos/módulos/evaluaciones/preguntas, asignaciones, reportes exportables a
CSV, auditoría).

**Carga de archivos PDF**: los administradores pueden adjuntar un PDF a una
lección (máx. 10 MB). Para el MVP el archivo se guarda como binario en la
propia base de datos PostgreSQL (`FileAsset.data`), no en almacenamiento de
objetos — decisión deliberada para evitar depender de una cuenta/API externa
adicional (ver `docs/ARCHITECTURE.md`). La descarga (`GET /api/files/:id`)
valida acceso al curso igual que el resto del contenido (no por confianza en
el id de la URL). Si el volumen de documentos crece, migrar a
almacenamiento de objetos (ej. Cloudflare R2) es sencillo: `FileAsset.storageKey`
ya existe para ese propósito.

Pendiente para siguientes iteraciones (documentado, no bloqueante para el
MVP): envío real de correos (hoy el flujo de recuperación de contraseña
expone el token solo en `DEMO_MODE`), exportación a Excel/PDF de reportes,
migración de archivos a almacenamiento de objetos si el volumen crece,
notificaciones por vencimiento, migraciones Prisma formales (el MVP usa
`prisma db push`).
