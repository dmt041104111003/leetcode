'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useRef } from 'react';

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
};

export function RichTextEditor({ value, onChange, placeholder = 'Nhập mô tả đề bài...', minHeight = '280px' }: RichTextEditorProps) {
  const isInitialized = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: { HTMLAttributes: { class: 'rich-text-code' } },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'rich-text-editor-inner',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (html !== value) onChange(html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML() && !isInitialized.current) {
      editor.commands.setContent(value || '', { emitUpdate: false });
      isInitialized.current = true;
    }
  }, [editor, value]);

  useEffect(() => {
    isInitialized.current = false;
  }, [value?.slice(0, 50)]);

  if (!editor) return <div style={{ minHeight, border: '1px solid #d1d5db', borderRadius: 8 }} />;

  return (
    <div
      className="rich-text-editor"
      style={{
        minHeight,
        border: '1px solid #d1d5db',
        borderRadius: 8,
        overflow: 'auto',
      }}
    >
      <EditorContent editor={editor} />
      <style jsx global>{`
        .rich-text-editor .ProseMirror {
          min-height: ${minHeight};
          padding: 0.75rem 1rem;
          outline: none;
          font-size: 0.9375rem;
        }
        .rich-text-editor .ProseMirror:focus {
          outline: none;
        }
        .rich-text-editor .ProseMirror p.is-editor-empty:first-child::before {
          color: #9ca3af;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .rich-text-editor .rich-text-code,
        .rich-text-editor pre {
          background: #f1f5f9;
          color: #334155;
          padding: 0.75rem 1rem;
          border-radius: 6px;
          overflow-x: auto;
          font-size: 0.875rem;
          margin: 0.5rem 0;
          border: 1px solid #e2e8f0;
        }
        .rich-text-editor pre code {
          background: none;
          padding: 0;
        }
        .rich-text-editor h1 { font-size: 1.5rem; font-weight: 700; margin: 0.75rem 0; }
        .rich-text-editor h2 { font-size: 1.25rem; font-weight: 600; margin: 0.5rem 0; }
        .rich-text-editor h3 { font-size: 1.125rem; font-weight: 600; margin: 0.5rem 0; }
        .rich-text-editor ul, .rich-text-editor ol { margin: 0.5rem 0; padding-left: 1.5rem; }
        .rich-text-editor blockquote { border-left: 4px solid #d1d5db; margin: 0.5rem 0; padding-left: 1rem; color: #6b7280; }
      `}</style>
    </div>
  );
}

export function RichTextPreview({ html }: { html: string }) {
  const isEmpty = !html || html.trim() === '' || html === '<p></p>' || html === '<p><br></p>';
  return (
    <>
      <div
        className="rich-text-preview"
        style={{
          minHeight: 200,
          maxHeight: 400,
          overflow: 'auto',
          padding: '0.75rem 1rem',
          border: '1px solid #d1d5db',
          borderRadius: 8,
          backgroundColor: '#fafafa',
          fontSize: '0.9375rem',
        }}
        dangerouslySetInnerHTML={{ __html: isEmpty ? '<p style="color:#9ca3af">Chưa có nội dung</p>' : html }}
      />
      <style jsx global>{`
        .rich-text-preview h1 { font-size: 1.5rem; font-weight: 700; margin: 0.75rem 0; }
        .rich-text-preview h2 { font-size: 1.25rem; font-weight: 600; margin: 0.5rem 0; }
        .rich-text-preview h3 { font-size: 1.125rem; font-weight: 600; margin: 0.5rem 0; }
        .rich-text-preview p { margin: 0.5rem 0; }
        .rich-text-preview ul, .rich-text-preview ol { margin: 0.5rem 0; padding-left: 1.5rem; }
        .rich-text-preview pre, .rich-text-preview code { background: #f1f5f9; color: #334155; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.875rem; border: 1px solid #e2e8f0; }
        .rich-text-preview pre { padding: 0.75rem 1rem; overflow-x: auto; margin: 0.5rem 0; }
        .rich-text-preview pre code { padding: 0; background: none; border: none; }
        .rich-text-preview blockquote { border-left: 4px solid #d1d5db; margin: 0.5rem 0; padding-left: 1rem; color: #6b7280; }
        .rich-text-preview strong.example { display: block; margin: 0.5rem 0 0.25rem; }
        .rich-text-preview sup { font-size: 0.75em; vertical-align: super; }
      `}</style>
    </>
  );
}
