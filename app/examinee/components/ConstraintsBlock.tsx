'use client';

import { RichTextPreview } from '@/app/admin/components/RichTextEditor';
import { decodeHtmlEntities } from '../utils/htmlUtils';

type ConstraintsBlockProps = { constraints: string | null };

export default function ConstraintsBlock({ constraints }: ConstraintsBlockProps) {
  if (!constraints || !constraints.trim()) return null;
  const isHtml = /<[a-z][\s\S]*>/i.test(constraints);
  const displayText = isHtml ? constraints : decodeHtmlEntities(constraints);
  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-2">Ràng buộc</h4>
      {isHtml ? (
        <RichTextPreview html={displayText} />
      ) : (
        <div className="rich-text-preview rounded-lg border border-gray-200 p-3 bg-gray-50 text-sm overflow-x-auto" style={{ minHeight: 60, maxHeight: 200 }}>
          <pre className="whitespace-pre-wrap font-sans text-gray-800 m-0">{displayText}</pre>
        </div>
      )}
    </div>
  );
}
