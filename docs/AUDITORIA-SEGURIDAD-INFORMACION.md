# Auditoría de seguridad de la información — Portal de Capacitación SST (ECSA)

- **Fecha:** 14 de octubre de 2026
- **Alcance:** código fuente del backend (Node/Express/Prisma) y del frontend (React/Vite), esquema de base de datos, configuración de despliegue (`render.yaml`) y flujos de autenticación, sesiones, archivos, evaluaciones, certificados y reportes.
- **Método:** revisión estática de código y configuración. **No** incluye pruebas de penetración, escaneo de dependencias (`npm audit`) ni revisión de la configuración interna de Render/Neon: el equipo de desarrollo no tiene Node instalado y esos puntos quedan pendientes.
- **Referencia:** buenas prácticas OWASP (ASVS / Top 10) y Ley Orgánica de Protección de Datos Personales del Ecuador (LOPDP).

## 1. Resumen

El portal tiene una base de seguridad sólida (hash Argon2id, sesiones en base de datos con revocación, CSRF, RBAC por permisos, validación con Zod, saneamiento de HTML, auditoría). Los riesgos relevantes **no** están en el diseño sino en la **configuración de la fase piloto**: cuentas DEMO con contraseña pública y modo DEMO activo en producción.

| Severidad | Total | Corregidos en este cambio | Abiertos |
|---|---|---|---|
| Alto | 3 | 1 | 2 |
| Medio | 8 | 4 (más 1 parcial: M-05) | 3 |
| Bajo / informativo | 8 | 0 | 8 |

## 2. Hallazgos

| ID | Sev. | Hallazgo | Estado |
|---|---|---|---|
| H-01 | Alto | **Cuentas DEMO con contraseña pública en producción.** `DEMO-ADMIN` tiene rol administrador y la clave `Demo#2026Sst`, que además se muestra en la pantalla de acceso. `DEMO_MODE=true` en `render.yaml` y el seed restablece esas cuentas en cada despliegue. Quien conozca el código tiene control total del portal. | **Abierto** — requiere decisión (ver §4) |
| H-02 | Alto | **Token de recuperación de contraseña expuesto.** Con `DEMO_MODE=true`, `/auth/password/forgot` devolvía el token en la respuesta para *cualquier* correo. Los correos del piloto son `<código>@ecsa.local`, es decir deducibles → toma de cuenta (incluidas las de administrador) sin autenticación. | **Corregido** — el token solo se devuelve para cuentas `isDemo` |
| H-03 | Alto | **Contraseña inicial compartida y conocida** (`Demo#2026Sst`) para ~50 cuentas piloto, con códigos numéricos consecutivos. Hasta que cada persona la cambie, su cuenta es accesible para cualquiera que conozca el código. Mitiga: cambio obligatorio en el primer ingreso. | **Abierto** — riesgo aceptado en piloto (ver §4) |
| M-01 | Medio | **Número de identificación expuesto en un endpoint público** (`/certificates/verify` devolvía `holderDocument`). El frontend ni siquiera lo mostraba. | **Corregido** |
| M-02 | Medio | **Las sesiones no se cerraban al cambiar o restablecer la contraseña**: una sesión robada seguía viva. | **Corregido** — se revocan las demás sesiones (cambio) o todas (restablecimiento) |
| M-03 | Medio | **No existía política de protección de datos, política de cookies ni registro de aceptación** (exigencia de la LOPDP: información al titular y constancia). | **Corregido** — ver §3 |
| M-04 | Medio | **Enlaces externos con esquema libre**: `externalUrl` aceptaba `javascript:` y se mostraba como enlace clicable a los capacitados (XSS almacenado por un administrador). | **Corregido** — solo `http://` y `https://` |
| M-05 | Medio | **Cabeceras de seguridad del frontend incompletas** (solo `X-Frame-Options` y `nosniff`). | **Parcial** — añadidos HSTS, Referrer-Policy y Permissions-Policy; falta CSP (requiere pruebas con el reproductor de YouTube) |
| M-06 | Medio | **Límite de intentos de login por IP** (10 / 15 min). En una red compartida (NAT del campamento) un solo usuario descuidado puede bloquear el acceso de muchos; y el bloqueo por cuenta (5 intentos / 15 min) permite bloquear cuentas ajenas conociendo el código. | **Abierto** |
| M-07 | Medio | **Validación de archivos solo por el tipo MIME declarado por el cliente**; no se verifica la firma real (`%PDF-`, cabeceras de imagen). Solo administradores suben, por lo que el riesgo es bajo. | **Abierto** |
| M-08 | Medio | **Cierre por inactividad solo en el navegador** (10 min). El servidor únicamente aplica un TTL absoluto de 8 h; una sesión robada no caduca por inactividad. | **Abierto** |
| L-01 | Bajo | La bitácora guarda el `code` ingresado en los intentos fallidos: si alguien escribe su contraseña en ese campo, queda registrada. | Abierto |
| L-02 | Bajo | Sin política de depuración/retención de `AuditLog` y `Session` (crecen indefinidamente). | Abierto |
| L-03 | Bajo | **Sin plan de respaldo y recuperación documentado.** Ya ocurrió una pérdida real de datos (base gratuita caducada). | Abierto — recomendado |
| L-04 | Bajo | La cadena de conexión de la base Neon se compartió en una conversación: debe rotarse la contraseña. | Abierto — recomendado |
| L-05 | Info | Sin autenticación multifactor para administradores. | Abierto |
| L-06 | Info | Datos alojados en proveedores cuyos servidores pueden estar fuera del Ecuador (Render / Neon): evaluar transferencia internacional y cláusulas contractuales. | Abierto |
| L-07 | Info | Doble envío de cookie CSRF sin firma: aceptable porque `onrender.com` es sufijo público; revisar si se migra a dominio propio. | Informativo |
| L-08 | Info | `npm audit` / escaneo de dependencias no ejecutado. | Pendiente |

