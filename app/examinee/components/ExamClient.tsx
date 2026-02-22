'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RichTextPreview } from '@/app/admin/components/RichTextEditor';
import type { ExamQuestionItem, ExamClientProps } from '../interfaces/exam';
import { formatRemaining } from '../lib/time';
import { getStarterCodeMap } from '../lib/starterCode';
import { useCountdown } from '../hooks/useCountdown';
import DifficultyBadge from './DifficultyBadge';
import ConstraintsBlock from './ConstraintsBlock';
import ExamplesBlock from './ExamplesBlock';
import CodeEditor from './CodeEditor';

export type { ExamQuestionItem } from '../interfaces/exam';

export default function ExamClient({
  sessionName,
  sessionCode,
  endAt,
  examineeName,
  questions,
}: ExamClientProps) {
  const router = useRouter();
  const remainingMs = useCountdown(endAt);
  const [selectedId, setSelectedId] = useState<number | null>(questions[0]?.id ?? null);
  const [codeByProblemId, setCodeByProblemId] = useState<Record<number, string>>({});
  const [langByProblemId, setLangByProblemId] = useState<Record<number, string>>({});
  const [rightTab, setRightTab] = useState<'testcase' | 'result'>('testcase');
  const [activeCaseKey, setActiveCaseKey] = useState<string>('');
  const [customCasesByProblemId, setCustomCasesByProblemId] = useState<Record<number, { id: string; input: string }[]>>({});
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testResultKind, setTestResultKind] = useState<'compile_error' | 'runtime_error' | 'success' | 'error' | null>(null);
  const [runDetail, setRunDetail] = useState<{ statusDescription: string; time: string | null; memory: number | null } | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submittedProblemIds, setSubmittedProblemIds] = useState<Set<number>>(new Set());
  const [scoreByProblemId, setScoreByProblemId] = useState<Record<number, number | null>>({});
  const timeUp = remainingMs <= 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/examinee/submissions');
        if (!res.ok || cancelled) return;
        const data = await res.json().catch(() => ({}));
        const list = data.submissions ?? [];
        if (!Array.isArray(list) || list.length === 0) return;
        setCodeByProblemId((prev) => {
          const next = { ...prev };
          for (const s of list) {
            if (s.problemId != null && s.code != null) next[s.problemId] = s.code;
          }
          return next;
        });
        setLangByProblemId((prev) => {
          const next = { ...prev };
          for (const s of list) {
            if (s.problemId != null && s.language != null) next[s.problemId] = s.language;
          }
          return next;
        });
        setSubmittedProblemIds((prev) => {
          const next = new Set(prev);
          for (const s of list) {
            if (s.problemId != null) next.add(s.problemId);
          }
          return next;
        });
        setScoreByProblemId((prev) => {
          const next = { ...prev };
          for (const s of list) {
            if (s.problemId != null) next[s.problemId] = s.score ?? null;
          }
          return next;
        });
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/examinee/logout', { method: 'POST' });
      router.push('/');
      router.refresh();
    } catch {
      router.push('/');
    }
  }, [router]);

  const selected = useMemo(() => questions.find((q) => q.id === selectedId) ?? questions[0] ?? null, [questions, selectedId]);
  const starterMap = useMemo(() => (selected ? getStarterCodeMap(selected.starterCode) : {}), [selected]);
  const languages = useMemo(() => Object.keys(starterMap), [starterMap]);
  const currentLang = selected ? langByProblemId[selected.id] ?? languages[0] ?? 'cpp' : 'cpp';
  const currentCode = selected ? codeByProblemId[selected.id] ?? starterMap[currentLang] ?? starterMap[languages[0]] ?? '' : '';

  const presetCases = useMemo(() => selected?.testCases ?? [], [selected]);
  const customCases = useMemo(() => (selected ? customCasesByProblemId[selected.id] ?? [] : []), [selected, customCasesByProblemId]);

  const exampleFormatHint = useMemo(() => {
    if (!selected?.examples || !Array.isArray(selected.examples)) return null;
    const list = selected.examples as { input?: string }[];
    const first = list.find((ex) => ex?.input != null && String(ex.input).trim() !== '');
    return first ? String(first.input).trim() : null;
  }, [selected]);

  useEffect(() => {
    setSubmitMessage(null);
  }, [selectedId]);

  useEffect(() => {
    if (!selected) return;
    const presets = selected.testCases ?? [];
    const customs = customCasesByProblemId[selected.id] ?? [];
    if (activeCaseKey.startsWith('preset-')) {
      const i = parseInt(activeCaseKey.replace('preset-', ''), 10);
      if (i >= 0 && i < presets.length) return;
    }
    if (activeCaseKey.startsWith('custom-') && customs.some((c) => c.id === activeCaseKey.replace('custom-', ''))) return;
    if (presets.length) setActiveCaseKey('preset-0');
    else if (customs.length) setActiveCaseKey('custom-' + customs[0].id);
    else setActiveCaseKey('');
  }, [selected?.id, presetCases.length, customCases.length, activeCaseKey]);

  const getCurrentInput = useCallback((): string => {
    if (!activeCaseKey) return '';
    if (activeCaseKey.startsWith('preset-')) {
      const i = parseInt(activeCaseKey.replace('preset-', ''), 10);
      const c = presetCases[i];
      return c ? c.input : '';
    }
    const id = activeCaseKey.replace('custom-', '');
    const c = customCases.find((x) => x.id === id);
    return c ? c.input : '';
  }, [activeCaseKey, presetCases, customCases]);

  const setCurrentCaseInput = useCallback(
    (value: string) => {
      if (!selected || !activeCaseKey.startsWith('custom-')) return;
      const id = activeCaseKey.replace('custom-', '');
      setCustomCasesByProblemId((prev) => ({
        ...prev,
        [selected.id]: (prev[selected.id] ?? []).map((x) => (x.id === id ? { ...x, input: value } : x)),
      }));
    },
    [selected, activeCaseKey]
  );

  const currentCaseInputValue = useMemo(() => {
    if (!activeCaseKey.startsWith('custom-')) return '';
    const id = activeCaseKey.replace('custom-', '');
    const c = customCases.find((x) => x.id === id);
    return c ? c.input : '';
  }, [activeCaseKey, customCases]);

  const addCustomCase = useCallback(() => {
    if (!selected) return;
    const id = crypto.randomUUID();
    setCustomCasesByProblemId((prev) => ({
      ...prev,
      [selected.id]: [...(prev[selected.id] ?? []), { id, input: '' }],
    }));
    setActiveCaseKey('custom-' + id);
  }, [selected]);

  const removeCustomCase = useCallback(
    (customId: string) => {
      if (!selected) return;
      const list = (customCasesByProblemId[selected.id] ?? []).filter((c) => c.id !== customId);
      setCustomCasesByProblemId((prev) => ({ ...prev, [selected.id]: list }));
      if (activeCaseKey === 'custom-' + customId) {
        if (list.length) setActiveCaseKey('custom-' + list[0].id);
        else if (presetCases.length) setActiveCaseKey('preset-0');
        else setActiveCaseKey('');
      }
    },
    [selected, customCasesByProblemId, activeCaseKey, presetCases.length]
  );

  const setCurrentCode = useCallback((value: string) => {
    if (!selected) return;
    setCodeByProblemId((prev) => ({ ...prev, [selected.id]: value }));
  }, [selected]);

  const setCurrentLang = useCallback((lang: string) => {
    if (!selected) return;
    setLangByProblemId((prev) => ({ ...prev, [selected.id]: lang }));
    const existing = codeByProblemId[selected.id];
    const fromStarter = getStarterCodeMap(selected.starterCode)[lang];
    if (fromStarter != null && (existing === undefined || existing === '' || existing === getStarterCodeMap(selected.starterCode)[currentLang]))
      setCodeByProblemId((prev) => ({ ...prev, [selected.id]: fromStarter }));
  }, [selected, codeByProblemId, currentLang]);

  useEffect(() => {
    if (!selected || languages.length === 0) return;
    const lang = langByProblemId[selected.id];
    if (lang && starterMap[lang] != null) return;
    const first = languages[0];
    setLangByProblemId((prev) => ({ ...prev, [selected.id]: first }));
    const existing = codeByProblemId[selected.id];
    if (existing === undefined || existing === '')
      setCodeByProblemId((prev) => ({ ...prev, [selected.id]: starterMap[first] ?? '' }));
  }, [selected?.id, languages, starterMap, langByProblemId, codeByProblemId]);

  const handleRun = useCallback(async () => {
    setRunLoading(true);
    setTestResult(null);
    setTestResultKind(null);
    setRunDetail(null);
    setRightTab('result');
    try {
      const res = await fetch('/api/examinee/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: currentCode,
          language: currentLang,
          stdin: getCurrentInput(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error ?? 'Không thể chạy code. Vui lòng thử lại.';
        const detail = data?.detail;
        setTestResultKind('error');
        setTestResult(
          (detail
            ? `${msg}\n\nChi tiết: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`
            : msg) +
            '\n\nGợi ý: Chạy thử chỉ dùng cho chương trình có hàm main() (đọc stdin, ghi stdout). Code Spring Boot / web app không chạy được ở đây.'
        );
        return;
      }
      const { stdout = '', stderr = '', exitCode, compileFailed, compileError, runtimeError, runDetail: detail } = data;
      if (detail && typeof detail === 'object') {
        setRunDetail({
          statusDescription: detail.statusDescription ?? '—',
          time: detail.time ?? null,
          memory: detail.memory != null ? detail.memory : null,
        });
      }
      if (compileFailed) {
        setTestResultKind('compile_error');
        setTestResult(compileError || stderr || '(Không có thông báo lỗi)');
        return;
      }
      if (runtimeError) {
        setTestResultKind('runtime_error');
        setTestResult(runtimeError);
        return;
      }
      const parts: string[] = [];
      if (stderr) parts.push('[stderr]\n' + stderr);
      if (stdout) parts.push('[stdout]\n' + stdout);
      parts.push(`\n(Exit code: ${exitCode ?? '—'})`);
      setTestResultKind('success');
      setTestResult(parts.join('\n\n') || 'Chạy xong, không có output.');
    } catch {
      setTestResultKind('error');
      setTestResult('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setRunLoading(false);
    }
  }, [currentCode, currentLang, getCurrentInput]);

  const handleSubmit = useCallback(async () => {
    if (!selected) return;
    setSubmitLoading(true);
    setSubmitMessage(null);
    try {
      const res = await fetch('/api/examinee/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: selected.id,
          code: currentCode,
          language: currentLang,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitMessage({ type: 'error', text: data?.error ?? 'Nộp bài thất bại. Vui lòng thử lại.' });
        return;
      }
      setSubmittedProblemIds((prev) => new Set(prev).add(selected.id));
      if (data.score != null) setScoreByProblemId((prev) => ({ ...prev, [selected.id]: data.score }));
      setSubmitMessage(null);
    } catch {
      setSubmitMessage({ type: 'error', text: 'Lỗi kết nối. Vui lòng thử lại.' });
    } finally {
      setSubmitLoading(false);
    }
  }, [selected, currentCode, currentLang]);

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-semibold text-gray-900 truncate">{sessionName}</h1>
          <span className="text-sm text-gray-500 truncate">({sessionCode})</span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-sm text-gray-600">{examineeName}</span>
          <button type="button" onClick={handleLogout} className="text-sm text-gray-500 hover:text-red-600">Đăng xuất</button>
          <div className={`min-w-[7rem] text-center font-mono font-semibold text-lg px-3 py-1.5 rounded-lg ${timeUp ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`} title={timeUp ? 'Đã hết giờ' : 'Thời gian còn lại'}>
            {timeUp ? '00:00:00' : formatRemaining(remainingMs)}
          </div>
        </div>
      </header>
      {timeUp && (
        <div className="mx-4 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-800 font-medium text-center">Kỳ thi đã kết thúc. Bạn không thể nộp bài thêm.</div>
      )}
      <div className="flex-1 flex min-h-0">
        <aside className="w-1/2 min-w-0 flex flex-col border-r border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-200 p-2 overflow-y-auto shrink-0">
            <h2 className="px-2 py-2 text-sm font-semibold text-gray-700">Đề bài</h2>
            {questions.length === 0 ? <p className="px-2 py-4 text-sm text-gray-500">Ca thi chưa có câu hỏi.</p> : (
              <ul className="space-y-0">
                {questions.map((q, index) => (
                  <li key={q.id}>
                    <button type="button" onClick={() => setSelectedId(q.id)} className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2 transition-colors ${selectedId === q.id ? 'bg-amber-100 text-amber-900' : 'hover:bg-gray-100 text-gray-800'}`}>
                      <span className="w-6 text-sm font-medium text-gray-500 shrink-0">{index + 1}.</span>
                      <span className="flex-1 truncate text-sm font-medium">{q.title}</span>
                      <DifficultyBadge difficulty={q.difficulty} />
                      {q.points != null && <span className="text-xs text-gray-500">{q.points}đ</span>}
                      {submittedProblemIds.has(q.id) && (
                        <span className="text-xs text-emerald-600 font-medium shrink-0">
                          Đã nộp{scoreByProblemId[q.id] != null ? ` ${scoreByProblemId[q.id]}đ` : ''}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {selected ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-xl font-bold text-gray-900">{selected.title}</h2>
                  <DifficultyBadge difficulty={selected.difficulty} />
                  {selected.points != null && <span className="text-sm text-gray-500">{selected.points} điểm</span>}
                </div>
                <div className="prose max-w-none prose-headings:text-gray-900">
                  <RichTextPreview html={selected.description} />
                </div>
                <ConstraintsBlock constraints={selected.constraints} />
                <ExamplesBlock examples={selected.examples} />
              </>
            ) : (
              <p className="text-sm text-gray-500">Chọn một câu hỏi ở danh sách trên.</p>
            )}
          </div>
        </aside>
        <section className="w-1/2 min-w-0 flex flex-col bg-white border-l border-gray-200">
          {selected ? (
            <>
              <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-gray-50 shrink-0">
                <span className="text-sm font-medium text-gray-600">&lt;/&gt; Code</span>
                {languages.length > 1 && (
                  <select value={currentLang} onChange={(e) => setCurrentLang(e.target.value)} className="text-sm border border-gray-300 rounded-lg px-2 py-1 bg-white text-gray-800">
                    {languages.map((lang) => <option key={lang} value={lang}>{lang.toUpperCase()}</option>)}
                  </select>
                )}
                <div className="flex-1" />
                <button type="button" onClick={handleRun} disabled={timeUp || runLoading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none">{runLoading ? 'Đang chạy...' : 'Chạy thử'}</button>
                {submittedProblemIds.has(selected.id) ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium">
                    Đã nộp bài
                    {scoreByProblemId[selected.id] != null && <span className="font-semibold text-amber-600">({scoreByProblemId[selected.id]}đ)</span>}
                  </span>
                ) : (
                  <button type="button" onClick={handleSubmit} disabled={timeUp || submitLoading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:pointer-events-none">{submitLoading ? 'Đang nộp...' : 'Nộp bài'}</button>
                )}
                {submitMessage && (
                  <span className={`text-sm ${submitMessage.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {submitMessage.text}
                  </span>
                )}
              </div>
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0 p-2 flex flex-col">
                  <CodeEditor
                    value={currentCode}
                    onChange={setCurrentCode}
                    language={currentLang}
                    disabled={timeUp}
                    height="100%"
                    className="rounded-lg border border-gray-300 overflow-hidden min-h-[220px]"
                  />
                </div>
                <div className="border-t border-gray-200 shrink-0">
                  <div className="flex border-b border-gray-200">
                    <button type="button" onClick={() => setRightTab('testcase')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${rightTab === 'testcase' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Testcase</button>
                    <button type="button" onClick={() => setRightTab('result')} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${rightTab === 'result' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Kết quả</button>
                  </div>
                  <div className="p-4 min-h-[120px] bg-gray-50 flex flex-col">
                    {rightTab === 'testcase' && (
                      <>
                        <p className="text-sm text-amber-700 mb-2">
                          Chọn hoặc tạo test case tùy chọn bên dưới để nhập input. Nếu không chọn test case nào, chạy thử sẽ dùng input rỗng (như chạy IDE bình thường).
                        </p>
                        <div className="flex items-center gap-1 flex-wrap border-b border-gray-200 pb-2 mb-2">
                          {presetCases.map((_, i) => (
                            <button
                              key={'preset-' + i}
                              type="button"
                              onClick={() => setActiveCaseKey('preset-' + i)}
                              className={`px-3 py-1.5 rounded-t text-sm font-medium transition-colors ${activeCaseKey === 'preset-' + i ? 'bg-amber-100 text-amber-800 border border-b-0 border-amber-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'}`}
                            >
                              Case {i + 1}
                            </button>
                          ))}
                          {customCases.map((c, i) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setActiveCaseKey('custom-' + c.id)}
                              className={`px-3 py-1.5 rounded-t text-sm font-medium transition-colors flex items-center gap-1 ${activeCaseKey === 'custom-' + c.id ? 'bg-emerald-100 text-emerald-800 border border-b-0 border-emerald-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'}`}
                            >
                              Tùy chọn {i + 1}
                              <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); removeCustomCase(c.id); }} onKeyDown={(e) => e.key === 'Enter' && removeCustomCase(c.id)} className="ml-0.5 text-gray-400 hover:text-red-600" aria-label="Xóa">×</span>
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={addCustomCase}
                            disabled={!selected || timeUp}
                            className="p-1.5 rounded border border-dashed border-gray-400 text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-50"
                            title="Thêm test case tùy chọn"
                          >
                            +
                          </button>
                        </div>
                        <div className="flex-1 min-h-[80px]">
                          {activeCaseKey.startsWith('preset-') && (() => {
                            const i = parseInt(activeCaseKey.replace('preset-', ''), 10);
                            const tc = presetCases[i];
                            if (!tc) return <p className="text-sm text-gray-500">Chọn một case ở trên.</p>;
                            return (
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">Input (chỉ xem, không sửa được)</label>
                                <pre className="p-3 rounded-lg bg-gray-100 border border-gray-200 text-sm font-mono text-gray-800 whitespace-pre-wrap overflow-x-auto min-h-[60px]">{tc.input || '(trống)'}</pre>
                                {tc.expectedOutput != null && tc.expectedOutput !== '' && (
                                  <>
                                    <label className="block text-sm font-medium text-gray-700">Output mẫu</label>
                                    <pre className="p-3 rounded-lg bg-gray-100 border border-gray-200 text-sm font-mono text-gray-800 whitespace-pre-wrap overflow-x-auto">{tc.expectedOutput}</pre>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                          {activeCaseKey.startsWith('custom-') && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Format theo ví dụ trong đề:
                              </label>
                              {exampleFormatHint ? (
                                <pre className="mb-2 p-2 rounded bg-amber-50 border border-amber-200 text-xs font-mono text-amber-800 whitespace-pre-wrap overflow-x-auto">
                                  {exampleFormatHint}
                                </pre>
                              ) : (
                                <p className="mb-2 text-xs text-gray-500">Xem phần Ví dụ trong đề bài để biết format input.</p>
                              )}
                              <textarea
                                value={currentCaseInputValue}
                                onChange={(e) => setCurrentCaseInput(e.target.value)}
                                placeholder={exampleFormatHint ? `Nhập input theo đúng format trên, ví dụ:\n${exampleFormatHint.length > 80 ? exampleFormatHint.slice(0, 80) + '...' : exampleFormatHint}` : 'Nhập input theo đúng format ví dụ trong đề bài.'}
                                className="w-full h-24 p-3 font-mono text-sm rounded-lg border border-gray-300 bg-white text-gray-900 resize-none focus:ring-2 focus:ring-amber-500"
                                spellCheck={false}
                              />
                            </div>
                          )}
                          {!activeCaseKey && presetCases.length === 0 && customCases.length === 0 && (
                            <p className="text-sm text-gray-500">Chưa có test case mẫu. Bấm <strong>+</strong> để thêm input tùy chọn và chạy thử.</p>
                          )}
                        </div>
                      </>
                    )}
                    {rightTab === 'result' && (
                      <div className="space-y-2">
                        {runDetail && (
                          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                            <span><strong>Trạng thái:</strong> {runDetail.statusDescription}</span>
                            <span><strong>Thời gian:</strong> {runDetail.time != null ? `${runDetail.time}s` : '—'}</span>
                            <span><strong>Bộ nhớ:</strong> {runDetail.memory != null ? `${runDetail.memory} KB` : '—'}</span>
                          </div>
                        )}
                        {testResultKind === 'compile_error' && (
                          <h4 className="text-base font-semibold text-red-600">Compile Error</h4>
                        )}
                        {testResultKind === 'runtime_error' && (
                          <h4 className="text-base font-semibold text-red-600">Runtime Error</h4>
                        )}
                        {testResultKind === 'error' && (
                          <h4 className="text-base font-semibold text-red-600">Lỗi</h4>
                        )}
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono overflow-x-auto m-0 bg-white p-3 rounded border border-gray-200">
                          {testResult ?? 'Bạn cần chạy code trước để xem kết quả.'}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">Chọn một câu hỏi để viết code và chạy test.</div>
          )}
        </section>
      </div>
    </main>
  );
}
