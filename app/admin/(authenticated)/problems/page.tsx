'use client';

import { useState, useEffect, useCallback } from 'react';
import formStyles from '../../styles/Form.module.css';
import tableStyles from '../../styles/Table.module.css';
import buttonStyles from '../../styles/Buttons.module.css';
import dialogStyles from '../../styles/Dialog.module.css';
import paginationStyles from '../../styles/Pagination.module.css';
import tabStyles from '../../styles/Tabs.module.css';
import Pagination from '../../components/Pagination';
import { RichTextEditor, RichTextPreview } from '../../components/RichTextEditor';
import { parseLeetCodePaste } from '@/lib/parseLeetCode';
import type { Problem, TestCase } from '../../types';
import { decodeHtmlEntities, formatConstraintsPreview, previewBoxStyle, ExamplesPreview, StarterCodePreview } from '../utils/problemUtils';

const styles = { ...formStyles, ...tableStyles, ...buttonStyles, ...dialogStyles, ...paginationStyles, ...tabStyles };
const PAGE_SIZE = 10;
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;

export default function ProblemsPage() {
  const [list, setList] = useState<Problem[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<string>('EASY');
  const [constraints, setConstraints] = useState('');
  const [examplesJson, setExamplesJson] = useState('[]');
  const [starterCodeJson, setStarterCodeJson] = useState('{}');
  const [timeLimitMs, setTimeLimitMs] = useState('');
  const [memoryLimitMb, setMemoryLimitMb] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [descTab, setDescTab] = useState<'editor' | 'preview'>('editor');
  const [constraintsTab, setConstraintsTab] = useState<'editor' | 'preview'>('editor');
  const [examplesTab, setExamplesTab] = useState<'editor' | 'preview'>('editor');
  const [starterCodeTab, setStarterCodeTab] = useState<'editor' | 'preview'>('editor');
  const [leetCodePaste, setLeetCodePaste] = useState('');
  type TestCaseRow = { id?: number; input: string; expectedOutput: string; isSample: boolean; sortOrder: number };
  const [testCasesList, setTestCasesList] = useState<TestCaseRow[]>([]);

  const fetchList = useCallback(async () => {
    const res = await fetch('/api/admin/problems');
    if (res.ok) setList(await res.json());
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const paginatedList = list.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setDifficulty('EASY');
    setConstraints('');
    setExamplesJson('[]');
    setStarterCodeJson('{}');
    setTimeLimitMs('');
    setMemoryLimitMb('');
    setSortOrder(0);
    setError('');
    setOpen(false);
    setDescTab('editor');
    setConstraintsTab('editor');
    setExamplesTab('editor');
    setStarterCodeTab('editor');
    setLeetCodePaste('');
    setTestCasesList([]);
  };

  const openAdd = () => {
    resetForm();
    setOpen(true);
  };

  const applyLeetCodePaste = () => {
    if (!leetCodePaste.trim()) return;
    const parsed = parseLeetCodePaste(leetCodePaste);
    setTitle(parsed.title);
    setDifficulty(parsed.difficulty);
    setDescription(parsed.descriptionHtml);
    setConstraints(parsed.constraints);
    setExamplesJson(JSON.stringify(parsed.examples ?? [], null, 2));
    setStarterCodeJson(JSON.stringify(parsed.starterCode ?? {}, null, 2));
    setDescTab('editor');
  };

  const openEdit = async (p: Problem) => {
    setEditingId(p.id);
    setTitle(p.title);
    setDescription(p.description);
    setDifficulty(p.difficulty);
    setConstraints(p.constraints ?? '');
    setExamplesJson(JSON.stringify(p.examples ?? [], null, 2));
    setStarterCodeJson(JSON.stringify(p.starterCode ?? {}, null, 2));
    setTimeLimitMs(p.timeLimitMs != null ? String(p.timeLimitMs) : '');
    setMemoryLimitMb(p.memoryLimitMb != null ? String(p.memoryLimitMb) : '');
    setSortOrder(p.sortOrder);
    setError('');
    setOpen(true);
    try {
      const res = await fetch(`/api/admin/problems/${p.id}`);
      if (res.ok) {
        const full = await res.json();
        const cases = Array.isArray(full.testCases) ? full.testCases : [];
        setTestCasesList(
          cases.map((tc: TestCase) => ({
            id: tc.id,
            input: tc.input ?? '',
            expectedOutput: tc.expectedOutput ?? '',
            isSample: Boolean(tc.isSample),
            sortOrder: tc.sortOrder ?? 0,
          }))
        );
      } else {
        setTestCasesList([]);
      }
    } catch {
      setTestCasesList([]);
    }
  };

  const addTestCase = () => {
    setTestCasesList((prev) => [...prev, { input: '', expectedOutput: '', isSample: false, sortOrder: prev.length }]);
  };

  const updateTestCase = (index: number, field: keyof TestCaseRow, value: string | number | boolean) => {
    setTestCasesList((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeTestCase = (index: number) => {
    setTestCasesList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let examples: unknown = null;
      let starterCode: unknown = null;
      try {
        examples = JSON.parse(examplesJson);
        if (!Array.isArray(examples)) examples = null;
      } catch {
        setError('Ví dụ (examples) phải là JSON array');
        setLoading(false);
        return;
      }
      try {
        starterCode = JSON.parse(starterCodeJson);
        if (typeof starterCode !== 'object' || starterCode === null) starterCode = null;
      } catch {
        setError('Starter code phải là JSON object');
        setLoading(false);
        return;
      }
      const descText = description.replace(/<[^>]*>/g, '').trim();
      if (!descText) {
        setError('Vui lòng nhập mô tả');
        setLoading(false);
        return;
      }
      const body = {
        title: title.trim(),
        description,
        difficulty,
        constraints: constraints.trim() || undefined,
        examples,
        starterCode,
        timeLimitMs: timeLimitMs ? Number(timeLimitMs) : undefined,
        memoryLimitMb: memoryLimitMb ? Number(memoryLimitMb) : undefined,
        sortOrder,
        testCases: testCasesList.map((tc) => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isSample: tc.isSample,
          sortOrder: tc.sortOrder,
        })),
      };
      if (editingId) {
        const res = await fetch(`/api/admin/problems/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Lỗi cập nhật');
          return;
        }
      } else {
        const res = await fetch('/api/admin/problems', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Lỗi thêm mới');
          return;
        }
      }
      resetForm();
      fetchList();
    } catch {
      setError('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa câu hỏi này?')) return;
    setError('');
    const res = await fetch(`/api/admin/problems/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Không thể xóa câu hỏi');
      return;
    }
    fetchList();
  };

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Câu hỏi</h1>
        <button type="button" className={styles.addIcon} onClick={openAdd} aria-label="Thêm câu hỏi" title="Thêm câu hỏi">+</button>
      </div>
      {error && (
        <p className={styles.error} style={{ marginTop: 0, marginBottom: 12 }}>
          {error}
          <button type="button" onClick={() => setError('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', textDecoration: 'underline' }} aria-label="Đóng">×</button>
        </p>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Tiêu đề</th>
              <th>Độ khó</th>
              <th>Thời gian (ms)</th>
              <th>Thứ tự</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {paginatedList.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.title}>{p.title}</td>
                <td>{p.difficulty}</td>
                <td>{p.timeLimitMs ?? '—'}</td>
                <td>{p.sortOrder}</td>
                <td>
                  <div className={styles.actions}>
                    <button type="button" className={styles.btnSecondary} onClick={() => openEdit(p)}>Sửa</button>
                    <button type="button" className={styles.btnDanger} onClick={() => handleDelete(p.id)}>Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.tableCards}>
        {paginatedList.map((p) => (
          <div key={p.id} className={styles.tableCard}>
            <div className={styles.tableCardRow}>
              <span className={styles.tableCardLabel}>ID</span>
              <span className={styles.tableCardValue}>{p.id}</span>
            </div>
            <div className={styles.tableCardRow}>
              <span className={styles.tableCardLabel}>Tiêu đề</span>
              <span className={styles.tableCardValue}>{p.title}</span>
            </div>
            <div className={styles.tableCardRow}>
              <span className={styles.tableCardLabel}>Độ khó</span>
              <span className={styles.tableCardValue}>{p.difficulty}</span>
            </div>
            <div className={styles.tableCardRow}>
              <span className={styles.tableCardLabel}>Thứ tự</span>
              <span className={styles.tableCardValue}>{p.sortOrder}</span>
            </div>
            <div className={styles.tableCardActions}>
              <div className={styles.actions}>
                <button type="button" className={styles.btnSecondary} onClick={() => openEdit(p)}>Sửa</button>
                <button type="button" className={styles.btnDanger} onClick={() => handleDelete(p.id)}>Xóa</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={list.length}
        pageSize={PAGE_SIZE}
      />

      {open && (
        <div className={styles.dialogBackdrop} onClick={() => setOpen(false)}>
          <div className={styles.dialogPanel} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div className={styles.dialogHeader}>
              <h2 className={styles.dialogTitle}>{editingId ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}</h2>
              <button type="button" className={styles.dialogClose} onClick={() => setOpen(false)} aria-label="Đóng">×</button>
            </div>
            <div className={styles.dialogBody}>
              <form onSubmit={handleSubmit}>
                {error && <p className={styles.error}>{error}</p>}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Dán đề bài</label>
                  <textarea
                    className={styles.textarea}
                    rows={6}
                    value={leetCodePaste}
                    onChange={(e) => setLeetCodePaste(e.target.value)}
                    placeholder="Copy toàn bộ đề bài (tiêu đề, Easy/Medium/Hard, mô tả, ví dụ, Constraints) và dán vào đây, sau đó bấm Áp dụng."
                    style={{ fontFamily: 'inherit', fontSize: '0.875rem' }}
                  />
                  <button type="button" className={styles.btnSecondary} onClick={applyLeetCodePaste} style={{ marginTop: 6 }}>
                    Áp dụng
                  </button>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Tiêu đề</label>
                  <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nhập tiêu đề" required />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Mô tả</label>
                  <div className={styles.tabs}>
                    <button type="button" className={descTab === 'editor' ? styles.tabActive : styles.tab} onClick={() => setDescTab('editor')}>Editor</button>
                    <button type="button" className={descTab === 'preview' ? styles.tabActive : styles.tab} onClick={() => setDescTab('preview')}>Preview</button>
                  </div>
                  {descTab === 'editor' && (
                    <div className={styles.tabPanelActive}>
                      <RichTextEditor key={editingId ?? 'new'} value={description} onChange={setDescription} placeholder="Dán đề bài hoặc nhập nội dung..." minHeight="320px" />
                    </div>
                  )}
                  {descTab === 'preview' && (
                    <div className={styles.tabPanelActive}>
                      <RichTextPreview html={description} />
                    </div>
                  )}
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Độ khó</label>
                  <select className={styles.select} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Ràng buộc</label>
                  <div className={styles.tabs}>
                    <button type="button" className={constraintsTab === 'editor' ? styles.tabActive : styles.tab} onClick={() => setConstraintsTab('editor')}>Editor</button>
                    <button type="button" className={constraintsTab === 'preview' ? styles.tabActive : styles.tab} onClick={() => setConstraintsTab('preview')}>Preview</button>
                  </div>
                  {constraintsTab === 'editor' && (
                    <div className={styles.tabPanelActive}>
                      <textarea className={styles.textarea} rows={3} value={constraints} onChange={(e) => setConstraints(e.target.value)} placeholder="Nhập ràng buộc" />
                    </div>
                  )}
                  {constraintsTab === 'preview' && (
                    <div className={styles.tabPanelActive}>
                      <div style={{ minHeight: 80, padding: '0.75rem 1rem', border: '1px solid #d1d5db', borderRadius: 8, backgroundColor: '#fafafa', fontSize: '0.9375rem', whiteSpace: 'pre-wrap' }}>
                        {constraints.trim() ? formatConstraintsPreview(constraints) : 'Chưa có nội dung'}
                      </div>
                    </div>
                  )}
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Ví dụ</label>
                  <div className={styles.tabs}>
                    <button type="button" className={examplesTab === 'editor' ? styles.tabActive : styles.tab} onClick={() => setExamplesTab('editor')}>Editor</button>
                    <button type="button" className={examplesTab === 'preview' ? styles.tabActive : styles.tab} onClick={() => setExamplesTab('preview')}>Preview</button>
                  </div>
                  {examplesTab === 'editor' && (
                    <div className={styles.tabPanelActive}>
                      <textarea className={styles.textarea} rows={4} value={examplesJson} onChange={(e) => setExamplesJson(e.target.value)} placeholder="JSON array ví dụ input/output" style={{ fontFamily: 'monospace' }} />
                    </div>
                  )}
                  {examplesTab === 'preview' && (
                    <div className={styles.tabPanelActive}>
                      <ExamplesPreview json={examplesJson} />
                    </div>
                  )}
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Starter code</label>
                  <div className={styles.tabs}>
                    <button type="button" className={starterCodeTab === 'editor' ? styles.tabActive : styles.tab} onClick={() => setStarterCodeTab('editor')}>Editor</button>
                    <button type="button" className={starterCodeTab === 'preview' ? styles.tabActive : styles.tab} onClick={() => setStarterCodeTab('preview')}>Preview</button>
                  </div>
                  {starterCodeTab === 'editor' && (
                    <div className={styles.tabPanelActive}>
                      <textarea className={styles.textarea} rows={3} value={starterCodeJson} onChange={(e) => setStarterCodeJson(e.target.value)} placeholder="JSON mã mẫu theo ngôn ngữ" style={{ fontFamily: 'monospace' }} />
                    </div>
                  )}
                  {starterCodeTab === 'preview' && (
                    <div className={styles.tabPanelActive}>
                      <StarterCodePreview json={starterCodeJson} />
                    </div>
                  )}
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Test cases (dùng để chấm bài)</label>
                  <p style={{ marginTop: 0, marginBottom: 8, fontSize: '0.875rem', color: '#6b7280' }}>
                    Nhập Input và Output mong đợi cho từng test. Nếu không có test case trong bảng này, hệ thống sẽ dùng ví dụ trong đề để chấm.
                  </p>
                  <div style={{ marginBottom: 8 }}>
                    <button type="button" className={styles.btnSecondary} onClick={addTestCase}>
                      + Thêm test case
                    </button>
                  </div>
                  {testCasesList.length === 0 ? (
                    <div style={{ ...previewBoxStyle, minHeight: 60 }}>Chưa có test case. Bấm &quot;Thêm test case&quot; để thêm.</div>
                  ) : (
                    <div style={{ overflow: 'auto', maxHeight: 320, border: '1px solid #d1d5db', borderRadius: 8, padding: 12, backgroundColor: '#fafafa' }}>
                      {testCasesList.map((tc, index) => (
                        <div key={index} style={{ marginBottom: 12, padding: 10, border: '1px solid #e5e7eb', borderRadius: 6, backgroundColor: '#fff' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Test case #{index + 1}</span>
                            <button type="button" className={styles.btnDanger} style={{ padding: '4px 8px', fontSize: '0.8125rem' }} onClick={() => removeTestCase(index)}>
                              Xóa
                            </button>
                          </div>
                          <div className={styles.formGroup} style={{ marginBottom: 6 }}>
                            <label className={styles.label} style={{ fontSize: '0.8125rem' }}>Input</label>
                            <textarea
                              className={styles.textarea}
                              rows={2}
                              value={tc.input}
                              onChange={(e) => updateTestCase(index, 'input', e.target.value)}
                              placeholder="Dữ liệu vào (stdin)"
                              style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}
                            />
                          </div>
                          <div className={styles.formGroup} style={{ marginBottom: 6 }}>
                            <label className={styles.label} style={{ fontSize: '0.8125rem' }}>Output mong đợi</label>
                            <textarea
                              className={styles.textarea}
                              rows={2}
                              value={tc.expectedOutput}
                              onChange={(e) => updateTestCase(index, 'expectedOutput', e.target.value)}
                              placeholder="Kết quả mong đợi"
                              style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.875rem' }}>
                              <input type="checkbox" checked={tc.isSample} onChange={(e) => updateTestCase(index, 'isSample', e.target.checked)} />
                              Là ví dụ mẫu
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <label className={styles.label} style={{ margin: 0, fontSize: '0.8125rem' }}>Thứ tự</label>
                              <input
                                type="number"
                                className={styles.input}
                                style={{ width: 72 }}
                                value={tc.sortOrder}
                                onChange={(e) => updateTestCase(index, 'sortOrder', Number(e.target.value) || 0)}
                                min={0}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div className={styles.formGroup} style={{ flex: '1 1 120px' }}>
                    <label className={styles.label}>Giới hạn thời gian (ms)</label>
                    <input type="number" className={styles.input} value={timeLimitMs} onChange={(e) => setTimeLimitMs(e.target.value)} placeholder="2000" min={1} />
                  </div>
                  <div className={styles.formGroup} style={{ flex: '1 1 120px' }}>
                    <label className={styles.label}>Giới hạn bộ nhớ (MB)</label>
                    <input type="number" className={styles.input} value={memoryLimitMb} onChange={(e) => setMemoryLimitMb(e.target.value)} placeholder="128" min={1} />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Thứ tự</label>
                  <input type="number" className={styles.input} value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)} placeholder="0" />
                </div>
                <div className={styles.headerActions} style={{ marginTop: '1rem' }}>
                  <button type="submit" className={styles.btnPrimary} disabled={loading}>{loading ? 'Đang lưu...' : 'Lưu'}</button>
                  <button type="button" className={styles.btnSecondary} onClick={() => setOpen(false)}>Hủy</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
