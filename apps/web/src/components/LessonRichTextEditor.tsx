import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useState } from "react";
import { lessonDraftToEditorHtml } from "../lib/lessonContent";

const ZOOM_STEPS = [75, 85, 90, 100, 110, 125, 150, 175] as const;

function preventTipTapBlur(e: React.MouseEvent) {
  e.preventDefault();
}

function IconAlignLeft({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" d="M4 6h16M4 12h10M4 18h16" />
    </svg>
  );
}

function IconAlignCenter({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" d="M4 6h16M7 12h10M5 18h14" />
    </svg>
  );
}

function IconAlignRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" d="M4 6h16M10 12h10M4 18h16" />
    </svg>
  );
}

function IconAlignJustify({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function IconClearFormat({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 4l4 4-9 9-4 1 1-4 9-9zM14.5 5.5l4 4M6 20h4"
      />
      <path strokeLinecap="round" d="M9 17l-2 2" />
    </svg>
  );
}

const toolbarBtn =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-800 hover:text-slate-100";

const toolbarBtnActive =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-800 text-violet-400 transition hover:bg-slate-700 hover:text-violet-300";

const selectBase =
  "h-8 cursor-pointer appearance-none rounded-md border border-slate-700/80 bg-slate-800/90 pl-2.5 pr-7 text-xs font-medium text-violet-400 outline-none transition hover:border-slate-600 hover:bg-slate-800 focus-visible:ring-1 focus-visible:ring-violet-500/50";

type Props = {
  value: string;
  onChange: (html: string) => void;
  editorKey: string | number;
  placeholder?: string;
};

export function LessonRichTextEditor({ value, onChange, editorKey, placeholder }: Props) {
  const [zoomPercent, setZoomPercent] = useState(100);
  const scale = zoomPercent / 100;
  const initial = lessonDraftToEditorHtml(value);

  const editor = useEditor(
    {
      shouldRerenderOnTransaction: true,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        TextAlign.configure({
          types: ["heading", "paragraph"],
        }),
        Placeholder.configure({
          placeholder: placeholder ?? "Write the lesson…",
        }),
      ],
      content: initial || "<p></p>",
      editorProps: {
        attributes: {
          class: "tiptap lesson-rich-text-editor focus:outline-none",
        },
      },
      onUpdate: ({ editor: ed }) => {
        onChange(ed.getHTML());
      },
    },
    [editorKey],
  );

  function stepZoom(delta: number) {
    setZoomPercent((z) => {
      let idx = ZOOM_STEPS.indexOf(z as (typeof ZOOM_STEPS)[number]);
      if (idx === -1) {
        idx = ZOOM_STEPS.reduce(
          (best, s, i) => (Math.abs(s - z) < Math.abs(ZOOM_STEPS[best] - z) ? i : best),
          0,
        );
      }
      const next = Math.min(ZOOM_STEPS.length - 1, Math.max(0, idx + delta));
      return ZOOM_STEPS[next];
    });
  }

  function clearFormatting() {
    if (!editor) return;
    if (editor.isActive("bulletList")) {
      editor.chain().focus().toggleBulletList().run();
    }
    if (editor.isActive("orderedList")) {
      editor.chain().focus().toggleOrderedList().run();
    }
    editor.chain().focus().unsetAllMarks().unsetTextAlign().setParagraph().run();
  }

  if (!editor) {
    return (
      <div className="min-h-[400px] animate-pulse rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/60" aria-hidden />
    );
  }

  const blockSelect: "p" | "h1" | "h2" | "h3" = editor.isActive("heading", { level: 1 })
    ? "h1"
    : editor.isActive("heading", { level: 2 })
      ? "h2"
      : editor.isActive("heading", { level: 3 })
        ? "h3"
        : "p";

  const listSelect = editor.isActive("bulletList")
    ? "bullet"
    : editor.isActive("orderedList")
      ? "ordered"
      : "none";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-600">
      <div
        className="flex flex-wrap items-center gap-x-1 gap-y-1.5 border-b border-slate-700/90 bg-[#141518] px-2 py-2"
        role="toolbar"
        aria-label="Lesson formatting"
      >
        <div className="flex items-center gap-0.5 pr-2">
          <button
            type="button"
            onMouseDown={preventTipTapBlur}
            onClick={() => stepZoom(-1)}
            className={`${toolbarBtn} w-7 text-base font-light`}
            title="Zoom out"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="min-w-[3.25rem] select-none rounded-md bg-slate-800 px-2 py-1 text-center text-[11px] font-medium tabular-nums text-slate-200">
            {zoomPercent}%
          </span>
          <button
            type="button"
            onMouseDown={preventTipTapBlur}
            onClick={() => stepZoom(1)}
            className={`${toolbarBtn} w-7 text-base font-light`}
            title="Zoom in"
            aria-label="Zoom in"
          >
            +
          </button>
        </div>

        <span className="hidden h-5 w-px shrink-0 bg-slate-700 sm:block" aria-hidden />

        <div className="relative">
          <select
            value={blockSelect}
            onChange={(e) => {
              const v = e.target.value as typeof blockSelect;
              if (v === "p") {
                editor.chain().focus().setParagraph().run();
              } else if (v === "h1") {
                editor.chain().focus().setHeading({ level: 1 }).run();
              } else if (v === "h2") {
                editor.chain().focus().setHeading({ level: 2 }).run();
              } else {
                editor.chain().focus().setHeading({ level: 3 }).run();
              }
            }}
            className={selectBase}
            title="Block style"
            aria-label="Paragraph or heading"
          >
            <option value="p" className="bg-slate-900 text-slate-200">
              Paragraph
            </option>
            <option value="h1" className="bg-slate-900 text-slate-200">
              H1
            </option>
            <option value="h2" className="bg-slate-900 text-slate-200">
              H2
            </option>
            <option value="h3" className="bg-slate-900 text-slate-200">
              H3
            </option>
          </select>
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500" aria-hidden>
            ▾
          </span>
        </div>

        <div className="relative">
          <select
            value={listSelect}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "none") {
                if (editor.isActive("bulletList")) {
                  editor.chain().focus().toggleBulletList().run();
                }
                if (editor.isActive("orderedList")) {
                  editor.chain().focus().toggleOrderedList().run();
                }
              } else if (v === "bullet") {
                if (editor.isActive("orderedList")) {
                  editor.chain().focus().toggleOrderedList().toggleBulletList().run();
                } else {
                  editor.chain().focus().toggleBulletList().run();
                }
              } else {
                if (editor.isActive("bulletList")) {
                  editor.chain().focus().toggleBulletList().toggleOrderedList().run();
                } else {
                  editor.chain().focus().toggleOrderedList().run();
                }
              }
            }}
            className={`${selectBase} pl-9`}
            title="List style"
            aria-label="List style"
          >
            <option value="none" className="bg-slate-900 text-slate-200">
              No list
            </option>
            <option value="bullet" className="bg-slate-900 text-slate-200">
              Bulleted list
            </option>
            <option value="ordered" className="bg-slate-900 text-slate-200">
              Numbered list
            </option>
          </select>
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden>
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M9 6h11M9 12h11M9 18h11M5 6h.01M5 12h.01M5 18h.01" />
            </svg>
          </span>
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500" aria-hidden>
            ▾
          </span>
        </div>

        <span className="hidden h-5 w-px shrink-0 bg-slate-700 sm:block" aria-hidden />

        <button
          type="button"
          onMouseDown={preventTipTapBlur}
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive("bold") ? toolbarBtnActive : toolbarBtn}
          title="Bold"
        >
          <span className="text-sm font-bold">B</span>
        </button>
        <button
          type="button"
          onMouseDown={preventTipTapBlur}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive("italic") ? toolbarBtnActive : toolbarBtn}
          title="Italic"
        >
          <span className="italic">I</span>
        </button>
        <button
          type="button"
          onMouseDown={preventTipTapBlur}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={editor.isActive("strike") ? toolbarBtnActive : toolbarBtn}
          title="Strikethrough"
        >
          <span className="line-through">S</span>
        </button>
        <button
          type="button"
          onMouseDown={preventTipTapBlur}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive("underline") ? toolbarBtnActive : toolbarBtn}
          title="Underline"
        >
          <span className="underline">U</span>
        </button>
        <button
          type="button"
          onMouseDown={preventTipTapBlur}
          onClick={() => clearFormatting()}
          className={toolbarBtn}
          title="Clear formatting"
          aria-label="Clear formatting"
        >
          <IconClearFormat className="h-4 w-4" />
        </button>

        <span className="hidden h-5 w-px shrink-0 bg-slate-700 sm:block" aria-hidden />

        <button
          type="button"
          onMouseDown={preventTipTapBlur}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={editor.isActive({ textAlign: "left" }) ? toolbarBtnActive : toolbarBtn}
          title="Align left"
        >
          <IconAlignLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onMouseDown={preventTipTapBlur}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={editor.isActive({ textAlign: "center" }) ? toolbarBtnActive : toolbarBtn}
          title="Align centre"
        >
          <IconAlignCenter className="h-4 w-4" />
        </button>
        <button
          type="button"
          onMouseDown={preventTipTapBlur}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={editor.isActive({ textAlign: "right" }) ? toolbarBtnActive : toolbarBtn}
          title="Align right"
        >
          <IconAlignRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onMouseDown={preventTipTapBlur}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          className={editor.isActive({ textAlign: "justify" }) ? toolbarBtnActive : toolbarBtn}
          title="Justify"
        >
          <IconAlignJustify className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[min(70vh,1040px)] overflow-auto bg-white dark:bg-slate-950/40">
        <div
          className="inline-block min-w-full origin-top-left transition-transform"
          style={{
            transform: `scale(${scale})`,
            width: scale === 1 ? "100%" : `${100 / scale}%`,
          }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
