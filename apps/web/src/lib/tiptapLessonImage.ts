import {
  mergeAttributes,
  Node,
  nodeInputRule,
  ResizableNodeView,
  type ResizableNodeViewDirection,
} from "@tiptap/core";

/**
 * Image node (TipTap-compatible) with optional {@link ResizableNodeView} in the editor.
 * Vendored to avoid an extra package in Docker installs; uses `@tiptap/core` only.
 */
const inputRegex = /(?:^|\s)(!\[(.+|:?)]\((\S+)(?:(?:\s+)["'](\S+)["'])?\))$/;

export type LessonImageResizeOptions =
  | {
      enabled: boolean;
      directions?: ResizableNodeViewDirection[];
      minWidth?: number;
      minHeight?: number;
      alwaysPreserveAspectRatio?: boolean;
    }
  | false;

export const LessonImage = Node.create({
  name: "image",

  addOptions() {
    return {
      inline: false,
      allowBase64: false,
      HTMLAttributes: {},
      resize: false as LessonImageResizeOptions,
    };
  },

  inline() {
    return this.options.inline;
  },

  group() {
    return this.options.inline ? "inline" : "block";
  },

  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: null },
      height: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: this.options.allowBase64 ? "img[src]" : 'img[src]:not([src^="data:"])',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },

  addNodeView() {
    const resize = this.options.resize;
    if (!resize || !resize.enabled || typeof document === "undefined") {
      return null;
    }

    const nodeName = this.name;
    const min: { width?: number; height?: number } = {};
    if (resize.minWidth != null) min.width = resize.minWidth;
    if (resize.minHeight != null) min.height = resize.minHeight;

    return ({ node, getPos, HTMLAttributes, editor }) => {
      const el = document.createElement("img");

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        if (value != null && key !== "width" && key !== "height") {
          el.setAttribute(key, String(value));
        }
      });
      el.src = String(HTMLAttributes.src ?? "");

      const nodeView = new ResizableNodeView({
        element: el,
        editor,
        node,
        getPos,
        onResize: (width, height) => {
          el.style.width = `${width}px`;
          el.style.height = `${height}px`;
        },
        onCommit: (width, height) => {
          const pos = getPos();
          if (pos === undefined) return;
          editor.chain().setNodeSelection(pos).updateAttributes(nodeName, { width, height }).run();
        },
        onUpdate: (updatedNode) => updatedNode.type === node.type,
        options: {
          directions: resize.directions,
          ...(Object.keys(min).length ? { min } : {}),
          preserveAspectRatio: resize.alwaysPreserveAspectRatio === true,
        },
      });

      const dom = nodeView.dom as HTMLElement;
      dom.style.visibility = "hidden";
      dom.style.pointerEvents = "none";
      const showDom = () => {
        dom.style.visibility = "";
        dom.style.pointerEvents = "";
      };
      el.onload = showDom;
      el.onerror = showDom;

      return nodeView;
    };
  },

  addCommands() {
    return {
      setImage:
        (options: {
          src: string;
          alt?: string;
          title?: string;
          width?: number;
          height?: number;
        }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: inputRegex,
        type: this.type,
        getAttributes: (match) => {
          const [, , alt, src, title] = match;
          return { src, alt, title };
        },
      }),
    ];
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    image: {
      setImage: (options: {
        src: string;
        alt?: string;
        title?: string;
        width?: number;
        height?: number;
      }) => ReturnType;
    };
  }
}
