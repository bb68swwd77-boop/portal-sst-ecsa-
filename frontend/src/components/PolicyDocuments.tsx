import { useLanguage } from "../context/LanguageContext";
import { POLICIES } from "../content/policies";

// Muestra las dos políticas (datos personales y cookies) en el idioma activo.
// Se reutiliza en la pantalla de aceptación y en la página pública /politicas.
export function PolicyDocuments({ scrollable = false }: { scrollable?: boolean }) {
  const { lang } = useLanguage();

  return (
    <div className={scrollable ? "policy-scroll" : undefined} tabIndex={scrollable ? 0 : undefined}>
      {POLICIES[lang].map((doc) => (
        <article key={doc.id} id={`politica-${doc.id}`} className="policy-doc">
          <h3>{doc.title}</h3>
          <p className="text-muted policy-updated">{doc.updated}</p>
          {doc.sections.map((s) => (
            <section key={s.heading}>
              <h4>{s.heading}</h4>
              {s.paragraphs?.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {s.bullets && (
                <ul>
                  {s.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>
      ))}
    </div>
  );
}
