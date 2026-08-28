import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = ["p", "b", "strong", "i", "em", "u", "ul", "ol", "li", "br", "h3", "h4", "a", "blockquote", "img"];

// Sanea HTML enriquecido antes de persistirlo: el contenido lo escribe un admin,
// pero se renderiza para todos los capacitados — nunca se confía en el HTML entrante.
// Se permite <img> (imágenes de referencia embebidas en el contenido de la
// lección, ej. señalización, EPP, diagramas) restringido a src/alt/dimensiones
// — DOMPurify además bloquea por defecto esquemas peligrosos (javascript:, etc).
export function sanitizeRichText(html: string | null | undefined): string | undefined {
  if (!html) return undefined;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "width", "height"],
  });
}
