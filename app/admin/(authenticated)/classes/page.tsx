'use client';

import { useState, useEffect, useCallback } from 'react';
import formStyles from '../../styles/Form.module.css';
import tableStyles from '../../styles/Table.module.css';
import buttonStyles from '../../styles/Buttons.module.css';
import dialogStyles from '../../styles/Dialog.module.css';
import paginationStyles from '../../styles/Pagination.module.css';
import Pagination from '../../components/Pagination';
import type { Class, ClassExaminee, Examinee } from '../../types';

const styles = { ...formStyles, ...tableStyles, ...buttonStyles, ...dialogStyles, ...paginationStyles };
const PAGE_SIZE = 10;

export default function ClassesPage() {
  const [list, setList] = useState<(Class & { _count?: { examinees: number } })[]>([]);
  const [examinees, setExaminees] = useState<Examinee[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [classExaminees, setClassExaminees] = useState<(ClassExaminee & { examinee: Examinee })[]>([]);
  const [pendingExaminees, setPendingExaminees] = useState<Examinee[]>([]);
  const [selectedExamineeIds, setSelectedExamineeIds] = useState<number[]>([]);

  const fetchList = useCallback(async () => {
    const res = await fetch('/api/admin/classes');
    if (res.ok) setList(await res.json());
  }, []);

  const fetchExaminees = useCallback(async () => {
    const res = await fetch('/api/admin/examinees?availableForClass=1');
    if (res.ok) setExaminees(await res.json());
  }, []);

  useEffect(() => {
    fetchList();
    fetchExaminees();
  }, [fetchList, fetchExaminees]);

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
    setClassExaminees([]);
    setPendingExaminees([]);
    setSelectedExamineeIds([]);
    setError('');
    setOpen(false);
  };

  const openAdd = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = async (c: Class & { _count?: { examinees: number } }) => {
    setEditingId(c.id);
    setCode(c.code);
    setName(c.name);
    setSelectedExamineeIds([]);
    setError('');
    setOpen(true);
    const res = await fetch(`/api/admin/classes/${c.id}/examinees`);
    if (res.ok) setClassExaminees(await res.json());
    else setClassExaminees([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body = { code: code.trim(), name: name.trim() };
      if (editingId) {
        const res = await fetch(`/api/admin/classes/${editingId}`, {
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
        const res = await fetch('/api/admin/classes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Lỗi thêm mới');
          return;
        }
        const created = await res.json();
        for (const ex of pendingExaminees) {
          await fetch(`/api/admin/classes/${created.id}/examinees`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ examineeId: ex.id }),
          });
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
    if (!confirm('Bạn có chắc muốn xóa lớp này?')) return;
    setError('');
    const res = await fetch(`/api/admin/classes/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Không thể xóa lớp');
      return;
    }
    fetchList();
  };

  const handleAddExaminee = async (examineeId: number) => {
    if (editingId != null) {
      setError('');
      try {
        const res = await fetch(`/api/admin/classes/${editingId}/examinees`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ examineeId }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Không thêm được thí sinh');
          return;
        }
        const newRow = await res.json();
        setClassExaminees((prev) => [...prev, newRow]);
        setSelectedExamineeIds((prev) => prev.filter((id) => id !== examineeId));
        fetchList();
      } catch {
        setError('Lỗi kết nối');
      }
    } else {
      const ex = examinees.find((e) => e.id === examineeId);
      if (ex && !pendingExaminees.some((p) => p.id === ex.id)) {
        setPendingExaminees((prev) => [...prev, ex]);
        setSelectedExamineeIds((prev) => prev.filter((id) => id !== examineeId));
      }
    }
  };

  const toggleSelectedExaminee = (id: number) => {
    setSelectedExamineeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllAvailable = () => {
    setSelectedExamineeIds(availableExaminees.map((e) => e.id));
  };

  const clearSelectedExaminees = () => {
    setSelectedExamineeIds([]);
  };

  const handleAddSelectedExaminees = async () => {
    if (editingId != null) {
      for (const id of selectedExamineeIds) {
        await handleAddExaminee(id);
      }
    } else {
      const toAdd = examinees.filter((e) => selectedExamineeIds.includes(e.id) && !pendingExaminees.some((p) => p.id === e.id));
      setPendingExaminees((prev) => [...prev, ...toAdd]);
    }
    setSelectedExamineeIds([]);
  };

  const removePendingExaminee = (examineeId: number) => {
    setPendingExaminees((prev) => prev.filter((e) => e.id !== examineeId));
  };

  const handleRemoveExaminee = async (examineeId: number) => {
    if (editingId == null || !confirm('Xóa thí sinh này khỏi lớp?')) return;
    await fetch(`/api/admin/classes/${editingId}/examinees/${examineeId}`, { method: 'DELETE' });
    setClassExaminees((prev) => prev.filter((ce) => ce.examineeId !== examineeId));
    fetchList();
  };

  const availableExaminees = editingId
    ? examinees.filter((e) => !classExaminees.some((ce) => ce.examineeId === e.id))
    : examinees.filter((e) => !pendingExaminees.some((p) => p.id === e.id));

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Lớp</h1>
        <button type="button" className={styles.addIcon} onClick={openAdd} aria-label="Thêm lớp" title="Thêm lớp">+</button>
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
              <th>Mã lớp</th>
              <th>Tên</th>
              <th>Số thí sinh</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {paginatedList.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.code}</td>
                <td>{c.name}</td>
                <td>{c._count?.examinees ?? 0}</td>
                <td>
                  <div className={styles.actions}>
                    <button type="button" className={styles.btnSecondary} onClick={() => openEdit(c)}>Sửa</button>
                    <button type="button" className={styles.btnDanger} onClick={() => handleDelete(c.id)}>Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.tableCards}>
        {paginatedList.map((c) => (
          <div key={c.id} className={styles.tableCard}>
            <div className={styles.tableCardRow}>
              <span className={styles.tableCardLabel}>ID</span>
              <span className={styles.tableCardValue}>{c.id}</span>
            </div>
            <div className={styles.tableCardRow}>
              <span className={styles.tableCardLabel}>Mã lớp</span>
              <span className={styles.tableCardValue}>{c.code}</span>
            </div>
            <div className={styles.tableCardRow}>
              <span className={styles.tableCardLabel}>Tên</span>
              <span className={styles.tableCardValue}>{c.name}</span>
            </div>
            <div className={styles.tableCardRow}>
              <span className={styles.tableCardLabel}>Số thí sinh</span>
              <span className={styles.tableCardValue}>{c._count?.examinees ?? 0}</span>
            </div>
            <div className={styles.tableCardActions}>
              <div className={styles.actions}>
                <button type="button" className={styles.btnSecondary} onClick={() => openEdit(c)}>Sửa</button>
                <button type="button" className={styles.btnDanger} onClick={() => handleDelete(c.id)}>Xóa</button>
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
              <h2 className={styles.dialogTitle}>{editingId ? 'Sửa lớp' : 'Thêm lớp'}</h2>
              <button type="button" className={styles.dialogClose} onClick={() => setOpen(false)} aria-label="Đóng">×</button>
            </div>
            <div className={styles.dialogBody}>
              <form onSubmit={handleSubmit}>
                {error && <p className={styles.error}>{error}</p>}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Mã lớp</label>
                  <input className={styles.input} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Mã lớp" required />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Tên lớp</label>
                  <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên lớp" required />
                </div>

                <div className={styles.formGroup} style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #eee' }}>
                  <label className={styles.label}>
                    {editingId ? 'Thí sinh trong lớp' : 'Thí sinh thêm vào lớp'}
                  </label>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0' }}>
                    {editingId
                      ? classExaminees.map((ce) => (
                          <li key={ce.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ flex: 1 }}>{ce.examinee?.mssv} – {ce.examinee?.fullName ?? '—'}</span>
                            <button type="button" className={styles.btnDanger} style={{ padding: '4px 8px' }} onClick={() => handleRemoveExaminee(ce.examineeId)}>Xóa</button>
                          </li>
                        ))
                      : pendingExaminees.map((e) => (
                          <li key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ flex: 1 }}>{e.mssv} – {e.fullName ?? '—'}</span>
                            <button type="button" className={styles.btnDanger} style={{ padding: '4px 8px' }} onClick={() => removePendingExaminee(e.id)}>Xóa</button>
                          </li>
                        ))}
                  </ul>
                  <div style={{ marginTop: 8 }}>
                    <label className={styles.label} style={{ display: 'block', marginBottom: 6 }}>Chọn thí sinh để thêm</label>
                    <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: 13 }}>Chỉ hiển thị thí sinh chưa có lớp (mỗi thí sinh chỉ thuộc một lớp). Chọn tất cả = chọn toàn bộ danh sách bên dưới.</p>
                    {availableExaminees.length === 0 ? (
                      <p style={{ margin: 0, color: '#666', fontSize: 14 }}>Không còn thí sinh nào để thêm.</p>
                    ) : (
                      <>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                          <button type="button" className={styles.btnSecondary} style={{ fontSize: 13 }} onClick={selectAllAvailable}>
                            Chọn tất cả
                          </button>
                          <button type="button" className={styles.btnSecondary} style={{ fontSize: 13 }} onClick={clearSelectedExaminees}>
                            Bỏ chọn
                          </button>
                          <button
                            type="button"
                            className={styles.btnPrimary}
                            style={{ fontSize: 13 }}
                            onClick={handleAddSelectedExaminees}
                            disabled={selectedExamineeIds.length === 0}
                          >
                            {selectedExamineeIds.length > 0 ? `Thêm ${selectedExamineeIds.length} thí sinh đã chọn` : 'Thêm thí sinh đã chọn'}
                          </button>
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 200, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 6 }}>
                          {availableExaminees.map((e) => (
                            <li
                              key={e.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '8px 10px',
                                borderBottom: '1px solid #eee',
                                cursor: 'pointer',
                                background: selectedExamineeIds.includes(e.id) ? '#f0f7ff' : undefined,
                              }}
                              onClick={() => toggleSelectedExaminee(e.id)}
                            >
                              <input
                                type="checkbox"
                                checked={selectedExamineeIds.includes(e.id)}
                                onChange={() => toggleSelectedExaminee(e.id)}
                                onClick={(ev) => ev.stopPropagation()}
                              />
                              <span>{e.mssv} – {e.fullName ?? '—'}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
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
