const API_URL = import.meta.env.VITE_API_URL || "/api";

export class ApiError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string[] | undefined>) {
    super(message);
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// El backend vive en un origen distinto al frontend (subdominios separados en
// producción), así que el JS del frontend no puede leer la cookie CSRF del
// backend vía document.cookie (pertenece a otro origen). En su lugar, el
// token se obtiene una vez de GET /auth/csrf (protegido por CORS) y se
// guarda en memoria para reenviarlo como header en cada mutación.
let csrfToken: string | null = null;
let csrfFetchPromise: Promise<string | null> | null = null;

async function fetchCsrfToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/auth/csrf`, { credentials: "include" });
    if (!res.ok) return null;
    const data = (await res.json()) as { csrfToken?: string };
    csrfToken = data.csrfToken ?? null;
    return csrfToken;
  } catch {
    return null;
  }
}

// Llamar una vez al iniciar la app (ver AuthContext). Repetible sin costo.
export function ensureCsrfToken(): Promise<string | null> {
  if (csrfToken) return Promise.resolve(csrfToken);
  if (!csrfFetchPromise) csrfFetchPromise = fetchCsrfToken().finally(() => (csrfFetchPromise = null));
  return csrfFetchPromise;
}

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers: Record<string, string> = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers as Record<string, string>),
  };

  if (!SAFE_METHODS.has(method)) {
    const token = csrfToken ?? (await ensureCsrfToken());
    if (token) headers["X-CSRF-Token"] = token;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    method,
    headers,
    credentials: "include",
  });

  // El token pudo invalidarse (cookie expirada/rotada en el servidor);
  // en un 403 CSRF se refresca una sola vez y se reintenta la petición.
  if (res.status === 403 && !isRetry && !SAFE_METHODS.has(method)) {
    csrfToken = null;
    const retryToken = await ensureCsrfToken();
    if (retryToken) {
      return request<T>(path, options, true);
    }
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, (data as any)?.error || "Ocurrió un error inesperado.", (data as any)?.fields);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export async function downloadFile(path: string, filename: string) {
  const res = await fetch(`${API_URL}${path}`, { credentials: "include" });
  if (!res.ok) throw new ApiError(res.status, "No fue posible descargar el archivo.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
