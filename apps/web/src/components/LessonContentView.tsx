import { lessonContentLooksLikeHtml } from "../lib/lessonContent";
import { sanitizeLessonHtml } from "../lib/sanitizeLessonHtml";

type Props = {
  content: string;
  className?: string;
};

/**
 * Renders lesson body: rich HTML (sanitised, including http(s) and mailto links, and remote http(s) images) or legacy plain text with preserved line breaks.
 */
export function LessonContentView({ content, className = "" }: Props) {
  if (!content) return null;

  if (lessonContentLooksLikeHtml(content)) {
    return (
      <div
        className={`lesson-content-html ${className}`}
        dangerouslySetInnerHTML={{ __html: sanitizeLessonHtml(content) }}
      />
    );
  }

  return (
    <div className={`whitespace-pre-wrap text-lg leading-relaxed text-slate-600 dark:text-slate-300 ${className}`}>
      {content}
    </div>
  );
}
