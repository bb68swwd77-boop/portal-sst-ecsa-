export interface CurrentUser {
  id: string;
  email: string;
  code: string | null;
  firstName: string;
  lastName: string;
  roleKey: "admin" | "user";
  permissions: string[];
  mustChangePassword: boolean;
  // Aceptación de la versión vigente de las políticas de datos y cookies.
  policyAccepted: boolean;
  policyVersion: string;
}

export interface DashboardCourse {
  id: string;
  code: string;
  title: string;
  description: string;
  imageUrl: string | null;
  durationMin: number;
  moduleCount: number;
  percent: number;
  status: "pending" | "in_progress" | "completed" | "overdue";
  dueAt: string | null;
  certificateCount: number;
}

export interface DashboardStats {
  totalAssigned: number;
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
  certificates: number;
  overallPercent: number;
}

export interface LessonFile {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface LessonDetail {
  id: string;
  title: string;
  order: number;
  contentType: string;
  bodyHtml: string | null;
  externalUrl: string | null;
  file: LessonFile | null;
  // Adjuntos adicionales más allá del archivo principal (`file`).
  files: LessonFile[];
  // Solo aplica a contentType "VIDEO" — null para el resto de tipos.
  percentWatched: number | null;
  normReference: string | null;
  normCode: string | null;
  normArticle: string | null;
  normYear: number | null;
  normVersion: string | null;
  normSource: string | null;
  normReviewedAt: string | null;
  completed: boolean;
  // Documentos (PDF) de la lección que el usuario aún no ha abierto.
  documentsPending: number;
}

export interface EvaluationSummary {
  id: string;
  title: string;
  description: string | null;
  passingScore: number;
  timeLimitMin: number | null;
  maxAttempts: number;
  attemptsUsed: number;
  lastScore: number | null;
  lastPassed: boolean | null;
  canAttempt: boolean;
  // Lecciones del módulo aún sin completar; mientras sea > 0 la evaluación está bloqueada.
  pendingLessons: number;
}

export interface ModuleDetail {
  id: string;
  title: string;
  order: number;
  lessons: LessonDetail[];
  evaluation: EvaluationSummary | null;
}

export interface CourseDetail {
  id: string;
  code: string;
  title: string;
  description: string;
  objective: string | null;
  durationMin: number;
  passingScore: number;
  // Avance general del curso (lecciones vistas + evaluaciones aprobadas).
  percent: number;
  modules: ModuleDetail[];
}

export interface AttemptQuestionOption {
  id: string;
  text: string;
}

export interface AttemptQuestion {
  id: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "MATCHING" | "SHORT_ANSWER";
  text: string;
  points: number;
  options: AttemptQuestionOption[];
}

export interface AttemptSession {
  attemptId: string;
  attemptNumber: number;
  startedAt: string;
  timeLimitMin: number | null;
  serverNow: string;
  maxAttempts: number;
  title: string;
  description: string | null;
  passingScore: number;
  questions: AttemptQuestion[];
  // Respuestas ya guardadas de este intento (autoguardado).
  draftAnswers: Record<string, { selectedOptionIds?: string[]; shortAnswerText?: string }>;
}

export interface Certificate {
  id: string;
  code: string;
  // Título del módulo certificado; nulo en los certificados antiguos del curso completo.
  moduleTitle: string | null;
  score: number;
  issuedAt: string;
  durationMin: number;
  course: { title: string; code: string; imageUrl: string | null };
}
