'use client';

import type { ExampleItem } from '../interfaces/exam';
import { decodeHtmlEntities } from '../utils/htmlUtils';

type ExamplesBlockProps = { examples: unknown };

export default function ExamplesBlock({ examples }: ExamplesBlockProps) {
  let list: ExampleItem[] = [];
  try {
    if (Array.isArray(examples)) list = examples as ExampleItem[];
  } catch {
    return null;
  }
  if (list.length === 0) return null;
  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-2">Ví dụ</h4>
      <div className="space-y-3">
        {list.map((ex, i) => (
          <div key={i} className="rounded-lg border border-gray-200 p-3 bg-gray-50">
            {ex.input != null && (
              <div className="mb-2">
                <span className="text-xs font-medium text-gray-500">Input:</span>
                <pre className="mt-1 p-2 rounded bg-gray-100 border border-gray-200 text-gray-800 text-sm overflow-x-auto">{decodeHtmlEntities(ex.input)}</pre>
              </div>
            )}
            {ex.output != null && (
              <div>
                <span className="text-xs font-medium text-gray-500">Output:</span>
                <pre className="mt-1 p-2 rounded bg-gray-100 border border-gray-200 text-gray-800 text-sm overflow-x-auto">{decodeHtmlEntities(ex.output)}</pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
