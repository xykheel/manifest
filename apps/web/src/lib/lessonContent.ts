/** Plain lesson text (legacy) vs HTML from TipTap */
export function lessonContentLooksLikeHtml(raw: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(raw.trim());
}

/** Convert stored plain text into HTML the editor can load */
export function lessonDraftToEditorHtml(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (lessonContentLooksLikeHtml(t)) return t;
  const esc = t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function isRichTextEmpty(html: string): boolean {
  if (typeof document === "undefined") {
    return html.replace(/<[^>]*>/g, "").trim().length === 0;
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").trim().length === 0;
}

export function lessonContentPlainPreview(html: string, maxLen: number): string {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}
