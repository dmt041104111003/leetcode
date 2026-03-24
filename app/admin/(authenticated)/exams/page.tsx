'use client';

import { useState, useEffect, useCallback } from 'react';
import formStyles from '../../styles/Form.module.css';
import tableStyles from '../../styles/Table.module.css';
import buttonStyles from '../../styles/Buttons.module.css';
import dialogStyles from '../../styles/Dialog.module.css';
import paginationStyles from '../../styles/Pagination.module.css';
import Pagination from '../../components/Pagination';
import type { Exam, ExamQuestion, Problem } from '../../types';
import { randomExamCode } from '../utils/codeUtils';

type ExamWithQuestions = Exam & { questions: (ExamQuestion & { problem: Problem })[] };

const styles = { ...formStyles, ...tableStyles, ...buttonStyles, ...dialogStyles, ...paginationStyles };
const PAGE_SIZE = 10;

export default function ExamsPage() {
  const [list, setList] = useState<ExamWithQuestions[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [questions, setQuestions] = useState<(ExamQuestion & { problem: Problem })[]>([]);
  const [addProblemId, setAddProblemId] = useState<number | ''>('');
  const [addPoints, setAddPoints] = useState('');

  const fetchList = useCallback(async () => {
    const res = await fetch('/api/admin/exams');
    if (res.ok) setList(await res.json());
  }, []);

  const fetchProblems = useCallback(async () => {
    const res = await fetch('/api/admin/problems');
    if (res.ok) setProblems(await res.json());
  }, []);

  useEffect(() => {
    fetchList();
    fetchProblems();
  }, [fetchList, fetchProblems]);

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const paginatedList = list.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const resetForm = () => {
    setEditingId(null);
    setCode('');
    setName('');
    setDescription('');
    setQuestions([]);
    setAddProblemId('');
    setAddPoints('');
    setError('');
    setOpen(false);
  };

  const openAdd = () => {
    resetForm();
    setCode(randomExamCode());
    setOpen(true);
  };

  const openEdit = async (exam: ExamWithQuestions) => {
    setEditingId(exam.id);
    setCode(exam.code);
    setName(exam.name);
    setDescription(exam.description ?? '');
    setQuestions(exam.questions ?? []);
    setAddProblemId('');
    setAddPoints('');
    setError('');
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body = { code: code.trim(), name: name.trim(), description: description.trim() || undefined };
      if (editingId) {
        const res = await fetch(`/api/admin/exams/${editingId}`, {
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
        const res = await fetch('/api/admin/exams', {
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
      if (!editingId) resetForm();
      fetchList();
    } catch {
      setError('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa đề thi này?')) return;
    setError('');
    const res = await fetch(`/api/admin/exams/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Không thể xóa đề thi');
      return;
    }
    fetchList();
  };

  const handleAddQuestion = async () => {
    if (editingId == null || addProblemId === '') return;
    setError('');
    try {
      const res = await fetch(`/api/admin/exams/${editingId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: Number(addProblemId),
          points: addPoints ? Number(addPoints) : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Không thêm được câu hỏi');
        return;
      }
      const newQ = await res.json();
      setQuestions((prev) => [...prev, newQ]);
      setAddProblemId('');
      setAddPoints('');
      fetchList();
    } catch {
      setError('Lỗi kết nối');
    }
  };

  const handleRemoveQuestion = async (qid: number) => {
    if (editingId == null || !confirm('Xóa câu hỏi này khỏi đề?')) return;
    await fetch(`/api/admin/exams/${editingId}/questions/${qid}`, { method: 'DELETE' });
    setQuestions((prev) => prev.filter((q) => q.id !== qid));
    fetchList();
  };

  const availableProblems = problems.filter(
    (p) => !questions.some((q) => q.problemId === p.id)
  );

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Đề thi</h1>
        <button type="button" className={styles.addIcon} onClick={openAdd} aria-label="Thêm đề thi" title="Thêm đề thi">+</button>
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
              <th>Mã đề</th>
              <th>Tên đề</th>
              <th>Số câu</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {paginatedList.map((exam) => (
              <tr key={exam.id}>
                <td>{exam.id}</td>
                <td>{exam.code}</td>
                <td>{exam.name}</td>
                <td>{(exam as ExamWithQuestions).questions?.length ?? 0}</td>
                <td>
                  <div className={styles.actions}>
                    <button type="button" className={styles.btnSecondary} onClick={() => openEdit(exam)}>Sửa</button>
                    <button type="button" className={styles.btnDanger} onClick={() => handleDelete(exam.id)}>Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.tableCards}>
        {paginatedList.map((exam) => (
          <div key={exam.id} className={styles.tableCard}>
            <div className={styles.tableCardRow}>
              <span className={styles.tableCardLabel}>ID</span>
              <span className={styles.tableCardValue}>{exam.id}</span>
            </div>
            <div className={styles.tableCardRow}>
              <span className={styles.tableCardLabel}>Mã đề</span>
              <span className={styles.tableCardValue}>{exam.code}</span>
            </div>
            <div className={styles.tableCardRow}>
              <span className={styles.tableCardLabel}>Tên đề</span>
              <span className={styles.tableCardValue}>{exam.name}</span>
            </div>
            <div className={styles.tableCardRow}>
              <span className={styles.tableCardLabel}>Số câu</span>
              <span className={styles.tableCardValue}>{(exam as ExamWithQuestions).questions?.length ?? 0}</span>
            </div>
            <div className={styles.tableCardActions}>
              <div className={styles.actions}>
                <button type="button" className={styles.btnSecondary} onClick={() => openEdit(exam)}>Sửa</button>
                <button type="button" className={styles.btnDanger} onClick={() => handleDelete(exam.id)}>Xóa</button>
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
          <div className={styles.dialogPanel} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className={styles.dialogHeader}>
              <h2 className={styles.dialogTitle}>{editingId ? 'Sửa đề thi' : 'Thêm đề thi'}</h2>
              <button type="button" className={styles.dialogClose} onClick={() => setOpen(false)} aria-label="Đóng">×</button>
            </div>
            <div className={styles.dialogBody}>
              <form onSubmit={handleSubmit}>
                {error && <p className={styles.error}>{error}</p>}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Mã đề thi</label>
                  <input className={styles.input} value={code} readOnly disabled style={{ opacity: 0.9, cursor: 'not-allowed' }} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Tên đề thi</label>
                  <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên đề thi" required />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Mô tả</label>
                  <textarea className={styles.textarea} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả ngắn" />
                </div>

                {editingId && (
                  <div className={styles.formGroup} style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #eee' }}>
                    <label className={styles.label}>Câu hỏi trong đề</label>
                    <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0' }}>
                      {questions.map((q, idx) => (
                        <li key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ flex: 1 }}>{idx + 1}. {q.problem?.title ?? `ID ${q.problemId}`} {q.points != null ? `(${q.points}đ)` : ''}</span>
                          <button type="button" className={styles.btnDanger} style={{ padding: '4px 8px' }} onClick={() => handleRemoveQuestion(q.id)}>Xóa</button>
                        </li>
                      ))}
                    </ul>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <select
                        className={styles.select}
                        value={addProblemId}
                        onChange={(e) => setAddProblemId(e.target.value ? Number(e.target.value) : '')}
                        style={{ minWidth: 180 }}
                      >
                        <option value="">-- Chọn câu hỏi --</option>
                        {availableProblems.map((p) => (
                          <option key={p.id} value={p.id}>{p.title} ({p.difficulty})</option>
                        ))}
                      </select>
                      <input type="number" className={styles.input} value={addPoints} onChange={(e) => setAddPoints(e.target.value)} placeholder="Điểm" style={{ width: 70 }} />
                      <button type="button" className={styles.btnSecondary} onClick={handleAddQuestion} disabled={addProblemId === ''}>Thêm câu</button>
                    </div>
                  </div>
                )}

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
