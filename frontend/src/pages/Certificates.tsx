import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import type { Certificate } from "../types";
import badgeCertificado from "../assets/badge-certificado.webp";

export function CertificatesPage() {
  const { t } = useLanguage();
  const [certificates, setCertificates] = useState<Certificate[] | null>(null);

  useEffect(() => {
    api.get<{ certificates: Certificate[] }>("/certificates/mine").then((res) => setCertificates(res.certificates));
  }, []);

  return (
    <div>
      <h2 className="page-title">{t("Mis certificados")}</h2>
      <p className="page-subtitle">{t("Certificados emitidos al aprobar cada capacitación.")}</p>

      {certificates && certificates.length === 0 && (
        <div className="empty-state card">{t("Aún no tiene certificados emitidos.")}</div>
      )}

      <div className="card-grid">
        {certificates?.map((c) => (
          <div key={c.id} className="card course-card">
            <div className="course-thumb" style={c.course.imageUrl ? { backgroundImage: `url(${c.course.imageUrl})` } : undefined}>
              {!c.course.imageUrl && <span className="course-thumb-fallback">🛡️</span>}
              <img src={badgeCertificado} alt="" className="certificate-badge" />
            </div>
            <div className="course-card-body">
              <div>
                <span className="badge badge-status-completed">{t("Vigente")}</span>
              </div>
              <h3 className="course-title">{c.course.title}</h3>
              <p className="text-secondary" style={{ fontSize: 13, margin: 0 }}>
                {t("Calificación:")} {c.score}%
                <br />
                {t("Duración:")} {c.durationMin} min
                <br />
                {t("Emitido:")} {new Date(c.issuedAt).toLocaleDateString("es-EC")}
                <br />
                {t("Código:")} <strong>{c.code}</strong>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
