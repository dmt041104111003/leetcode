import { NextRequest, NextResponse } from 'next/server';
import { verifyExaminee } from '@/lib/auth';
import { LANGUAGE_TO_ID, runJudge0Submission } from '@/lib/judge0';

export async function POST(req: NextRequest) {
  const auth = await verifyExaminee();
  if (!auth) {
    return NextResponse.json({ error: 'Vui lòng đăng nhập thí sinh' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { code, language, stdin } = body;
    if (typeof code !== 'string') {
      return NextResponse.json({ error: 'Thiếu hoặc sai định dạng code' }, { status: 400 });
    }

    const langKey = String(language || 'cpp').toLowerCase();
    const languageId = LANGUAGE_TO_ID[langKey] ?? LANGUAGE_TO_ID.cpp;
    const stdinStr = typeof stdin === 'string' ? stdin : '';

    let data: { stdout?: string | null; stderr?: string | null; compile_output?: string | null; compile_error?: string | null; message?: string | null; status?: { id?: number; description?: string }; exit_code?: number | null; time?: string | null; memory?: number | null };
    try {
      const result = await runJudge0Submission({
        source_code: code,
        language_id: languageId,
        stdin: stdinStr,
        cpu_time_limit: 5,
        memory_limit: 128000,
      });
      data = {
        stdout: result.stdout,
        stderr: result.stderr,
        compile_output: result.compile_output,
        compile_error: result.compile_output,
        message: result.message,
        status: result.status ?? undefined,
        exit_code: null,
        time: result.time ?? null,
        memory: result.memory ?? null,
      };
    } catch (e) {
      const errText = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { error: 'Không thể chạy code. Vui lòng thử lại.', detail: errText },
        { status: 502 }
      );
    }

    const statusId = data.status?.id;
    const statusDesc = data.status?.description ?? '';
    const compileError = data.compile_error ?? data.compile_output ?? '';
    const stdout = data.stdout ?? '';
    const stderr = data.stderr ?? '';
    const message = data.message ?? '';
    const exitCode = data.exit_code ?? null;
    const time = data.time ?? null;
    const memory = data.memory ?? null;

    const isCompileError = statusId === 6 || statusDesc.toLowerCase().includes('compil');
    const isRuntimeError = statusId === 11 || statusDesc.toLowerCase().includes('runtime');

    const runDetail = {
      statusId: statusId ?? null,
      statusDescription: statusDesc,
      time: time != null ? String(time) : null,
      memory: memory != null ? Number(memory) : null,
    };

    return NextResponse.json({
      stdout,
      stderr,
      compileError: isCompileError ? (compileError || message || '(Lỗi biên dịch)') : '',
      compileFailed: isCompileError,
      runtimeError: isRuntimeError ? (stderr || message) : '',
      exitCode,
      statusDescription: statusDesc,
      runDetail,
    });
  } catch (e) {
    console.error('Run code error:', e);
    return NextResponse.json(
      { error: 'Lỗi khi chạy code. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}
