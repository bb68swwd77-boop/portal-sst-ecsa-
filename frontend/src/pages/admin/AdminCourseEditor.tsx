import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, uploadFile } from "../../api/client";
import { Modal } from "../../components/Modal";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";

interface AnswerOption {
  id: string;
  text: string;
  isCorrect: boolean;
  order: number;
}
interface Question {
  id: string;
  type: string;
  text: string;
  order: number;
  points: number;
  options: AnswerOption[];
}
interface Evaluation {
  id: string;
  title: string;
  passingScore: number;
  maxAttempts: number;
  showCorrectAnswers: boolean;
  questions: Question[];
}
interface Lesson {
  id: string;
  title: string;
  order: number;
  contentType: string;
  bodyHtml: string | null;
  normReference: string | null;
  normCode: string | null;
  normArticle: string | null;
}
interface Module {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
  evaluation: Evaluation | null;
}
interface Assignment {
  id: string;
  targetType: string;
  targetValue: string | null;
  userId: string | null;
  mandatory: boolean;
  dueAt: string | null;
}
interface CourseAdmin {
  id: string;
  code: string;
  title: string;
  description: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  durationMin: number;
  passingScore: number;
  maxAttempts: number;
  modules: Module[];
  assignments: Assignment[];
}

const emptyOption = () => ({ text: "", isCorrect: false, order: 1 });

