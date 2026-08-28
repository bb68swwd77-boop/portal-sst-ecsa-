# Despliegue en la nube (Render) — sin instalar nada localmente

Esta guía despliega el backend, el frontend y la base de datos PostgreSQL
usando la infraestructura de Render, sin necesidad de instalar Node.js ni
PostgreSQL en tu equipo. Al final tendrás una URL pública para acceder al
portal desde cualquier navegador.

## Paso 1 — Subir el código a GitHub

Necesitas una cuenta de GitHub (gratuita). Si ya tienes una, solo falta crear
un repositorio vacío y subir esta carpeta:

```bash
cd "portal-sst-ecsa"
git init
git add .
git commit -m "Portal de Capacitación SST — versión inicial"
git branch -M main
git remote add origin https://github.com/<tu-usuario>/portal-sst-ecsa.git
git push -u origin main
```

(Crea antes el repositorio vacío en github.com/new, sin README ni
.gitignore, para evitar conflictos.)

## Paso 2 — Crear cuenta en Render

Entra a https://render.com y crea una cuenta (puede vincularse directamente
con tu cuenta de GitHub). Es gratuita para este proyecto (planes "Free").

## Paso 3 — Desplegar con el Blueprint

1. En el dashboard de Render, click **New** → **Blueprint**.
2. Conecta tu cuenta de GitHub y selecciona el repositorio
   `portal-sst-ecsa`.
3. Render detecta automáticamente el archivo `render.yaml` en la raíz del
   repositorio y propone crear 3 recursos:
   - `ecsa-sst-db` (PostgreSQL, plan free)
   - `ecsa-sst-backend` (servicio web Node.js)
   - `ecsa-sst-frontend` (sitio estático)
4. Click **Apply**. Render construye y despliega los tres automáticamente.
   El primer despliegue del backend ejecuta `npm run release`, que aplica el
   esquema de base de datos (`prisma db push`) y siembra los datos DEMO
   (usuarios, 3 cursos, evaluaciones) — no necesitas ejecutar nada
   manualmente.

## Paso 4 — Ajustar URLs cruzadas (una sola vez)

`render.yaml` asume los nombres de servicio `ecsa-sst-backend` y
`ecsa-sst-frontend`. Si Render les asignó nombres distintos (por ejemplo, ya
existían servicios con ese nombre en tu cuenta):

1. Abre el servicio **frontend** en Render → **Environment** → edita
   `VITE_API_URL` con la URL real del backend + `/api`
   (ej. `https://ecsa-sst-backend-xyz.onrender.com/api`) → **Save, rebuild**.
2. Abre el servicio **backend** → **Environment** → edita `CORS_ORIGIN` con
   la URL real del frontend (ej. `https://ecsa-sst-frontend-xyz.onrender.com`)
   → **Save, rebuild**.

## Paso 5 — Probar

Abre la URL del frontend (`https://ecsa-sst-frontend*.onrender.com`) e
ingresa con las credenciales DEMO documentadas en el README. Verifica el
flujo completo: iniciar sesión → completar una lección → presentar la
evaluación → ver el certificado emitido → verificarlo en
"Verificar certificado".

## Notas sobre el plan gratuito de Render

- Los servicios "Free" se **duermen tras ~15 minutos de inactividad** y
  tardan unos segundos en despertar en la siguiente visita — normal para
  demos, no recomendado tal cual para producción con SLA.
- La base de datos "Free" tiene límite de almacenamiento y expira a los 90
  días si no se actualiza a un plan pago — para uso productivo real, cambiar
  a un plan pago antes de esa fecha.
- `SESSION_SECRET` se genera automáticamente por Render
  (`generateValue: true`); no se comparte código con el valor real.

## Variables sensibles

Ninguna credencial real queda en el repositorio: `DATABASE_URL` y
`SESSION_SECRET` se inyectan por Render como variables de entorno. Los
archivos `.env` locales están en `.gitignore` y nunca deben subirse a
GitHub.
