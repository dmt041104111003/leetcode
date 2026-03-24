'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import styles from '../styles/Login.module.css';

type AdminLoginFormProps = { initialSessionCode?: string };

export default function AdminLoginForm({ initialSessionCode }: AdminLoginFormProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const isAdminPage = pathname?.startsWith('/admin') ?? true;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [step, setStep] = useState<1 | 2>(1);
  const [mssv, setMssv] = useState('');
  const [fullName, setFullName] = useState('');
  const [sessionCode, setSessionCode] = useState(initialSessionCode ?? '');
  useEffect(() => {
    if (initialSessionCode) setSessionCode(initialSessionCode);
  }, [initialSessionCode]);
  useEffect(() => {
    if (step === 2 && initialSessionCode) setSessionCode(initialSessionCode);
  }, [step, initialSessionCode]);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Đăng nhập thất bại');
        return;
      }
      router.push('/admin/sessions');
    } catch {
      setError('Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  };

  const handleExamineeStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/examinee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mssv: mssv.trim(), fullName: fullName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Đăng nhập thất bại');
        return;
      }
      setStep(2);
      if (initialSessionCode) setSessionCode(initialSessionCode);
      setError('');
    } catch {
      setError('Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  };

  const handleExamineeStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/examinee/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionCode: sessionCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Mã ca thi không hợp lệ');
        return;
      }
      router.push('/examinee/exam');
      router.refresh();
    } catch {
      setError('Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  };

  if (isAdminPage) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">Đăng nhập</h1>
          <p className="text-center text-gray-600 text-sm mb-6">Quản trị</p>
          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <div>
              <label htmlFor="admin-username" className="block text-sm font-medium text-gray-700 mb-1">Tài khoản</label>
              <input
                id="admin-username"
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                placeholder="Nhập tài khoản"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${error ? 'border-red-500' : 'border-gray-300'}`}
                required
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="Nhập mật khẩu"
                  className={`w-full px-3 py-2 pr-20 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${error ? 'border-red-500' : 'border-gray-300'}`}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700 py-1 px-2"
                  tabIndex={-1}
                >
                  {showPassword ? 'Ẩn' : 'Hiện'}
                </button>
              </div>
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button type="submit" disabled={loading} className="w-full py-2 px-4 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50">
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className={styles.loginOverlay}>
      <div className={styles.loginBox}>
        <h1 className={styles.loginBoxHeading}>Đăng nhập thí sinh</h1>
        <p className={styles.loginBoxSubtitle}>{step === 1 ? 'Nhập mã sinh viên và họ tên' : 'Nhập mã ca thi'}</p>

        {step === 1 ? (
          <form className={styles.loginBoxForm} onSubmit={handleExamineeStep1}>
            <div className={styles.loginInputWrap}>
              <input
                className={`${styles.loginBoxInput} ${error ? styles.hasError : ''}`}
                type="text"
                value={mssv}
                onChange={(e) => { setMssv(e.target.value); setError(''); }}
                placeholder="Mã sinh viên"
                required
                aria-label="Mã sinh viên"
              />
              {mssv && (
                <button type="button" className={styles.loginInputClear} onClick={() => setMssv('')} aria-label="Xóa">×</button>
              )}
            </div>
            <div className={styles.loginInputWrap}>
              <input
                className={`${styles.loginBoxInput} ${error ? styles.hasError : ''}`}
                type="text"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); setError(''); }}
                placeholder="Họ tên"
                required
                aria-label="Họ tên"
              />
              {fullName && (
                <button type="button" className={styles.loginInputClear} onClick={() => setFullName('')} aria-label="Xóa">×</button>
              )}
            </div>
            {error && <p className={styles.loginBoxError}>{error}</p>}
            <button type="submit" className={styles.loginBoxButton} disabled={loading}>
              {loading ? 'Đang kiểm tra...' : 'Tiếp tục'}
            </button>
          </form>
        ) : (
          <form className={styles.loginBoxForm} onSubmit={handleExamineeStep2}>
            <div className={styles.loginInputWrap}>
              <input
                className={`${styles.loginBoxInput} ${error ? styles.hasError : ''}`}
                type="text"
                value={sessionCode}
                onChange={(e) => { setSessionCode(e.target.value); setError(''); }}
                placeholder="Mã ca thi"
                required
                aria-label="Mã ca thi"
              />
              {sessionCode && (
                <button type="button" className={styles.loginInputClear} onClick={() => setSessionCode('')} aria-label="Xóa">×</button>
              )}
            </div>
            {error && <p className={styles.loginBoxError}>{error}</p>}
            <button type="button" className={styles.loginBoxButton} style={{ marginBottom: 8 }} onClick={() => { setStep(1); setError(''); }} disabled={loading}>
              Quay lại
            </button>
            <button type="submit" className={styles.loginBoxButton} disabled={loading}>
              {loading ? 'Đang kiểm tra...' : 'Vào ca thi'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
