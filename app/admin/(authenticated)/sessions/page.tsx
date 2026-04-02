'use client';

import { useState, useEffect, useCallback } from 'react';
import formStyles from '../../styles/Form.module.css';
import tableStyles from '../../styles/Table.module.css';
import buttonStyles from '../../styles/Buttons.module.css';
import dialogStyles from '../../styles/Dialog.module.css';
import paginationStyles from '../../styles/Pagination.module.css';
import Pagination from '../../components/Pagination';
import type { Session, Exam, Class } from '../../types';
import { formatDateTime, toDatetimeLocal } from '../utils/dateUtils';
import { randomSessionCode } from '../utils/codeUtils';

const styles = { ...formStyles, ...tableStyles, ...buttonStyles, ...dialogStyles, ...paginationStyles };
const PAGE_SIZE = 10;

function sessionAlreadyStarted(s: { startAt: string }) {
  return new Date() >= new Date(s.startAt);
}

function normalizeProctoringSnapshotUrl(v: { snapshotUrl?: unknown; snapshot_url?: unknown }): string {
  const raw =
    typeof v.snapshotUrl === 'string'
      ? v.snapshotUrl
      : typeof v.snapshot_url === 'string'
        ? v.snapshot_url
        : '';
  const s = raw.trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return s;
}

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
  type DetailExaminee = {
    id: number;
    mssv: string;
    fullName: string | null;
    participated: boolean;
    submitted: boolean;
    submissionCount: number;
    violationCount: number;
  };
  type DetailSubmission = { id: number; problemId: number; problemTitle: string; problemSlug: string; score: number | null; submittedAt: string; code: string; language: string };
  type ProctoringViolationRow = {
    id: number;
    violationType: string;
    message: string | null;
    facesCount: number | null;
    snapshotUrl?: string | null;
    meta: unknown;
    createdAt: string;
    examId: number | null;
  };
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
  const [violationsOpen, setViolationsOpen] = useState(false);
  const [violationsLoading, setViolationsLoading] = useState(false);
  const [violationsRows, setViolationsRows] = useState<ProctoringViolationRow[]>([]);
  const [violationsTitle, setViolationsTitle] = useState<string>('');
  const [violationsMeta, setViolationsMeta] = useState<{ sessionCode: string; examLabel: string; mssv: string; fullName: string | null } | null>(null);

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
    setCode(randomSessionCode());
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
    if (new Date(endAt) <= new Date(startAt)) {
      setError('Thời gian kết thúc phải sau thời gian bắt đầu.');
      return;
    }
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
    setViolationsOpen(false);
    setViolationsRows([]);
    setViolationsTitle('');
    setViolationsMeta(null);
  };

  const openViolations = async (ex: DetailExaminee) => {
    if (!detailSessionId || !detailSelectedClass || !detailSession) return;
    setViolationsOpen(true);
    setViolationsLoading(true);
    setViolationsTitle(`Vi phạm giám sát — ${ex.mssv}`);
    setViolationsMeta({
      sessionCode: detailSession.code,
      examLabel: detailSession.exam ? `${detailSession.exam.name} (${detailSession.exam.code})` : '—',
      mssv: ex.mssv,
      fullName: ex.fullName,
    });
    try {
      const res = await fetch(
        `/api/admin/sessions/${detailSessionId}/proctoring-violations?examineeId=${ex.id}&classId=${detailSelectedClass.id}`
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const rows = Array.isArray(data.violations) ? data.violations : [];
        setViolationsRows(
          rows.map((row: unknown) => {
            const r = row as ProctoringViolationRow;
            const snap = normalizeProctoringSnapshotUrl(r) || null;
            return { ...r, snapshotUrl: snap };
          })
        );
      } else {
        setViolationsRows([]);
        const msg = typeof (data as { error?: string }).error === 'string' ? (data as { error: string }).error : 'Không tải được danh sách vi phạm';
        alert(msg);
      }
    } catch {
      setViolationsRows([]);
    } finally {
      setViolationsLoading(false);
    }
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
                    <button type="button" className={styles.btnSecondary} onClick={() => !sessionAlreadyStarted(s) && openEdit(s)} disabled={sessionAlreadyStarted(s)} title={sessionAlreadyStarted(s) ? 'Ca thi đã bắt đầu hoặc đã kết thúc, không thể sửa.' : undefined}>Sửa</button>
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
                <button type="button" className={styles.btnSecondary} onClick={() => !sessionAlreadyStarted(s) && openEdit(s)} disabled={sessionAlreadyStarted(s)} title={sessionAlreadyStarted(s) ? 'Ca thi đã bắt đầu hoặc đã kết thúc, không thể sửa.' : undefined}>Sửa</button>
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
                  <input className={styles.input} value={code} readOnly disabled style={{ opacity: 0.9, cursor: 'not-allowed' }} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Tên ca thi</label>
                  <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên ca thi" required />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Thời gian bắt đầu</label>
                  <input
                    type="datetime-local"
                    className={styles.input}
                    value={startAt}
                    min={editingId ? undefined : toDatetimeLocal(new Date())}
                    onChange={(e) => {
                      const v = e.target.value;
                      setStartAt(v);
                      if (endAt && v && new Date(endAt) <= new Date(v)) setEndAt('');
                    }}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Thời gian kết thúc</label>
                  <input
                    type="datetime-local"
                    className={styles.input}
                    value={endAt}
                    min={startAt || (editingId ? undefined : toDatetimeLocal(new Date()))}
                    onChange={(e) => setEndAt(e.target.value)}
                    required
                  />
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
                          <th>Đã nộp bài</th>
                          <th>Số vi phạm</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailExaminees.map((ex) => (
                          <tr key={ex.id}>
                            <td>{ex.mssv}</td>
                            <td>{ex.fullName ?? '—'}</td>
                            <td>{ex.participated ? 'Có' : '—'}</td>
                            <td>{ex.submitted ? 'Có' : '—'}</td>
                            <td>{ex.violationCount ?? 0}</td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                <button type="button" className={styles.btnSecondary} onClick={() => openExamineeSubmissions(ex)}>Xem bài nộp</button>
                                <button type="button" className={styles.btnSecondary} onClick={() => openViolations(ex)}>Chi tiết vi phạm</button>
                              </div>
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
            {violationsOpen && (
              <div className={styles.dialogBackdrop} style={{ zIndex: 1001 }} onClick={() => setViolationsOpen(false)}>
                <div className={styles.dialogPanel} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 920, width: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
                  <div className={styles.dialogHeader}>
                    <h3 className={styles.dialogTitle} style={{ fontSize: '1rem' }}>{violationsTitle}</h3>
                    <button type="button" className={styles.dialogClose} onClick={() => setViolationsOpen(false)} aria-label="Đóng">×</button>
                  </div>
                  <div className={styles.dialogBody} style={{ overflow: 'auto', flex: 1 }}>
                    {violationsMeta && (
                      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 0, lineHeight: 1.5 }}>
                        <strong>Ca thi:</strong> {violationsMeta.sessionCode}
                        {' · '}
                        <strong>Đề thi:</strong> {violationsMeta.examLabel}
                        <br />
                        <strong>Thí sinh:</strong> {violationsMeta.mssv} — {violationsMeta.fullName ?? '—'}
                      </p>
                    )}
                    {violationsLoading && <p style={{ marginTop: 8 }}>Đang tải...</p>}
                    {!violationsLoading && violationsRows.length === 0 && (
                      <p style={{ marginTop: 8, fontSize: '0.875rem', color: '#6b7280' }}>Chưa ghi nhận vi phạm giám sát.</p>
                    )}
                    {!violationsLoading && violationsRows.length > 0 && (
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {violationsRows.map((v) => {
                          const meta = v.meta && typeof v.meta === 'object' ? (v.meta as Record<string, unknown>) : null;
                          const metaFacesRaw = meta && Array.isArray(meta.faces) ? meta.faces : [];
                          const metaFaces = metaFacesRaw.filter((x): x is Record<string, unknown> => x != null && typeof x === 'object');
                          const enrolledSid =
                            meta && typeof meta.enrolled_student_id === 'string' ? meta.enrolled_student_id.trim() : '';
                          const snapshotSrc = normalizeProctoringSnapshotUrl(v);
                          return (
                            <div
                              key={v.id}
                              style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: 10,
                                overflow: 'hidden',
                                background: '#f9fafb',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  justifyContent: 'space-between',
                                  gap: 12,
                                  padding: '10px 12px',
                                  background: '#1f2937',
                                  color: '#fff',
                                }}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                    {v.violationType || '—'}
                                  </p>
                                  {(typeof v.facesCount === 'number' || enrolledSid) ? (
                                    <p style={{ margin: '6px 0 0', fontSize: '0.75rem', opacity: 0.9 }}>
                                      {[
                                        typeof v.facesCount === 'number' ? `Faces: ${v.facesCount}` : null,
                                        enrolledSid ? `MSSV đăng ký: ${enrolledSid}` : null,
                                      ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </p>
                                  ) : null}
                                </div>
                                <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.95, whiteSpace: 'nowrap' }}>
                                  {formatDateTime(v.createdAt)}
                                </p>
                              </div>
                              <div style={{ padding: 12 }}>
                                <div style={{ marginBottom: 12 }}>
                                  <p
                                    style={{
                                      margin: '0 0 8px',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      color: '#374151',
                                      letterSpacing: '0.04em',
                                      textTransform: 'uppercase',
                                    }}
                                  >
                                    Ảnh vi phạm (cloud)
                                  </p>
                                  {snapshotSrc ? (
                                    <>
                                      <a
                                        href={snapshotSrc}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ display: 'inline-block', fontSize: '0.75rem', color: '#2563eb', marginBottom: 8 }}
                                      >
                                        Mở ảnh đầy đủ ↗
                                      </a>
                                      <div
                                        style={{
                                          position: 'relative',
                                          width: '100%',
                                          maxHeight: 360,
                                          borderRadius: 8,
                                          overflow: 'hidden',
                                          border: '1px solid #e5e7eb',
                                          background: '#0f172a',
                                        }}
                                      >
                                        {/* img + no-referrer: một số cấu hình Cloudinary chặn hotlink theo Referer */}
                                        <img
                                          src={snapshotSrc}
                                          alt={`Vi phạm ${v.violationType || ''}`}
                                          referrerPolicy="no-referrer"
                                          style={{
                                            width: '100%',
                                            height: 'auto',
                                            maxHeight: 360,
                                            objectFit: 'contain',
                                            display: 'block',
                                          }}
                                        />
                                      </div>
                                    </>
                                  ) : (
                                    <p style={{ margin: 0, fontSize: '0.8125rem', color: '#9ca3af', lineHeight: 1.45 }}>
                                      Chưa có URL ảnh (kiểm tra upload Cloudinary khi ghi vi phạm, biến môi trường CLOUDINARY_* trên
                                      server).
                                    </p>
                                  )}
                                </div>
                                {v.message ? (
                                  <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.45, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
                                    {v.message}
                                  </p>
                                ) : (
                                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>—</p>
                                )}
                                {metaFaces.filter((f) => typeof f.id === 'string' && String(f.id).trim()).length > 0 && (
                                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e5e7eb' }}>
                                    <p style={{ margin: '0 0 6px', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
                                      Thí sinh đã định danh
                                    </p>
                                    {metaFaces
                                      .filter((f) => typeof f.id === 'string' && String(f.id).trim())
                                      .map((f, idx) => {
                                      const mssv = String(f.id).trim();
                                      const dir = typeof f.direction === 'string' ? f.direction : '—';
                                      const away = f.looking_away === true;
                                      const th = typeof f.theta === 'number' ? f.theta : null;
                                      const ph = typeof f.phi === 'number' ? f.phi : null;
                                      return (
                                        <div key={`${mssv}-${idx}`} style={{ marginBottom: 8 }}>
                                          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>
                                            MSSV: {mssv}
                                            {away ? ' — lệch' : ''}
                                          </p>
                                          <p style={{ margin: '2px 0 0', fontSize: '0.875rem', color: '#374151' }}>
                                            {dir}
                                            {(th != null || ph != null) && (
                                              <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                                                {' '}
                                                (θ={th != null ? th.toFixed(3) : '—'} rad, φ={ph != null ? ph.toFixed(3) : '—'} rad)
                                              </span>
                                            )}
                                          </p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
