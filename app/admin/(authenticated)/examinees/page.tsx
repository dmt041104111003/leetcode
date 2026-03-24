'use client';

import { useState, useEffect, useCallback } from 'react';
import formStyles from '../../styles/Form.module.css';
import tableStyles from '../../styles/Table.module.css';
import buttonStyles from '../../styles/Buttons.module.css';
import dialogStyles from '../../styles/Dialog.module.css';
import paginationStyles from '../../styles/Pagination.module.css';
import Pagination from '../../components/Pagination';
import type { Session, Examinee } from '../../types';

const styles = { ...formStyles, ...tableStyles, ...buttonStyles, ...dialogStyles, ...paginationStyles };
const PAGE_SIZE = 10;

export default function ExamineesPage() {
  const [list, setList] = useState<Examinee[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [mssv, setMssv] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSessionId, setFilterSessionId] = useState<number | ''>('');

  const fetchList = useCallback(async () => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (filterSessionId !== '') params.set('sessionId', String(filterSessionId));
    const res = await fetch(`/api/admin/examinees?${params}`);
    if (res.ok) setList(await res.json());
  }, [searchQuery, filterSessionId]);

  const fetchSessions = useCallback(async () => {
    const res = await fetch('/api/admin/sessions');
    if (res.ok) setSessions(await res.json());
  }, []);

  useEffect(() => {
    fetchList();
    fetchSessions();
  }, [fetchList, fetchSessions]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterSessionId]);

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const paginatedList = list.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const resetForm = () => {
    setEditingId(null);
    setMssv('');
    setFullName('');
    setError('');
    setOpen(false);
  };

  const openAdd = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (e: Examinee) => {
    setEditingId(e.id);
    setMssv(e.mssv);
    setFullName(e.fullName ?? '');
    setError('');
    setOpen(true);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body = { mssv: mssv.trim(), fullName: fullName.trim() || undefined };
      if (editingId) {
        const res = await fetch(`/api/admin/examinees/${editingId}`, {
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
        const res = await fetch('/api/admin/examinees', {
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
    if (!confirm('Bạn có chắc muốn xóa thí sinh này?')) return;
    setError('');
    const res = await fetch(`/api/admin/examinees/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Không thể xóa thí sinh');
      return;
    }
    fetchList();
  };

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Thí sinh</h1>
        <button type="button" className={styles.addIcon} onClick={openAdd} aria-label="Thêm thí sinh" title="Thêm thí sinh">+</button>
      </div>
      {error && (
        <p className={styles.error} style={{ marginTop: 0, marginBottom: 12 }}>
          {error}
          <button type="button" onClick={() => setError('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', textDecoration: 'underline' }} aria-label="Đóng">×</button>
        </p>
      )}

      <div style={{ marginBottom: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="search"
          placeholder="Tìm MSSV hoặc tên"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.input}
          style={{ flex: 2, minWidth: 0 }}
        />
        <select
          className={styles.select}
          value={filterSessionId}
          onChange={(e) => setFilterSessionId(e.target.value ? Number(e.target.value) : '')}
          style={{ flex: 1, minWidth: 0 }}
        >
          <option value="">Tất cả ca thi</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
          ))}
        </select>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>MSSV</th>
              <th>Họ tên</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {paginatedList.map((e) => (
              <tr key={e.id}>
                <td>{e.id}</td>
                <td>{e.mssv}</td>
                <td>{e.fullName ?? '—'}</td>
                <td>
                  <div className={styles.actions}>
                    <button type="button" className={styles.btnSecondary} onClick={() => openEdit(e)}>Sửa</button>
                    <button type="button" className={styles.btnDanger} onClick={() => handleDelete(e.id)}>Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.tableCards}>
        {paginatedList.map((e) => (
          <div key={e.id} className={styles.tableCard}>
            <div className={styles.tableCardRow}>
              <span className={styles.tableCardLabel}>ID</span>
              <span className={styles.tableCardValue}>{e.id}</span>
            </div>
            <div className={styles.tableCardRow}>
              <span className={styles.tableCardLabel}>MSSV</span>
              <span className={styles.tableCardValue}>{e.mssv}</span>
            </div>
            <div className={styles.tableCardRow}>
              <span className={styles.tableCardLabel}>Họ tên</span>
              <span className={styles.tableCardValue}>{e.fullName ?? '—'}</span>
            </div>
            <div className={styles.tableCardActions}>
              <div className={styles.actions}>
                <button type="button" className={styles.btnSecondary} onClick={() => openEdit(e)}>Sửa</button>
                <button type="button" className={styles.btnDanger} onClick={() => handleDelete(e.id)}>Xóa</button>
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
          <div className={styles.dialogPanel} onClick={(ev) => ev.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <h2 className={styles.dialogTitle}>{editingId ? 'Sửa thí sinh' : 'Thêm thí sinh'}</h2>
              <button type="button" className={styles.dialogClose} onClick={() => setOpen(false)} aria-label="Đóng">×</button>
            </div>
            <div className={styles.dialogBody}>
              <form onSubmit={handleSubmit}>
                {error && <p className={styles.error}>{error}</p>}
                <div className={styles.formGroup}>
                  <label className={styles.label}>MSSV</label>
                  <input className={styles.input} value={mssv} onChange={(e) => setMssv(e.target.value)} placeholder="Mã số sinh viên" required />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Họ tên</label>
                  <input className={styles.input} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Họ và tên" />
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
