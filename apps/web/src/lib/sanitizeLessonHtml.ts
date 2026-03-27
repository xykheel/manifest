/**
 * Client-only sanitiser for admin-authored lesson HTML (TipTap / StarterKit-ish tags).
 * Avoids a third-party dep so Docker bind mounts + anonymous node_modules volumes stay reliable.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "s",
  "strike",
  "del",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "hr",
  "a",
  "u",
]);

/** Inline `style` is allowed only for these tags, and only `text-align` (TipTap TextAlign). */
const TAGS_ALLOW_STYLE_TEXT_ALIGN = new Set(["p", "h1", "h2", "h3", "h4", "li"]);

const REMOVE_ENTIRELY = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "textarea",
  "select",
  "button",
  "meta",
  "link",
  "base",
]);

/** URLs allowed in lesson links (editor + sanitised HTML). */
export function isAllowedLessonLinkHref(href: string): boolean {
  const t = href.trim().toLowerCase();
  return t.startsWith("http://") || t.startsWith("https://") || t.startsWith("mailto:");
}

/**
 * Normalises URL or email input from the link dialog: adds https for bare hosts, mailto for a simple email shape.
 */
export function normalizeLessonLinkInput(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const lower = t.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://") || lower.startsWith("mailto:")) {
    return t;
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
    return `mailto:${t}`;
  }
  return `https://${t.replace(/^\/+/, "")}`;
}

function safeHref(href: string): boolean {
  return isAllowedLessonLinkHref(href);
}

function filterTextAlignOnly(style: string | null): string | undefined {
  if (!style?.trim()) return undefined;
  const kept: string[] = [];
  for (const part of style.split(";")) {
    const colon = part.indexOf(":");
    if (colon === -1) continue;
    const prop = part.slice(0, colon).trim().toLowerCase();
    const val = part.slice(colon + 1).trim().toLowerCase();
    if (prop === "text-align" && ["left", "center", "right", "justify"].includes(val)) {
      kept.push(`text-align: ${val}`);
    }
  }
  return kept.length ? kept.join("; ") : undefined;
}

function cleanAttributes(el: Element, tag: string) {
  const allowAlignStyle = TAGS_ALLOW_STYLE_TEXT_ALIGN.has(tag);
  const priorStyle = allowAlignStyle ? el.getAttribute("style") : null;

  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (name.startsWith("on")) {
      el.removeAttribute(attr.name);
      continue;
    }
    if (tag === "a") {
      if (name === "href") {
        if (!safeHref(attr.value)) {
          el.removeAttribute("href");
        }
      } else {
        el.removeAttribute(attr.name);
      }
      continue;
    }
    el.removeAttribute(attr.name);
  }

  if (tag === "a" && el.hasAttribute("href")) {
    el.setAttribute("rel", "noopener noreferrer");
    el.setAttribute("target", "_blank");
  }

  if (allowAlignStyle) {
    const filtered = filterTextAlignOnly(priorStyle);
    if (filtered) {
      el.setAttribute("style", filtered);
    }
  }
}

function detach(node: Node) {
  node.parentNode?.removeChild(node);
}

function sanitizeTree(node: Node): void {
  if (node.nodeType === Node.TEXT_NODE) return;
  if (node.nodeType === Node.COMMENT_NODE) {
    detach(node);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    detach(node);
    return;
  }

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (REMOVE_ENTIRELY.has(tag)) {
    detach(el);
    return;
  }

  if (!ALLOWED_TAGS.has(tag)) {
    const parent = el.parentNode;
    if (!parent) return;
    const moved = Array.from(el.childNodes);
    for (const c of moved) {
      parent.insertBefore(c, el);
      sanitizeTree(c);
    }
    detach(el);
    return;
  }

  cleanAttributes(el, tag);

  for (const c of Array.from(el.childNodes)) {
    sanitizeTree(c);
  }
}

export function sanitizeLessonHtml(html: string): string {
  if (typeof document === "undefined") return "";
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  for (const c of Array.from(tpl.content.childNodes)) {
    sanitizeTree(c);
  }
  return tpl.innerHTML;
}
