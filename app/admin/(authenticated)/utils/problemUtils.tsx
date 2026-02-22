import React from 'react';

export function decodeHtmlEntities(s: string): string {
  const doc = typeof document !== 'undefined' ? document : null;
  if (doc) {
    const el = doc.createElement('textarea');
    el.innerHTML = s;
    return el.value;
  }
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'");
}

export function formatConstraintsPreview(s: string): string {
  let out = decodeHtmlEntities(s);
  out = out.replace(/\b10 6\b/g, '10⁶').replace(/\b10 4\b/g, '10⁴').replace(/\b10 9\b/g, '10⁹');
  return out;
}

export const previewBoxStyle: React.CSSProperties = {
  minHeight: 120,
  maxHeight: 320,
  overflow: 'auto',
  padding: '0.75rem 1rem',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  backgroundColor: '#fafafa',
  fontSize: '0.9375rem',
};

export function ExamplesPreview({ json }: { json: string }) {
  let list: Array<{ input?: string; output?: string; explanation?: string | null }> = [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) list = parsed;
  } catch {
    return <div style={previewBoxStyle}>JSON không hợp lệ</div>;
  }
  if (list.length === 0) return <div style={previewBoxStyle}>Chưa có ví dụ</div>;
  return (
    <div style={previewBoxStyle}>
      {list.map((ex, i) => (
        <div key={i} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: i < list.length - 1 ? '1px solid #e5e7eb' : undefined }}>
          {ex.input != null && <div><strong>Input:</strong><pre style={{ margin: '0.25rem 0', padding: '0.5rem', background: '#1e293b', color: '#e2e8f0', borderRadius: 4, fontSize: '0.875rem', overflow: 'auto' }}>{decodeHtmlEntities(ex.input)}</pre></div>}
          {ex.output != null && <div><strong>Output:</strong><pre style={{ margin: '0.25rem 0', padding: '0.5rem', background: '#1e293b', color: '#e2e8f0', borderRadius: 4, fontSize: '0.875rem', overflow: 'auto' }}>{decodeHtmlEntities(ex.output)}</pre></div>}
          {ex.explanation != null && ex.explanation !== '' && <div><strong>Explanation:</strong><p style={{ margin: '0.25rem 0' }}>{decodeHtmlEntities(ex.explanation)}</p></div>}
        </div>
      ))}
    </div>
  );
}

export function StarterCodePreview({ json }: { json: string }) {
  let obj: Record<string, string> = {};
  try {
    const parsed = JSON.parse(json);
    if (parsed != null && typeof parsed === 'object' && !Array.isArray(parsed)) obj = parsed;
  } catch {
    return <div style={previewBoxStyle}>JSON không hợp lệ</div>;
  }
  const entries = Object.entries(obj);
  if (entries.length === 0) return <div style={previewBoxStyle}>Chưa có starter code</div>;
  return (
    <div style={previewBoxStyle}>
      {entries.map(([lang, code]) => (
        <div key={lang} style={{ marginBottom: '1rem' }}>
          <strong style={{ display: 'block', marginBottom: '0.25rem', textTransform: 'capitalize' }}>{lang}</strong>
          <pre style={{ margin: 0, padding: '0.75rem', background: '#1e293b', color: '#e2e8f0', borderRadius: 4, fontSize: '0.8125rem', overflow: 'auto', whiteSpace: 'pre-wrap' }}>{code}</pre>
        </div>
      ))}
    </div>
  );
}
