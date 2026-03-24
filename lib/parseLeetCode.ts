export type ParsedLeetCode = {
  title: string;
  difficulty: string;
  descriptionHtml: string;
  constraints: string;
  examples: Array<{ input?: string; output?: string; explanation?: string | null }>;
  starterCode: Record<string, string>;
};

const DIFFICULTY_MAP: Record<string, string> = {
  easy: 'EASY',
  medium: 'MEDIUM',
  hard: 'HARD',
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paragraphToHtml(block: string): string {
  const trimmed = block.trim();
  if (!trimmed) return '';
  const withBr = escapeHtml(trimmed).replace(/\n/g, '<br/>');
  const strongLabels = ['Example ', 'Input:', 'Output:', 'Explanation:', 'Constraints:'];
  let out = withBr;
  for (const label of strongLabels) {
    const re = new RegExp(`(${escapeHtml(label)})`, 'gi');
    out = out.replace(re, '<strong>$1</strong>');
  }
  return `<p>${out}</p>`;
}

function parseOutputsFromContent(content: string): string[] {
  const outputs: string[] = [];
  const re = /<strong[^>]*>Output:\s*<\/strong>\s*([^\n<]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    outputs.push(m[1].replace(/\s+/g, ' ').trim());
  }
  return outputs;
}

function parseFromNextData(raw: string): ParsedLeetCode | null {
  const match = raw.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json"\s*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]) as {
      props?: {
        pageProps?: {
          dehydratedState?: {
            queries?: Array<{
              queryKey?: unknown[];
              state?: {
                data?: {
                  question?: {
                    title?: string;
                    difficulty?: string;
                    content?: string;
                    exampleTestcaseList?: string[];
                    codeSnippets?: Array<{ code?: string; lang?: string; langSlug?: string }>;
                  };
                };
              };
            }>;
          };
        };
      };
    };
    const queries = data?.props?.pageProps?.dehydratedState?.queries;
    if (!Array.isArray(queries)) return null;
    const detailQuery = queries.find(
      (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'questionDetail'
    );
    const question = detailQuery?.state?.data?.question;
    if (!question?.content) return null;
    const title = question.title ?? '';
    const difficulty = DIFFICULTY_MAP[(question.difficulty ?? '').toLowerCase()] ?? 'EASY';
    const constraintsMatch = question.content.match(
      /<p>\s*<strong[^>]*>Constraints:\s*<\/strong>\s*<\/p>\s*<ul>([\s\S]*?)<\/ul>/i
    );
    let constraints = '';
    let descriptionHtml = question.content;
    if (constraintsMatch) {
      const ul = constraintsMatch[0];
      descriptionHtml = question.content.replace(ul, '').trim();
      const liMatches = constraintsMatch[1].match(/<li>([\s\S]*?)<\/li>/g);
      if (liMatches) {
        constraints = liMatches
          .map((li) => li.replace(/<\/?li>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
          .join('\n');
      }
    }
    const inputList = Array.isArray(question.exampleTestcaseList) ? question.exampleTestcaseList : [];
    const outputList = parseOutputsFromContent(question.content);
    const examples = inputList.map((input, i) => ({
      input,
      output: outputList[i] ?? '',
      explanation: null as string | null,
    }));
    const starterCode: Record<string, string> = {};
    if (Array.isArray(question.codeSnippets)) {
      for (const s of question.codeSnippets) {
        if (s.langSlug && typeof s.code === 'string') starterCode[s.langSlug] = s.code;
      }
    }
    return { title, difficulty, descriptionHtml, constraints, examples, starterCode };
  } catch {
    return null;
  }
}

export function parseLeetCodePaste(raw: string): ParsedLeetCode {
  const fromNext = parseFromNextData(raw);
  if (fromNext) return fromNext;

  const lines = raw.split(/\r?\n/).map((l) => l.trimEnd());
  let title = '';
  let difficulty = 'EASY';
  let body = '';

  const firstNonEmpty = lines.findIndex((l) => l.length > 0);
  if (firstNonEmpty >= 0) {
    title = lines[firstNonEmpty];
    const second = lines.slice(firstNonEmpty + 1).find((l) => l.length > 0);
    if (second && /^(easy|medium|hard)$/i.test(second)) {
      difficulty = DIFFICULTY_MAP[second.toLowerCase()] ?? 'EASY';
      const restStart = firstNonEmpty + 1 + lines.slice(firstNonEmpty + 1).findIndex((l) => l.length > 0) + 1;
      body = lines.slice(restStart).join('\n');
    } else {
      body = lines.slice(firstNonEmpty + 1).join('\n');
    }
  }

  const constraintsMatch = body.match(/\n\s*Constraints:\s*\n([\s\S]*)/i);
  let descriptionPart = body;
  let constraints = '';
  if (constraintsMatch) {
    descriptionPart = body.slice(0, body.indexOf(constraintsMatch[0])).trim();
    constraints = constraintsMatch[1].trim();
  }

  const skipLines = ['Topics', 'Companies', 'Hint', 'premium lock icon'];
  const descLines = descriptionPart.split(/\r?\n/);
  let start = 0;
  while (start < descLines.length) {
    const line = descLines[start].trim();
    if (!line) {
      start++;
      continue;
    }
    if (skipLines.some((s) => line.toLowerCase().includes(s.toLowerCase()))) {
      start++;
      continue;
    }
    break;
  }
  const descTrimmed = descLines.slice(start).join('\n').replace(/^\s*\n+/, '').trim();

  const blocks = descTrimmed.split(/\n\n+/).filter((b) => b.trim());
  const descriptionHtml = blocks.map(paragraphToHtml).join('\n') || '<p></p>';

  return { title, difficulty, descriptionHtml, constraints, examples: [], starterCode: {} };
}
