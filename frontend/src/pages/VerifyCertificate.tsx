import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { AuthLayout } from "../components/AuthLayout";

interface VerifyResult {
  valid: boolean;
  integrityValid?: boolean;
  certificate?: {
    code: string;
    courseTitle: string;
    courseCode: string;
    durationMin: number;
    modality: string;
    score: number;
    issuedAt: string;
    holderName: string;
    holderCompany: string | null;
    signedBy: { name: string; position: string } | null;
  };
  message?: string;
}

export function VerifyCertificatePage() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function verify(codeToVerify: string) {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await api.get<VerifyResult>(`/certificates/verify?code=${encodeURIComponent(codeToVerify)}`);
      setResult(res);
    } catch (err) {
      setResult({ valid: false, message: err instanceof ApiError ? err.message : "No fue posible verificar el certificado." });
    } finally {
      setSubmitting(false);
    }
  }

  // Soporta el flujo de QR: si el certificado trae ?code=... en la URL
  // (como el que se genera en el PDF), se verifica automáticamente.
  useEffect(() => {
    const codeFromUrl = params.get("code");
    if (codeFromUrl) verify(codeFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await verify(code);
  }

  return (
    <AuthLayout>
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <div className="auth-logo">
          <div className="mark">ECSA · Proyecto Mirador</div>
          <h2>Verificar certificado</h2>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="code">Código del certificado</label>
            <input id="code" required placeholder="ECSA-SST-XXXXXXXXXXXX" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "100%" }}>
            {submitting ? "Verificando…" : "Verificar"}
          </button>
        </form>

        {result && !result.valid && <div className="alert alert-danger mt-16">{result.message ?? "Código no encontrado — certificado no válido."}</div>}

        {result?.valid && result.certificate && (
          <div className="card mt-16">
            <div className="badge badge-status-completed mt-8">Certificado válido y verificado en el sistema SST-ECSA</div>

            {result.integrityValid === false && (
              <div className="alert alert-danger mt-8">
                ⚠ Este registro no coincide con su huella de emisión original — podría haber sido alterado. Contacte a SST.
              </div>
            )}

            <h3 className="mt-8">{result.certificate.courseTitle}</h3>
            <p className="text-secondary" style={{ fontSize: 13, lineHeight: 1.7 }}>
              <strong>Titular:</strong> {result.certificate.holderName}
              <br />
              {result.certificate.holderCompany && (
                <>
                  <strong>Empresa:</strong> {result.certificate.holderCompany}
                  <br />
                </>
              )}
              <strong>Código curso:</strong> {result.certificate.courseCode}
              <br />
              <strong>Duración:</strong> {result.certificate.durationMin} min
              <br />
              <strong>Modalidad:</strong> {result.certificate.modality}
              <br />
              <strong>Calificación:</strong> {result.certificate.score}%
              <br />
              <strong>Fecha de emisión:</strong> {new Date(result.certificate.issuedAt).toLocaleDateString("es-EC")}
              <br />
              <strong>Código:</strong> {result.certificate.code}
              {result.certificate.signedBy && (
                <>
                  <br />
                  <strong>Firmado por:</strong> {result.certificate.signedBy.name} — {result.certificate.signedBy.position}
                </>
              )}
            </p>
          </div>
        )}

        <div className="mt-16 text-center">
          <Link to="/login" className="btn-link">
            Volver a iniciar sesión
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
