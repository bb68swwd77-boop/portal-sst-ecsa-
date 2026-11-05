import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { asyncHandler, HttpError } from "../middleware/errorHandler";
import { prisma } from "../lib/prisma";
import { audit } from "../lib/audit";

// Enlace al dashboard de Power BI. El portal NO incrusta ni almacena datos del
// dashboard: solo guarda el enlace y lo muestra como botón a las personas que un
// administrador autorizó. El control real de acceso lo hace Power BI (inicio de
// sesión de la organización + licencia).
const SETTING_KEY = "powerbi_dashboard_url";

async function readUrl(): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  return row?.value ? row.value : null;
}

function parseDashboardUrl(raw: string): string {
  const value = raw.trim();
  if (value.length > 2000) throw new HttpError(400, "El enlace es demasiado largo.");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new HttpError(400, "El enlace no es válido. Debe empezar con https://");
  }
  // Solo https: evita esquemas como javascript: y enlaces sin cifrar.
  if (parsed.protocol !== "https:") throw new HttpError(400, "El enlace no es válido. Debe empezar con https://");
  // "Publicar en la web" de Power BI genera https://app.powerbi.com/view?r=… : es
  // público (cualquiera con la dirección ve los datos), así que no se acepta.
  if (/(^|\.)powerbi\.com$/i.test(parsed.hostname) && /^\/view\/?$/i.test(parsed.pathname)) {
    throw new HttpError(
      400,
      "Ese enlace es de \"Publicar en la web\" y es público. Use el enlace de \"Compartir\" del reporte o de la app de Power BI."
    );
  }
  return parsed.toString();
}

// Para cualquier usuario autenticado: devuelve el enlace solo si un administrador
// le concedió acceso; si no, url: null (el botón no se muestra).
export const dashboardLinkRouter = Router();
dashboardLinkRouter.use(requireAuth);

dashboardLinkRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const url = req.currentUser!.canViewDashboard ? await readUrl() : null;
    res.json({ url });
  })
);

// Para administradores que gestionan usuarios: ver y cambiar el enlace.
export const adminDashboardLinkRouter = Router();
adminDashboardLinkRouter.use(requireAuth, requirePermission("users:edit"));

adminDashboardLinkRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({ url: await readUrl() });
  })
);

adminDashboardLinkRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const raw = typeof req.body?.url === "string" ? req.body.url : "";
    if (!raw.trim()) {
      // Vacío = quitar el enlace (el botón deja de aparecer para todos).
      await prisma.appSetting.deleteMany({ where: { key: SETTING_KEY } });
      await audit({ userId: req.currentUser!.id, action: "settings.dashboard_link_clear", result: "success", req });
      res.json({ url: null });
    } else {
      const url = parseDashboardUrl(raw);
      await prisma.appSetting.upsert({
        where: { key: SETTING_KEY },
        update: { value: url, updatedBy: req.currentUser!.id },
        create: { key: SETTING_KEY, value: url, updatedBy: req.currentUser!.id },
      });
      await audit({
        userId: req.currentUser!.id,
        action: "settings.dashboard_link_update",
        result: "success",
        req,
        metadata: { host: new URL(url).hostname },
      });
      res.json({ url });
    }
  })
);
