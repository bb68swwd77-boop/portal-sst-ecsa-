export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleKey: "admin" | "user";
  permissions: string[];
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
  certificateCode: string | null;
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
  title: string;
  description: string | null;
  passingScore: number;
  questions: AttemptQuestion[];
}

export interface Certificate {
  id: string;
  code: string;
  score: number;
  issuedAt: string;
  durationMin: number;
  course: { title: string; code: string };
}
