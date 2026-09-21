/* eslint-disable no-console */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function hashPassword(plain: string) {
  return argon2.hash(plain, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

const PERMISSIONS = [
  "courses:create",
  "courses:edit",
  "courses:delete",
  "courses:view",
  "courses:view_assigned",
  "users:create",
  "users:edit",
  "users:view",
  "reports:view",
  "evaluations:manage",
  "evaluations:take",
  "certificates:view",
  "audit:view",
];

const USER_PERMISSIONS = ["courses:view_assigned", "evaluations:take", "certificates:view"];

async function main() {
  console.log("Sembrando permisos y roles...");
  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  }

  const adminRole = await prisma.role.upsert({
    where: { key: "admin" },
    update: {},
    create: { key: "admin", name: "Administrador" },
  });
  const userRole = await prisma.role.upsert({
    where: { key: "user" },
    update: {},
    create: { key: "user", name: "Capacitado / Contratista" },
  });

  const allPermissions = await prisma.permission.findMany();
  for (const p of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: p.id },
    });
  }
  for (const key of USER_PERMISSIONS) {
    const p = allPermissions.find((x) => x.key === key)!;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: userRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: userRole.id, permissionId: p.id },
    });
  }

  console.log("Sembrando usuarios DEMO...");
  const demoPasswordHash = await hashPassword("Demo#2026Sst");
  // Las cuentas DEMO siempre vuelven a la contraseña documentada en el README
  // en cada siembra (ej. al redesplegar) — así un "Restablecer clave" o
  // bloqueo accidental sobre estas cuentas de prueba siempre es recuperable
  // sin acceso directo a la base de datos. Nunca se aplica a cuentas reales
  // (isDemo: false), que solo se crean vía panel admin y no pasan por aquí.
  const demoAccountReset = { passwordHash: demoPasswordHash, failedLoginCount: 0, lockedUntil: null, mustChangePassword: false, isActive: true };

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    // code se incluye también en el update: estas cuentas ya existen en
    // despliegues previos (creadas antes de que existiera este campo), y
    // demoAccountReset por sí solo nunca lo habría poblado, dejándolas sin
    // código para siempre — inaccesibles ahora que el login es por código.
    update: { ...demoAccountReset, code: "DEMO-ADMIN", category: "ADM" },
    create: {
      email: "admin@example.com",
      code: "DEMO-ADMIN",
      passwordHash: demoPasswordHash,
      firstName: "Ana",
      lastName: "Administradora",
      roleId: adminRole.id,
      company: "ECSA",
      area: "SST",
      position: "Coordinadora SST",
      category: "ADM",
      isDemo: true,
    },
  });

  const usuario1 = await prisma.user.upsert({
    where: { email: "usuario1@example.com" },
    update: { ...demoAccountReset, code: "DEMO-USER1", category: "OPERATIVO" },
    create: {
      email: "usuario1@example.com",
      code: "DEMO-USER1",
      passwordHash: demoPasswordHash,
      firstName: "Carlos",
      lastName: "Contratista",
      documentId: "0102030405",
      company: "Contratista Andes S.A.",
      area: "Mantenimiento",
      position: "Técnico",
      category: "OPERATIVO",
      roleId: userRole.id,
      isDemo: true,
    },
  });

  const usuario2 = await prisma.user.upsert({
    where: { email: "usuario2@example.com" },
    update: { ...demoAccountReset, code: "DEMO-USER2", category: "OPERATIVO" },
    create: {
      email: "usuario2@example.com",
      code: "DEMO-USER2",
      passwordHash: demoPasswordHash,
      firstName: "María",
      lastName: "Trabajadora",
      documentId: "0607080910",
      company: "Contratista Andes S.A.",
      area: "Operaciones",
      position: "Supervisora",
      category: "OPERATIVO",
      roleId: userRole.id,
      isDemo: true,
    },
  });

  console.log("Sembrando usuarios piloto (código de trabajador)...");
  await seedPilotUsers(adminRole.id, userRole.id, demoPasswordHash);

  console.log("Sembrando capacitaciones DEMO...");

  // ---------------------------------------------------------------------
  // Curso 1: Trabajo en Altura
  // ---------------------------------------------------------------------
  const alturaCourse = await prisma.course.upsert({
    where: { code: "SST-ALT-01" },
    update: {},
    create: {
      code: "SST-ALT-01",
      title: "Seguridad en Trabajos en Altura",
      description: "Capacitación obligatoria para personal que ejecuta actividades por encima de 1.8 m de altura.",
      objective: "Identificar peligros y aplicar controles seguros en trabajos en altura conforme a la normativa IESS.",
      targetAudience: "Personal contratista que realiza trabajos en altura",
      category: "Riesgos físicos",
      level: "Básico",
      durationMin: 90,
      status: "PUBLISHED",
      passingScore: 80,
      maxAttempts: 3,
    },
  });

  const alturaM1 = await prisma.module.upsert({
    where: { courseId_order: { courseId: alturaCourse.id, order: 1 } },
    update: {},
    create: { courseId: alturaCourse.id, title: "Conceptos generales", order: 1 },
  });
  await prisma.lesson.upsert({
    where: { moduleId_order: { moduleId: alturaM1.id, order: 1 } },
    update: {},
    create: {
      moduleId: alturaM1.id,
      title: "¿Qué se considera trabajo en altura?",
      order: 1,
      contentType: "RICH_TEXT",
      bodyHtml:
        "<p>Se considera trabajo en altura toda actividad laboral que se realiza a 1.8 metros o más sobre un nivel inferior, con riesgo de caída. Incluye trabajos en andamios, escaleras, techos, estructuras y bordes de excavación.</p><p>Antes de iniciar, todo trabajo en altura requiere un permiso de trabajo autorizado y verificación de las condiciones climáticas y del punto de anclaje.</p>",
      normReference: "Reglamento de Seguridad y Salud de los Trabajadores (IESS, Resolución CD 513)",
      normCode: "CD 513",
      normArticle: "Art. 53",
      normYear: 2016,
      normVersion: "1.0",
      normSource: "IESS",
      normReviewedAt: new Date("2025-01-15"),
    },
  });

  const alturaM2 = await prisma.module.upsert({
    where: { courseId_order: { courseId: alturaCourse.id, order: 2 } },
    update: {},
    create: { courseId: alturaCourse.id, title: "Equipos de protección contra caídas", order: 2 },
  });
  await prisma.lesson.upsert({
    where: { moduleId_order: { moduleId: alturaM2.id, order: 1 } },
    update: {},
    create: {
      moduleId: alturaM2.id,
      title: "Sistemas de detención de caídas",
      order: 1,
      contentType: "RICH_TEXT",
      bodyHtml:
        "<p>Todo trabajador en altura debe utilizar arnés de cuerpo entero, línea de vida certificada y punto de anclaje capaz de soportar como mínimo 22.2 kN por trabajador. El equipo debe inspeccionarse antes de cada uso y descartarse ante cualquier daño visible.</p>",
      normReference: "Reglamento de Seguridad y Salud de los Trabajadores (IESS, Resolución CD 513)",
      normCode: "CD 513",
      normArticle: "Art. 54",
      normYear: 2016,
      normVersion: "1.0",
      normSource: "IESS",
      normReviewedAt: new Date("2025-01-15"),
    },
  });

  const alturaEval = await prisma.evaluation.upsert({
    where: { moduleId: alturaM2.id },
    update: {},
    create: {
      moduleId: alturaM2.id,
      title: "Evaluación — Trabajo en Altura",
      description: "Evaluación final del curso de trabajo en altura.",
      passingScore: 80,
      maxAttempts: 3,
      shuffleQuestions: true,
      shuffleAnswers: true,
      showCorrectAnswers: true,
    },
  });

  await seedQuestion(alturaEval.id, 1, "SINGLE_CHOICE", "¿A partir de qué altura se considera trabajo en altura según la normativa ecuatoriana?", [
    ["0.5 metros", false],
    ["1.8 metros", true],
    ["3 metros", false],
  ]);
  await seedQuestion(alturaEval.id, 2, "SINGLE_CHOICE", "¿Qué carga mínima debe soportar un punto de anclaje?", [
    ["5 kN", false],
    ["22.2 kN", true],
    ["100 kN", false],
  ]);
  await seedQuestion(alturaEval.id, 3, "TRUE_FALSE", "El arnés puede reutilizarse después de detener una caída sin inspección adicional.", [
    ["Verdadero", false],
    ["Falso", true],
  ]);

  // ---------------------------------------------------------------------
  // Curso 2: Espacios Confinados (contenido base del HTML original)
  // ---------------------------------------------------------------------
  const confinadosCourse = await prisma.course.upsert({
    where: { code: "SST-ESP-01" },
    update: {},
    create: {
      code: "SST-ESP-01",
      title: "Espacios Confinados",
      description: "Identificación, permisos de entrada y monitoreo atmosférico en espacios confinados.",
      objective: "Aplicar el procedimiento seguro de ingreso a espacios confinados conforme al Art. 55 del CD 513.",
      targetAudience: "Personal que ingresa o supervisa espacios confinados",
      category: "Riesgos físicos",
      level: "Intermedio",
      durationMin: 75,
      status: "PUBLISHED",
      passingScore: 80,
      maxAttempts: 3,
    },
  });

  const confM1 = await prisma.module.upsert({
    where: { courseId_order: { courseId: confinadosCourse.id, order: 1 } },
    update: {},
    create: { courseId: confinadosCourse.id, title: "Identificación de peligros", order: 1 },
  });
  await prisma.lesson.upsert({
    where: { moduleId_order: { moduleId: confM1.id, order: 1 } },
    update: {},
    create: {
      moduleId: confM1.id,
      title: "Definición y riesgos de espacios confinados",
      order: 1,
      contentType: "RICH_TEXT",
      bodyHtml:
        "<p>Un espacio confinado es cualquier área con entrada y salida limitadas, no diseñada para ocupación humana continua, donde puede acumularse una atmósfera peligrosa. Antes de autorizar el ingreso, el supervisor debe verificar el permiso de entrada vigente y los resultados de monitoreo atmosférico (oxígeno, gases inflamables, tóxicos).</p>",
      normReference: "Reglamento de Seguridad y Salud de los Trabajadores (IESS, Resolución CD 513)",
      normCode: "CD 513",
      normArticle: "Art. 55",
      normYear: 2016,
      normVersion: "1.0",
      normSource: "IESS",
      normReviewedAt: new Date("2025-01-15"),
    },
  });

  const confM2 = await prisma.module.upsert({
    where: { courseId_order: { courseId: confinadosCourse.id, order: 2 } },
    update: {},
    create: { courseId: confinadosCourse.id, title: "Permisos de entrada y vigía", order: 2 },
  });
  await prisma.lesson.upsert({
    where: { moduleId_order: { moduleId: confM2.id, order: 1 } },
    update: {},
    create: {
      moduleId: confM2.id,
      title: "Monitoreo continuo y plan de rescate",
      order: 1,
      contentType: "RICH_TEXT",
      bodyHtml:
        "<p>El Art. 55 exige que el monitoreo se realice de forma continua durante la permanencia del personal, y que exista un vigía permanente en el exterior con capacidad de activar el plan de rescate.</p>",
      normReference: "Reglamento de Seguridad y Salud de los Trabajadores (IESS, Resolución CD 513)",
      normCode: "CD 513",
      normArticle: "Art. 55",
      normYear: 2016,
      normVersion: "1.0",
      normSource: "IESS",
      normReviewedAt: new Date("2025-01-15"),
    },
  });

  const confEval = await prisma.evaluation.upsert({
    where: { moduleId: confM2.id },
    update: {},
    create: {
      moduleId: confM2.id,
      title: "Evaluación — Espacios Confinados",
      description: "Evaluación final del curso de espacios confinados.",
      passingScore: 80,
      maxAttempts: 3,
      shuffleQuestions: true,
      shuffleAnswers: true,
      showCorrectAnswers: true,
    },
  });

  await seedQuestion(
    confEval.id,
    1,
    "SINGLE_CHOICE",
    "Según el Art. 55 del CD 513, ¿quién debe permanecer fuera del espacio confinado durante todo el trabajo?",
    [
      ["El supervisor de turno únicamente", false],
      ["Un vigía permanente con capacidad de activar el rescate", true],
      ["No es obligatorio si el monitoreo inicial fue favorable", false],
    ]
  );
  await seedQuestion(confEval.id, 2, "MULTIPLE_CHOICE", "¿Qué parámetros debe incluir el monitoreo atmosférico?", [
    ["Oxígeno", true],
    ["Gases inflamables", true],
    ["Gases tóxicos", true],
    ["Solo temperatura", false],
  ]);

  // ---------------------------------------------------------------------
  // Curso 3: Izaje y Cargas Suspendidas
  // ---------------------------------------------------------------------
  const izajeCourse = await prisma.course.upsert({
    where: { code: "SST-IZA-01" },
    update: {},
    create: {
      code: "SST-IZA-01",
      title: "Seguridad en Izaje y Cargas Suspendidas",
      description: "Controles de seguridad para maniobras de izaje con grúas y cargas suspendidas.",
      objective: "Reconocer la zona de riesgo, señalización y responsabilidades en maniobras de izaje.",
      targetAudience: "Riggers, operadores y personal en zona de izaje",
      category: "Riesgos mecánicos",
      level: "Intermedio",
      durationMin: 60,
      status: "PUBLISHED",
      passingScore: 80,
      maxAttempts: 3,
    },
  });

  const izajeM1 = await prisma.module.upsert({
    where: { courseId_order: { courseId: izajeCourse.id, order: 1 } },
    update: {},
    create: { courseId: izajeCourse.id, title: "Procedimiento de trabajo seguro", order: 1 },
  });
  await prisma.lesson.upsert({
    where: { moduleId_order: { moduleId: izajeM1.id, order: 1 } },
    update: {},
    create: {
      moduleId: izajeM1.id,
      title: "Delimitación de la zona de izaje",
      order: 1,
      contentType: "RICH_TEXT",
      bodyHtml:
        "<p>Toda maniobra de izaje debe delimitar una zona de exclusión bajo la carga suspendida. Ningún trabajador debe permanecer o transitar bajo cargas suspendidas. El rigger certificado dirige la maniobra mediante señales estandarizadas.</p>",
      normReference: "Reglamento de Seguridad y Salud de los Trabajadores (IESS, Resolución CD 513)",
      normCode: "CD 513",
      normArticle: "Art. 128",
      normYear: 2016,
      normVersion: "1.0",
      normSource: "IESS",
      normReviewedAt: new Date("2025-01-15"),
    },
  });

  const izajeEval = await prisma.evaluation.upsert({
    where: { moduleId: izajeM1.id },
    update: {},
    create: {
      moduleId: izajeM1.id,
      title: "Evaluación — Izaje y Cargas Suspendidas",
      passingScore: 80,
      maxAttempts: 3,
      shuffleQuestions: true,
      shuffleAnswers: true,
      showCorrectAnswers: true,
    },
  });
  await seedQuestion(izajeEval.id, 1, "TRUE_FALSE", "Es seguro transitar brevemente bajo una carga suspendida si la maniobra va lenta.", [
    ["Verdadero", false],
    ["Falso", true],
  ]);
  await seedQuestion(izajeEval.id, 2, "SINGLE_CHOICE", "¿Quién dirige la maniobra de izaje mediante señales estandarizadas?", [
    ["Cualquier trabajador presente", false],
    ["El rigger certificado", true],
    ["El operador de la grúa, sin señalización", false],
  ]);

  console.log("Asignando capacitaciones a usuarios demo...");
  await prisma.courseAssignment.createMany({
    data: [
      { courseId: alturaCourse.id, targetType: "USER", userId: usuario1.id, mandatory: true, createdBy: admin.id },
      { courseId: confinadosCourse.id, targetType: "USER", userId: usuario1.id, mandatory: true, createdBy: admin.id },
      { courseId: izajeCourse.id, targetType: "COMPANY", targetValue: "Contratista Andes S.A.", mandatory: true, createdBy: admin.id },
    ],
    skipDuplicates: true,
  });

  console.log("Seed completado.");
  console.log("--------------------------------------------------");
  console.log("Credenciales DEMO (usar solo en entornos de desarrollo):");
  console.log("  Administrador : código DEMO-ADMIN / Demo#2026Sst");
  console.log("  Usuario 1     : código DEMO-USER1 / Demo#2026Sst");
  console.log("  Usuario 2     : código DEMO-USER2 / Demo#2026Sst");
  console.log("Piloto ECSA: cada trabajador ingresa con su código (columna ID. del Excel)");
  console.log(`  y la contraseña compartida Demo#2026Sst — se les pide crear una propia al entrar.`);
  console.log(`  Cuenta admin del piloto: código ${PILOT_ADMIN_CODE} / Demo#2026Sst`);
  console.log("--------------------------------------------------");

  async function seedQuestion(
    evaluationId: string,
    order: number,
    type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE",
    text: string,
    options: [string, boolean][]
  ) {
    const existing = await prisma.question.findFirst({ where: { evaluationId, order } });
    if (existing) return existing;
    return prisma.question.create({
      data: {
        evaluationId,
        type,
        text,
        order,
        points: 1,
        options: { create: options.map(([t, correct], i) => ({ text: t, isCorrect: correct, order: i + 1 })) },
      },
    });
  }
}

