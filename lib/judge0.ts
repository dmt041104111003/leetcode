export const JUDGE0_BASE_URL = process.env.JUDGE0_BASE_URL ?? 'http://localhost:2358';

export const LANGUAGE_TO_ID: Record<string, number> = {
  c: 50,
  cpp: 54,
  py: 71,
  python: 71,
  js: 93,
  javascript: 93,
  java: 91,
  go: 60,
  rust: 73,
  rb: 72,
  ruby: 72,
};

export type Judge0RunOptions = {
  source_code: string;
  language_id: number;
  stdin: string;
  expected_output?: string | null;
  cpu_time_limit?: number;
  memory_limit?: number;
};

export type Judge0Result = {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status: { id: number; description: string } | null;
  time: string | null;
  memory: number | null;
};

export async function runJudge0Submission(options: Judge0RunOptions): Promise<Judge0Result> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = process.env.JUDGE0_AUTH_TOKEN;
  if (token) headers['X-Auth-Token'] = token;

  const body: Record<string, unknown> = {
    source_code: options.source_code,
    language_id: options.language_id,
    stdin: options.stdin,
    cpu_time_limit: options.cpu_time_limit ?? 5,
    memory_limit: options.memory_limit ?? 128000,
  };
  if (options.expected_output != null && options.expected_output !== '') {
    body.expected_output = options.expected_output;
  }

  const res = await fetch(`${JUDGE0_BASE_URL}/submissions?base64_encoded=false&wait=true`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Judge0 error: ${res.status} ${text}`);
  }

  const data = (await res.json()) as Judge0Result;
  return data;
}
