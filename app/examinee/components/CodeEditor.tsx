'use client';

import { useCallback } from 'react';
import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(() => import('@monaco-editor/react').then((mod) => mod.Editor), { ssr: false });

export type MonacoEditorInstance = {
  getAction?: (id: string) => { run: () => Promise<unknown> } | null;
  getModel?: () => { getValue: () => string } | null;
};

const LANG_MAP: Record<string, string> = {
  c: 'c',
  cpp: 'cpp',
  py: 'python',
  python: 'python',
  js: 'javascript',
  javascript: 'javascript',
  java: 'java',
  go: 'go',
};

type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  language: string;
  disabled?: boolean;
  onEditorReady?: (editor: MonacoEditorInstance) => void;
  height?: string | number;
  className?: string;
};

export default function CodeEditor({
  value,
  onChange,
  language,
  disabled = false,
  onEditorReady,
  height = '100%',
  className,
}: CodeEditorProps) {
  const monacoLang = LANG_MAP[language.toLowerCase()] ?? language ?? 'cpp';

  const handleEditorDidMount = useCallback(
    (editor: MonacoEditorInstance) => {
      onEditorReady?.(editor);
    },
    [onEditorReady]
  );

  return (
    <div className={className} style={{ height: typeof height === 'number' ? `${height}px` : height, minHeight: 220 }}>
      <MonacoEditor
        height={height === '100%' ? '100%' : undefined}
        language={monacoLang}
        value={value}
        onChange={(v) => onChange(v ?? '')}
        onMount={handleEditorDidMount}
        loading={<div className="flex items-center justify-center h-full min-h-[220px] text-gray-500 text-sm">Đang tải editor...</div>}
        theme="vs"
        options={{
          readOnly: disabled,
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          formatOnPaste: true,
          formatOnType: true,
          bracketPairColorization: { enabled: true },
          padding: { top: 12, bottom: 12 },
        }}
      />
    </div>
  );
}
