import { useEffect, useState } from "react";
import { api, downloadFile } from "../api/client";
import { useToast } from "../context/ToastContext";
import type { Certificate } from "../types";

export function CertificatesPage() {
  const [certificates, setCertificates] = useState<Certificate[] | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { notify } = useToast();

  useEffect(() => {
    api.get<{ certificates: Certificate[] }>("/certificates/mine").then((res) => setCertificates(res.certificates));
  }, []);

  async function handleDownload(c: Certificate) {
    setDownloadingId(c.id);
    try {
      await downloadFile(`/certificates/mine/${c.id}/pdf`, `certificado-${c.code}.pdf`);
    } catch {
      notify("No fue posible descargar el certificado.", "danger");
    } finally {
      setDownloadingId(null);
    }
  }

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
            <button className="btn btn-primary btn-sm mt-8" onClick={() => handleDownload(c)} disabled={downloadingId === c.id}>
              {downloadingId === c.id ? "Generando…" : "📄 Descargar certificado (PDF)"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
