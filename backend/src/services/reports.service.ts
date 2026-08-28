import { prisma } from "../lib/prisma";
import { getAssignedCourseIdsForUser } from "./courses.service";

export interface ReportFilters {
  courseId?: string;
  company?: string;
  status?: "pending" | "in_progress" | "completed" | "overdue";
  search?: string;
}

export interface ReportRow {
  userId: string;
  userName: string;
  email: string;
  company: string | null;
  area: string | null;
  courseId: string;
  courseTitle: string;
  status: "pending" | "in_progress" | "completed" | "overdue";
  percent: number;
  bestScore: number | null;
  certificateCode: string | null;
  dueAt: Date | null;
  completedAt: Date | null;
}

export async function buildTrainingReport(filters: ReportFilters): Promise<ReportRow[]> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      company: filters.company || undefined,
      ...(filters.search
        ? {
            OR: [
              { firstName: { contains: filters.search, mode: "insensitive" } },
              { lastName: { contains: filters.search, mode: "insensitive" } },
              { email: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { role: true },
  });

  const courses = await prisma.course.findMany({
    where: { id: filters.courseId || undefined, status: "PUBLISHED" },
    include: { modules: { include: { evaluation: true, lessons: true } } },
  });

  const rows: ReportRow[] = [];

  for (const user of users) {
    if (user.role.key !== "user") continue; // el reporte de capacitación es sobre capacitados, no administradores
    const assignedIds = await getAssignedCourseIdsForUser(user);
    const relevantCourses = courses.filter((c) => assignedIds.has(c.id));
    if (relevantCourses.length === 0) continue;

    const [progressRows, attempts, certificates, assignments] = await Promise.all([
      prisma.lessonProgress.findMany({ where: { userId: user.id, lesson: { module: { courseId: { in: relevantCourses.map((c) => c.id) } } } } }),
      prisma.evaluationAttempt.findMany({
        where: { userId: user.id, status: "SUBMITTED", evaluation: { module: { courseId: { in: relevantCourses.map((c) => c.id) } } } },
      }),
      prisma.certificate.findMany({ where: { userId: user.id, courseId: { in: relevantCourses.map((c) => c.id) } } }),
      prisma.courseAssignment.findMany({ where: { courseId: { in: relevantCourses.map((c) => c.id) }, OR: [{ userId: user.id }, { userId: null }] } }),
    ]);
    const completedLessonIds = new Set(progressRows.filter((p) => p.completedAt).map((p) => p.lessonId));
    const certByCourse = new Map(certificates.map((c) => [c.courseId, c]));

    for (const course of relevantCourses) {
      const totalLessons = course.modules.reduce((a, m) => a + m.lessons.length, 0);
      const completedLessons = course.modules.reduce((a, m) => a + m.lessons.filter((l) => completedLessonIds.has(l.id)).length, 0);
      const evaluationIds = course.modules.filter((m) => m.evaluation).map((m) => m.evaluation!.id);
      const courseAttempts = attempts.filter((a) => evaluationIds.includes(a.evaluationId));
      const passedEvals = evaluationIds.filter((id) => courseAttempts.some((a) => a.evaluationId === id && a.passed));
      const totalUnits = totalLessons + evaluationIds.length;
      const completedUnits = completedLessons + passedEvals.length;
      const percent = totalUnits === 0 ? 0 : Math.round((completedUnits / totalUnits) * 100);
      const cert = certByCourse.get(course.id);
      const assignment = assignments.find((a) => a.courseId === course.id);
      const bestScore = courseAttempts.length ? Math.max(...courseAttempts.map((a) => a.score ?? 0)) : null;

      let status: ReportRow["status"] = "pending";
      if (cert) status = "completed";
      else if (completedUnits > 0) status = "in_progress";
      if (assignment?.dueAt && assignment.dueAt < new Date() && status !== "completed") status = "overdue";

      if (filters.status && filters.status !== status) continue;

      rows.push({
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        company: user.company,
        area: user.area,
        courseId: course.id,
        courseTitle: course.title,
        status,
        percent,
        bestScore,
        certificateCode: cert?.code ?? null,
        dueAt: assignment?.dueAt ?? null,
        completedAt: cert?.issuedAt ?? null,
      });
    }
  }

  return rows;
}

export function reportRowsToCsv(rows: ReportRow[]): string {
  const header = [
    "Usuario",
    "Correo",
    "Empresa",
    "Área",
    "Capacitación",
    "Estado",
    "Progreso (%)",
    "Mejor puntaje",
    "Código certificado",
    "Fecha límite",
    "Fecha de aprobación",
  ];
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.userName,
        r.email,
        r.company,
        r.area,
        r.courseTitle,
        r.status,
        r.percent,
        r.bestScore ?? "",
        r.certificateCode ?? "",
        r.dueAt ? r.dueAt.toISOString() : "",
        r.completedAt ? r.completedAt.toISOString() : "",
      ]
        .map(escape)
        .join(",")
    );
  }
  return lines.join("\n");
}
