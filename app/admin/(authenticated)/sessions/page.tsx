'use client';

import { useState, useEffect, useCallback } from 'react';
import formStyles from '../../styles/Form.module.css';
import tableStyles from '../../styles/Table.module.css';
import buttonStyles from '../../styles/Buttons.module.css';
import dialogStyles from '../../styles/Dialog.module.css';
import paginationStyles from '../../styles/Pagination.module.css';
import Pagination from '../../components/Pagination';
import type { Session, Exam, Class } from '../../types';
import { formatDateTime } from '../utils/dateUtils';

const styles = { ...formStyles, ...tableStyles, ...buttonStyles, ...dialogStyles, ...paginationStyles };
const PAGE_SIZE = 10;

export default function SessionsPage() {
  const [list, setList] = useState<Session[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [examId, setExamId] = useState<string>('');
  const [classIds, setClassIds] = useState<number[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  type DetailClass = { id: number; code: string; name: string; countParticipated: number; countSubmitted: number };
  type DetailExaminee = { id: number; mssv: string; fullName: string | null; participated: boolean; submitted: boolean; submissionCount: number };
  type DetailSubmission = { id: number; problemId: number; problemTitle: string; problemSlug: string; score: number | null; submittedAt: string; code: string; language: string };
  const [detailOpen, setDetailOpen] = useState(false);
  const [viewCodeSubmission, setViewCodeSubmission] = useState<DetailSubmission | null>(null);
  const [detailSessionId, setDetailSessionId] = useState<number | null>(null);
  const [detailSession, setDetailSession] = useState<{ id: number; code: string; name: string; startAt: string; endAt: string; exam?: { id: number; code: string; name: string } } | null>(null);
  const [detailClasses, setDetailClasses] = useState<DetailClass[]>([]);
  const [detailStep, setDetailStep] = useState<'classes' | 'examinees' | 'submissions'>('classes');
  const [detailSelectedClass, setDetailSelectedClass] = useState<DetailClass | null>(null);
  const [detailExaminees, setDetailExaminees] = useState<DetailExaminee[]>([]);
  const [detailSelectedExaminee, setDetailSelectedExaminee] = useState<DetailExaminee | null>(null);
  const [detailSubmissions, setDetailSubmissions] = useState<DetailSubmission[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchList = useCallback(async () => {
    const res = await fetch('/api/admin/sessions');
    if (res.ok) setList(await res.json());
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    const f = async () => {
      const [rExams, rClasses] = await Promise.all([
        fetch('/api/admin/exams'),
        fetch('/api/admin/classes'),
      ]);
      if (rExams.ok) setExams(await rExams.json());
      if (rClasses.ok) setClasses(await rClasses.json());
    };
    f();
  }, []);

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
    setStartAt('');
    setEndAt('');
    setExamId('');
    setClassIds([]);
    setError('');
    setOpen(false);
  };

  const openAdd = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (s: Session) => {
    setEditingId(s.id);
    setCode(s.code);
    setName(s.name);
    setStartAt(s.startAt.slice(0, 16));
    setEndAt(s.endAt.slice(0, 16));
    setExamId(s.examId != null ? String(s.examId) : '');
    setClassIds(s.classes?.map((c) => c.id) ?? []);
    setError('');
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body = { code: code.trim(), name: name.trim(), startAt, endAt, examId: examId || null, classIds };
      if (editingId) {
        const res = await fetch(`/api/admin/sessions/${editingId}`, {
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
        const res = await fetch('/api/admin/sessions', {
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
    if (!confirm('Bạn có chắc muốn xóa ca thi này?')) return;
    await fetch(`/api/admin/sessions/${id}`, { method: 'DELETE' });
    fetchList();
  };

  const openDetail = async (s: Session) => {
    setDetailSessionId(s.id);
    setDetailStep('classes');
    setDetailSelectedClass(null);
    setDetailExaminees([]);
    setDetailSelectedExaminee(null);
    setDetailSubmissions([]);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/sessions/${s.id}/detail`);
      if (res.ok) {
        const data = await res.json();
        setDetailSession(data.session);
        setDetailClasses(data.classes ?? []);
      } else {
        setDetailSession(null);
        setDetailClasses([]);
      }
    } catch {
      setDetailSession(null);
      setDetailClasses([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const openClassExaminees = async (cls: DetailClass) => {
    if (!detailSessionId) return;
    setDetailSelectedClass(cls);
    setDetailStep('examinees');
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/sessions/${detailSessionId}/examinees?classId=${cls.id}`);
      if (res.ok) {
        const data = await res.json();
        setDetailExaminees(data.examinees ?? []);
      } else {
        setDetailExaminees([]);
      }
    } catch {
      setDetailExaminees([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const openExamineeSubmissions = async (ex: DetailExaminee) => {
    if (!detailSessionId) return;
    setDetailSelectedExaminee(ex);
    setDetailStep('submissions');
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/sessions/${detailSessionId}/submissions?examineeId=${ex.id}`);
      if (res.ok) {
        const data = await res.json();
        setDetailSubmissions(data.submissions ?? []);
      } else {
        setDetailSubmissions([]);
      }
    } catch {
      setDetailSubmissions([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailSessionId(null);
    setDetailSession(null);
    setDetailClasses([]);
    setDetailStep('classes');
    setDetailSelectedClass(null);
    setDetailExaminees([]);
    setDetailSelectedExaminee(null);
    setDetailSubmissions([]);
    setViewCodeSubmission(null);
  };

  const backToClasses = () => {
    setDetailStep('classes');
    setDetailSelectedClass(null);
    setDetailExaminees([]);
    setDetailSelectedExaminee(null);
    setDetailSubmissions([]);
  };

  const backToExaminees = () => {
    setDetailStep('examinees');
    setDetailSelectedExaminee(null);
    setDetailSubmissions([]);
  };

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Ca thi</h1>
        <button type="button" className={styles.addIcon} onClick={openAdd} aria-label="Thêm ca thi" title="Thêm ca thi">+</button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Mã ca</th>
              <th>Tên</th>
              <th>Đề thi</th>
              <th>Bắt đầu</th>
              <th>Kết thúc</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {paginatedList.map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{s.code}</td>
                <td>{s.name}</td>
                <td>{s.exam ? `${s.exam.name} (${s.exam.code})` : '—'}</td>
                <td>{formatDateTime(s.startAt)}</td>
                <td>{formatDateTime(s.endAt)}</td>
                <td>
                  <div className={styles.actions}>
                    <button type="button" className={styles.btnSecondary} onClick={() => openDetail(s)}>Chi tiết</button>
                    <button type="button" className={styles.btnSecondary} onClick={() => openEdit(s)}>Sửa</button>
                    <button type="button" className={styles.btnDanger} onClick={() => handleDelete(s.id)}>Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.tableCards}>
        {paginatedList.map((s) => (
          <div key={s.id} className={styles.tableCard}>
            <div className={styles.tableCardRow}>
              <span className={styles.tableCardLabel}>ID</span>
              <span className={styles.tableCardValue}>{s.id}</span>
            </div>
            <div className={styles.tableCardRow}>
              <span className={styles.tableCardLabel}>Mã ca</span>
              <span className={styles.tableCardValue}>{s.code}</span>
            </div>
            <div className={styles.tableCardRow}>
              <span className={styles.tableCardLabel}>Tên</span>
              <span className={styles.tableCardValue}>{s.name}</span>
            </div>
            <div className={styles.tableCardRow}>
              <span className={styles.tableCardLabel}>Đề thi</span>
              <span className={styles.tableCardValue}>{s.exam ? `${s.exam.name} (${s.exam.code})` : '—'}</span>
            </div>
            <div className={styles.tableCardRow}>
              <span className={styles.tableCardLabel}>Bắt đầu</span>
              <span className={styles.tableCardValue}>{formatDateTime(s.startAt)}</span>
            </div>
            <div className={styles.tableCardRow}>
              <span className={styles.tableCardLabel}>Kết thúc</span>
              <span className={styles.tableCardValue}>{formatDateTime(s.endAt)}</span>
            </div>
            <div className={styles.tableCardActions}>
              <div className={styles.actions}>
                <button type="button" className={styles.btnSecondary} onClick={() => openDetail(s)}>Chi tiết</button>
                <button type="button" className={styles.btnSecondary} onClick={() => openEdit(s)}>Sửa</button>
                <button type="button" className={styles.btnDanger} onClick={() => handleDelete(s.id)}>Xóa</button>
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
          <div className={styles.dialogPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <h2 className={styles.dialogTitle}>{editingId ? 'Sửa ca thi' : 'Thêm ca thi'}</h2>
              <button type="button" className={styles.dialogClose} onClick={() => setOpen(false)} aria-label="Đóng">×</button>
            </div>
            <div className={styles.dialogBody}>
              <form onSubmit={handleSubmit}>
                {error && <p className={styles.error}>{error}</p>}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Mã ca thi</label>
                  <input className={styles.input} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Mã ca thi" required />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Tên ca thi</label>
                  <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên ca thi" required />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Thời gian bắt đầu</label>
                  <input type="datetime-local" className={styles.input} value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Thời gian kết thúc</label>
                  <input type="datetime-local" className={styles.input} value={endAt} onChange={(e) => setEndAt(e.target.value)} required />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Đề thi</label>
                  <select className={styles.select} value={examId} onChange={(e) => setExamId(e.target.value)}>
                    <option value="">Không chọn</option>
                    {exams.map((e) => (
                      <option key={e.id} value={e.id}>{e.name} ({e.code})</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Lớp thi (có thể chọn nhiều lớp)</label>
                  <div style={{ flexWrap: 'wrap', gap: 8, display: 'flex', marginTop: 4 }}>
                    {classes.map((c) => (
                      <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.875rem' }}>
                        <input
                          type="checkbox"
                          checked={classIds.includes(c.id)}
                          onChange={(e) => {
                            if (e.target.checked) setClassIds((prev) => [...prev, c.id]);
                            else setClassIds((prev) => prev.filter((id) => id !== c.id));
                          }}
                        />
                        {c.name} ({c.code})
                      </label>
                    ))}
                  </div>
                  {classes.length === 0 && <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 4 }}>Chưa có lớp nào. Vào mục Lớp để thêm.</p>}
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

      {detailOpen && (
        <div className={styles.dialogBackdrop} onClick={closeDetail}>
          <div className={styles.dialogPanel} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 960, width: '92vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className={styles.dialogHeader}>
              <h2 className={styles.dialogTitle}>
                {detailStep === 'classes' && 'Chi tiết ca thi'}
                {detailStep === 'examinees' && `Thí sinh — ${detailSelectedClass?.name ?? ''}`}
                {detailStep === 'submissions' && `Bài nộp — ${detailSelectedExaminee?.mssv ?? ''}`}
              </h2>
              <button type="button" className={styles.dialogClose} onClick={closeDetail} aria-label="Đóng">×</button>
            </div>
            <div className={`${styles.dialogBody} ${styles.dialogBodyScrollHidden}`} style={{ overflow: 'auto', flex: 1 }}>
              {detailLoading && <p style={{ margin: 0 }}>Đang tải...</p>}
              {!detailLoading && detailStep === 'classes' && detailSession && (
                <>
                  <p style={{ marginTop: 0, fontWeight: 600 }}>{detailSession.name}</p>
                  <p style={{ margin: '4px 0 12px', fontSize: '0.875rem', color: '#6b7280' }}>
                    {detailSession.exam ? `${detailSession.exam.name} (${detailSession.exam.code})` : '—'} · {formatDateTime(detailSession.startAt)} → {formatDateTime(detailSession.endAt)}
                  </p>
                  <p style={{ marginBottom: 8, fontSize: '0.875rem' }}><strong>Danh sách lớp</strong></p>
                  {detailClasses.length === 0 ? (
                    <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Ca thi chưa gán lớp.</p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {detailClasses.map((cls) => (
                        <li key={cls.id} style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                          <span><strong>{cls.name}</strong> ({cls.code})</span>
                          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                            {cls.countParticipated} tham gia · {cls.countSubmitted} đã nộp bài
                          </span>
                          <button type="button" className={styles.btnSecondary} onClick={() => openClassExaminees(cls)}>Xem thí sinh</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {!detailLoading && detailStep === 'examinees' && (
                <>
                  <button type="button" className={styles.btnSecondary} onClick={backToClasses} style={{ marginBottom: 12 }}>← Quay lại lớp</button>
                  {detailExaminees.length === 0 ? (
                    <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Lớp không có thí sinh.</p>
                  ) : (
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>MSSV</th>
                          <th>Họ tên</th>
                          <th>Tham gia thi</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailExaminees.map((ex) => (
                          <tr key={ex.id}>
                            <td>{ex.mssv}</td>
                            <td>{ex.fullName ?? '—'}</td>
                            <td>{ex.participated ? 'Có' : '—'}</td>
                            <td>
                              <button type="button" className={styles.btnSecondary} onClick={() => openExamineeSubmissions(ex)}>Xem bài nộp</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
              {!detailLoading && detailStep === 'submissions' && (
                <>
                  <button type="button" className={styles.btnSecondary} onClick={backToExaminees} style={{ marginBottom: 12 }}>← Quay lại thí sinh</button>
                  {detailSelectedExaminee && (
                    <p style={{ marginBottom: 12, fontSize: '0.875rem' }}>
                      <strong>{detailSelectedExaminee.mssv}</strong> — {detailSelectedExaminee.fullName ?? '—'}
                    </p>
                  )}
                  {detailSubmissions.length === 0 ? (
                    <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Chưa có bài nộp.</p>
                  ) : (
                    <>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Câu hỏi</th>
                            <th>Điểm</th>
                            <th>Ngôn ngữ</th>
                            <th>Nộp lúc</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailSubmissions.map((sub) => (
                            <tr key={sub.id}>
                              <td>{sub.problemTitle}</td>
                              <td>{sub.score != null ? `${sub.score}đ` : '—'}</td>
                              <td>{sub.language ?? '—'}</td>
                              <td>{formatDateTime(sub.submittedAt)}</td>
                              <td>
                                <button type="button" className={styles.btnSecondary} onClick={() => setViewCodeSubmission(sub)}>Xem code</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {viewCodeSubmission && (
                        <div className={styles.dialogBackdrop} style={{ zIndex: 1001 }} onClick={() => setViewCodeSubmission(null)}>
                          <div className={styles.dialogPanel} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                            <div className={styles.dialogHeader}>
                              <h3 className={styles.dialogTitle} style={{ fontSize: '1rem' }}>
                                Code — {viewCodeSubmission.problemTitle} {viewCodeSubmission.score != null ? `(${viewCodeSubmission.score}đ)` : ''}
                              </h3>
                              <button type="button" className={styles.dialogClose} onClick={() => setViewCodeSubmission(null)} aria-label="Đóng">×</button>
                            </div>
                            <div className={styles.dialogBody} style={{ overflow: 'auto', flex: 1, padding: 12 }}>
                              <pre style={{ margin: 0, padding: 12, background: '#f8fafc', color: '#334155', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.8125rem', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {viewCodeSubmission.code ?? ''}
                              </pre>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
