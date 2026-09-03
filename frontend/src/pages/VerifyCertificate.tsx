import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { AuthLayout } from "../components/AuthLayout";
import { useLanguage } from "../context/LanguageContext";

interface VerifyResult {
  valid: boolean;
  certificate?: {
    code: string;
    courseTitle: string;
    courseCode: string;
    durationMin: number;
    score: number;
    issuedAt: string;
    holderName: string;
    holderDocument: string | null;
    holderCompany: string | null;
  };
  message?: string;
}

export function VerifyCertificatePage() {
  const { t } = useLanguage();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res = await api.get<VerifyResult>(`/certificates/verify?code=${encodeURIComponent(code)}`);
      setResult(res);
    } catch (err) {
      setResult({ valid: false, message: err instanceof ApiError ? err.message : "No fue posible verificar el certificado." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <div className="auth-logo">
          <div className="mark">ECSA · Proyecto Mirador</div>
          <h2>{t("Verificar certificado")}</h2>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="code">{t("Código del certificado")}</label>
            <input id="code" required placeholder="ECSA-SST-XXXXXXXXXXXX" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "100%" }}>
            {submitting ? t("Verificando…") : t("Verificar")}
          </button>
        </form>

        {result && !result.valid && (
          <div className="alert alert-danger mt-16">{t(result.message ?? "Certificado no válido.")}</div>
        )}

        {result?.valid && result.certificate && (
          <div className="card mt-16">
            <div className="badge badge-status-completed mt-8">{t("Certificado válido")}</div>
            <h3 className="mt-8">{result.certificate.courseTitle}</h3>
            <p className="text-secondary" style={{ fontSize: 13, lineHeight: 1.7 }}>
              <strong>{t("Titular:")}</strong> {result.certificate.holderName}
              <br />
              {result.certificate.holderCompany && (
                <>
                  <strong>{t("Empresa:")}</strong> {result.certificate.holderCompany}
                  <br />
                </>
              )}
              <strong>{t("Código curso:")}</strong> {result.certificate.courseCode}
              <br />
              <strong>{t("Duración:")}</strong> {result.certificate.durationMin} min
              <br />
              <strong>{t("Calificación:")}</strong> {result.certificate.score}%
              <br />
              <strong>{t("Fecha de emisión:")}</strong> {new Date(result.certificate.issuedAt).toLocaleDateString("es-EC")}
              <br />
              <strong>{t("Código:")}</strong> {result.certificate.code}
            </p>
          </div>
        )}

        <div className="mt-16 text-center">
          <Link to="/login" className="btn-link">
            {t("Volver a iniciar sesión")}
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