// Palabras que van en minúscula dentro de un nombre (excepto si son la
// primera palabra) — convención habitual en nombres compuestos en español.
const NAME_LOWERCASE_WORDS = new Set(["de", "del", "la", "las", "los", "y"]);

function toTitleCase(fullNameUpper: string): string {
  return fullNameUpper
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => (i > 0 && NAME_LOWERCASE_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

// El archivo fuente trae el nombre completo en una sola columna ("NOMBRES"),
// en el orden habitual de cédula ecuatoriana: 2 apellidos + nombre(s). Con 2
// palabras (nombres extranjeros: "ZHU DAITING") se asume apellido + nombre.
function splitFullName(raw: string): { firstName: string; lastName: string } {
  const words = raw.trim().split(/\s+/);
  if (words.length <= 2) {
    return { lastName: toTitleCase(words[0] ?? ""), firstName: toTitleCase(words.slice(1).join(" ")) };
  }
  return { lastName: toTitleCase(words.slice(0, 2).join(" ")), firstName: toTitleCase(words.slice(2).join(" ")) };
}

interface PilotUserRow {
  name: string;
  code: string;
  position: string;
  category: "ADM" | "OPERATIVO";
}

// Lote de la prueba piloto (Códigos.xlsx, hoja "Hoja1") — empresa ECSA,
// departamento "Gestión de Seguridad Industrial y Salud Ocupacional" para
// todos. Se excluye deliberadamente a Randy Alvarez (código 1003460):
// será creado manualmente como administrador aparte.
const PILOT_USERS: PilotUserRow[] = [
  { name: "FUENTES ESMERALDAS JUAN JOSE", code: "1000337", position: "AUXILIAR I GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "ORDOÑEZ AREVALO FRANKLIN HUMBERTO", code: "1000354", position: "AUXILIAR I GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "URDIALES JARRO MARIA ANGELITA", code: "1000459", position: "AUXILIAR I GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "CRUZ NOVILLO EDGAR VICENTE", code: "1000503", position: "AUXILIAR I GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "BUCHELI ALBAN JUAN ANDRES", code: "1000935", position: "SUPERVISOR DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "ADM" },
  { name: "VIVANCO COLLAGUAZO DARWIN ARTEMAN", code: "1000988", position: "GERENTE DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "ADM" },
  { name: "MALDONADO MALDONADO EDISON GERMAN", code: "1001033", position: "COORDINADOR SEMISENIOR DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "IZA TOAPANTA DORIS FABIOLA", code: "1001155", position: "COORDINADOR SENIOR DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "ADM" },
  { name: "TORRES SUMBA MAURICIO GABRIEL", code: "1001608", position: "COORDINADOR SEMISENIOR DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "JANETA PAUCAR ALEX FABIAN", code: "1001677", position: "COORDINADOR JUNIOR DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "QUEZADA RIVERA LUIS FERNANDO", code: "1001701", position: "COORDINADOR JUNIOR DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "ZHU DAITING", code: "1001788", position: "GERENTE DE SEGURIDAD INDUSTRIAL Y SALUD OCUPACIONAL", category: "ADM" },
  { name: "CURIPOMA REMACHE MARJEORY FERNANDA", code: "1001958", position: "AUXILIAR II GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "ADM" },
  { name: "GONZAGA VALLEJO JUAN FRANKLIN", code: "1002199", position: "COORDINADOR JUNIOR DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "QUEZADA PARDO ANA DEL CISNE", code: "1002234", position: "COORDINADOR SEMISENIOR DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "ADM" },
  { name: "GONZAGA SANCHEZ MAX ENRIQUE", code: "1002238", position: "COORDINADOR JUNIOR DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "TORRES LUNA OMAR GUILLERMO", code: "1002237", position: "PARAMEDICO", category: "OPERATIVO" },
  { name: "CASTRO ROMERO GONZALO DANIEL", code: "1002241", position: "COORDINADOR JUNIOR DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "TENECELA GONZALEZ FRANKLIN JOSE", code: "1002240", position: "COORDINADOR JUNIOR DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "ALVARADO FLORES JESSICA JOHANNA", code: "1002244", position: "PARAMEDICO II", category: "OPERATIVO" },
  { name: "FLORES BOADA ANGELA ESTEFANIA", code: "1002245", position: "PARAMEDICO", category: "OPERATIVO" },
  { name: "SANCHEZ DIAZ EDDY PATRICIO", code: "1002246", position: "MEDICO OCUPACIONAL", category: "OPERATIVO" },
  { name: "PLACENCIA ORELLANA CHRISTIAN FABIAN", code: "1002274", position: "COORDINADOR JUNIOR DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "GUAMAN ALTAMIRANO CRISTINA ABIGAIL", code: "1002373", position: "COORDINADOR JUNIOR DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "JAPON NAMICELA ROMARIO JOSE", code: "1002374", position: "ASISTENTE I DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "ADM" },
  { name: "CASTILLO JIMENEZ CRISTIAN ROMAN", code: "1002390", position: "AUXILIAR II GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "GONZALEZ ESPINOZA FREDDY EDUARDO", code: "1002487", position: "COORDINADOR JUNIOR DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "PEÑA CEDEÑO ARACELY ELIZABETH", code: "1002485", position: "MEDICO OCUPACIONAL", category: "OPERATIVO" },
  { name: "MORALES LLUMAN ANGEL FABIAN", code: "1002601", position: "COORDINADOR SEMISENIOR DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "RIVADENEIRA AVILA JUAN DIEGO", code: "1002607", position: "COORDINADOR SEMISENIOR DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "LARREATEGUI MORENO LAURO IVAN", code: "1002659", position: "COORDINADOR SEMISENIOR DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "MARIN ULLAURI IVAN PATRICIO", code: "1002662", position: "COORDINADOR SEMISENIOR DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "CAMPOVERDE RUIZ CARLOS EDUARDO", code: "1002758", position: "COORDINADOR JUNIOR DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "GUALAN TORRES THALIA FERNANDA", code: "1002801", position: "MEDICO OCUPACIONAL", category: "OPERATIVO" },
  { name: "CARVAJAL GARCIA MARIO GIOVANNI", code: "1002893", position: "COORDINADOR JUNIOR DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "CUENCA ZARI HOLGER MAURICIO", code: "1002934", position: "AUXILIAR I GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "TABARA YAGUACHI CARLOS ALBERTO", code: "1002933", position: "ASISTENTE I DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "MORA BARROSO GIOVANNY EFRAIN", code: "1002954", position: "COORDINADOR JUNIOR DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "MAIGUASHCA GUZMAN JUAN PABLO", code: "1002995", position: "COORDINADOR JUNIOR DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "LOAYZA ARMIJOS YARITZA NOHELIA", code: "1003118", position: "ASISTENTE I DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "MOROCHO NAVAS DIANA KARINA", code: "1003119", position: "ASISTENTE I DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "JIAN LIU", code: "1003135", position: "INGENIERO SENIOR", category: "ADM" },
  { name: "ENCALADA TORRES PABLO ANDRES", code: "1003138", position: "ASISTENTE I DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "REYES VEGAS MARICELA NOEMI", code: "1003253", position: "AUXILIAR I GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "ROMERO LEON CARLOS ALFREDO", code: "1003279", position: "COORDINADOR JUNIOR DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "OPERATIVO" },
  { name: "HU CHENGCHENG", code: "1003558", position: "ASISTENTE I DE GESTION DE SEGURIDAD Y SALUD OCUPACIONAL", category: "ADM" },
  { name: "PIGUABE JIMENEZ JUAN CARLOS", code: "1003561", position: "PARAMEDICO", category: "OPERATIVO" },
];

const PILOT_COMPANY = "ECSA";
const PILOT_AREA = "GESTION DE SEGURIDAD INDUSTRIAL Y SALUD OCUPACIONAL";
const PILOT_ADMIN_CODE = "1000001";

async function seedPilotUsers(adminRoleId: string, userRoleId: string, sharedPasswordHash: string) {
  // Las cuentas piloto son "solo crear": un redespliegue normal no pisa sus
  // contraseñas. Con RESET_PILOT_PASSWORDS=true (variable de entorno, usar una
  // sola vez y quitarla) se restablecen todas a la contraseña compartida, sin
  // bloqueo y con cambio obligatorio en el próximo ingreso.
  const resetPilot = process.env.RESET_PILOT_PASSWORDS === "true";
  const pilotUpdate = resetPilot
    ? { passwordHash: sharedPasswordHash, failedLoginCount: 0, lockedUntil: null, mustChangePassword: true, isActive: true }
    : {};
  if (resetPilot) console.log("RESET_PILOT_PASSWORDS=true: restableciendo contraseñas de cuentas piloto...");

  // Cuenta administrativa del piloto — Randy Alvarez (código 1003460, excluido
  // de este lote) se crea aparte manualmente y usará su propia cuenta admin.
  await prisma.user.upsert({
    where: { code: PILOT_ADMIN_CODE },
    update: pilotUpdate,
    create: {
      email: `${PILOT_ADMIN_CODE}@ecsa.local`,
      code: PILOT_ADMIN_CODE,
      passwordHash: sharedPasswordHash,
      firstName: "Administrador",
      lastName: "SST",
      company: PILOT_COMPANY,
      area: PILOT_AREA,
      position: "Administrador del portal",
      category: "ADM",
      roleId: adminRoleId,
      mustChangePassword: true,
      isDemo: false,
    },
  });

  for (const row of PILOT_USERS) {
    const { firstName, lastName } = splitFullName(row.name);
    await prisma.user.upsert({
      where: { code: row.code },
      update: pilotUpdate,
      create: {
        email: `${row.code}@ecsa.local`,
        code: row.code,
        passwordHash: sharedPasswordHash,
        firstName,
        lastName,
        company: PILOT_COMPANY,
        area: PILOT_AREA,
        position: row.position,
        category: row.category,
        roleId: userRoleId,
        mustChangePassword: true,
        isDemo: false,
      },
    });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
