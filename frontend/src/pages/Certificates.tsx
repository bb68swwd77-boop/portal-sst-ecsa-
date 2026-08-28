import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Certificate } from "../types";

export function CertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[] | null>(null);

  useEffect(() => {
    api.get<{ certificates: Certificate[] }>("/certificates/mine").then((res) => setCertificates(res.certificates));
  }, []);

  return (
    <div>
      <h2 className="page-title">Mis certificados</h2>
      <p className="page-subtitle">Certificados emitidos al aprobar cada capacitación.</p>

      {certificates && certificates.length === 0 && (
        <div className="empty-state card">Aún no tiene certificados emitidos.</div>
      )}

      <div className="card-grid">
        {certificates?.map((c) => (
          <div key={c.id} className="card">
            <span className="badge badge-status-completed">Vigente</span>
            <h3 className="mt-8">{c.course.title}</h3>
            <p className="text-secondary" style={{ fontSize: 13 }}>
              Calificación: {c.score}%
              <br />
              Duración: {c.durationMin} min
              <br />
              Emitido: {new Date(c.issuedAt).toLocaleDateString("es-EC")}
              <br />
              Código: <strong>{c.code}</strong>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