## 3. Controles añadidos en este cambio

### Política de protección de datos y política de cookies
- Dos documentos bilingües (ES / 中文) en `frontend/src/content/policies.ts`, basados en los datos reales que trata el portal y en las cookies reales que usa (`sid`, `csrf_token`, `ecsa-lang`, `ecsa-sidebar-collapsed`).
- Consulta pública en `/politicas` (enlazada desde la pantalla de acceso) y desde «Mi perfil».

### Aceptación una sola vez, con registro
- Al ingresar, antes de cualquier otra pantalla (incluso antes del cambio de contraseña), el usuario ve ambas políticas y debe marcar la casilla de aceptación. Solo se pide **una vez por versión**.
- **Registro:** tabla `PolicyAcceptance` — usuario, versión, fecha y hora, IP y navegador; índice único por usuario+versión (no se duplica). Además se escribe `policy.accepted` en la bitácora de auditoría.
- **Cumplimiento real, no solo visual:** el servidor bloquea toda la API (403 `POLICY_REQUIRED`) salvo `/api/auth/*` mientras el usuario no haya aceptado la versión vigente.
- **Nueva versión:** si cambia el texto, se sube `CURRENT_POLICY_VERSION` (`backend/src/config/policies.ts`) y todos deben aceptar de nuevo; las aceptaciones anteriores se conservan como historial.
- **Consulta del registro:** Panel administrativo → Auditoría → pestaña «Aceptación de políticas» (quién aceptó, versión, fecha, IP; cuántos usuarios faltan). Cada usuario ve su propia constancia en «Mi perfil».

### Correcciones de seguridad
H-02, M-01, M-02, M-04 y parte de M-05 (ver tabla).

## 4. Decisiones pendientes del responsable del portal

1. **H-01 — cuentas DEMO:** cuando termine la fase de demostración, poner `DEMO_MODE=false` en Render y desactivar `DEMO-ADMIN`, `DEMO-USER1` y `DEMO-USER2` desde Usuarios. Mientras sigan activas, cualquiera que conozca el código y la clave genérica es administrador.
2. **H-03 — contraseña compartida:** definir una fecha límite para el primer cambio y desactivar las cuentas que no lo hayan hecho; idealmente pasar a contraseñas temporales individuales.
3. **L-04 — rotar** la contraseña de Neon (Neon → Settings → Reset password) y actualizar `DATABASE_URL` en Render.
4. **L-03 — respaldos:** programar un respaldo periódico de la base (por ejemplo `pg_dump` semanal) y probar una restauración.
5. **Revisión legal:** el texto de las políticas es una base de trabajo; debe validarlo el área legal o el delegado de protección de datos de ECSA, que además debe indicar el canal oficial para ejercer derechos.

## 5. Controles ya existentes (se mantienen)

Hash Argon2id · sesiones en base de datos con revocación inmediata · cookie `HttpOnly`, `Secure`, firmada · protección CSRF (doble envío) · RBAC por permisos en cada endpoint · bloqueo de cuenta tras intentos fallidos · mensajes de login genéricos (anti-enumeración) · limitador de tasa general y de login · validación de entradas con Zod · saneamiento de HTML con DOMPurify · cabeceras Helmet con CSP en la API · respuestas de error sin detalles técnicos · las respuestas correctas de las evaluaciones nunca viajan al navegador antes de calificar · control de acceso a archivos por asignación · bitácora de auditoría · cierre de sesión por inactividad (10 min).
