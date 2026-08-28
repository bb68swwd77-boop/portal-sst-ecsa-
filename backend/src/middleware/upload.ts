import multer from "multer";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set(["application/pdf"]);

/**
 * Carga en memoria (no a disco): el buffer se persiste directo en la BD
 * (FileAsset.data) — ver ARCHITECTURE.md sobre esta decisión para el MVP.
 * Restringe tipo MIME y tamaño en el propio middleware, antes de tocar BD.
 */
export const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error("Solo se permiten archivos PDF."));
      return;
    }
    cb(null, true);
  },
}).single("file");
