# Arquitectura — Portal de Capacitación SST ECSA

## 1. Stack y justificación

| Capa | Elección | Por qué |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | SPA rápida de desarrollar, tipado end-to-end, build estático fácil de desplegar como sitio estático. |
| Backend | Node.js + Express + TypeScript | Mismo lenguaje que el frontend, ecosistema maduro, control explícito del middleware de seguridad (no una convención mágica que oculte dónde se valida un permiso). |
| Base de datos | PostgreSQL | Relacional, soporta bien RBAC normalizado, transacciones ACID necesarias para calificar evaluaciones y emitir certificados de forma consistente. |
| ORM | Prisma | Esquema tipado, migraciones, cliente type-safe que reduce errores de SQL injection por construcción manual de queries. |
| Sesiones | Cookie httpOnly + tabla `Session` en BD | A diferencia de JWT autocontenido, una sesión revocada en servidor deja de funcionar inmediatamente — requisito explícito de "control de sesiones activas". |
| Despliegue | Render (blueprint `render.yaml`) | Backend + frontend + Postgres desde un solo repo Git, sin instalar Node/Postgres localmente ni gestionar servidores. |

## 2. Modelo de datos (resumen)

`User, Role, Permission, RolePermission` — RBAC normalizado.
`Course, Module, Lesson, LessonProgress, FileAsset` — contenido y avance.
`CourseAssignment` — asignación por usuario, empresa, área, cargo o "todos".
`Evaluation, Question, AnswerOption, EvaluationAttempt, AttemptAnswer` —
evaluaciones; `AnswerOption.isCorrect` nunca sale del backend antes de
calificar.
`Certificate` — código público verificable, independiente del id interno.
`Session, PasswordReset` — autenticación.
`AuditLog` — trazabilidad.

Ver `backend/prisma/schema.prisma` para el detalle completo con índices y
relaciones.

## 3. RBAC

Permisos: `courses:create/edit/delete/view/view_assigned`,
`users:create/edit/view`, `reports:view`, `evaluations:manage/take`,
`certificates:view`, `audit:view`.

El rol `admin` tiene todos los permisos; el rol `user` solo
`courses:view_assigned`, `evaluations:take`, `certificates:view`. Cada
endpoint declara explícitamente qué permiso requiere
(`requirePermission("courses:create")`) — nunca hay una comparación directa
de rol en la lógica de negocio.

## 4. Endpoints principales

```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/password/forgot
POST   /api/auth/password/reset
POST   /api/auth/password/change
GET    /api/auth/sessions
POST   /api/auth/sessions/:id/revoke

GET    /api/me/dashboard
GET    /api/me/profile

GET    /api/courses/:id
POST   /api/courses/:id/lessons/:lessonId/complete

POST   /api/evaluations/:id/start
POST   /api/evaluations/attempts/:attemptId/submit

GET    /api/certificates/mine
GET    /api/certificates/mine/:id
GET    /api/certificates/mine/:id/pdf         (certificado personalizado en PDF)
GET    /api/certificates/verify?code=...      (público)

GET    /api/admin/dashboard
GET    /api/admin/users
POST   /api/admin/users
PUT    /api/admin/users/:id
POST   /api/admin/users/:id/toggle-active
POST   /api/admin/users/:id/reset-password

GET    /api/admin/courses
POST   /api/admin/courses
PUT    /api/admin/courses/:id
DELETE /api/admin/courses/:id
POST   /api/admin/courses/:id/modules
POST   /api/admin/courses/modules/:moduleId/lessons
POST   /api/admin/courses/:id/assignments

POST   /api/admin/evaluations/modules/:moduleId
POST   /api/admin/evaluations/:id/questions

GET    /api/admin/reports/training?format=json|csv
GET    /api/admin/audit

POST   /api/admin/files/upload   (multipart, PDF, máx. 10MB)
GET    /api/files/:id            (descarga — valida acceso al curso)

GET    /api/admin/signatories
POST   /api/admin/signatories
PUT    /api/admin/signatories/:id
GET    /api/certificates/mine/:id/pdf   (certificado en PDF con QR de verificación)
```

Ningún endpoint `/api/admin/*` es alcanzable sin el permiso correspondiente
(`requireAuth` + `requirePermission`, validado en servidor).

## 5. Seguridad — mapeo contra requisitos

- **Contraseñas**: Argon2id (`backend/src/lib/hash.ts`), nunca en frontend/localStorage.
- **Sesiones**: cookie firmada `httpOnly`+`Secure`+`SameSite=Lax`, respaldada
  por tabla `Session` — revocar = invalidar de inmediato.
- **CSRF**: patrón doble cookie (`backend/src/middleware/csrf.ts`) — el
  frontend reenvía `X-CSRF-Token` en cada mutación.
- **XSS**: CSP estricta (Helmet) + sanitización de HTML enriquecido con
  DOMPurify antes de persistir contenido de lecciones.
- **SQL Injection**: Prisma parametriza todas las queries; no hay SQL crudo.
- **IDOR**: cada consulta de curso/certificado/intento valida ownership o
  permiso admin en el servidor (`assertCourseAccess`,
  `getCertificateForUser`), nunca solo el id de la URL.
- **Rate limiting**: login (10/15min), recuperación de contraseña
  (5/hora), API general (120/min).
- **Bloqueo de cuenta**: 5 intentos fallidos → bloqueo 15 minutos.
- **Enumeración de usuarios**: mensajes de error idénticos en login y
  recuperación de contraseña exista o no la cuenta.
- **Errores**: `errorHandler` nunca expone stack traces ni detalles SQL al
  cliente.
- **Auditoría**: login/logout, cambios de usuario, creación/publicación de
  cursos, envío de evaluaciones, emisión de certificados, verificación de
  certificados.
- **Evaluaciones**: `AnswerOption.isCorrect` se omite explícitamente en el
  payload de inicio de intento; la calificación se calcula server-side en
  `evaluations.service.ts`.
- **Certificados — integridad y firma**: el código, la fecha de emisión y el
  hash (`contentHash`, SHA-256 de participante+curso+fecha+duración+
  modalidad+calificación) se generan siempre en `evaluations.service.ts`
  (servidor), nunca a partir de datos enviados por el cliente. `GET
  /certificates/verify` recalcula el hash contra los valores actuales en BD
  y expone `integrityValid` — si alguien edita el registro directamente en
  la base de datos, la próxima verificación lo delata. La firma que aparece
  en el PDF/verificación viene siempre de `Signatory` (firmante institucional
  activo al momento de emitir), nunca del usuario que recibe el certificado
  — ver `backend/prisma/schema.prisma` y `routes/admin/signatories.routes.ts`.
  No hay equivalente a "RLS" porque no aplica: el cliente nunca tiene acceso
  directo a la base de datos (a diferencia de Supabase), solo a la API REST,
  y la tabla `Certificate` únicamente se escribe desde código de servidor
  (`maybeIssueCertificate`), nunca desde un endpoint que el cliente controle.

## 6. Escalabilidad futura (no implementado en el MVP, arquitectura lo permite)

Notificaciones por correo/vencimiento, exportación Excel/PDF, carga de
archivos a almacenamiento de objetos (S3-compatible) usando el modelo
`FileAsset` ya definido, recertificaciones, código QR en certificados,
integración Microsoft 365/Power BI vía la API REST existente.