export function AdminCourseEditorPage() {
  const { courseId } = useParams();
  const { notify } = useToast();
  const { t } = useLanguage();
  const [course, setCourse] = useState<CourseAdmin | null>(null);
  const [moduleModal, setModuleModal] = useState(false);
  const [lessonModal, setLessonModal] = useState<{ moduleId: string } | null>(null);
  const [evalModal, setEvalModal] = useState<{ moduleId: string } | null>(null);
  const [questionModal, setQuestionModal] = useState<{ evaluationId: string } | null>(null);

  async function load() {
    const res = await api.get<{ course: CourseAdmin }>(`/admin/courses/${courseId}`);
    setCourse(res.course);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function saveCourseField(field: string, value: unknown) {
    await api.put(`/admin/courses/${courseId}`, { [field]: value });
    notify(t("Capacitación actualizada."), "success");
    await load();
  }

  async function deleteLesson(lessonId: string) {
    if (!confirm(t("¿Eliminar esta lección?"))) return;
    await api.delete(`/admin/courses/lessons/${lessonId}`);
    await load();
  }

  async function deleteQuestion(questionId: string) {
    if (!confirm(t("¿Eliminar esta pregunta?"))) return;
    await api.delete(`/admin/evaluations/questions/${questionId}`);
    await load();
  }

  async function deleteAssignment(assignmentId: string) {
    await api.delete(`/admin/courses/assignments/${assignmentId}`);
    await load();
  }

  if (!course) return <div className="empty-state">{t("Cargando…")}</div>;

  return (
    <div>
      <div className="breadcrumbs">
        <Link to="/admin/capacitaciones">{t("Capacitaciones")}</Link> / {course.title}
      </div>
      <div className="flex-between">
        <h2 className="page-title">{course.title}</h2>
        <select value={course.status} onChange={(e) => saveCourseField("status", e.target.value)}>
          <option value="DRAFT">{t("Borrador")}</option>
          <option value="PUBLISHED">{t("Publicado")}</option>
          <option value="ARCHIVED">{t("Archivado")}</option>
        </select>
      </div>

      <div className="card">
        <h3>{t("Información general")}</h3>
        <div className="form-row">
          <div className="field">
            <label>{t("Título")}</label>
            <input
              defaultValue={course.title}
              onBlur={(e) => e.target.value.trim() && e.target.value !== course.title && saveCourseField("title", e.target.value.trim())}
            />
          </div>
          <div className="field">
            <label>{t("Código")}</label>
            <input
              defaultValue={course.code}
              onBlur={(e) => e.target.value.trim() && e.target.value !== course.code && saveCourseField("code", e.target.value.trim())}
            />
          </div>
        </div>
        <div className="field">
          <label>{t("Descripción")}</label>
          <textarea
            rows={3}
            defaultValue={course.description}
            onBlur={(e) => e.target.value !== course.description && saveCourseField("description", e.target.value)}
          />
        </div>
        <div className="form-row">
          <div className="field">
            <label>{t("Duración (min)")}</label>
            <input
              type="number"
              defaultValue={course.durationMin}
              onBlur={(e) => saveCourseField("durationMin", Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>{t("Nota mínima (%)")}</label>
            <input
              type="number"
              defaultValue={course.passingScore}
              onBlur={(e) => saveCourseField("passingScore", Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="flex-between mt-24">
        <h3>{t("Módulos")}</h3>
        <button className="btn btn-secondary btn-sm" onClick={() => setModuleModal(true)}>
          + {t("Módulo")}
        </button>
      </div>

      {course.modules.map((m) => (
        <div className="card mt-16" key={m.id}>
          <div className="flex-between">
            <h4>
              {t("Módulo")} {m.order} · {m.title}
            </h4>
          </div>

          <div className="table-wrap mt-8">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t("Lección")}</th>
                  <th>{t("Tipo")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {m.lessons.map((l) => (
                  <tr key={l.id}>
                    <td>{l.order}</td>
                    <td>{l.title}</td>
                    <td>{l.contentType}</td>
                    <td>
                      <button className="btn-link" onClick={() => deleteLesson(l.id)}>
                        {t("Eliminar")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-secondary btn-sm mt-8" onClick={() => setLessonModal({ moduleId: m.id })}>
            + {t("Lección")}
          </button>

          <div className="mt-16">
            {m.evaluation ? (
              <div>
                <div className="flex-between">
                  <strong>{m.evaluation.title}</strong>
                  <button className="btn btn-secondary btn-sm" onClick={() => setQuestionModal({ evaluationId: m.evaluation!.id })}>
                    + {t("Pregunta")}
                  </button>
                </div>
                <p className="text-muted" style={{ fontSize: 12 }}>
                  {t("Nota mínima")} {m.evaluation.passingScore}% · {t("Intentos máx.")} {m.evaluation.maxAttempts} ·{" "}
                  {t("Preguntas:")} {m.evaluation.questions.length}
                </p>
                {m.evaluation.questions.map((q) => (
                  <div key={q.id} className="card mt-8" style={{ padding: 12 }}>
                    <div className="flex-between">
                      <strong style={{ fontSize: 13 }}>
                        {q.order}. {q.text}
                      </strong>
                      <button className="btn-link" onClick={() => deleteQuestion(q.id)}>
                        {t("Eliminar")}
                      </button>
                    </div>
                    <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12 }}>
                      {q.options.map((o) => (
                        <li key={o.id} style={{ color: o.isCorrect ? "var(--color-success)" : "var(--color-text-secondary)" }}>
                          {o.text} {o.isCorrect && "✓"}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={() => setEvalModal({ moduleId: m.id })}>
                + {t("Crear evaluación para este módulo")}
              </button>
            )}
          </div>
        </div>
      ))}

      <AssignmentsSection courseId={course.id} assignments={course.assignments} onChange={load} onDelete={deleteAssignment} />

      {moduleModal && (
        <ModuleFormModal
          courseId={course.id}
          nextOrder={course.modules.length + 1}
          onClose={() => setModuleModal(false)}
          onSaved={load}
        />
      )}
      {lessonModal && (
        <LessonFormModal
          moduleId={lessonModal.moduleId}
          nextOrder={(course.modules.find((m) => m.id === lessonModal.moduleId)?.lessons.length ?? 0) + 1}
          onClose={() => setLessonModal(null)}
          onSaved={load}
        />
      )}
      {evalModal && <EvaluationFormModal moduleId={evalModal.moduleId} onClose={() => setEvalModal(null)} onSaved={load} />}
      {questionModal && (
        <QuestionFormModal evaluationId={questionModal.evaluationId} onClose={() => setQuestionModal(null)} onSaved={load} />
      )}
    </div>
  );
}

function ModuleFormModal({ courseId, nextOrder, onClose, onSaved }: { courseId: string; nextOrder: number; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const [title, setTitle] = useState("");
  const [order, setOrder] = useState(nextOrder);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post(`/admin/courses/${courseId}/modules`, { title, order });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("No fue posible crear el módulo."));
    }
  }

  return (
    <Modal title={t("Nuevo módulo")} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="field">
          <label>{t("Título")}</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>{t("Orden")}</label>
          <input type="number" min={1} value={order} onChange={(e) => setOrder(Number(e.target.value))} />
        </div>
        <button className="btn btn-primary" type="submit">
          {t("Crear módulo")}
        </button>
      </form>
    </Modal>
  );
}

function LessonFormModal({ moduleId, nextOrder, onClose, onSaved }: { moduleId: string; nextOrder: number; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    title: "",
    order: nextOrder,
    contentType: "RICH_TEXT",
    bodyHtml: "",
    externalUrl: "",
    fileId: "",
    normReference: "",
  });
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsFile = form.contentType === "PDF" || form.contentType === "DOCUMENT";
  const needsUrl = form.contentType === "VIDEO" || form.contentType === "LINK";

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const res = await uploadFile<{ file: { id: string; filename: string } }>("/admin/files/upload", file);
      setForm((prev) => ({ ...prev, fileId: res.file.id }));
      setUploadedFilename(res.file.filename);
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("No fue posible subir el archivo."));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (needsFile && !form.fileId) {
      setError(t("Debe subir un archivo PDF para este tipo de contenido."));
      return;
    }
    try {
      const { fileId, ...rest } = form;
      await api.post(`/admin/courses/modules/${moduleId}/lessons`, { ...rest, fileId: fileId || undefined });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("No fue posible crear la lección."));
    }
  }

  return (
    <Modal title={t("Nueva lección")} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="field">
          <label>{t("Título")}</label>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="field">
            <label>{t("Orden")}</label>
            <input type="number" min={1} value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>{t("Tipo de contenido")}</label>
            <select value={form.contentType} onChange={(e) => setForm({ ...form, contentType: e.target.value, fileId: "", externalUrl: "" })}>
              <option value="RICH_TEXT">{t("Texto enriquecido")}</option>
              <option value="VIDEO">{t("Video (enlace)")}</option>
              <option value="PDF">{t("PDF (archivo adjunto)")}</option>
              <option value="DOCUMENT">{t("Documento (archivo adjunto)")}</option>
              <option value="LINK">{t("Enlace externo")}</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>{t("Contenido (HTML permitido: p, b, i, ul, li, a, img…)")}</label>
          <textarea rows={4} value={form.bodyHtml} onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })} />
          <div className="field-hint">
            {t("Puede incluir imágenes de referencia ya alojadas en internet con")}{" "}
            <code>&lt;img src="https://..." alt="descripción"&gt;</code>.
          </div>
        </div>

        {needsFile && (
          <div className="field">
            <label>{t("Archivo PDF")}</label>
            <input type="file" accept="application/pdf" onChange={handleFileChange} />
            {uploading && <div className="field-hint">{t("Subiendo…")}</div>}
            {uploadedFilename && <div className="field-hint">✓ {uploadedFilename} {t("cargado correctamente.")}</div>}
            <div className="field-hint">{t("Máximo 10 MB, solo PDF.")}</div>
          </div>
        )}

        {needsUrl && (
          <div className="field">
            <label>{t("URL externa")}</label>
            <input value={form.externalUrl} onChange={(e) => setForm({ ...form, externalUrl: e.target.value })} placeholder="https://…" />
          </div>
        )}

        <h4 className="mt-16">{t("Referencia normativa")}</h4>
        <div className="field">
          <label>{t("Norma")}</label>
          <input value={form.normReference} onChange={(e) => setForm({ ...form, normReference: e.target.value })} />
        </div>
        <button className="btn btn-primary" type="submit">
          {t("Crear lección")}
        </button>
      </form>
    </Modal>
  );
}

function EvaluationFormModal({ moduleId, onClose, onSaved }: { moduleId: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ title: "Evaluación del módulo", passingScore: 80, maxAttempts: 3, showCorrectAnswers: true });
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post(`/admin/evaluations/modules/${moduleId}`, form);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("No fue posible crear la evaluación."));
    }
  }

  return (
    <Modal title={t("Nueva evaluación")} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="field">
          <label>{t("Título")}</label>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="field">
            <label>{t("Nota mínima (%)")}</label>
            <input type="number" min={1} max={100} value={form.passingScore} onChange={(e) => setForm({ ...form, passingScore: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>{t("Intentos máximos")}</label>
            <input type="number" min={1} value={form.maxAttempts} onChange={(e) => setForm({ ...form, maxAttempts: Number(e.target.value) })} />
          </div>
        </div>
        <label className="field option-row" style={{ marginBottom: 16 }}>
          <input
            type="checkbox"
            className="option-toggle"
            checked={form.showCorrectAnswers}
            onChange={(e) => setForm({ ...form, showCorrectAnswers: e.target.checked })}
          />
          {t("Mostrar respuestas correctas al finalizar")}
        </label>
        <button className="btn btn-primary" type="submit">
          {t("Crear evaluación")}
        </button>
      </form>
    </Modal>
  );
}

function QuestionFormModal({ evaluationId, onClose, onSaved }: { evaluationId: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useLanguage();
  const [type, setType] = useState("SINGLE_CHOICE");
  const [text, setText] = useState("");
  const [order, setOrder] = useState(1);
  const [options, setOptions] = useState([emptyOption(), emptyOption()]);
  const [error, setError] = useState<string | null>(null);

  function updateOption(idx: number, patch: Partial<{ text: string; isCorrect: boolean }>) {
    const exclusive = (type === "SINGLE_CHOICE" || type === "TRUE_FALSE") && patch.isCorrect;
    setOptions((prev) =>
      prev.map((o, i) => {
        if (i === idx) return { ...o, ...patch };
        return exclusive ? { ...o, isCorrect: false } : o;
      })
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/admin/evaluations/${evaluationId}/questions`, {
        type,
        text,
        order,
        points: 1,
        options: options.map((o, i) => ({ ...o, order: i + 1 })),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("No fue posible crear la pregunta."));
    }
  }

  return (
    <Modal title={t("Nueva pregunta")} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="form-row">
          <div className="field">
            <label>{t("Tipo")}</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="SINGLE_CHOICE">{t("Selección única")}</option>
              <option value="MULTIPLE_CHOICE">{t("Selección múltiple")}</option>
              <option value="TRUE_FALSE">{t("Verdadero / Falso")}</option>
              <option value="SHORT_ANSWER">{t("Respuesta corta")}</option>
            </select>
          </div>
          <div className="field">
            <label>{t("Orden")}</label>
            <input type="number" min={1} value={order} onChange={(e) => setOrder(Number(e.target.value))} />
          </div>
        </div>
        <div className="field">
          <label>{t("Enunciado")}</label>
          <textarea required rows={2} value={text} onChange={(e) => setText(e.target.value)} />
        </div>

        {type !== "SHORT_ANSWER" && (
          <div className="field">
            <label>{t("Opciones (marque la(s) correcta(s))")}</label>
            {options.map((o, idx) => (
              <div key={idx} className="option-row mt-8">
                <input
                  type={type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                  className="option-toggle"
                  name="correct-option"
                  checked={o.isCorrect}
                  onChange={(e) => updateOption(idx, { isCorrect: e.target.checked })}
                />
                <input
                  className="option-text"
                  placeholder={`${t("Opción")} ${idx + 1}`}
                  value={o.text}
                  onChange={(e) => updateOption(idx, { text: e.target.value })}
                />
              </div>
            ))}
            {type !== "TRUE_FALSE" && (
              <button type="button" className="btn-link mt-8" onClick={() => setOptions((prev) => [...prev, emptyOption()])}>
                + {t("Agregar opción")}
              </button>
            )}
          </div>
        )}

        {type === "SHORT_ANSWER" && (
          <div className="field">
            <label>{t("Respuesta(s) válida(s) (una por opción)")}</label>
            {options.map((o, idx) => (
              <input
                key={idx}
                className="mt-8"
                placeholder={t("Respuesta válida")}
                value={o.text}
                onChange={(e) => updateOption(idx, { text: e.target.value, isCorrect: true })}
              />
            ))}
            <button type="button" className="btn-link mt-8" onClick={() => setOptions((prev) => [...prev, { ...emptyOption(), isCorrect: true }])}>
              + {t("Agregar respuesta válida")}
            </button>
          </div>
        )}

        <button className="btn btn-primary mt-16" type="submit">
          {t("Guardar pregunta")}
        </button>
      </form>
    </Modal>
  );
}

function AssignmentsSection({
  courseId,
  assignments,
  onChange,
  onDelete,
}: {
  courseId: string;
  assignments: Assignment[];
  onChange: () => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useLanguage();
  const [targetType, setTargetType] = useState("COMPANY");
  const [targetValue, setTargetValue] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/admin/courses/${courseId}/assignments`, {
        targetType,
        targetValue: targetType === "ALL" ? undefined : targetValue,
        mandatory: true,
        dueAt: dueAt || undefined,
      });
      setTargetValue("");
      onChange();
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("No fue posible crear la asignación."));
    }
  }

  return (
    <div className="mt-24">
      <h3>{t("Asignaciones")}</h3>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("Tipo")}</th>
              <th>{t("Valor")}</th>
              <th>{t("Fecha límite")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id}>
                <td>{a.targetType}</td>
                <td>{a.targetValue ?? a.userId ?? t("Todos")}</td>
                <td>{a.dueAt ? new Date(a.dueAt).toLocaleDateString("es-EC") : "—"}</td>
                <td>
                  <button className="btn-link" onClick={() => onDelete(a.id)}>
                    {t("Quitar")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-8 mt-16" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
        {error && <div className="alert alert-danger" style={{ width: "100%" }}>{error}</div>}
        <div className="field" style={{ marginBottom: 0 }}>
          <label>{t("Asignar por")}</label>
          <select value={targetType} onChange={(e) => setTargetType(e.target.value)}>
            <option value="COMPANY">{t("Empresa")}</option>
            <option value="AREA">{t("Área")}</option>
            <option value="POSITION">{t("Cargo")}</option>
            <option value="ALL">{t("Todos los usuarios")}</option>
          </select>
        </div>
        {targetType !== "ALL" && (
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{t("Valor")}</label>
            <input required value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
          </div>
        )}
        <div className="field" style={{ marginBottom: 0 }}>
          <label>{t("Fecha límite")}</label>
          <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </div>
        <button className="btn btn-secondary" type="submit">
          {t("Asignar")}
        </button>
      </form>
    </div>
  );
}
