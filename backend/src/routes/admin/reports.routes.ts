import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { requirePermission } from "../../middleware/rbac";
import { asyncHandler } from "../../middleware/errorHandler";
import { validateQuery } from "../../middleware/validate";
import { buildTrainingReport, reportRowsToCsv } from "../../services/reports.service";
import { audit } from "../../lib/audit";

export const adminReportsRouter = Router();
adminReportsRouter.use(requireAuth, requirePermission("reports:view"));

const filterSchema = z.object({
  courseId: z.string().cuid().optional(),
  company: z.string().trim().max(150).optional(),
  status: z.enum(["pending", "in_progress", "completed", "overdue"]).optional(),
  search: z.string().trim().max(200).optional(),
  format: z.enum(["json", "csv"]).default("json"),
});

adminReportsRouter.get(
  "/training",
  validateQuery(filterSchema),
  asyncHandler(async (req, res) => {
    const filters = req.query as unknown as z.infer<typeof filterSchema>;
    const rows = await buildTrainingReport(filters);
    await audit({ userId: req.currentUser!.id, action: "report.generate", result: "success", req, metadata: { filters } });

    if (filters.format === "csv") {
      const csv = reportRowsToCsv(rows);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="reporte-capacitacion-sst.csv"`);
      return res.send(csv);
    }
    res.json({ rows });
  })
);
