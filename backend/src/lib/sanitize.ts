import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = ["p", "b", "strong", "i", "em", "u", "ul", "ol", "li", "br", "h3", "h4", "a", "blockquote"];

// Sanea HTML enriquecido antes de persistirlo: el contenido lo escribe un admin,
// pero se renderiza para todos los capacitados — nunca se confía en el HTML entrante.
export function sanitizeRichText(html: string | null | undefined): string | undefined {
  if (!html) return undefined;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
}
