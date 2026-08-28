import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { Modal } from "../../components/Modal";
import { useToast } from "../../context/ToastContext";

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
    notify("Capacitación actualizada.", "success");
    await load();
  }

  async function deleteLesson(lessonId: string) {
    if (!confirm("¿Eliminar esta lección?")) return;
    await api.delete(`/admin/courses/lessons/${lessonId}`);
    await load();
  }

  async function deleteQuestion(questionId: string) {
    if (!confirm("¿Eliminar esta pregunta?")) return;
    await api.delete(`/admin/evaluations/questions/${questionId}`);
    await load();
  }

  async function deleteAssignment(assignmentId: string) {
    await api.delete(`/admin/courses/assignments/${assignmentId}`);
    await load();
  }

  if (!course) return <div className="empty-state">Cargando…</div>;

  return (
    <div>
      <div className="breadcrumbs">
        <Link to="/admin/capacitaciones">Capacitaciones</Link> / {course.title}
      </div>
      <div className="flex-between">
        <h2 className="page-title">{course.title}</h2>
        <select value={course.status} onChange={(e) => saveCourseField("status", e.target.value)}>
          <option value="DRAFT">Borrador</option>
          <option value="PUBLISHED">Publicado</option>
          <option value="ARCHIVED">Archivado</option>
        </select>
      </div>

      <div className="card">
        <h3>Información general</h3>
        <div className="field">
          <label>Descripción</label>
          <textarea
            rows={3}
            defaultValue={course.description}
            onBlur={(e) => e.target.value !== course.description && saveCourseField("description", e.target.value)}
          />
        </div>
        <div className="form-row">
          <div className="field">
            <label>Duración (min)</label>
            <input
              type="number"
              defaultValue={course.durationMin}
              onBlur={(e) => saveCourseField("durationMin", Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>Nota mínima (%)</label>
            <input
              type="number"
              defaultValue={course.passingScore}
              onBlur={(e) => saveCourseField("passingScore", Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="flex-between mt-24">
        <h3>Módulos</h3>
        <button className="btn btn-secondary btn-sm" onClick={() => setModuleModal(true)}>
          + Módulo
        </button>
      </div>

      {course.modules.map((m) => (
        <div className="card mt-16" key={m.id}>
          <div className="flex-between">
            <h4>
              Módulo {m.order} · {m.title}
            </h4>
          </div>

          <div className="table-wrap mt-8">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Lección</th>
                  <th>Tipo</th>
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
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-secondary btn-sm mt-8" onClick={() => setLessonModal({ moduleId: m.id })}>
            + Lección
          </button>

          <div className="mt-16">
            {m.evaluation ? (
              <div>
                <div className="flex-between">
                  <strong>{m.evaluation.title}</strong>
                  <button className="btn btn-secondary btn-sm" onClick={() => setQuestionModal({ evaluationId: m.evaluation!.id })}>
                    + Pregunta
                  </button>
                </div>
                <p className="text-muted" style={{ fontSize: 12 }}>
                  Nota mínima {m.evaluation.passingScore}% · Intentos máx. {m.evaluation.maxAttempts} · Preguntas: {m.evaluation.questions.length}
                </p>
                {m.evaluation.questions.map((q) => (
                  <div key={q.id} className="card mt-8" style={{ padding: 12 }}>
                    <div className="flex-between">
                      <strong style={{ fontSize: 13 }}>
                        {q.order}. {q.text}
                      </strong>
                      <button className="btn-link" onClick={() => deleteQuestion(q.id)}>
                        Eliminar
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
                + Crear evaluación para este módulo
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
      setError(err instanceof ApiError ? err.message : "No fue posible crear el módulo.");
    }
  }

  return (
    <Modal title="Nuevo módulo" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="field">
          <label>Título</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Orden</label>
          <input type="number" min={1} value={order} onChange={(e) => setOrder(Number(e.target.value))} />
        </div>
        <button className="btn btn-primary" type="submit">
          Crear módulo
        </button>
      </form>
    </Modal>
  );
}

function LessonFormModal({ moduleId, nextOrder, onClose, onSaved }: { moduleId: string; nextOrder: number; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: "",
    order: nextOrder,
    contentType: "RICH_TEXT",
    bodyHtml: "",
    externalUrl: "",
    normReference: "",
    normCode: "",
    normArticle: "",
  });
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post(`/admin/courses/modules/${moduleId}/lessons`, form);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No fue posible crear la lección.");
    }
  }

  return (
    <Modal title="Nueva lección" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="field">
          <label>Título</label>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="field">
            <label>Orden</label>
            <input type="number" min={1} value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Tipo de contenido</label>
            <select value={form.contentType} onChange={(e) => setForm({ ...form, contentType: e.target.value })}>
              <option value="RICH_TEXT">Texto enriquecido</option>
              <option value="VIDEO">Video</option>
              <option value="PDF">PDF</option>
              <option value="DOCUMENT">Documento</option>
              <option value="LINK">Enlace externo</option>
              <option value="IMAGE">Imagen</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Contenido (HTML permitido: p, b, i, ul, li, a…)</label>
          <textarea rows={4} value={form.bodyHtml} onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })} />
        </div>
        <div className="field">
          <label>URL externa (video/documento, opcional)</label>
          <input value={form.externalUrl} onChange={(e) => setForm({ ...form, externalUrl: e.target.value })} />
        </div>
        <h4 className="mt-16">Referencia normativa (versionable)</h4>
        <div className="field">
          <label>Norma</label>
          <input value={form.normReference} onChange={(e) => setForm({ ...form, normReference: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="field">
            <label>Código</label>
            <input value={form.normCode} onChange={(e) => setForm({ ...form, normCode: e.target.value })} />
          </div>
          <div className="field">
            <label>Artículo</label>
            <input value={form.normArticle} onChange={(e) => setForm({ ...form, normArticle: e.target.value })} />
          </div>
        </div>
        <button className="btn btn-primary" type="submit">
          Crear lección
        </button>
      </form>
    </Modal>
  );
}

function EvaluationFormModal({ moduleId, onClose, onSaved }: { moduleId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ title: "Evaluación del módulo", passingScore: 80, maxAttempts: 3, showCorrectAnswers: true });
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post(`/admin/evaluations/modules/${moduleId}`, form);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No fue posible crear la evaluación.");
    }
  }

  return (
    <Modal title="Nueva evaluación" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="field">
          <label>Título</label>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="form-row">
          <div className="field">
            <label>Nota mínima (%)</label>
            <input type="number" min={1} max={100} value={form.passingScore} onChange={(e) => setForm({ ...form, passingScore: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Intentos máximos</label>
            <input type="number" min={1} value={form.maxAttempts} onChange={(e) => setForm({ ...form, maxAttempts: Number(e.target.value) })} />
          </div>
        </div>
        <label className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={form.showCorrectAnswers}
            onChange={(e) => setForm({ ...form, showCorrectAnswers: e.target.checked })}
          />
          Mostrar respuestas correctas al finalizar
        </label>
        <button className="btn btn-primary" type="submit">
          Crear evaluación
        </button>
      </form>
    </Modal>
  );
}

function QuestionFormModal({ evaluationId, onClose, onSaved }: { evaluationId: string; onClose: () => void; onSaved: () => void }) {
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
      setError(err instanceof ApiError ? err.message : "No fue posible crear la pregunta.");
    }
  }

  return (
    <Modal title="Nueva pregunta" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="form-row">
          <div className="field">
            <label>Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="SINGLE_CHOICE">Selección única</option>
              <option value="MULTIPLE_CHOICE">Selección múltiple</option>
              <option value="TRUE_FALSE">Verdadero / Falso</option>
              <option value="SHORT_ANSWER">Respuesta corta</option>
            </select>
          </div>
          <div className="field">
            <label>Orden</label>
            <input type="number" min={1} value={order} onChange={(e) => setOrder(Number(e.target.value))} />
          </div>
        </div>
        <div className="field">
          <label>Enunciado</label>
          <textarea required rows={2} value={text} onChange={(e) => setText(e.target.value)} />
        </div>

        {type !== "SHORT_ANSWER" && (
          <div className="field">
            <label>Opciones (marque la(s) correcta(s))</label>
            {options.map((o, idx) => (
              <div key={idx} className="flex gap-8 mt-8">
                <input
                  type={type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                  name="correct-option"
                  checked={o.isCorrect}
                  onChange={(e) => updateOption(idx, { isCorrect: e.target.checked })}
                />
                <input
                  style={{ flex: 1 }}
                  placeholder={`Opción ${idx + 1}`}
                  value={o.text}
                  onChange={(e) => updateOption(idx, { text: e.target.value })}
                />
              </div>
            ))}
            {type !== "TRUE_FALSE" && (
              <button type="button" className="btn-link mt-8" onClick={() => setOptions((prev) => [...prev, emptyOption()])}>
                + Agregar opción
              </button>
            )}
          </div>
        )}

        {type === "SHORT_ANSWER" && (
          <div className="field">
            <label>Respuesta(s) válida(s) (una por opción)</label>
            {options.map((o, idx) => (
              <input
                key={idx}
                className="mt-8"
                placeholder="Respuesta válida"
                value={o.text}
                onChange={(e) => updateOption(idx, { text: e.target.value, isCorrect: true })}
              />
            ))}
            <button type="button" className="btn-link mt-8" onClick={() => setOptions((prev) => [...prev, { ...emptyOption(), isCorrect: true }])}>
              + Agregar respuesta válida
            </button>
          </div>
        )}

        <button className="btn btn-primary mt-16" type="submit">
          Guardar pregunta
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
      setError(err instanceof ApiError ? err.message : "No fue posible crear la asignación.");
    }
  }

  return (
    <div className="mt-24">
      <h3>Asignaciones</h3>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Valor</th>
              <th>Fecha límite</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id}>
                <td>{a.targetType}</td>
                <td>{a.targetValue ?? a.userId ?? "Todos"}</td>
                <td>{a.dueAt ? new Date(a.dueAt).toLocaleDateString("es-EC") : "—"}</td>
                <td>
                  <button className="btn-link" onClick={() => onDelete(a.id)}>
                    Quitar
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
          <label>Asignar por</label>
          <select value={targetType} onChange={(e) => setTargetType(e.target.value)}>
            <option value="COMPANY">Empresa</option>
            <option value="AREA">Área</option>
            <option value="POSITION">Cargo</option>
            <option value="ALL">Todos los usuarios</option>
          </select>
        </div>
        {targetType !== "ALL" && (
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Valor</label>
            <input required value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
          </div>
        )}
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Fecha límite</label>
          <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </div>
        <button className="btn btn-secondary" type="submit">
          Asignar
        </button>
      </form>
    </div>
  );
}
